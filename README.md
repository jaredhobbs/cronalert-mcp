# cronalert-mcp

MCP server for [CronAlert](https://cronalert.com) uptime monitoring. Manage your monitors, check results, and incidents from Claude, Cursor, Windsurf, or any MCP-compatible AI client.

## Quick Start

### 1. Get your API key

Go to [cronalert.com/app/settings/api-keys](https://cronalert.com/app/settings/api-keys) and create an API key.

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
claude mcp add cronalert -- npx -y cronalert-mcp
```

Then set `CRONALERT_API_KEY` in your environment.

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

Ask your AI assistant things like:

- "List all my monitors"
- "Create a monitor for https://api.example.com/health with 1-minute checks"
- "Show me the uptime for my production API"
- "Are there any active incidents?"
- "Delete the monitor called staging-test"

## Available Tools

| Tool | Description |
|------|-------------|
| `list_monitors` | List all monitors with status, uptime, and response times |
| `create_monitor` | Create a new HTTP monitor |
| `get_monitor` | Get details for a specific monitor |
| `update_monitor` | Update a monitor's settings (URL, interval, pause/resume) |
| `delete_monitor` | Delete a monitor |
| `get_check_results` | Get check history with uptime percentage and response times |
| `get_monitor_incidents` | Get incidents for a specific monitor |
| `list_incidents` | List all active incidents across all monitors |
| `list_status_pages` | List your public status pages |

## Requirements

- Node.js 18+
- A [CronAlert](https://cronalert.com) account (free tier works)
- An API key from [Settings > API Keys](https://cronalert.com/app/settings/api-keys)

## License

MIT
