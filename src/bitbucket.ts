import axios, { AxiosError } from "axios";

const workspace = process.env.BITBUCKET_WORKSPACE;

if (!workspace) {
  throw new Error("BITBUCKET_WORKSPACE is not configured");
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

    console.error(`\n========== BITBUCKET ERROR ==========
Operation: ${operation}
Endpoint: ${endpoint ?? "unknown"}
Status: ${status ?? "unknown"}
Response:
${JSON.stringify(data, null, 2)}
====================================\n`);

    if (status === 404) {
      throw new Error(
        `${operation} failed: Resource not found (404). Endpoint: ${endpoint}`,
      );
    }

    if (status === 401) {
      throw new Error(
        `${operation} failed: Authentication failed (401). Check BITBUCKET_EMAIL and BITBUCKET_TOKEN.`,
      );
    }

    if (status === 403) {
      throw new Error(
        `${operation} failed: Permission denied (403). Token lacks required permissions.`,
      );
    }

    throw new Error(
      `${operation} failed (${status}): ${
        typeof data === "string" ? data : JSON.stringify(data ?? error.message)
      }`,
    );
  }

  console.error(`${operation} failed`, error);

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

export async function listRepositories() {
  const endpoint = `/repositories/${workspace}`;

  const data = await request("listRepositories", endpoint, () =>
    bitbucket.get(endpoint),
  );

  return (data as any)?.values.map((repo: any) => ({
    name: repo.name,
    slug: repo.slug,
  }));
}

export async function listPullRequests(repo: string) {
  const endpoint = `/repositories/${workspace}/${repo}/pullrequests`;

  const data = await request("listPullRequests", endpoint, () =>
    bitbucket.get(endpoint),
  );

  return (data as any)?.values ?? [];
}

export async function getPullRequest(repo: string, id: number) {
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
  const endpoint = `/repositories/${workspace}/${repo}/pullrequests/${id}/approve`;

  return request("approvePullRequest", endpoint, () =>
    bitbucket.post(endpoint),
  );
}

export async function mergePullRequest(repo: string, id: number) {
  const endpoint = `/repositories/${workspace}/${repo}/pullrequests/${id}/merge`;

  return request("mergePullRequest", endpoint, () => bitbucket.post(endpoint));
}

export async function addComment(repo: string, id: number, comment: string) {
  const endpoint = `/repositories/${workspace}/${repo}/pullrequests/${id}/comments`;

  return request("addComment", endpoint, () =>
    bitbucket.post(endpoint, {
      content: {
        raw: comment,
      },
    }),
  );
}

export async function listCommits(repo: string) {
  const endpoint = `/repositories/${workspace}/${repo}/commits`;

  const data = await request("listCommits", endpoint, () =>
    bitbucket.get(endpoint),
  );

  return (data as any)?.values ?? [];
}

export async function getRepository(repo: string) {
  const endpoint = `/repositories/${workspace}/${repo}`;

  return request("getRepository", endpoint, () => bitbucket.get(endpoint));
}

export async function getPullRequestDiff(repo: string, id: number) {
  const endpoint = `/repositories/${workspace}/${repo}/pullrequests/${id}/diff`;

  const { data } = await bitbucket.get(endpoint, {
    responseType: "text",
  });

  return data;
}

export async function getPullRequestComments(repo: string, id: number) {
  const endpoint = `/repositories/${workspace}/${repo}/pullrequests/${id}/comments`;

  const { data } = await bitbucket.get(endpoint);

  return data.values;
}

export async function getPullRequestCommits(repo: string, id: number) {
  const endpoint = `/repositories/${workspace}/${repo}/pullrequests/${id}/commits`;

  const { data } = await bitbucket.get(endpoint);

  return data.values;
}
