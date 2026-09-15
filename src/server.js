import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { createMcpServer } from "./tools/index.js";

const TRANSPORT = process.env.MCP_TRANSPORT || "stdio";

async function runStdio() {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

async function runHttp() {
  const app = express();
  app.use(express.json());

  const TOOLS_INFO = [
    {
      name: "get_repo_info",
      description: "Get stars, forks, language, and other basic repo metadata",
    },
    {
      name: "list_open_issues",
      description: "List open issues for a repository",
    },
    {
      name: "list_pull_requests",
      description: "List pull requests, filterable by state",
    },
    {
      name: "get_commit_status",
      description: "Get CI/build status for a commit, branch, or tag",
    },
    {
      name: "get_pull_request_diff",
      description: "Get the code diff for a pull request",
    },
    {
      name: "list_recent_commits",
      description: "List recent commits on a branch",
    },
  ];

  app.get("/", (req, res) => {
    res.send(`<!DOCTYPE html>
<html>
<head>
  <title>GitHub Analyzer MCP Server</title>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, sans-serif; max-width: 640px; margin: 60px auto; padding: 0 20px; color: #1a1a1a; }
    h1 { font-size: 22px; }
    .status { display: inline-block; background: #16a34a; color: white; padding: 2px 10px; border-radius: 12px; font-size: 13px; }
    .endpoint { background: #f4f4f5; padding: 10px 14px; border-radius: 6px; font-family: monospace; font-size: 14px; margin: 16px 0; }
    ul { padding-left: 20px; }
    li { margin-bottom: 8px; }
    code { background: #f4f4f5; padding: 1px 5px; border-radius: 3px; }
  </style>
</head>
<body>
  <h1>🐙 GitHub Analyzer MCP Server <span class="status">running</span></h1>
  <p>This is a Model Context Protocol (MCP) server that exposes GitHub repository data as tools an AI assistant can call.</p>
  <p>MCP endpoint (for MCP clients only, not a browser):</p>
  <div class="endpoint">POST ${req.protocol}://${req.get("host")}/mcp</div>
  <p><strong>Available tools:</strong></p>
  <ul>
    ${TOOLS_INFO.map((t) => `<li><code>${t.name}</code> — ${t.description}</li>`).join("\n    ")}
  </ul>
  <p style="color:#666; font-size:13px;">Connect an MCP-compatible client (Claude, Cline, etc.) to the endpoint above using Streamable HTTP transport.</p>
</body>
</html>`);
  });

  app.post("/mcp", async (req, res) => {
    try {
      // Stateless mode: a brand-new server + transport per request.
      const server = createMcpServer();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });

      res.on("close", () => {
        transport.close();
        server.close();
      });

      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error("Error handling MCP request:", error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    }
  });

  // Streamable HTTP clients may also probe with GET/DELETE — reject cleanly
  // rather than letting Express 404 in a confusing way.
  app.get("/mcp", (req, res) => {
    res.status(405).send(`<!DOCTYPE html>
<html><body style="font-family: sans-serif; max-width: 500px; margin: 60px auto;">
<h2>405 — POST only</h2>
<p>This is an MCP Streamable HTTP endpoint. It only accepts POST requests from MCP clients using the Model Context Protocol — it's not meant to be visited directly in a browser.</p>
<p><a href="/">← Back to server info</a></p>
</body></html>`);
  });

  app.delete("/mcp", (req, res) => {
    res.status(405).json({
      error: "Method not allowed. This server is stateless (POST only).",
    });
  });

  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`MCP server (Streamable HTTP) listening on port ${port}`);
  });
}

async function main() {
  if (TRANSPORT === "http") {
    await runHttp();
  } else {
    await runStdio();
  }
}

main().catch((error) => {
  console.error("Fatal error starting server:", error);
  process.exit(1);
});
