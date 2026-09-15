import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  getRepoInfo,
  listOpenIssues,
  listPullRequests,
  getCommitStatus,
  getPullRequestDiff,
  listRecentCommits,
} from "../github/client.js";

export function createMcpServer() {
  const server = new McpServer({
    name: "github-analyzer-mcp",
    version: "1.0.0",
  });

  server.registerTool(
    "get_repo_info",
    {
      title: "Get Repository Info",
      description:
        "Get basic information about a GitHub repository, including stars, forks, " +
        "open issue count, primary language, and description.",
      inputSchema: {
        owner: z
          .string()
          .describe("The GitHub username or org that owns the repo"),
        repo: z.string().describe("The repository name"),
      },
    },
    async ({ owner, repo }) => {
      try {
        const info = await getRepoInfo(owner, repo);
        return {
          content: [{ type: "text", text: JSON.stringify(info, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error fetching repo info: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    "list_open_issues",
    {
      title: "List Open Issues",
      description:
        "List open issues (not pull requests) for a GitHub repository, including " +
        "title, author, labels, and comment count. Use this to see what bugs or " +
        "feature requests are currently outstanding.",
      inputSchema: {
        owner: z
          .string()
          .describe("The GitHub username or org that owns the repo"),
        repo: z.string().describe("The repository name"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .default(10)
          .describe("Max number of issues to return (default 10)"),
      },
    },
    async ({ owner, repo, limit }) => {
      try {
        const issues = await listOpenIssues(owner, repo, limit);
        return {
          content: [{ type: "text", text: JSON.stringify(issues, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            { type: "text", text: `Error fetching issues: ${error.message}` },
          ],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    "list_pull_requests",
    {
      title: "List Pull Requests",
      description:
        "List pull requests for a GitHub repository, filterable by state (open, " +
        "closed, or all). Returns title, author, branches, and draft status. Use " +
        "this to see what's being worked on or what recently merged/closed.",
      inputSchema: {
        owner: z
          .string()
          .describe("The GitHub username or org that owns the repo"),
        repo: z.string().describe("The repository name"),
        state: z
          .enum(["open", "closed", "all"])
          .default("open")
          .describe("Filter PRs by state"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .default(10)
          .describe("Max number of PRs to return (default 10)"),
      },
    },
    async ({ owner, repo, state, limit }) => {
      try {
        const prs = await listPullRequests(owner, repo, state, limit);
        return {
          content: [{ type: "text", text: JSON.stringify(prs, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error fetching pull requests: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    "get_commit_status",
    {
      title: "Get Commit Status",
      description:
        "Get the combined CI/build status for a specific commit, branch, or tag " +
        "(e.g. 'main', a commit SHA). Returns overall state (success/failure/pending) " +
        "plus individual check results. Use this to check if a build passed.",
      inputSchema: {
        owner: z
          .string()
          .describe("The GitHub username or org that owns the repo"),
        repo: z.string().describe("The repository name"),
        ref: z
          .string()
          .describe("A commit SHA, branch name, or tag, e.g. 'main'"),
      },
    },
    async ({ owner, repo, ref }) => {
      try {
        const status = await getCommitStatus(owner, repo, ref);
        return {
          content: [{ type: "text", text: JSON.stringify(status, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error fetching commit status: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    "get_pull_request_diff",
    {
      title: "Get Pull Request Diff",
      description:
        "Get the code diff for a specific pull request by number, truncated if very " +
        "large. Use this when you need to see the actual code changes, not just PR " +
        "metadata — for example, to review or summarize what a PR changes.",
      inputSchema: {
        owner: z
          .string()
          .describe("The GitHub username or org that owns the repo"),
        repo: z.string().describe("The repository name"),
        pullNumber: z.number().int().describe("The pull request number"),
      },
    },
    async ({ owner, repo, pullNumber }) => {
      try {
        const diff = await getPullRequestDiff(owner, repo, pullNumber);
        return {
          content: [{ type: "text", text: JSON.stringify(diff, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            { type: "text", text: `Error fetching PR diff: ${error.message}` },
          ],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    "list_recent_commits",
    {
      title: "List Recent Commits",
      description:
        "List the most recent commits on a branch, with message, author, and date. " +
        "Use this to see recent activity or find a commit SHA to use with other tools.",
      inputSchema: {
        owner: z
          .string()
          .describe("The GitHub username or org that owns the repo"),
        repo: z.string().describe("The repository name"),
        branch: z
          .string()
          .optional()
          .describe("Branch name (defaults to the repo's default branch)"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .default(10)
          .describe("Max number of commits to return (default 10)"),
      },
    },
    async ({ owner, repo, branch, limit }) => {
      try {
        const commits = await listRecentCommits(owner, repo, branch, limit);
        return {
          content: [{ type: "text", text: JSON.stringify(commits, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            { type: "text", text: `Error fetching commits: ${error.message}` },
          ],
          isError: true,
        };
      }
    },
  );

  return server;
}
