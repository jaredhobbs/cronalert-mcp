# cronalert-mcp

MCP server for [CronAlert](https://cronalert.com) uptime monitoring. Manage your monitors, check results, and incidents from Claude, Cursor, Windsurf, or any MCP-compatible AI client.

## Quick Start

### 1. Get your API key

Sign up at [cronalert.com](https://cronalert.com) and create an API key in [Settings > API Keys](https://cronalert.com/app/settings/api-keys).

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

### 3. Start using it

Ask your AI assistant to manage your monitors (see examples below).

## Available Tools

| Tool | Description | Type |
|------|-------------|------|
| `list_monitors` | List all monitors with status and response times | Read |
| `create_monitor` | Create a new HTTP monitor | Write |
| `get_monitor` | Get details for a specific monitor | Read |
| `update_monitor` | Update settings, pause/resume | Write |
| `delete_monitor` | Permanently delete a monitor | Write |
| `get_check_results` | Check history with uptime % and response times | Read |
| `get_monitor_incidents` | Incidents for a specific monitor | Read |
| `list_incidents` | All active incidents across monitors | Read |
| `list_status_pages` | Your public status pages | Read |

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
