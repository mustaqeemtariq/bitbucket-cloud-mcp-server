#!/usr/bin/env node
import "dotenv/config";
import { z } from "zod";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import {
  listRepositories,
  listPullRequests,
  getPullRequest,
  createPullRequest,
  updatePullRequest,
  approvePullRequest,
  mergePullRequest,
  addComment,
  requestChanges,
  listCommits,
  getPullRequestDiff,
  getPullRequestComments,
  getPullRequestCommits,
} from "./bitbucket.js";

const server = new McpServer({
  name: "bitbucket-cloud-mcp-server",
  version: "1.0.0",
});

function jsonResult(data: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

function errorResult(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  console.error("[MCP TOOL ERROR]", message);

  return {
    content: [
      {
        type: "text" as const,
        text: message,
      },
    ],
    isError: true,
  };
}

interface ChangedFile {
  filePath: string;
  additions: number[];
  deletions: number[];
}

function parseDiffFiles(diff: string): ChangedFile[] {
  const files: ChangedFile[] = [];
  const fileSections = diff.split(/^diff --git /m).filter(Boolean);

  for (const section of fileSections) {
    const fileMatch = section.match(/b\/(.+?)[\r\n]/);
    if (!fileMatch) continue;

    const filePath = fileMatch[1];
    const additions: number[] = [];
    const deletions: number[] = [];

    const hunkRegex = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/gm;
    let hunkMatch;

    while ((hunkMatch = hunkRegex.exec(section)) !== null) {
      let newLine = parseInt(hunkMatch[1], 10);
      const hunkStart = hunkMatch.index + hunkMatch[0].length;
      const nextHunk = section.indexOf("\n@@ ", hunkStart);
      const hunkBody = section.slice(
        hunkStart,
        nextHunk === -1 ? undefined : nextHunk,
      );

      for (const line of hunkBody.split("\n")) {
        if (line.startsWith("+") && !line.startsWith("+++")) {
          additions.push(newLine);
          newLine++;
        } else if (line.startsWith("-") && !line.startsWith("---")) {
          deletions.push(newLine);
        } else {
          newLine++;
        }
      }
    }

    files.push({ filePath, additions, deletions });
  }

  return files;
}

server.registerTool(
  "list_repositories",
  {
    title: "List Repositories",
    description: "List repositories in the configured Bitbucket workspace",
    annotations: {
      readOnlyHint: true,
    },
    inputSchema: z.object({
      workspace: z
        .string()
        .describe("Bitbucket workspace to list repositories from"),
      includePrivate: z.boolean(),
    }),
  },
  async ({ includePrivate = true }) => {
    try {
      const repos = await listRepositories();
      const filtered = includePrivate
        ? repos
        : repos.filter((r: any) => !r.is_private);

      return jsonResult(filtered);
    } catch (error) {
      return errorResult(error);
    }
  },
);

server.registerTool(
  "list_pull_requests",
  {
    title: "List Pull Requests",
    description: "List pull requests for a repository",
    inputSchema: z.object({
      repo: z.string().describe("Repository slug only (e.g. 'my-repo', NOT 'workspace/my-repo')"),
    }),
  },
  async ({ repo }) => {
    try {
      const prs = await listPullRequests(repo);
      return jsonResult(prs);
    } catch (error) {
      return errorResult(error);
    }
  },
);

server.registerTool(
  "get_pull_request",
  {
    title: "Get Pull Request",
    description: "Get pull request details",
    inputSchema: z.object({
      repo: z.string().describe("Repository slug only (e.g. 'my-repo', NOT 'workspace/my-repo')"),
      id: z.number(),
    }),
  },
  async ({ repo, id }) => {
    try {
      const pr = await getPullRequest(repo, id);
      return jsonResult(pr);
    } catch (error) {
      return errorResult(error);
    }
  },
);

server.registerTool(
  "create_pull_request",
  {
    title: "Create Pull Request",
    description: "Create a new pull request",
    inputSchema: z.object({
      repo: z.string().describe("Repository slug only (e.g. 'my-repo', NOT 'workspace/my-repo')"),
      title: z.string(),
      source: z.string(),
      destination: z.string(),
      description: z.string().optional(),
    }),
  },
  async ({ repo, title, source, destination, description }) => {
    try {
      const pr = await createPullRequest(
        repo,
        title,
        source,
        destination,
        description,
      );

      return jsonResult(pr);
    } catch (error) {
      return errorResult(error);
    }
  },
);

server.registerTool(
  "update_pull_request",
  {
    title: "Update Pull Request",
    description: "Update an existing pull request's title, description, destination branch, or reviewers",
    inputSchema: z.object({
      repo: z.string().describe("Repository slug only (e.g. 'my-repo', NOT 'workspace/my-repo')"),
      id: z.number().describe("Pull request ID"),
      title: z.string().optional().describe("New title for the pull request"),
      description: z.string().optional().describe("New description for the pull request"),
      destination: z.string().optional().describe("New destination branch name"),
      reviewers: z.array(z.string()).optional().describe("List of reviewer UUIDs to set on the pull request"),
    }),
  },
  async ({ repo, id, title, description, destination, reviewers }) => {
    try {
      const result = await updatePullRequest(repo, id, {
        title,
        description,
        destination,
        reviewers,
      });
      return jsonResult(result);
    } catch (error) {
      return errorResult(error);
    }
  },
);

server.registerTool(
  "approve_pull_request",
  {
    title: "Approve Pull Request",
    description: "Approve a pull request",
    inputSchema: z.object({
      repo: z.string().describe("Repository slug only (e.g. 'my-repo', NOT 'workspace/my-repo')"),
      id: z.number(),
    }),
  },
  async ({ repo, id }) => {
    try {
      const result = await approvePullRequest(repo, id);
      return jsonResult(result);
    } catch (error) {
      return errorResult(error);
    }
  },
);

server.registerTool(
  "merge_pull_request",
  {
    title: "Merge Pull Request",
    description: "Merge a pull request",
    inputSchema: z.object({
      repo: z.string().describe("Repository slug only (e.g. 'my-repo', NOT 'workspace/my-repo')"),
      id: z.number(),
    }),
  },
  async ({ repo, id }) => {
    try {
      const result = await mergePullRequest(repo, id);
      return jsonResult(result);
    } catch (error) {
      return errorResult(error);
    }
  },
);

server.registerTool(
  "comment_pull_request",
  {
    title: "Comment Pull Request",
    description:
      "Add a comment to a pull request. Optionally provide filePath and line to make it an inline comment on a specific line in the diff.",
    inputSchema: z.object({
      repo: z.string().describe("Repository slug only (e.g. 'my-repo', NOT 'workspace/my-repo')"),
      id: z.number(),
      comment: z.string().describe("The comment text"),
      imageUrl: z
        .string()
        .optional()
        .describe(
          "Optional image URL to embed in the comment (rendered as markdown image)",
        ),
      filePath: z
        .string()
        .optional()
        .describe(
          "Path to the file in the repository (e.g. src/index.ts). When provided with line, creates an inline comment.",
        ),
      line: z
        .number()
        .optional()
        .describe(
          "Line number in the new version of the file to comment on. Must be provided together with filePath.",
        ),
    }),
  },
  async ({ repo, id, comment, imageUrl, filePath, line }) => {
    try {
      let body = comment;
      if (imageUrl) {
        body += `\n\n![image](${imageUrl})`;
      }
      const result = await addComment(repo, id, body, filePath, line);
      return jsonResult(result);
    } catch (error) {
      return errorResult(error);
    }
  },
);

server.registerTool(
  "list_commits",
  {
    title: "List Commits",
    description: "List commits for a repository",
    inputSchema: z.object({
      repo: z.string().describe("Repository slug only (e.g. 'my-repo', NOT 'workspace/my-repo')"),
    }),
  },
  async ({ repo }) => {
    try {
      const commits = await listCommits(repo);
      return jsonResult(commits);
    } catch (error) {
      return errorResult(error);
    }
  },
);

server.registerTool(
  "request_changes",
  {
    title: "Request Changes on Pull Request",
    description:
      "Request changes on a pull request, signaling the author needs to address feedback. Only use this tool when the user explicitly asks to request changes.",
    inputSchema: z.object({
      repo: z.string().describe("Repository slug only (e.g. 'my-repo', NOT 'workspace/my-repo')"),
      id: z.number(),
    }),
  },
  async ({ repo, id }) => {
    try {
      const result = await requestChanges(repo, id);
      return jsonResult(result);
    } catch (error) {
      return errorResult(error);
    }
  },
);

server.registerTool(
  "review_pull_request",
  {
    title: "Review Pull Request",
    description: "Get everything needed to review a pull request",
    annotations: {
      readOnlyHint: true,
    },
    inputSchema: z.object({
      repo: z.string().describe("Repository slug only (e.g. 'my-repo', NOT 'workspace/my-repo')"),
      id: z.number(),
    }),
  },
  async ({ repo, id }) => {
    try {
      const [pr, diff, comments, commits] = await Promise.all([
        getPullRequest(repo, id),
        getPullRequestDiff(repo, id),
        getPullRequestComments(repo, id),
        getPullRequestCommits(repo, id),
      ]);

      const changedFiles = parseDiffFiles(diff);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                pullRequest: {
                  id: (pr as any).id,
                  title: (pr as any).title,
                  author: (pr as any).author?.display_name,
                  source: (pr as any).source?.branch?.name,
                  destination: (pr as any).destination?.branch?.name,
                },
                commits,
                comments,
                changedFiles,
                diff,
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (error) {
      return errorResult(error);
    }
  },
);

const transport = new StdioServerTransport();

await server.connect(transport);

console.error("Bitbucket MCP Server started");

process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err);
});

process.on("unhandledRejection", (reason) => {
  console.error("UNHANDLED REJECTION:", reason);
});

process.on("SIGINT", async () => {
  process.exit(0);
});

process.on("SIGTERM", async () => {
  process.exit(0);
});
