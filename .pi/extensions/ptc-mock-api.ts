/**
 * ptc-mock-api.ts — Mock API tools for PTC benchmarking
 *
 * Registers 3 tools that simulate real API endpoints returning large
 * structured data. These tools CANNOT be replicated via bash — they
 * are only accessible as pi tool calls. This is the scenario where
 * PTC provides genuine value.
 *
 * Only loads when PTC_BENCH_ID env var is set (bench runs only).
 *
 * The scenario: a team project tracker API.
 * - get_team_members(department) → 10-15 members with rich metadata
 * - get_task_history(member_id, sprint) → 30-50 tasks per member with
 *   extensive metadata (assignees, reviewers, timestamps, labels, etc.)
 * - get_capacity(member_id) → capacity and allocation data
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

// Only load during bench runs
const ACTIVE = !!process.env.PTC_BENCH_ID;

// ---------------------------------------------------------------------------
// Mock data generators
// ---------------------------------------------------------------------------

const DEPARTMENTS = {
  engineering: [
    { id: "ENG001", name: "Alice Chen", role: "Senior Engineer", level: "senior", email: "alice@example.com", team: "platform", location: "SF", timezone: "PST", manager: "MGR001", startDate: "2022-03-15", skills: ["TypeScript", "Rust", "Kubernetes"], certifications: ["AWS SA", "CKA"], lastReview: "2025-11", performanceRating: 4.2, projects: ["infra-v3", "migration-tool"] },
    { id: "ENG002", name: "Bob Martinez", role: "Staff Engineer", level: "staff", email: "bob@example.com", team: "platform", location: "NYC", timezone: "EST", manager: "MGR001", startDate: "2021-01-10", skills: ["Go", "Python", "Terraform"], certifications: ["GCP Pro"], lastReview: "2025-11", performanceRating: 4.5, projects: ["infra-v3", "observability"] },
    { id: "ENG003", name: "Carol White", role: "Engineer", level: "mid", email: "carol@example.com", team: "frontend", location: "London", timezone: "GMT", manager: "MGR002", startDate: "2023-06-01", skills: ["React", "TypeScript", "CSS"], certifications: [], lastReview: "2025-11", performanceRating: 3.8, projects: ["dashboard-v2", "design-system"] },
    { id: "ENG004", name: "David Kim", role: "Principal Engineer", level: "principal", email: "david@example.com", team: "architecture", location: "SF", timezone: "PST", manager: "MGR001", startDate: "2019-09-20", skills: ["System Design", "Rust", "C++"], certifications: ["AWS SA Pro"], lastReview: "2025-11", performanceRating: 4.8, projects: ["compiler-rewrite", "perf-initiative"] },
    { id: "ENG005", name: "Emma Johnson", role: "Junior Engineer", level: "junior", email: "emma@example.com", team: "frontend", location: "Remote", timezone: "CST", manager: "MGR002", startDate: "2025-01-15", skills: ["JavaScript", "React"], certifications: [], lastReview: null, performanceRating: null, projects: ["dashboard-v2"] },
    { id: "ENG006", name: "Frank Liu", role: "Senior Engineer", level: "senior", email: "frank@example.com", team: "backend", location: "SF", timezone: "PST", manager: "MGR003", startDate: "2022-08-01", skills: ["Java", "Kotlin", "PostgreSQL"], certifications: ["AWS DA"], lastReview: "2025-11", performanceRating: 4.0, projects: ["api-gateway", "auth-service"] },
    { id: "ENG007", name: "Grace Taylor", role: "Engineer", level: "mid", email: "grace@example.com", team: "backend", location: "Austin", timezone: "CST", manager: "MGR003", startDate: "2023-03-10", skills: ["Python", "Django", "Redis"], certifications: [], lastReview: "2025-11", performanceRating: 3.9, projects: ["api-gateway", "cache-layer"] },
    { id: "ENG008", name: "Henry Park", role: "Staff Engineer", level: "staff", email: "henry@example.com", team: "data", location: "NYC", timezone: "EST", manager: "MGR001", startDate: "2020-11-01", skills: ["Spark", "Python", "Airflow", "dbt"], certifications: ["Databricks"], lastReview: "2025-11", performanceRating: 4.3, projects: ["data-platform", "ml-pipeline"] },
    { id: "ENG009", name: "Iris Nakamura", role: "Senior Engineer", level: "senior", email: "iris@example.com", team: "mobile", location: "Tokyo", timezone: "JST", manager: "MGR002", startDate: "2021-07-15", skills: ["Swift", "Kotlin", "Flutter"], certifications: [], lastReview: "2025-11", performanceRating: 4.1, projects: ["mobile-app-v3", "push-service"] },
    { id: "ENG010", name: "Jake Wilson", role: "Engineer", level: "mid", email: "jake@example.com", team: "devops", location: "Remote", timezone: "MST", manager: "MGR003", startDate: "2024-02-01", skills: ["Terraform", "Ansible", "Docker"], certifications: ["CKA", "AWS SA"], lastReview: "2025-11", performanceRating: 3.7, projects: ["ci-cd-overhaul", "infra-v3"] },
  ],
  design: [
    { id: "DES001", name: "Karen Lee", role: "Design Lead", level: "senior", email: "karen@example.com", team: "product-design", location: "SF", timezone: "PST", manager: "MGR004", startDate: "2021-04-01", skills: ["Figma", "User Research", "Prototyping"], certifications: [], lastReview: "2025-11", performanceRating: 4.4, projects: ["dashboard-v2", "design-system", "mobile-app-v3"] },
    { id: "DES002", name: "Leo Fernandez", role: "Designer", level: "mid", email: "leo@example.com", team: "product-design", location: "Berlin", timezone: "CET", manager: "MGR004", startDate: "2023-09-15", skills: ["Figma", "Illustration", "Motion"], certifications: [], lastReview: "2025-11", performanceRating: 3.6, projects: ["marketing-site", "design-system"] },
  ],
};

const TASK_STATUSES = ["done", "done", "done", "done", "in-progress", "in-progress", "blocked", "review", "todo"];
const TASK_TYPES = ["feature", "bug", "chore", "spike", "doc"];
const PRIORITIES = ["P0", "P1", "P1", "P2", "P2", "P2", "P3", "P3"];

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function generateTasks(memberId: string, sprint: string): object[] {
  const seed = [...memberId, ...sprint].reduce((a, c) => a + c.charCodeAt(0), 0);
  const rand = seededRandom(seed);
  const count = 25 + Math.floor(rand() * 25); // 25-50 tasks

  return Array.from({ length: count }, (_, i) => {
    const r = rand;
    const status = TASK_STATUSES[Math.floor(r() * TASK_STATUSES.length)];
    const type = TASK_TYPES[Math.floor(r() * TASK_TYPES.length)];
    const priority = PRIORITIES[Math.floor(r() * PRIORITIES.length)];
    const storyPoints = [1, 2, 3, 5, 8][Math.floor(r() * 5)];
    const hoursLogged = status === "done" ? Math.round(storyPoints * (1.5 + r() * 3) * 10) / 10 : Math.round(storyPoints * r() * 2 * 10) / 10;

    return {
      taskId: `${memberId}-${sprint}-${String(i + 1).padStart(3, "0")}`,
      title: `${type}: ${["Implement", "Fix", "Refactor", "Add", "Update", "Remove", "Migrate", "Optimize"][Math.floor(r() * 8)]} ${["auth flow", "dashboard widget", "API endpoint", "cache layer", "test suite", "CI pipeline", "docs", "error handling", "logging", "metrics", "search index", "notification system", "webhook handler", "rate limiter"][Math.floor(r() * 14)]}`,
      type,
      status,
      priority,
      storyPoints,
      hoursLogged,
      assignee: memberId,
      reviewer: `ENG${String(Math.floor(r() * 10) + 1).padStart(3, "0")}`,
      createdDate: `2025-${sprint === "S1" ? "01" : sprint === "S2" ? "03" : sprint === "S3" ? "05" : "07"}-${String(Math.floor(r() * 28) + 1).padStart(2, "0")}`,
      updatedDate: `2025-${sprint === "S1" ? "02" : sprint === "S2" ? "04" : sprint === "S3" ? "06" : "08"}-${String(Math.floor(r() * 28) + 1).padStart(2, "0")}`,
      labels: [["frontend", "backend", "infra", "data", "mobile"][Math.floor(r() * 5)], r() > 0.5 ? "tech-debt" : "feature-work"],
      blockedBy: status === "blocked" ? [`${memberId}-${sprint}-${String(Math.floor(r() * i) + 1).padStart(3, "0")}`] : [],
      pullRequestUrl: status === "done" || status === "review" ? `https://github.com/org/repo/pull/${1000 + i}` : null,
      comments: Math.floor(r() * 15),
      attachments: Math.floor(r() * 3),
      sprint,
      epicId: `EPIC-${Math.floor(r() * 20) + 1}`,
      estimate: `${storyPoints}sp`,
      timeTracking: { estimated: storyPoints * 4, logged: hoursLogged, remaining: Math.max(0, storyPoints * 4 - hoursLogged) },
    };
  });
}

function generateCapacity(memberId: string): object {
  const seed = [...memberId].reduce((a, c) => a + c.charCodeAt(0), 0);
  const rand = seededRandom(seed);
  const totalHours = 160;
  const pto = Math.floor(rand() * 40);
  const meetings = Math.floor(20 + rand() * 30);
  const oncall = rand() > 0.7 ? 20 : 0;
  const available = totalHours - pto - meetings - oncall;
  const allocated = Math.floor(available * (0.7 + rand() * 0.3));

  return {
    memberId,
    sprint: "S3",
    totalHours,
    pto,
    meetingHours: meetings,
    oncallHours: oncall,
    availableHours: available,
    allocatedHours: allocated,
    utilizationPercent: Math.round((allocated / available) * 100),
    overloaded: allocated > available,
    currentProjects: Math.floor(1 + rand() * 4),
    maxRecommendedProjects: 3,
    notes: allocated > available ? "At risk — over-allocated this sprint" : pto > 20 ? "Extended PTO this sprint" : "Normal capacity",
  };
}

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

// Initialise the global PTC tool executor registry
if (!globalThis.__ptcToolExecutors) {
  (globalThis as any).__ptcToolExecutors = {};
}

export default function mockApi(pi: ExtensionAPI) {
  if (!ACTIVE) return;

  const PTC_ONLY_TOOLS = ["get_team_members", "get_task_history", "get_capacity"];

  pi.registerTool({
    name: "get_team_members",
    label: "Get Team Members",
    description: "Returns team members for a department with full profile data (role, skills, projects, performance). Departments: engineering, design.",
    parameters: Type.Object({
      department: Type.String({ description: "Department name: engineering or design" }),
    }),
    async execute(_id, params) {
      const dept = (params as { department: string }).department.toLowerCase();
      const members = (DEPARTMENTS as Record<string, object[]>)[dept];
      if (!members) {
        return { content: [{ type: "text", text: `Unknown department: ${dept}` }], isError: true };
      }
      return { content: [{ type: "text", text: JSON.stringify(members, null, 2) }] };
    },
  });

  pi.registerTool({
    name: "get_task_history",
    label: "Get Task History",
    description: "Returns all tasks for a team member in a given sprint. Each task has extensive metadata: status, priority, story points, hours logged, reviewer, labels, PR links, comments, time tracking. Returns 25-50 tasks per member. Sprints: S1, S2, S3, S4.",
    parameters: Type.Object({
      member_id: Type.String({ description: "Team member ID (e.g. ENG001)" }),
      sprint: Type.String({ description: "Sprint identifier: S1, S2, S3, or S4" }),
    }),
    async execute(_id, params) {
      const { member_id, sprint } = params as { member_id: string; sprint: string };
      const tasks = generateTasks(member_id, sprint);
      return { content: [{ type: "text", text: JSON.stringify(tasks, null, 2) }] };
    },
  });

  pi.registerTool({
    name: "get_capacity",
    label: "Get Member Capacity",
    description: "Returns capacity and allocation data for a team member in the current sprint. Includes PTO, meeting hours, on-call, utilization percentage, and overload warnings.",
    parameters: Type.Object({
      member_id: Type.String({ description: "Team member ID (e.g. ENG001)" }),
    }),
    async execute(_id, params) {
      const { member_id } = params as { member_id: string };
      const capacity = generateCapacity(member_id);
      return { content: [{ type: "text", text: JSON.stringify(capacity, null, 2) }] };
    },
  });

  // Store raw executors so ptc.ts can call them even when deactivated
  const reg = (globalThis as any).__ptcToolExecutors;
  reg["get_team_members"] = async (params: Record<string, unknown>) => {
    const dept = (params.department as string || "").toLowerCase();
    const members = (DEPARTMENTS as Record<string, object[]>)[dept];
    if (!members) throw new Error(`Unknown department: ${dept}`);
    return JSON.stringify(members, null, 2);
  };
  reg["get_task_history"] = async (params: Record<string, unknown>) => {
    const tasks = generateTasks(params.member_id as string, params.sprint as string);
    return JSON.stringify(tasks, null, 2);
  };
  reg["get_capacity"] = async (params: Record<string, unknown>) => {
    const capacity = generateCapacity(params.member_id as string);
    return JSON.stringify(capacity, null, 2);
  };

  // Hide PTC-only tools from the model's direct tool list.
  // They remain in getAllTools() (so execute_code can call them)
  // but are removed from getActiveTools() (so the model can't call them directly).
  if (process.env.PTC_ONLY) {
    pi.on("session_start", async () => {
      const active = pi.getActiveTools();
      const filtered = active.filter((name: string) => !PTC_ONLY_TOOLS.includes(name));
      pi.setActiveTools(filtered);
    });
  }
}
