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
    res.status(405).json({
      error: "Method not allowed. This server is stateless (POST only).",
    });
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