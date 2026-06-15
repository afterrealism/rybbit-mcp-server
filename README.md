<picture>
   <source media="(prefers-color-scheme: dark)" srcset="art/header-dark.png">
   <img alt="Logo for Rybbit MCP Server" src="art/header-light.png">
</picture>

# Rybbit MCP Server

An MCP (Model Context Protocol) server for the [Rybbit Analytics](https://rybbit.com) API. It gives Claude read access to your analytics — traffic, sessions, events, users, goals, funnels, performance, and errors — so you can ask things like *"how many people visited last week and what pages did they view?"* in plain English and get a detailed answer.

This server is **analytics-focused and non-destructive**: it cannot delete anything (no deleting sites, goals, or funnels) and does not send tracking events. The only write operations it exposes are creating/updating goals and funnels.

## Installation

No installation required! Use `npx` to run directly.

Or install globally:

```bash
npm install -g rybbit-mcp-server
```

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `RYBBIT_API_KEY` | Yes | — | Your Rybbit API key |
| `RYBBIT_URL` | No | `https://app.rybbit.io` | Base URL for the Rybbit API (for self-hosted instances) |

### Getting an API Key

1. Navigate to Settings → Account in your Rybbit dashboard
2. Go to the API Keys section
3. Create a key with a custom name
4. Copy it immediately (it won't be shown again)

## Usage

### With Claude Desktop

Add to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "rybbit": {
      "command": "npx",
      "args": ["rybbit-mcp-server"],
      "env": {
        "RYBBIT_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

For self-hosted Rybbit instances, add the `RYBBIT_URL` environment variable:

```json
{
  "mcpServers": {
    "rybbit": {
      "command": "npx",
      "args": ["rybbit-mcp-server"],
      "env": {
        "RYBBIT_API_KEY": "your_api_key_here",
        "RYBBIT_URL": "https://your-rybbit-instance.com"
      }
    }
  }
}
```

### With Claude Code

Add to your Claude Code MCP settings (`~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "rybbit": {
      "command": "npx",
      "args": ["rybbit-mcp-server"],
      "env": {
        "RYBBIT_API_KEY": "your_api_key_here",
        "RYBBIT_URL": "https://your-rybbit-instance.com"
      }
    }
  }
}
```

### Standalone

```bash
npx rybbit-mcp-server

# Or if installed globally:
rybbit-mcp-server
```

## Available Tools

### Overview & Metrics
- `rybbit_get_overview` - Get high-level analytics (sessions, pageviews, users, bounce rate)
- `rybbit_get_overview_timeseries` - Get time-series analytics data
- `rybbit_get_metric` - Get dimensional breakdown by parameter (browser, country, etc.)
- `rybbit_get_live_visitors` - Get count of currently active visitors

### Sessions
- `rybbit_get_sessions` - Get paginated list of sessions
- `rybbit_get_session_details` - Get detailed session info with events
- `rybbit_get_session_locations` - Get session locations for map visualization

### Events
- `rybbit_get_events` - Get paginated list of events
- `rybbit_get_event_names` - Get unique event names with counts
- `rybbit_get_event_properties` - Get properties for a specific event
- `rybbit_get_outbound_links` - Get outbound link clicks

### Users
- `rybbit_get_users` - Get paginated list of users
- `rybbit_get_user_sessions` - Get sessions for a specific user
- `rybbit_get_user_session_count` - Get daily session count for a user
- `rybbit_get_user_info` - Get detailed user profile

### Goals
- `rybbit_get_goals` - Get goals with conversion metrics
- `rybbit_get_goal_sessions` - Get sessions that completed a goal
- `rybbit_create_goal` - Create a new goal (path or event-based)
- `rybbit_update_goal` - Update goal configuration

### Funnels
- `rybbit_get_funnels` - Get saved funnels
- `rybbit_analyze_funnel` - Analyze step-by-step conversion
- `rybbit_get_funnel_step_sessions` - Get sessions at a funnel step
- `rybbit_create_funnel` - Create a new funnel

### Performance (Core Web Vitals)
- `rybbit_get_performance_overview` - Get LCP, CLS, INP, FCP, TTFB metrics
- `rybbit_get_performance_timeseries` - Get performance trends over time
- `rybbit_get_performance_by_dimension` - Get performance by pathname, country, etc.

### Error Tracking
- `rybbit_get_error_names` - Get unique errors with counts
- `rybbit_get_error_events` - Get error occurrences with stack traces
- `rybbit_get_error_timeseries` - Get error trends over time

### Retention & Journeys
- `rybbit_get_retention` - Get cohort-based retention analysis
- `rybbit_get_journeys` - Get common user navigation paths

### Organizations & Sites
- `rybbit_get_organizations` - Get your organizations (includes their sites and members)
- `rybbit_get_organization_members` - Get organization members
- `rybbit_get_site` - Get site details and configuration
- `rybbit_get_excluded_ips` - Get IPs excluded from tracking
- `rybbit_get_excluded_countries` - Get countries excluded from tracking
- `rybbit_get_private_link_config` - Get the private share-link configuration

## Example questions for Claude

Once configured, ask Claude in plain English — it picks the right tool(s) and combines the results. Common patterns:

| You ask… | Claude uses |
|----------|-------------|
| "How many people visited last week, and what pages did they view?" | `rybbit_get_overview` (totals) + `rybbit_get_metric` with `parameter: "pathname"` (top pages) |
| "Show the daily traffic trend this month" | `rybbit_get_overview_timeseries` with `bucket: "day"` |
| "Where is my traffic coming from?" | `rybbit_get_metric` with `parameter: "referrer"` (or `utm_source`, `country`, `channel`) |
| "Who are my most active users, and what did they do?" | `rybbit_get_users` (sorted) → `rybbit_get_user_sessions` → `rybbit_get_session_details` |
| "Trace one visitor's journey" | `rybbit_get_session_details` (every page/event in a session) |
| "How many people are on the site right now?" | `rybbit_get_live_visitors` |
| "Is the site healthy?" | `rybbit_get_performance_overview` (Core Web Vitals) + `rybbit_get_error_names` |
| "How is my signup funnel converting?" | `rybbit_analyze_funnel` (or `rybbit_get_funnels` to list saved ones) |
| "What are the most common paths through my site?" | `rybbit_get_journeys` |
| "Are users coming back?" | `rybbit_get_retention` |

> **Finding your `siteId`:** every analytics tool needs one. If you don't know it, ask Claude to *"list my Rybbit organizations"* (`rybbit_get_organizations`) — the response includes each site and its ID.

### Worked example

> **You:** "How many visitors did my site (ID 1) get from June 1–7, and what were the top 5 pages?"

Claude makes two calls and combines them into one answer:

```json
{ "name": "rybbit_get_overview",
  "arguments": { "siteId": "1", "startDate": "2026-06-01", "endDate": "2026-06-07" } }

{ "name": "rybbit_get_metric",
  "arguments": { "siteId": "1", "parameter": "pathname",
                 "startDate": "2026-06-01", "endDate": "2026-06-07", "limit": 5 } }
```

> **Claude:** "From June 1–7 your site had **1,240 visitors** across 1,800 sessions and 5,400 pageviews (42% bounce rate). The most-viewed pages were `/` (2,100 views), `/pricing` (820), `/blog` (610), `/docs` (430), and `/signup` (310)."

## Common Parameters

### Time Parameters
Most analytics tools accept time parameters:
- `startDate` / `endDate` - Date range in YYYY-MM-DD format
- `timeZone` - IANA timezone (e.g., "America/New_York")
- `pastMinutesStart` / `pastMinutesEnd` - Relative time range in minutes

### Filters
Filter data using JSON array format:
```json
[
  {
    "parameter": "country",
    "type": "equals",
    "value": ["US"]
  }
]
```

Filter types: `equals`, `not_equals`, `contains`, `not_contains`, `regex`, `not_regex`, `greater_than`, `less_than`

Available parameters: `browser`, `operating_system`, `device_type`, `country`, `region`, `city`, `pathname`, `page_title`, `hostname`, `querystring`, `referrer`, `utm_source`, `utm_medium`, `utm_campaign`, `user_id`, `event_name`

## Rate Limits

The Rybbit API has a rate limit of 500 requests per 10 minutes per API key.

## License

MIT
