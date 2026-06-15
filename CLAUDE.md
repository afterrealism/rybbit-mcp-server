# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

An MCP (Model Context Protocol) server that exposes the [Rybbit Analytics](https://rybbit.com) REST API as 37 MCP tools (prefixed `rybbit_`). It runs as a stdio process launched by an MCP client (Claude Desktop, Claude Code) via `npx rybbit-mcp-server`.

The server is **analytics-focused and non-destructive**: it has no delete tools and does not send tracking events. The only state-mutating tools are `rybbit_create_goal`, `rybbit_update_goal`, and `rybbit_create_funnel`; everything else is read-only. Preserve this when adding tools unless explicitly told otherwise.

## Commands

- **Run:** `npm start` (or `node src/index.js`). Requires `RYBBIT_API_KEY` to be set or the process exits immediately.
- **No build, test, or lint tooling exists.** Plain Node.js ESM (`"type": "module"`), no TypeScript, no bundler. The only runtime dependency is `@modelcontextprotocol/sdk`. Node >= 18 is required (relies on native `fetch`).
- **Smoke-test a change locally:** `RYBBIT_API_KEY=... node src/index.js` — startup logs `Rybbit MCP Server running on stdio` to stderr. To exercise a tool, pipe JSON-RPC into stdin or wire it into an MCP client config (see README).

## Configuration

Two environment variables, read at module load:
- `RYBBIT_API_KEY` (required) — sent as `Authorization: Bearer`.
- `RYBBIT_URL` (optional, default `https://app.rybbit.io`) — `BASE_URL` in `src/client.js`; set this for self-hosted Rybbit instances.

## Architecture

Two files do everything:

- **`src/client.js`** — `RybbitClient`, a thin `fetch` wrapper providing `get/post/put` with Bearer auth. Also exports `buildTimeParams()`, which converts the camelCase time options into the snake_case query params the Rybbit API expects.
- **`src/index.js`** — the entry point. Holds the `tools` array (MCP tool definitions: name, description, JSON-schema), the `handleToolCall(name, args)` switch that maps each tool to a Rybbit endpoint, and the MCP server wiring (`StdioServerTransport`, `ListTools`/`CallTool` handlers).

### Adding or changing a tool

Every tool lives in **two places in `src/index.js`** that must stay in sync:
1. An entry in the `tools` array (the input schema the client sees).
2. A `case` in the `handleToolCall` switch (the actual API call).

Schemas are composed from the shared fragments `siteIdSchema`, `timeParamsSchema`, and `paginationSchema` via object spread — reuse them rather than re-declaring fields.

### Conventions and gotchas

- **camelCase → snake_case translation.** MCP tools expose camelCase params (`startDate`, `userId`, `pageSize`); the Rybbit API wants snake_case (`start_date`, `user_id`, `page_size`). Time params are translated by `buildTimeParams()`; **everything else is translated inline in each switch case** (e.g. `{ user_id: args.userId, page_size: args.pageSize }`). Forgetting this mapping is the most common bug.
- **Nested/array params are passed as JSON strings.** Schema fields like `filters`, `steps`, and `stepFilters` are declared `type: 'string'`. `filters` and `steps` are `JSON.parse`'d in the handler; `stepFilters` is forwarded as-is for the API to parse. This avoids inconsistent nested-object handling across MCP clients. (`filters` is parsed in the handler, then re-stringified inside `buildTimeParams`.)
- **Never use `console.log`.** stdout is the JSON-RPC channel for the stdio transport. All diagnostics go to `console.error` (stderr). Note `client.js` currently logs every request line + API-key presence/length to stderr.
- **Error handling.** `RybbitClient.request` throws on any non-2xx response (message includes status, URL, and body). The `CallTool` handler catches it and returns `{ content: [...], isError: true }` rather than crashing the server.
- **`undefined`/`null`/`''` query params are dropped** by the URLSearchParams loop in `client.js`, so passing optional args through unconditionally is safe.
