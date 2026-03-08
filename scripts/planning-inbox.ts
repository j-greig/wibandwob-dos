import { execSync } from 'child_process';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';

const REPO_ROOT = resolve(join(import.meta.dir, '..'));
const EPICS_DIR = join(REPO_ROOT, '.planning', 'epics');
const TODOS_DIR = join(REPO_ROOT, '.pi', 'todos');

interface GitHubIssue {
  number: number;
  title: string;
  labels: { name: string }[];
  createdAt: string;
}

interface EpicMapping {
  [issueNumber: number]: { epicId: string; status: string };
}

// Parse EPIC_STATUS.md to get epic metadata
function parseEpicStatus(): EpicMapping {
  const mapping: EpicMapping = {};

  try {
    const dirNames = readdirSync(EPICS_DIR).filter(
      name => name.startsWith('e') && statSync(join(EPICS_DIR, name)).isDirectory()
    );

    dirNames.forEach(dir => {
      // Extract eNNN from directory name (e.g., "e001-codified-context-infrastructure" -> "e001")
      const epicId = dir.match(/^(e\d+)/)?.[1];
      if (!epicId) return;

      const briefPath = join(EPICS_DIR, dir, `${epicId}-brief.md`);
      try {
        const briefContent = readFileSync(briefPath, 'utf-8');
        // Parse YAML frontmatter
        const match = briefContent.match(/^---\n([\s\S]*?)\n---/);
        if (match) {
          const frontmatter = match[1];
          const issueMatch = frontmatter.match(/^issue:\s*(\d+)/m);
          const statusMatch = frontmatter.match(/^status:\s*(\S+)/m);
          if (issueMatch) {
            const issueNum = parseInt(issueMatch[1], 10);
            const status = statusMatch ? statusMatch[1] : 'unknown';
            mapping[issueNum] = { epicId, status };
          }
        }
      } catch {
        // brief file doesn't exist or can't be parsed
      }
    });
  } catch {
    // directory doesn't exist
  }

  return mapping;
}

// Fetch open GitHub issues
function fetchGitHubIssues(): GitHubIssue[] {
  try {
    const json = execSync(
      'gh issue list --json number,title,labels,createdAt --state open',
      { cwd: REPO_ROOT, encoding: 'utf-8' }
    );
    return JSON.parse(json);
  } catch (e) {
    console.error('Failed to fetch GitHub issues. Is gh CLI installed?');
    return [];
  }
}

// Read and parse .pi/todos
interface Todo {
  id: string;
  title: string;
  status: 'open' | 'closed' | 'other';
  createdAt: Date;
}

function readPiTodos(): Todo[] {
  const todos: Todo[] = [];
  try {
    const files = readdirSync(TODOS_DIR).filter(f => f.endsWith('.md'));
    files.forEach(file => {
      try {
        const content = readFileSync(join(TODOS_DIR, file), 'utf-8');
        let title = file;
        let status = 'open';
        let createdAt = new Date();

        // Try to parse JSON frontmatter
        const jsonMatch = content.match(/^(\{[\s\S]*?\})\n/);
        if (jsonMatch) {
          try {
            const json = JSON.parse(jsonMatch[1]);
            title = json.title || file;
            status = json.status || 'open';
            if (json.created_at) {
              createdAt = new Date(json.created_at);
            }
          } catch {
            // fallback to file parsing
          }
        }

        const id = file.replace('.md', '');

        todos.push({
          id,
          title,
          status: status === 'open' ? 'open' : 'closed',
          createdAt,
        });
      } catch {
        // ignore parse errors
      }
    });
  } catch {
    // directory doesn't exist
  }
  return todos;
}

// Calculate age in days
function ageDays(dateStr: string | Date): number {
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  const now = new Date();
  const ms = now.getTime() - date.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

// Format date
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// Main
function main() {
  const epicMapping = parseEpicStatus();
  const issues = fetchGitHubIssues();
  const todos = readPiTodos().filter(t => t.status === 'open');

  // Separate epic trackers from inbox issues
  const epicTrackers: (GitHubIssue & { epicId: string; status: string })[] = [];
  const inboxIssues: (GitHubIssue & { ageDays: number })[] = [];

  issues.forEach(issue => {
    const epic = epicMapping[issue.number];
    if (epic) {
      epicTrackers.push({ ...issue, ...epic });
    } else {
      inboxIssues.push({ ...issue, ageDays: ageDays(issue.createdAt) });
    }
  });

  // Sort by age (newest first for inbox, oldest first for todos)
  inboxIssues.sort((a, b) => b.ageDays - a.ageDays);
  todos.sort((a, b) => ageDays(a.createdAt) - ageDays(b.createdAt));

  // Generate report
  const now = new Date();
  console.log('=== PLANNING INBOX ===');
  console.log(`[${formatDate(now)}]\n`);

  if (inboxIssues.length > 0) {
    console.log(
      'GITHUB ISSUES (non-epic — must graduate or close this session)'
    );
    inboxIssues.forEach(issue => {
      const labels = issue.labels.map(l => l.name).join(', ');
      const labelStr = labels ? ` [${labels}]` : '';
      console.log(`  #${issue.number}  ${issue.title}${labelStr}  [${issue.ageDays}d]`);
    });
    console.log('  → suggest: promote to epic brief / close this session\n');
  }

  if (epicTrackers.length > 0) {
    console.log('EPIC TRACKERS (keep open)');
    epicTrackers.forEach(issue => {
      console.log(
        `  #${issue.number}  ${issue.epicId}  ${issue.title}  [${issue.status}]`
      );
    });
    console.log();
  }

  const staleTodos = todos.filter(t => ageDays(t.createdAt) > 2);
  if (todos.length > 0) {
    console.log('PI TODOS (open, session-scoped)');
    todos.forEach(todo => {
      const age = ageDays(todo.createdAt);
      const ageStr = age > 2 ? `[STALE: ${age}d]` : `[${age}d]`;
      console.log(`  TODO-${todo.id}  ${todo.title}  ${ageStr}`);
    });
    if (staleTodos.length > 0) {
      console.log(
        `  → ${staleTodos.length} stale: promote to .planning story / close\n`
      );
    } else {
      console.log();
    }
  }

  // Summary
  const actionCount = inboxIssues.length + staleTodos.length;
  console.log(
    `ACTION NEEDED: ${inboxIssues.length} inbox issues${staleTodos.length > 0 ? ` + ${staleTodos.length} stale todos` : ''}`
  );
}

main();
