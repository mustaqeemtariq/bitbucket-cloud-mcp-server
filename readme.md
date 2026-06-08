# Bitbucket Cloud MCP Server

A Model Context Protocol (MCP) server that lets MCP-compatible AI clients work with Bitbucket Cloud repositories, pull requests, commits, comments, approvals, and merges.

## Features

* List repositories in a Bitbucket workspace
* List, inspect, create, approve, merge, and comment on pull requests
* Fetch pull request metadata, commits, comments, and diff content for reviews
* List repository commits
* Read-only annotations on safe exploration tools
* Runs over MCP stdio for clients such as Claude Desktop, Cursor, Kiro, and MCP Inspector

## Requirements

* Node.js 18 or newer
* A Bitbucket Cloud workspace
* A Bitbucket API token or app password with repository and pull request access

## Installation

Run without installing:

```bash
npx bitbucket-cloud-mcp-server
```

Or install globally:

```bash
npm install -g bitbucket-cloud-mcp-server
bitbucket-cloud-mcp-server
```

## Configuration

Set these environment variables in your MCP client configuration:

| Variable | Description |
| --- | --- |
| `BITBUCKET_WORKSPACE` | Bitbucket workspace slug |
| `BITBUCKET_EMAIL` | Atlassian account email |
| `BITBUCKET_TOKEN` | Bitbucket API token or app password |

Example:

```json
{
  "mcpServers": {
    "bitbucket": {
      "command": "npx",
      "args": ["-y", "bitbucket-cloud-mcp-server"],
      "env": {
        "BITBUCKET_WORKSPACE": "my-workspace",
        "BITBUCKET_EMAIL": "my-email@example.com",
        "BITBUCKET_TOKEN": "my-api-token"
      }
    }
  }
}
```

If you installed the package globally, you can use the binary directly:

```json
{
  "mcpServers": {
    "bitbucket": {
      "command": "bitbucket-cloud-mcp-server",
      "env": {
        "BITBUCKET_WORKSPACE": "my-workspace",
        "BITBUCKET_EMAIL": "my-email@example.com",
        "BITBUCKET_TOKEN": "my-api-token"
      }
    }
  }
}
```

## Verify Credentials

Before running the MCP server, verify Bitbucket access:

```bash
curl -u "my-email@example.com:my-api-token" \
  "https://api.bitbucket.org/2.0/repositories/my-workspace"
```

A successful response returns repository information for the workspace.

## Tools

### `list_repositories`

Lists repositories in the configured workspace.

Input:

```json
{
  "includePrivate": true
}
```

### `list_pull_requests`

Lists pull requests for a repository.

Input:

```json
{
  "repo": "my-repository"
}
```

### `get_pull_request`

Gets pull request details.

Input:

```json
{
  "repo": "my-repository",
  "id": 123
}
```

### `review_pull_request`

Returns pull request metadata, commits, existing comments, and diff content for review.

Input:

```json
{
  "repo": "my-repository",
  "id": 123
}
```

### `create_pull_request`

Creates a pull request.

Input:

```json
{
  "repo": "my-repository",
  "title": "Add authentication",
  "source": "feature/auth",
  "destination": "main",
  "description": "Adds login functionality"
}
```

### `approve_pull_request`

Approves a pull request.

Input:

```json
{
  "repo": "my-repository",
  "id": 123
}
```

Bitbucket may prevent users from approving their own pull requests depending on repository settings.

### `merge_pull_request`

Merges a pull request.

Input:

```json
{
  "repo": "my-repository",
  "id": 123
}
```

### `comment_pull_request`

Adds a comment to a pull request.

Input:

```json
{
  "repo": "my-repository",
  "id": 123,
  "comment": "Looks good to me."
}
```

### `list_commits`

Lists commits for a repository.

Input:

```json
{
  "repo": "my-repository"
}
```

## Development

Install dependencies:

```bash
npm install
```

Run in development mode:

```bash
npm run dev
```

Build:

```bash
npm run build
```

Preview the npm package contents:

```bash
npm run pack:dry-run
```

## Publishing

The unscoped `bitbucket-mcp` package name is already used on npm, so this package is configured as `bitbucket-cloud-mcp-server`.

Before publishing, confirm you are logged in:

```bash
npm whoami
```

Then publish:

```bash
npm publish --access public
```

The `prepublishOnly` script rebuilds `dist` before publishing.

## License

ISC
