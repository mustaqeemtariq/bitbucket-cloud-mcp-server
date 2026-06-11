import axios from "axios";

const workspace = process.env.BITBUCKET_WORKSPACE;

if (!workspace) {
  throw new Error("BITBUCKET_WORKSPACE is not configured");
}

if (!process.env.BITBUCKET_EMAIL) {
  throw new Error("BITBUCKET_EMAIL is not configured");
}

if (!process.env.BITBUCKET_TOKEN) {
  throw new Error("BITBUCKET_TOKEN is not configured");
}

export const bitbucket = axios.create({
  baseURL: "https://api.bitbucket.org/2.0",
  timeout: 30000,
  headers: {
    Authorization: `Basic ${Buffer.from(
      `${process.env.BITBUCKET_EMAIL}:${process.env.BITBUCKET_TOKEN}`,
    ).toString("base64")}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});

function handleBitbucketError(
  operation: string,
  error: unknown,
  endpoint?: string,
): never {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const data = error.response?.data;

    const bitbucketMessage =
      (typeof data === "string" ? data : null) ||
      data?.error?.message ||
      data?.error?.detail ||
      data?.message ||
      error.message;

    console.error(`
========== BITBUCKET ERROR ==========
Operation: ${operation}
Endpoint: ${endpoint ?? "unknown"}
Status: ${status ?? "unknown"}
Response:
${JSON.stringify(data, null, 2)}
====================================
`);

    switch (status) {
      case 400:
        throw new Error(`${operation} failed: ${bitbucketMessage}`);

      case 401:
        throw new Error(
          `${operation} failed: Authentication failed (401). Check BITBUCKET_EMAIL and BITBUCKET_TOKEN.`,
        );

      case 403:
        throw new Error(
          `${operation} failed: Permission denied (403). ${bitbucketMessage}`,
        );

      case 404:
        throw new Error(`${operation} failed: Resource not found (404).`);

      case 409:
        throw new Error(
          `${operation} failed: Conflict (409). ${bitbucketMessage}`,
        );

      default:
        throw new Error(
          `${operation} failed (${status ?? "unknown"}): ${bitbucketMessage}`,
        );
    }
  }

  console.error(
    `[Bitbucket MCP] ${operation} failed with non-Axios error`,
    error,
  );

  throw new Error(
    `${operation} failed: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
}

async function request<T>(
  operation: string,
  endpoint: string,
  fn: () => Promise<{ data: T }>,
): Promise<T> {
  try {
    console.error(`[Bitbucket MCP] ${operation}: ${endpoint}`);

    const response = await fn();

    return response.data;
  } catch (error) {
    handleBitbucketError(operation, error, endpoint);
  }
}

/**
 * Normalizes a repo identifier: if the caller passes "workspace/repo",
 * strip the workspace prefix and return only the repo slug.
 */
function normalizeRepo(repo: string): string {
  if (repo.includes("/")) {
    return repo.split("/").pop()!;
  }
  return repo;
}

export async function listRepositories() {
  const endpoint = `/repositories/${workspace}`;

  const data = await request<any>("listRepositories", endpoint, () =>
    bitbucket.get(endpoint),
  );

  return (data?.values ?? []).map((repo: any) => ({
    name: repo.name,
    slug: repo.slug,
    full_name: repo.full_name,
    is_private: repo.is_private,
  }));
}

export async function getRepository(repo: string) {
  repo = normalizeRepo(repo);
  const endpoint = `/repositories/${workspace}/${repo}`;

  return request("getRepository", endpoint, () => bitbucket.get(endpoint));
}

export async function listPullRequests(repo: string) {
  repo = normalizeRepo(repo);
  const endpoint = `/repositories/${workspace}/${repo}/pullrequests`;

  const data = await request<any>("listPullRequests", endpoint, () =>
    bitbucket.get(endpoint),
  );

  return data?.values ?? [];
}

export async function getPullRequest(repo: string, id: number) {
  repo = normalizeRepo(repo);
  const endpoint = `/repositories/${workspace}/${repo}/pullrequests/${id}`;

  return request("getPullRequest", endpoint, () => bitbucket.get(endpoint));
}

export async function createPullRequest(
  repo: string,
  title: string,
  source: string,
  destination: string,
  description?: string,
) {
  repo = normalizeRepo(repo);
  const endpoint = `/repositories/${workspace}/${repo}/pullrequests`;

  return request("createPullRequest", endpoint, () =>
    bitbucket.post(endpoint, {
      title,
      description,
      source: {
        branch: {
          name: source,
        },
      },
      destination: {
        branch: {
          name: destination,
        },
      },
    }),
  );
}

export async function approvePullRequest(repo: string, id: number) {
  repo = normalizeRepo(repo);
  const endpoint = `/repositories/${workspace}/${repo}/pullrequests/${id}/approve`;

  return request("approvePullRequest", endpoint, () =>
    bitbucket.post(endpoint, {}),
  );
}

export async function mergePullRequest(repo: string, id: number) {
  repo = normalizeRepo(repo);
  const endpoint = `/repositories/${workspace}/${repo}/pullrequests/${id}/merge`;

  return request("mergePullRequest", endpoint, () =>
    bitbucket.post(endpoint, {
      merge_strategy: "merge_commit",
      close_source_branch: true,
    }),
  );
}

export async function addComment(
  repo: string,
  id: number,
  comment: string,
  filePath?: string,
  line?: number,
) {
  repo = normalizeRepo(repo);
  const endpoint = `/repositories/${workspace}/${repo}/pullrequests/${id}/comments`;

  const body: Record<string, unknown> = {
    content: {
      raw: comment,
    },
  };

  if (filePath && line !== undefined) {
    body.inline = {
      path: filePath,
      to: line,
    };
  }

  return request("addComment", endpoint, () =>
    bitbucket.post(endpoint, body),
  );
}

export async function listCommits(repo: string) {
  repo = normalizeRepo(repo);
  const endpoint = `/repositories/${workspace}/${repo}/commits`;

  const data = await request<any>("listCommits", endpoint, () =>
    bitbucket.get(endpoint),
  );

  return data?.values ?? [];
}

export async function getPullRequestDiff(repo: string, id: number) {
  repo = normalizeRepo(repo);
  const endpoint = `/repositories/${workspace}/${repo}/pullrequests/${id}/diff`;

  return request<string>("getPullRequestDiff", endpoint, () =>
    bitbucket.get(endpoint, {
      responseType: "text",
    }),
  );
}

export async function getPullRequestComments(repo: string, id: number) {
  repo = normalizeRepo(repo);
  const endpoint = `/repositories/${workspace}/${repo}/pullrequests/${id}/comments`;

  const data = await request<any>("getPullRequestComments", endpoint, () =>
    bitbucket.get(endpoint),
  );

  return data?.values ?? [];
}

export async function getPullRequestCommits(repo: string, id: number) {
  repo = normalizeRepo(repo);
  const endpoint = `/repositories/${workspace}/${repo}/pullrequests/${id}/commits`;

  const data = await request<any>("getPullRequestCommits", endpoint, () =>
    bitbucket.get(endpoint),
  );

  return data?.values ?? [];
}



export async function requestChanges(
  repo: string,
  id: number,
) {
  repo = normalizeRepo(repo);
  const endpoint = `/repositories/${workspace}/${repo}/pullrequests/${id}/request-changes`;

  return request("requestChanges", endpoint, () =>
    bitbucket.post(endpoint, {}),
  );
}

export interface UpdatePullRequestOptions {
  title?: string;
  description?: string;
  destination?: string;
  reviewers?: string[];
}

export async function updatePullRequest(
  repo: string,
  id: number,
  options: UpdatePullRequestOptions,
) {
  repo = normalizeRepo(repo);
  const endpoint = `/repositories/${workspace}/${repo}/pullrequests/${id}`;

  const body: Record<string, unknown> = {};

  if (options.title !== undefined) {
    body.title = options.title;
  }
  if (options.description !== undefined) {
    body.description = options.description;
  }
  if (options.destination !== undefined) {
    body.destination = { branch: { name: options.destination } };
  }
  if (options.reviewers !== undefined) {
    body.reviewers = options.reviewers.map((uuid) => ({ uuid }));
  }

  return request("updatePullRequest", endpoint, () =>
    bitbucket.put(endpoint, body),
  );
}

export async function canMergePullRequest(repo: string, id: number) {
  repo = normalizeRepo(repo);
  const pr: any = await getPullRequest(repo, id);

  return {
    id: pr.id,
    title: pr.title,
    state: pr.state,
    queued: pr.queued,
    draft: pr.draft,
    sourceBranch: pr.source?.branch?.name,
    destinationBranch: pr.destination?.branch?.name,
  };
}
