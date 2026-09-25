# cronalert-mcp

MCP server for [CronAlert](https://cronalert.com) uptime monitoring. Manage your monitors, check results, and incidents from Claude, Cursor, Windsurf, or any MCP-compatible AI client.

## Quick Start

### 1. Get your API key

Sign up at [cronalert.com](https://cronalert.com) and create an API key in [Settings > API Keys](https://cronalert.com/app/settings/api-keys).

When creating the key, choose a **scope**:

- **Read-only** — the agent can list and read monitors, check results, and incidents but **cannot** create, update, or delete anything. Recommended for most agent setups.
- **Read & write** — full access, including destructive tools. Optionally enable **"require confirmation"** so deletes need a server-issued confirmation token (see [Security & permissions](#security--permissions)).

### 2. Add to your MCP client

**Claude Desktop** — edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "cronalert": {
      "command": "npx",
      "args": ["-y", "cronalert-mcp"],
      "env": {
        "CRONALERT_API_KEY": "ca_your_api_key_here"
      }
    }
  }
}
```

**Claude Code** — run:

```bash
claude mcp add cronalert -e CRONALERT_API_KEY=ca_your_key -- npx -y cronalert-mcp
```

**Cursor** — add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "cronalert": {
      "command": "npx",
      "args": ["-y", "cronalert-mcp"],
      "env": {
        "CRONALERT_API_KEY": "ca_your_api_key_here"
      }
    }
  }
}
```

**Remote server (no install needed)** — connect any MCP client to:

```
https://cronalert.com/mcp
```

Authenticate with `Authorization: Bearer ca_your_key` header. Supports Streamable HTTP transport.

### 3. Start using it

Ask your AI assistant to manage your monitors (see examples below).

## Available Tools

| Tool | Description | Type |
|------|-------------|------|
| `list_monitors` | List all monitors with status and response times | Read |
| `create_monitor` | Create an HTTP, heartbeat, or TCP port monitor (heartbeats take an expected interval and grace period) | Write |
| `get_monitor` | Get details for a specific monitor | Read |
| `update_monitor` | Update settings, heartbeat interval/grace, pause/resume | Write |
| `delete_monitor` | Permanently delete a monitor | Write |
| `get_check_results` | Check history with uptime % and response times | Read |
| `get_monitor_incidents` | Incidents for a specific monitor | Read |
| `list_incidents` | All active incidents across monitors | Read |
| `list_status_pages` | Your public status pages | Read |
| `add_incident_update` | Post a status update on an active incident | Write |
| `get_incident_updates` | Status updates for an incident | Read |
| `import_monitors` | Import monitors from UptimeRobot, Pingdom, Better Stack, StatusCake, Checkly, Oh Dear, Cronitor, Healthchecks.io, Dead Man's Snitch, Datadog, CronAlert JSON, or CSV | Write |

## Security & permissions

Approvals in MCP clients are client-side: write tools carry `destructiveHint: true`, so Claude Code / Desktop / Cursor prompt before running them. CronAlert adds two **server-side** boundaries so the client prompt isn't the only gate:

- **Read-only API keys.** A read-only key is rejected on every write endpoint (create/update/delete/import) with a 403 — enforced by the server, regardless of the client. Hand agents a read-only key and destructive tools simply cannot succeed. This is the strongest boundary and the recommended default.
- **Confirmation tokens for deletes.** If a read-write key has **"require confirmation"** enabled, `delete_monitor` first returns a preview plus a short-lived, resource-bound `confirmToken` instead of deleting. The agent must call `delete_monitor` again with that token in the `confirm` argument. This prevents a single stray or prompt-injected call from destroying data and gives the server an auditable, explicit second step.

The API key is scoped to a single team, so the blast radius of any key is that team's resources.

## Examples

### Example 1: Create a monitor and check its status

**User prompt:** "Create a monitor for https://api.example.com/health that checks every minute, then show me its details."

**What happens:**
1. The AI calls `create_monitor` with `name: "API Health"`, `url: "https://api.example.com/health"`, `checkInterval: 60`
2. CronAlert creates the monitor and returns its ID
3. The AI calls `get_monitor` with the new ID to show the details

**Expected output:**
```json
{
  "id": "abc123",
  "name": "API Health",
  "url": "https://api.example.com/health",
  "method": "GET",
  "checkInterval": 60,
  "lastStatus": "unknown",
  "createdAt": "2026-03-08T12:00:00Z"
}
```

### Example 2: Check uptime and respond to incidents

**User prompt:** "Are any of my monitors down? If so, show me the error details."

**What happens:**
1. The AI calls `list_incidents` to check for active incidents
2. If incidents exist, it calls `get_monitor` for each affected monitor
3. It calls `get_check_results` to get the recent error details

**Expected output (no incidents):**
```json
{
  "data": [],
  "message": "No active incidents"
}
```

**Expected output (with incident):**
```json
{
  "data": [
    {
      "id": "inc_xyz",
      "monitorId": "abc123",
      "cause": "Expected status 200, got 503",
      "startedAt": "2026-03-08T11:45:00Z"
    }
  ]
}
```

### Example 3: List monitors and pause one for maintenance

**User prompt:** "List all my monitors, then pause the staging one."

**What happens:**
1. The AI calls `list_monitors` to get all monitors
2. It identifies the staging monitor by name
3. It calls `update_monitor` with `id: "staging_id"` and `paused: true`

**Expected output:**
```json
{
  "id": "staging_id",
  "name": "Staging Server",
  "isPaused": true,
  "lastStatus": "up"
}
```

### Example 4: Heartbeat for a nightly backup (v1.5.0+)

**User prompt:** "Create a heartbeat monitor called Nightly DB backup that expects a ping every 24 hours with a 2-hour grace period, and give me the URL to add to the cron job."

**What happens:**
1. The AI calls `create_monitor` with `type: "heartbeat"`, `name: "Nightly DB backup"`, `checkInterval: 86400`, `gracePeriod: 7200`
2. CronAlert returns the monitor including its unique ping `url`
3. The AI shows the URL to append to the job, e.g. `pg_dump ... && curl -fsS <url>`

`checkInterval` is the expected seconds between pings (plan minimum, 60 on Pro+, up to 604800). `gracePeriod` is optional; it defaults to the interval capped at one hour. For `http` and `tcp` monitors `checkInterval` is ignored and set from your plan.

## Requirements

- Node.js 18+
- A [CronAlert](https://cronalert.com) account (free tier works)
- An API key from [Settings > API Keys](https://cronalert.com/app/settings/api-keys)

## Privacy Policy

This MCP server connects to the CronAlert API (`cronalert.com/api/v1/`) using your API key. It transmits:

- **Monitor configuration** (names, URLs, check intervals) when creating or updating monitors
- **API key** for authentication on every request

Data is processed by CronAlert's servers on Cloudflare's infrastructure. No data is stored locally by the MCP server itself. See our full [Privacy Policy](https://cronalert.com/privacy) for details on data collection, retention, and your rights.

## Support

- Website: [cronalert.com](https://cronalert.com)
- Email: support@cronalert.com
- Issues: [GitHub Issues](https://github.com/jaredhobbs/cronalert-mcp/issues)

## License

MIT
