import { jest } from "@jest/globals";

// Mock every client.js function BEFORE importing anything that uses it
const mockGetRepoInfo = jest.fn();
const mockListOpenIssues = jest.fn();
const mockListPullRequests = jest.fn();
const mockGetCommitStatus = jest.fn();
const mockGetPullRequestDiff = jest.fn();
const mockListRecentCommits = jest.fn();

jest.unstable_mockModule("../github/client.js", () => ({
  getRepoInfo: mockGetRepoInfo,
  listOpenIssues: mockListOpenIssues,
  listPullRequests: mockListPullRequests,
  getCommitStatus: mockGetCommitStatus,
  getPullRequestDiff: mockGetPullRequestDiff,
  listRecentCommits: mockListRecentCommits,
}));

// Dynamic imports AFTER the mock is registered
const { createMcpServer } = await import("./index.js");
const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
const { InMemoryTransport } =
  await import("@modelcontextprotocol/sdk/inMemory.js");

describe("MCP tools", () => {
  let client;

  beforeEach(async () => {
    jest.clearAllMocks();

    const server = createMcpServer();
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();

    client = new Client({ name: "test-client", version: "1.0.0" });

    await Promise.all([
      client.connect(clientTransport),
      server.connect(serverTransport),
    ]);
  });

  afterEach(async () => {
    await client.close();
  });

  it("get_repo_info returns the client data as JSON text", async () => {
    mockGetRepoInfo.mockResolvedValue({
      fullName: "octocat/hello-world",
      stars: 100,
    });

    const result = await client.callTool({
      name: "get_repo_info",
      arguments: { owner: "octocat", repo: "hello-world" },
    });

    expect(mockGetRepoInfo).toHaveBeenCalledWith("octocat", "hello-world");
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.stars).toBe(100);
  });

  it("get_repo_info returns isError: true when the underlying call throws", async () => {
    mockGetRepoInfo.mockRejectedValue(new Error("API rate limit exceeded"));

    const result = await client.callTool({
      name: "get_repo_info",
      arguments: { owner: "octocat", repo: "hello-world" },
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("API rate limit exceeded");
  });

  it("list_open_issues rejects a call missing the required 'repo' field", async () => {
    const result = await client.callTool({
      name: "list_open_issues",
      arguments: { owner: "octocat" }, // repo intentionally omitted
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Invalid arguments");
  });

  it("list_pull_requests passes state and limit through correctly", async () => {
    mockListPullRequests.mockResolvedValue([ 
      { number: 42, title: "Add dark mode" },
    ]);

    const result = await client.callTool({
      name: "list_pull_requests",
      arguments: {
        owner: "octocat",
        repo: "hello-world",
        state: "closed",
        limit: 5,
      },
    });

    expect(mockListPullRequests).toHaveBeenCalledWith(
      "octocat",
      "hello-world",
      "closed",
      5,
    );
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed[0].number).toBe(42);
  });

  it("get_commit_status passes the ref through correctly", async () => {
    mockGetCommitStatus.mockResolvedValue({ state: "success", checks: [] });

    const result = await client.callTool({
      name: "get_commit_status",
      arguments: { owner: "octocat", repo: "hello-world", ref: "main" },
    });

    expect(mockGetCommitStatus).toHaveBeenCalledWith(
      "octocat",
      "hello-world",
      "main",
    );
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.state).toBe("success");
  });

  it("get_pull_request_diff passes the pull number through correctly", async () => {
    mockGetPullRequestDiff.mockResolvedValue({
      pullNumber: 42,
      diff: "diff --git ...",
    });

    const result = await client.callTool({
      name: "get_pull_request_diff",
      arguments: { owner: "octocat", repo: "hello-world", pullNumber: 42 },
    });

    expect(mockGetPullRequestDiff).toHaveBeenCalledWith(
      "octocat",
      "hello-world",
      42,
    );
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.pullNumber).toBe(42);
  });

  it("list_recent_commits works when branch is omitted (optional field)", async () => {
    mockListRecentCommits.mockResolvedValue([
      { shortSha: "a1b2c3d", message: "Fix bug" },
    ]);

    const result = await client.callTool({
      name: "list_recent_commits",
      arguments: { owner: "octocat", repo: "hello-world" }, // branch intentionally omitted
    });

    expect(mockListRecentCommits).toHaveBeenCalledWith(
      "octocat",
      "hello-world",
      undefined,
      10,
    );
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed[0].shortSha).toBe("a1b2c3d");
  });
});
