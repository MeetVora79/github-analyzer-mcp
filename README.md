# GitHub Analyzer MCP Server

[![CI](https://github.com/MeetVora79/github-analyzer-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/MeetVora79/github-analyzer-mcp/actions/workflows/ci.yml)

MCP (Model Context Protocol) server that exposes GitHub repository data as tools an AI assistant can call — repo info, issues, pull requests, commit statuses, PR diffs, and recent commits.

Works with any MCP-compatible client (Claude Desktop, Cline, Claude.ai, etc.) both **locally** (stdio) and as a **deployed remote server** (Streamable HTTP).

**Live server:** `https://github-analyzer-mcp-keih.onrender.com`
**MCP endpoint:** `https://github-analyzer-mcp-keih.onrender.com/mcp`

## What is MCP?

The Model Context Protocol is a standard way for AI applications to discover and call external tools. Instead of writing a custom integration for every AI app, you write one MCP server, and any compatible client can connect to it. This server exposes six read-only tools backed by GitHub's REST API via [Octokit](https://github.com/octokit/octokit.js).

## Tools

| Tool | Description |
|---|---|
| `get_repo_info` | Basic repo metadata — stars, forks, language, open issue count, description |
| `list_open_issues` | Open issues for a repo (title, author, labels, comment count) |
| `list_pull_requests` | Pull requests, filterable by state (`open` / `closed` / `all`) |
| `get_commit_status` | Combined CI/build status for a commit SHA, branch, or tag |
| `get_pull_request_diff` | Code diff for a specific PR (truncated if very large) |
| `list_recent_commits` | Recent commits on a branch |

## Tech stack

- **Node.js** + **[@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk)** — MCP server implementation
- **[Octokit](https://github.com/octokit/octokit.js)** — GitHub API client
- **[Zod](https://zod.dev)** — input schema validation for tools
- **Express** — HTTP layer for Streamable HTTP (remote) transport
- **[Jest](https://jestjs.io)** — unit testing
- **[Docker](https://www.docker.com)** — containerized local/deployable runtime
- **GitHub Actions** — CI (tests + Docker build verified on every push)
- **[Render](https://render.com)** — deployment

## Project structure

```
github-analyzer-mcp/
├── .github/
│   └── workflows/
│       └── ci.yml            # GitHub Actions — runs tests + Docker build on every push
├── src/
│   ├── github/
│   │   └── client.js       # Octokit setup + GitHub wrapper functions (MCP-agnostic)
│   │   └── client.test.js    # Unit tests for client.js (mocked Octokit, no live API calls)
│   ├── tools/
│   │   └── index.js        # createMcpServer() — registers all tools with schemas
│   │   └── index.test.js     # Integration tests — real MCP Client/Server over an in-memory transport
│   └── server.js            # Entry point — picks stdio or HTTP transport
├── Dockerfile                  # Container build (HTTP mode)
├── .dockerignore                # Excludes node_modules, .env, tests from the image
├── .env                      # GITHUB_TOKEN (not committed)
├── .gitignore
└── package.json
```

`github/client.js` contains plain async functions with no MCP dependency — they can be tested or reused independently of the MCP layer. Each function accepts an optional Octokit client parameter (dependency injection), so tests can pass in a fake client instead of hitting the real GitHub API. `tools/index.js` wraps those functions with MCP tool schemas and descriptions. `server.js` wires everything to a transport.

## Setup

### 1. Clone and install

```bash
git clone https://github.com/meetvora79/github-analyzer-mcp.git
cd github-analyzer-mcp
npm install
```

### 2. Create a GitHub Personal Access Token

1. GitHub → **Settings** → **Developer settings** → **Personal access tokens** → **Fine-grained tokens**
2. **Generate new token**, scope it to specific repos, and grant these permissions (read-only):
   - **Contents**
   - **Issues**
   - **Pull requests**
   - **Commit statuses**
   - **Metadata** (usually auto-selected)

### 3. Configure environment variables

Create a `.env` file in the project root:

```
GITHUB_TOKEN=github_pat_xxxxxxxxxxxxxxxxxxxxxx
```

## Running locally

**stdio mode** (default — for local MCP clients like Cline or Claude Desktop, which spawn the server as a subprocess):

```bash
node src/server.js
```

**HTTP mode** (Streamable HTTP — for testing the remote-capable version locally):

```bash
# macOS/Linux
MCP_TRANSPORT=http node src/server.js

# Windows PowerShell
$env:MCP_TRANSPORT="http"; node src/server.js
```

Server listens on `http://localhost:3000`, with the MCP endpoint at `http://localhost:3000/mcp`.

### Debugging with MCP Inspector

```bash
npx @modelcontextprotocol/inspector node src/server.js
```

Opens a local web UI to list and manually call tools without needing a full AI client — useful for verifying a tool works before wiring up a client.

## Testing
 
```bash
npm test
```
 
Runs the full Jest suite:
 
- **`src/github/client.test.js`** — unit tests for every GitHub-wrapper function (`getRepoInfo`, `listOpenIssues`, `listPullRequests`, `getCommitStatus`, `getPullRequestDiff`, `listRecentCommits`). Each function is tested against a fake Octokit client passed via dependency injection, so tests run instantly with no live GitHub API calls and no rate-limit risk.
- **`src/tools/index.test.js`** — integration tests that spin up a real `McpServer` and a real MCP `Client` connected over an in-memory transport, then call each registered tool exactly as a real MCP client would. Covers the success path, error handling (`isError: true` on a thrown exception), and Zod input-validation rejections for missing/invalid arguments.
Because this project uses ES Modules (`"type": "module"`), Jest runs with Node's experimental VM modules flag — see the `test` script in `package.json` if you're curious how that's wired up.
 
## Docker
 
The server can run in a container, using the same HTTP transport as the Render deployment.
 
**Build the image:**
 
```bash
docker build -t github-analyzer-mcp .
```
 
**Run it**, passing your token in at runtime (never baked into the image — `.env` is excluded via `.dockerignore`):
 
```bash
docker run -p 3000:3000 --env-file .env github-analyzer-mcp
```
 
The MCP endpoint is then available at `http://localhost:3000/mcp`.
 
> Anyone who pulls this image gets a working server with **no GitHub access** until they supply their own token via `-e GITHUB_TOKEN=...` or `--env-file`. Pulling the image never grants access to the maintainer's repos or token — each user brings their own.

## Connecting a client

### Cline (VS Code extension)

Open Cline's MCP settings (**MCP Servers** icon → **Configure** → **Configure MCP Servers**) and add:

```json
{
  "mcpServers": {
    "github-analyzer": {
      "command": "node",
      "args": ["/absolute/path/to/github-analyzer-mcp/src/server.js"],
      "env": { "GITHUB_TOKEN": "github_pat_xxxxxxxxxxxxxxxxxxxxxx" },
      "disabled": false,
      "autoApprove": []
    },
    "github-analyzer-remote": {
      "url": "https://github-analyzer-mcp-keih.onrender.com/mcp",
      "type": "streamableHttp",
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

### Claude Desktop

Edit `claude_desktop_config.json` (macOS: `~/Library/Application Support/Claude/`, Windows: `%APPDATA%\Claude\`):

```json
{
  "mcpServers": {
    "github-analyzer": {
      "command": "node",
      "args": ["/absolute/path/to/github-analyzer-mcp/src/server.js"],
      "env": { "GITHUB_TOKEN": "github_pat_xxxxxxxxxxxxxxxxxxxxxx" }
    }
  }
}
```

Fully restart the client after editing its config — MCP servers are only loaded on startup.

## Deployment (Render)

1. Push this repo to GitHub.
2. Render dashboard → **New** → **Web Service** → connect the repo.
3. Settings:
   - **Build command:** `npm install`
   - **Start command:** `node src/server.js`
4. Environment variables:
   - `GITHUB_TOKEN` — your token
   - `MCP_TRANSPORT` — `http`
5. Deploy. Your MCP endpoint will be `https://<your-service>.onrender.com/mcp`.

> Free-tier Render instances spin down after inactivity — the first request after idle time may take 30–60 seconds while the instance wakes up.

## Continuous Integration
 
Every push and pull request to `main` triggers a GitHub Actions workflow (`.github/workflows/ci.yml`) with two jobs, run in parallel:
 
- **`test`** — installs dependencies and runs the full Jest suite (see [Testing](#testing) above).
- **`docker-build`** — runs `docker build` against the `Dockerfile` to confirm the image still builds cleanly, catching a broken Dockerfile before it reaches a real deploy.
Both must pass for the workflow to go green. See the badge at the top of this README, or the [Actions tab](https://github.com/MeetVora79/github-analyzer-mcp/actions) for run history.

## Transport notes

- **stdio** — client spawns the server as a local subprocess, communicates over stdin/stdout. No networking; can't be used remotely.
- **Streamable HTTP** — server runs as a persistent HTTP service; clients connect over a URL. This server runs in **stateless mode** (a fresh server + transport instance per request) since all tools are independent, read-only lookups with no need for session memory.

## Security notes

- The GitHub token lives server-side only — clients never see it directly.
- This deployment has no auth on the `/mcp` endpoint; anyone with the URL can call it against your token's quota. Fine for a learning project, but add authentication before using this with a real/high-limit token.
- Large payloads (e.g. PR diffs) are truncated to avoid flooding a model's context window.

## Author

Meet Vora

- Email: meetvora877@gmail.com
- LinkedIn: https://linkedin.com/in/meetvora79