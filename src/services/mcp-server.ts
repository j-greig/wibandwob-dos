/**
 * MCP Server — fastmcp adapter over control-api.
 *
 * Auto-generates MCP tools from `GET /openapi.json` at startup.
 * Wraps the existing HTTP control-api (port 8099), not replacing it.
 *
 * Transport: stdio (local/subprocess) + httpStream on port+10 (remote agents).
 */

import { FastMCP } from "fastmcp";
import { z } from "zod";

// ---------------------------------------------------------------------------
// OpenAPI → Zod schema conversion (naive, handles common cases)
// ---------------------------------------------------------------------------

type OpenApiSchema = {
  type?: string;
  properties?: Record<string, OpenApiSchema>;
  required?: string[];
  items?: OpenApiSchema;
  description?: string;
  enum?: unknown[];
};

function openApiSchemaToZod(schema: OpenApiSchema, propertyName?: string): z.ZodTypeAny {
  if (!schema) return z.unknown();

  switch (schema.type) {
    case "string":
      if (schema.enum && Array.isArray(schema.enum) && schema.enum.length > 0) {
        // z.enum requires a readonly tuple, cast carefully
        const values = schema.enum as string[];
        return z.enum(values as [string, ...string[]]).describe(schema.description ?? propertyName ?? "");
      }
      return z.string().describe(schema.description ?? propertyName ?? "");

    case "number":
    case "integer":
      return z.number().describe(schema.description ?? propertyName ?? "");

    case "boolean":
      return z.boolean().describe(schema.description ?? propertyName ?? "");

    case "array":
      if (schema.items) {
        return z.array(openApiSchemaToZod(schema.items, propertyName));
      }
      return z.array(z.unknown());

    case "object":
      if (schema.properties && Object.keys(schema.properties).length > 0) {
        const shape: Record<string, z.ZodTypeAny> = {};
        for (const [key, propSchema] of Object.entries(schema.properties)) {
          const required = schema.required?.includes(key) ?? false;
          const zodField = openApiSchemaToZod(propSchema, key);
          shape[key] = required ? zodField : zodField.optional();
        }
        return z.object(shape);
      }
      return z.record(z.string(), z.unknown());

    default:
      // Try to infer from properties
      if (schema.properties) {
        const shape: Record<string, z.ZodTypeAny> = {};
        for (const [key, propSchema] of Object.entries(schema.properties)) {
          const required = schema.required?.includes(key) ?? false;
          const zodField = openApiSchemaToZod(propSchema, key);
          shape[key] = required ? zodField : zodField.optional();
        }
        return z.object(shape);
      }
      return z.unknown();
  }
}

function deriveSchemaFromRequestBody(
  requestBody: { content?: { "application/json"?: { schema?: OpenApiSchema } } } | undefined,
): z.ZodObject<Record<string, z.ZodTypeAny>> | undefined {
  const schema = requestBody?.content?.["application/json"]?.schema;
  if (!schema) return undefined;

  const zodType = openApiSchemaToZod(schema);
  if (zodType instanceof z.ZodObject) {
    return zodType;
  }
  return z.object({});
}

// ---------------------------------------------------------------------------
// OpenAPI spec fetcher
// ---------------------------------------------------------------------------

interface OpenApiPath {
  get?: { summary?: string; parameters?: OpenApiParameter[] };
  post?: { summary?: string; requestBody?: { content?: { "application/json"?: { schema?: OpenApiSchema } } } };
}

interface OpenApiParameter {
  name: string;
  in: "query" | "path";
  required?: boolean;
  schema?: OpenApiSchema;
  description?: string;
}

interface OpenApiSpec {
  paths: Record<string, OpenApiPath>;
}

async function fetchOpenApiSpec(baseUrl: string): Promise<OpenApiSpec | null> {
  try {
    const response = await fetch(`${baseUrl}/openapi.json`);
    if (!response.ok) return null;
    return (await response.json()) as OpenApiSpec;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Tool name normalization
// ---------------------------------------------------------------------------

function normalizeToolName(path: string): string {
  return path
    .replace(/^\//, "")           // drop leading slash
    .replace(/\//g, "_")          // slashes → underscores
    .replace(/-/g, "_");           // hyphens → underscores
}

// ---------------------------------------------------------------------------
// MCP Server factory
// ---------------------------------------------------------------------------

export interface McpServerOptions {
  /** Base URL of the control-api (e.g. "http://127.0.0.1:8099") */
  apiBaseUrl: string;
  /** Port offset for httpStream transport (default: +10) */
  httpStreamPortOffset?: number;
  /** Whether to enable stdio transport (default: true) */
  enableStdio?: boolean;
  /** Whether to enable httpStream transport (default: true) */
  enableHttpStream?: boolean;
}

export function createMcpServer(options: McpServerOptions): FastMCP {
  const {
    apiBaseUrl,
    httpStreamPortOffset = 10,
    enableStdio = true,
    enableHttpStream = true,
  } = options;

  const server = new FastMCP({
    name: "WibWob-DOS",
    version: "1.0.0",
  });

  // ── Bootstrap tools from OpenAPI spec ───────────────────────────────────

  fetchOpenApiSpec(apiBaseUrl).then((spec) => {
    if (!spec) {
      console.error("[mcp-server] Failed to fetch OpenAPI spec from", apiBaseUrl);
      return;
    }

    for (const [path, pathOps] of Object.entries(spec.paths)) {
      const toolName = normalizeToolName(path);
      const summary = pathOps.get?.summary ?? pathOps.post?.summary ?? path;
      const description = `HTTP ${pathOps.get ? "GET" : "POST"} ${path} — ${summary}`;

      if (pathOps.get) {
        const params = pathOps.get.parameters ?? [];
        const queryShape: Record<string, z.ZodTypeAny> = {};

        for (const param of params) {
          if (param.in !== "query") continue;
          const paramSchema = param.schema ?? { type: "string" };
          const zodField = openApiSchemaToZod(paramSchema, param.name)
            .describe(param.description ?? param.name);
          queryShape[param.name] = param.required ? zodField : zodField.optional();
        }

        server.addTool({
          name: toolName,
          description,
          parameters: z.object(queryShape),
          execute: async (args) => {
            const url = new URL(`${apiBaseUrl}${path}`);
            for (const [key, value] of Object.entries(args)) {
              if (value !== undefined && value !== null) {
                url.searchParams.set(key, String(value));
              }
            }
            const response = await fetch(url.toString(), {
              method: "GET",
              headers: { "Content-Type": "application/json" },
            });
            const text = await response.text();
            return { content: [{ type: "text" as const, text }] };
          },
        });
      }

      if (pathOps.post) {
        const requestSchema = deriveSchemaFromRequestBody(pathOps.post.requestBody);
        const inputSchema = requestSchema ?? z.object({});

        server.addTool({
          name: toolName,
          description,
          parameters: inputSchema,
          execute: async (args) => {
            const response = await fetch(`${apiBaseUrl}${path}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(args),
            });
            const text = await response.text();
            return { content: [{ type: "text" as const, text }] };
          },
        });
      }
    }

    console.log(`[mcp-server] Loaded ${Object.keys(spec.paths).length} endpoints as MCP tools`);
  }).catch(console.error);

  // ── Transport startup (called by consumer after server is ready) ─────────

  return server;
}

// ---------------------------------------------------------------------------
// Convenience: run with transports
// ---------------------------------------------------------------------------

export async function runMcpServer(options: McpServerOptions): Promise<void> {
  const server = createMcpServer(options);

  // Wait briefly for tools to load
  await new Promise((resolve) => setTimeout(resolve, 500));

  if (options.enableStdio !== false) {
    await server.start({ transportType: "stdio" });
  }

  if (options.enableHttpStream !== false) {
    const port = parseInt(new URL(options.apiBaseUrl).port || "8099", 10);
    await server.start({
      transportType: "httpStream",
      httpStream: { port: port + (options.httpStreamPortOffset ?? 10) },
    });
  }

  // Keep process alive
  await new Promise(() => {});
}
