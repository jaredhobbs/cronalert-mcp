---
name: cronalert-uptime-monitoring
description: Set up and operate uptime monitoring with CronAlert through the cronalert-mcp server. Use when the user wants to monitor a URL, API, TCP port, or cron job for downtime, check whether anything is currently down, triage an outage, pause monitors for a deploy, post status-page updates, or migrate monitors from UptimeRobot, Pingdom, Better Stack, Healthchecks.io, or similar services.
license: MIT
metadata:
  author: CronAlert
  homepage: https://cronalert.com
  mcp-server: cronalert-mcp
  version: 1.0.0
---

# CronAlert uptime monitoring

CronAlert checks user-supplied URLs and TCP ports on a schedule from Cloudflare's edge, waits for heartbeat pings from cron jobs, opens an incident when something fails, and alerts the team over email, Slack, Discord, webhook, Microsoft Teams, Telegram, PagerDuty, or push. This skill tells you when and how to drive it through the `cronalert-mcp` tools.

## Prerequisites

Check that the `cronalert` MCP server is connected (its tools are named `list_monitors`, `create_monitor`, and so on). If it is not, walk the user through setup before doing anything else:

1. Create a free account at https://cronalert.com if they do not have one.
2. Create an API key at https://cronalert.com/app/settings/api-keys. Recommend a **read-only** key unless the user explicitly needs you to create, change, or delete monitors. Read-only keys are rejected server-side on every write, so they are the safe default for an agent.
3. Register the server with their client:

```bash
# Claude Code
claude mcp add cronalert -e CRONALERT_API_KEY=ca_xxx -- npx -y cronalert-mcp
```

```json
// Cursor (.cursor/mcp.json), Claude Desktop, Windsurf
{
  "mcpServers": {
    "cronalert": {
      "command": "npx",
      "args": ["-y", "cronalert-mcp"],
      "env": { "CRONALERT_API_KEY": "ca_xxx" }
    }
  }
}
```

A hosted endpoint also exists at `https://cronalert.com/mcp` with `Authorization: Bearer ca_xxx` for clients that support Streamable HTTP.

Never ask the user to paste their API key into chat. Point them at the config file.

## Choosing the monitor type

Pick the type before calling `create_monitor`. Getting this wrong is the most common mistake.

| Situation | Type | Notes |
|---|---|---|
| Website, API, health endpoint, anything with a URL | `http` | Default. Checks status code, optionally response content. |
| Cron job, scheduled task, queue worker, backup script | `heartbeat` | CronAlert waits for the job to ping it. Alerts when the ping is late. Pro+. |
| Database, Redis, SMTP (not port 25), SSH, game server, anything on a bare IP | `tcp` | Opens a connection to host:port. Pro+. |

Rules that follow from how CronAlert works:

- **HTTP monitors cannot target a bare IP address.** Cloudflare Workers refuse to fetch `http://203.0.113.5/`. Use a hostname, or use a `tcp` monitor against the IP and port instead.
- **Port 25 is blocked** on Cloudflare. For SMTP use 465 or 587.
- **ICMP ping and UDP are not possible.** Offer a `tcp` check on a known open port instead.
- **Check interval is set by the plan, not the user**, for `http` and `tcp` monitors: 3 minutes on Free, 1 minute on Pro and above. Do not promise a custom interval. `checkInterval` only matters for heartbeats.
- **One content assertion per monitor.** A monitor can check status code plus at most one of: keyword present, keyword absent, regex match, regex no-match, content changed, content stale. If the user wants two assertions on one URL, create two monitors.
- **No request body.** HTTP monitors send a method, optional custom headers, and nothing else. Keep POST checks to endpoints that accept an empty body.
- **No response-header assertions and no latency-threshold alerts.** The only time-based failure is the request timeout (1 to 120 seconds).
- **Alert channels are team-wide and configured in the web app**, not through these tools. Every monitor alerts every enabled channel. If the user wants different routing per monitor, suggest separate teams or a webhook relay. If `list_monitors` works but the user says they got no alert, the likely cause is zero enabled channels; send them to https://cronalert.com/app/alerts.

## Workflows

### Monitor a deployed service

1. Confirm the URL returns the expected status when healthy. Prefer a dedicated health endpoint over the home page.
2. Call `create_monitor` with `name`, `url`, and `expectedStatusCode` if it is not 200. Add `headers` as a JSON string if the endpoint needs auth. Keep `timeout` at the default unless the endpoint is known to be slow.
3. If the health endpoint returns a body, add one content check: `keywordMatchType: "contains"` with `keyword: "ok"` (or whatever the healthy body includes). This catches a 200 that serves an error page.
4. Call `get_monitor` after a few minutes and report `lastStatus`. A new monitor reads `unknown` until its first check runs.

Example call:

```json
{
  "name": "API health",
  "url": "https://api.example.com/health",
  "expectedStatusCode": 200,
  "keywordMatchType": "contains",
  "keyword": "\"status\":\"ok\""
}
```

### Monitor a cron job with a heartbeat

1. Ask how often the job runs and how late is acceptable. Convert both to seconds.
2. Call `create_monitor` with `type: "heartbeat"`, `checkInterval` set to the run interval, and `gracePeriod` set to the allowed lateness. If the user has no opinion on grace, omit it. The default is the interval capped at one hour, so a daily job alerts after 25 hours and a minutely one after 2 minutes.
3. The response includes the monitor's unique ping URL. Append a ping to the end of the job so it only fires on success:

```bash
0 3 * * * pg_dump mydb > /backups/mydb.sql && curl -fsS --retry 3 <ping-url>
```

For a Python or Node job, make the HTTP GET the last statement in the success path. Do not ping in a `finally` block, since that hides failures.

4. Tell the user the monitor will show `unknown` until the first ping arrives, then `down` if a ping is ever late by more than interval plus grace.

Heartbeats accept intervals from the plan minimum (60 seconds on Pro) up to 7 days (604800). There is one ping URL per monitor. There are no separate start or fail endpoints and no cron-expression schedules, so for a job with an irregular schedule set the interval to the longest expected gap.

### Monitor a TCP service

Call `create_monitor` with `type: "tcp"`, `host`, and `port`. Leave `url` out. Example for a Postgres instance on a bare IP:

```json
{ "name": "Primary Postgres", "type": "tcp", "host": "203.0.113.5", "port": 5432 }
```

A TCP monitor passes if the connection opens. It does not speak the protocol, so a database that accepts connections but rejects every query still reads `up`.

### Multi-region checks (Team plan and above)

Pass `regions` as a comma-separated list from `us-east, us-west, eu-west, eu-central, ap-southeast`. Set `failureThreshold` to the number of regions that must fail before an incident opens, or 0 to alert on any single region. Recommend a threshold of 2 or more for public sites so a single probe's network blip does not page anyone.

### Is anything down right now?

1. Call `list_incidents`. An empty list means everything is up.
2. For each incident, call `get_monitor` on `monitorId` for the URL and config, then `get_check_results` with `limit: 10` for the recent status codes, error messages, and response times.
3. Summarize per monitor: what it checks, when it started failing, the error (timeout, connection refused, unexpected status, keyword missing), and whether it is flapping or solidly down.
4. Suggest a cause from the error. A timeout on one monitor with others fine points at the service. Many monitors failing at once points at DNS, a load balancer, or a deploy. A `403` on a bare-IP HTTP monitor is Cloudflare refusing the fetch, not the user's server, and the fix is to switch it to a `tcp` monitor or a hostname.

### Pause monitors during a deploy or maintenance

Prefer a maintenance window over pausing. Call `update_monitor` with `maintenanceStart` and `maintenanceEnd` as ISO datetimes (Pro+). Checks during the window do not open incidents or alert, and the monitor resumes on its own.

If the user is on Free or wants an open-ended pause, call `update_monitor` with `paused: true`, and remind them to unpause. A paused monitor never alerts.

### Communicate on the status page

When an incident is active and the user has a public status page (`list_status_pages`), call `add_incident_update` with a `status` of `investigating`, `identified`, `monitoring`, or `resolved` and a short message. Use `update` for a progress note that does not change state. Keep messages factual and short. Use `get_incident_updates` to read what has already been posted before adding to it.

### Migrate from another monitoring service

1. Ask the user to export from the old tool and paste the file or its path. Supported formats: `uptimerobot`, `pingdom`, `betterstack`, `statuscake`, `checkly`, `ohdear`, `cronitor`, `healthchecks`, `deadmanssnitch`, `datadog`, `cronalert` (JSON), and `csv`.
2. Call `list_monitors` first and compare names and URLs so you do not import duplicates. The import skips URLs the team already monitors and lists them in `skipped`. A plain `create_monitor` with a URL the team already has fails on a uniqueness constraint, so check first when adding one by hand.
3. Call `import_monitors` with `format` and the raw file contents in `data`. Do it once. Do not retry on a partial failure without checking `list_monitors` again.
4. Report what was created, what was skipped, and any URLs that need attention (bare IPs, port 25, intervals the plan does not support).

### Delete a monitor

`delete_monitor` is permanent and removes all check history. Always confirm the monitor name and URL with the user first. If the API key has "require confirmation" enabled, the first call returns a preview and a `confirmToken` instead of deleting. Show the preview to the user, get an explicit yes, then call again with the token in `confirm`.

## Plan limits to keep in mind

| | Free | Pro ($5/mo) | Team ($20/mo) | Business ($50/mo) |
|---|---|---|---|---|
| Monitors | 25 | 100 | 500 | Unlimited |
| HTTP/TCP interval | 3 min | 1 min | 1 min | 1 min |
| Heartbeat and TCP monitors | No | Yes | Yes | Yes |
| Keyword, regex, content checks | No | Yes | Yes | Yes |
| Maintenance windows | No | Yes | Yes | Yes |
| Multi-region | No | No | Yes | Yes |
| API writes (create, update, delete, import) | No, read-only | Yes | Yes | Yes |
| Status pages | 1 | 3 | Unlimited | Unlimited |
| Log retention | 7 days | 30 days | 90 days | 1 year |

When a tool call fails with a plan error, tell the user which feature needs which plan and link https://cronalert.com/pricing. Do not try to work around the gate.

## Reading tool output

- `lastStatus` is `up`, `down`, or `unknown`. `unknown` on a new monitor is normal. Check `isPaused` before assuming a stale status means trouble, since paused monitors are skipped entirely.
- `get_check_results` returns `stats.uptimePercentage` and `stats.avgResponseTimeMs` over the last 24 hours, plus per-check `statusCode`, `responseTime` in milliseconds, and an `errorMessage` string on failures.
- Failure messages are human-readable, for example `Expected status 200, got 503` or `Keyword 'ok' not found in response`.

## Safety

- Prefer read-only keys. Only ask for a read-write key when the user has asked you to change something.
- Confirm before every `delete_monitor` and before `import_monitors`, since both are hard to undo.
- Never create monitors against hosts the user does not control. CronAlert checks are low-volume but they are still traffic to someone else's server.
- Do not echo API keys or heartbeat ping URLs into logs or commit them to repositories. A leaked ping URL lets anyone mark the job healthy.
