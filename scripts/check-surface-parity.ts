import { join } from "node:path";
import { listAppCommands } from "../src/core/command-catalog.ts";

const repoRoot = join(import.meta.dir, "..");
const typesPath = join(repoRoot, "src/core/types.ts");
const snapshotRegistryPath = join(repoRoot, "src/core/snapshot-registry.ts");
const commandCatalogPath = join(repoRoot, "src/core/command-catalog.ts");

function uniqueSorted(values: Iterable<string>): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function parseQuotedUnionMembers(source: string, typeName: string): string[] {
  const match = source.match(new RegExp(`export\\s+type\\s+${typeName}\\s*=\\s*([\\s\\S]*?);`));
  if (!match) {
    throw new Error(`Could not find type ${typeName}`);
  }
  return uniqueSorted(match[1].match(/"([^"]+)"/g)?.map((value) => value.slice(1, -1)) ?? []);
}

function parseNamedObjectKeys(source: string, constName: string, terminator: string): string[] {
  const pattern = new RegExp(
    `export\\s+const\\s+${constName}\\s*=\\s*\\{([\\s\\S]*?)\\}\\s*${terminator.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`
  );
  const match = source.match(pattern);
  if (!match) {
    throw new Error(`Could not find const ${constName}`);
  }
  return uniqueSorted([...match[1].matchAll(/^\s*"([^"]+)"\s*:/gm)].map((entry) => entry[1]));
}

function parseInterfaceKeys(source: string, interfaceName: string): string[] {
  const match = source.match(new RegExp(`export\\s+interface\\s+${interfaceName}\\s*\\{([\\s\\S]*?)\\n\\}`));
  if (!match) {
    throw new Error(`Could not find interface ${interfaceName}`);
  }
  return uniqueSorted(
    [...match[1].matchAll(/^\s*([A-Za-z0-9_]+)\s*:/gm)].map((entry) => entry[1])
  );
}

function diff(left: string[], right: string[]): string[] {
  const rightSet = new Set(right);
  return left.filter((value) => !rightSet.has(value));
}

function printList(items: string[]): void {
  for (const item of items) {
    console.log(`  - ${item}`);
  }
}

async function main(): Promise<void> {
  const [typesSource, snapshotRegistrySource, commandCatalogSource] = await Promise.all([
    Bun.file(typesPath).text(),
    Bun.file(snapshotRegistryPath).text(),
    Bun.file(commandCatalogPath).text(),
  ]);

  const persistableAppTypes = parseQuotedUnionMembers(typesSource, "PersistableAppType");
  const snapshotRegistryKeys = parseNamedObjectKeys(
    snapshotRegistrySource,
    "snapshotRegistry",
    "satisfies Record<PersistableAppType, SnapshotHandler>"
  );
  const appMenuActionKeys = parseInterfaceKeys(commandCatalogSource, "AppMenuActions");
  const commands = listAppCommands();

  let failed = false;

  console.log("Check 1: PersistableAppType <-> snapshotRegistry");
  const missingSnapshotEntries = diff(persistableAppTypes, snapshotRegistryKeys);
  const extraSnapshotEntries = diff(snapshotRegistryKeys, persistableAppTypes);
  if (missingSnapshotEntries.length === 0 && extraSnapshotEntries.length === 0) {
    console.log("PASS");
  } else {
    failed = true;
    console.log("FAIL");
    if (missingSnapshotEntries.length > 0) {
      console.log("Missing snapshotRegistry entries:");
      printList(missingSnapshotEntries);
    }
    if (extraSnapshotEntries.length > 0) {
      console.log("Extra snapshotRegistry entries:");
      printList(extraSnapshotEntries);
    }
  }

  console.log("");
  console.log("Check 2: command actionKey -> AppMenuActions");
  const missingActionKeys = uniqueSorted(
    commands
      .map((command) => command.actionKey)
      .filter((actionKey) => !appMenuActionKeys.includes(actionKey))
  );
  if (missingActionKeys.length === 0) {
    console.log("PASS");
  } else {
    failed = true;
    console.log("FAIL");
    console.log("Command actionKeys missing from AppMenuActions:");
    printList(missingActionKeys);
  }

  console.log("");
  console.log("Check 3: agent-visible commands require descriptions");
  const missingAgentDescriptions = uniqueSorted(
    commands
      .filter((command) => command.agent)
      .filter((command) => command.description.trim().length === 0)
      .map((command) => command.id)
  );
  if (missingAgentDescriptions.length === 0) {
    console.log("PASS");
  } else {
    failed = true;
    console.log("FAIL");
    console.log("Agent-visible commands missing descriptions:");
    printList(missingAgentDescriptions);
  }

  process.exit(failed ? 1 : 0);
}

await main();
