import { Octokit } from "octokit";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.GITHUB_TOKEN) {
  throw new Error("GITHUB_TOKEN is missing. Did you create a .env file?");
}

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

export default octokit;

export async function getRepoInfo(owner, repo, client = octokit) {
  const { data } = await client.rest.repos.get({ owner, repo });

  return {
    fullName: data.full_name,
    description: data.description,
    stars: data.stargazers_count,
    forks: data.forks_count,
    openIssues: data.open_issues_count,
    defaultBranch: data.default_branch,
    language: data.language,
    url: data.html_url,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function listOpenIssues(
  owner,
  repo,
  limit = 10,
  client = octokit,
) {
  const { data } = await client.rest.issues.listForRepo({
    owner,
    repo,
    state: "open",
    per_page: limit,
  });

  // GitHub's issues endpoint also returns PRs mixed in — filter them out
  const issuesOnly = data.filter((item) => !item.pull_request);

  return issuesOnly.map((issue) => ({
    number: issue.number,
    title: issue.title,
    author: issue.user?.login,
    labels: issue.labels.map((l) => (typeof l === "string" ? l : l.name)),
    comments: issue.comments,
    createdAt: issue.created_at,
    url: issue.html_url,
  }));
}

export async function listPullRequests(
  owner,
  repo,
  state = "open",
  limit = 10,
  client = octokit,
) {
  const { data } = await client.rest.pulls.list({
    owner,
    repo,
    state,
    per_page: limit,
  });

  return data.map((pr) => ({
    number: pr.number,
    title: pr.title,
    author: pr.user?.login,
    state: pr.state,
    draft: pr.draft,
    baseBranch: pr.base.ref,
    headBranch: pr.head.ref,
    createdAt: pr.created_at,
    updatedAt: pr.updated_at,
    url: pr.html_url,
  }));
}

export async function getCommitStatus(owner, repo, ref, client = octokit) {
  const { data } = await client.rest.repos.getCombinedStatusForRef({
    owner,
    repo,
    ref,
  });

  return {
    ref: data.sha,
    overallState: data.state, // "success" | "failure" | "pending" | "error"
    totalChecks: data.total_count,
    statuses: data.statuses.map((s) => ({
      context: s.context, // e.g. "ci/circleci: build"
      state: s.state,
      description: s.description,
      targetUrl: s.target_url,
    })),
  };
}

export async function getPullRequestDiff(
  owner,
  repo,
  pullNumber,
  client = octokit,
) {
  const { data } = await client.rest.pulls.get({
    owner,
    repo,
    pull_number: pullNumber,
    mediaType: {
      format: "diff",
    },
  });

  // When format is "diff", Octokit returns the raw diff as a string
  // in `data` instead of the usual JSON object.
  const diffText = data;

  return {
    pullNumber,
    diff: truncateDiff(diffText),
  };
}

function truncateDiff(diffText, maxChars = 8000) {
  if (diffText.length <= maxChars) {
    return diffText;
  }
  return (
    diffText.slice(0, maxChars) +
    `\n\n... [diff truncated — ${diffText.length - maxChars} more characters omitted]`
  );
}

export async function listRecentCommits(
  owner,
  repo,
  branch,
  limit = 10,
  client = octokit,
) {
  const { data } = await client.rest.repos.listCommits({
    owner,
    repo,
    sha: branch, // optional — branch name, tag, or SHA to start from
    per_page: limit,
  });

  return data.map((commit) => ({
    sha: commit.sha,
    shortSha: commit.sha.slice(0, 7),
    message: commit.commit.message.split("\n")[0], // first line only
    author: commit.commit.author?.name,
    authorLogin: commit.author?.login, // GitHub username, if linked
    date: commit.commit.author?.date,
    url: commit.html_url,
  }));
}
