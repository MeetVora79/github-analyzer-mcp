import {
  getRepoInfo,
  listOpenIssues,
  listPullRequests,
  getCommitStatus,
  getPullRequestDiff,
  listRecentCommits,
} from "./client.js";

describe("getRepoInfo", () => {
  it("returns formatted repo metadata", async () => {
    const fakeOctokit = {
      rest: {
        repos: {
          get: async () => ({
            data: {
              full_name: "octocat/hello-world",
              stargazers_count: 100,
              forks_count: 20,
              language: "JavaScript",
              open_issues_count: 5,
            },
          }),
        },
      },
    };

    const result = await getRepoInfo("octocat", "hello-world", fakeOctokit);
    expect(result.stars).toBe(100);
    expect(result.forks).toBe(20);
    expect(result.language).toBe("JavaScript");
    expect(result.fullName).toBe("octocat/hello-world");
  });
});

describe("listOpenIssues", () => {
  it("returns a list of open issues", async () => {
    const fakeOctokit = {
      rest: {
        issues: {
          listForRepo: async () => ({
            data: [
              {
                title: "Bug: login fails on mobile",
                user: { login: "octocat" },
                labels: [{ name: "bug" }],
                comments: 3,
              },
              {
                title: "Feature request: dark mode",
                user: { login: "hubot" },
                labels: [{ name: "enhancement" }],
                comments: 0,
              },
            ],
          }),
        },
      },
    };

    const result = await listOpenIssues(
      "octocat",
      "hello-world",
      10,
      fakeOctokit,
    );
    expect(result).toHaveLength(2);
    expect(result[0].title).toBe("Bug: login fails on mobile");
    expect(result[0].author).toBe("octocat");
    expect(result[1].author).toBe("hubot");
    expect(result[1].comments).toBe(0);
  });
});

describe("listPullRequests", () => {
  it("returns a list of pull requests", async () => {
    const fakeOctokit = {
      rest: {
        pulls: {
          list: async () => ({
            data: [
              {
                number: 42,
                title: "Add dark mode support",
                state: "open",
                draft: false,
                user: { login: "meet" },
                base: { ref: "main" },
                head: { ref: "feature/dark-mode" },
                created_at: "2026-01-01T00:00:00Z",
                updated_at: "2026-01-03T00:00:00Z",
                html_url: "https://github.com/octocat/hello-world/pull/42",
              },
              {
                number: 41,
                title: "Fix login redirect",
                state: "closed",
                draft: false,
                user: { login: "hubot" },
                base: { ref: "main" },
                head: { ref: "fix/login-redirect" },
                created_at: "2025-12-28T00:00:00Z",
                updated_at: "2025-12-30T00:00:00Z",
                html_url: "https://github.com/octocat/hello-world/pull/41",
              },
            ],
          }),
        },
      },
    };

    const result = await listPullRequests(
      "octocat",
      "hello-world",
      "open",
      10,
      fakeOctokit,
    );
    expect(result[0].title).toBe("Add dark mode support");
    expect(result[0].number).toBe(42);
    expect(result[0].author).toBe("meet");
    expect(result[0].draft).toBe(false);
    expect(result[0].headBranch).toBe("feature/dark-mode");
    expect(result[0].url).toBe(
      "https://github.com/octocat/hello-world/pull/42",
    );
  });
});

describe("getCommitStatus", () => {
  it("returns a commit status", async () => {
    const fakeOctokit = {
      rest: {
        repos: {
          getCombinedStatusForRef: async () => ({
            data: {
              sha: "231hbfdh1232323",
              state: "success",
              total_count: 10,
              statuses: [
                {
                  context: "build",
                  state: "pending",
                  description: "abcd",
                  targetUrl: "abcd",
                },
              ],
            },
          }),
        },
      },
    };

    const result = await getCommitStatus(
      "octocat",
      "hello-world",
      "231hbfdh1232323",
      fakeOctokit,
    );
    expect(result.ref).toBe("231hbfdh1232323");
    expect(result.overallState).toBe("success");
    expect(result.totalChecks).toBe(10);
    expect(result.statuses[0].context).toBe("build");
    expect(result.statuses[0].state).toBe("pending");
  });
});

describe("getPullRequestDiff", () => {
  it("returns the full diff when it's under the size limit", async () => {
    const shortDiff = "diff --git a/file.js b/file.js\n+console.log('hello');";
    const fakeOctokit = {
      rest: {
        pulls: {
          get: async () => ({
            data: shortDiff,
          }),
        },
      },
    };

    const result = await getPullRequestDiff(
      "octocat",
      "hello-world",
      42,
      fakeOctokit,
    );
    expect(result.pullNumber).toBe(42);
    expect(result.diff).toBe(shortDiff);
    expect(result.diff).not.toContain("truncated");
  });

  it("truncates the diff and appends a message when it exceeds the size limit", async () => {
    const longDiff = "x".repeat(9000); // 1000 chars over the 8000 default limit

    const fakeOctokit = {
      rest: {
        pulls: {
          get: async () => ({ data: longDiff }),
        },
      },
    };

    const result = await getPullRequestDiff(
      "octocat",
      "hello-world",
      42,
      fakeOctokit,
    );

    expect(result.diff.startsWith("x".repeat(8000))).toBe(true);
    expect(result.diff).toContain(
      "[diff truncated — 1000 more characters omitted]",
    );
  });
});

describe("listRecentCommits", () => {
  it("returns a list of recent commits", async () => {
    const fakeOctokit = {
      rest: {
        repos: {
          listCommits: async () => ({
            data: [
              {
                sha: "a1b2c3d4e5f6789",
                commit: {
                  message:
                    "Fix login bug\n\nThis addresses issue #42 by validating tokens properly.",
                  author: { name: "Meet Vora", date: "2026-01-05T10:00:00Z" },
                },
                author: { login: "meetvora79" },
                html_url:
                  "https://github.com/octocat/hello-world/commit/a1b2c3d4e5f6789",
              },
            ],
          }),
        },
      },
    };

    const result = await listRecentCommits(
      "octocat",
      "hello-world",
      "main",
      10,
      fakeOctokit,
    );
    expect(result).toHaveLength(1);
    expect(result[0].shortSha).toBe("a1b2c3d");
    expect(result[0].message).toBe("Fix login bug"); // multi-line body dropped, first line only
    expect(result[0].author).toBe("Meet Vora");
    expect(result[0].authorLogin).toBe("meetvora79");
  });

  it("handles commits with no linked GitHub account without throwing", async () => {
    const fakeOctokit = {
      rest: {
        repos: {
          listCommits: async () => ({
            data: [
              {
                sha: "f6e5d4c3b2a1000",
                commit: {
                  message: "Quick typo fix",
                  author: { name: "Someone", date: "2026-01-06T09:00:00Z" },
                },
                author: null, // not linked to a GitHub account
                html_url:
                  "https://github.com/octocat/hello-world/commit/f6e5d4c3b2a1000",
              },
            ],
          }),
        },
      },
    };

    const result = await listRecentCommits(
      "octocat",
      "hello-world",
      "main",
      10,
      fakeOctokit,
    );

    expect(result[0].authorLogin).toBeUndefined(); // optional chaining should prevent a crash
    expect(result[0].author).toBe("Someone"); // git author name is separate and still present
  });
});
