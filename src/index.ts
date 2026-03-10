import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_BASE = "https://cronalert.com/api/v1";

function getApiKey(): string {
  const key = process.env.CRONALERT_API_KEY;
  if (!key) {
    throw new Error(
      "CRONALERT_API_KEY environment variable is required. " +
        "Get your API key from https://cronalert.com/app/settings/api-keys"
    );
  }
  return key;
}

async function apiRequest(
  path: string,
  options: RequestInit = {}
): Promise<unknown> {
  const apiKey = getApiKey();
  const url = `${API_BASE}${path}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`API error ${response.status}: ${body}`);
  }

  return response.json();
}

function buildQueryString(
  params: Record<string, string | number | undefined>
): string {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== ""
  );
  if (entries.length === 0) return "";
  return "?" + entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join("&");
}

function stripUndefined(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) result[k] = v;
  }
  return result;
}

const server = new McpServer({
  name: "cronalert",
  version: "1.0.6",
});

// 1. list_monitors (read-only)
server.tool(
  "list_monitors",
  "List all uptime monitors. Optionally filter by status (up, down, unknown) and paginate.",
  {
    page: z.number().int().positive().optional().describe("Page number"),
    limit: z.number().int().positive().max(100).optional().describe("Results per page (max 100)"),
    status: z.enum(["up", "down", "unknown"]).optional().describe("Filter by monitor status"),
  },
  {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
  },
  async ({ page, limit, status }) => {
    const qs = buildQueryString({ page, limit, status });
    const data = await apiRequest(`/monitors${qs}`);
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  }
);

// 2. create_monitor (destructive - creates data)
server.tool(
  "create_monitor",
  "Create a new uptime monitor. Set type to 'heartbeat' for cron job / background task monitoring (returns a ping URL instead of checking a URL).",
  {
    name: z.string().describe("Display name for the monitor"),
    type: z.enum(["http", "heartbeat"]).optional().default("http").describe("Monitor type: 'http' checks a URL, 'heartbeat' waits for pings from your application"),
    url: z.string().url().optional().describe("URL to monitor (required for http type, ignored for heartbeat)"),
    method: z.enum(["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"]).optional().default("GET").describe("HTTP method (default GET, http type only)"),
    expectedStatusCode: z.number().int().min(100).max(599).optional().default(200).describe("Expected HTTP status code (default 200, http type only)"),
    timeout: z.number().int().min(1).max(120).optional().default(30).describe("Request timeout in seconds (1-120, default 30, http type only)"),
    checkInterval: z.number().int().min(30).max(86400).optional().default(180).describe("Check interval in seconds (default 180, auto-set from plan)"),
    keyword: z.string().max(500).optional().describe("Keyword to search for in response body (Pro plan+, http type only)"),
    keywordMatchType: z.enum(["contains", "not_contains"]).optional().describe("Whether the keyword should be present or absent (Pro plan+)"),
    headers: z.string().max(4096).optional().describe("Custom request headers as JSON string, e.g. '{\"Authorization\": \"Bearer token\"}' (http type only)"),
    regions: z.string().max(500).optional().describe("Comma-separated region IDs for multi-region checks: us-east, us-west, eu-west, eu-central, ap-southeast (Team plan+, http type only)"),
    failureThreshold: z.number().int().min(0).max(5).optional().describe("Number of regions that must fail before alerting (0 = alert on any failure, multi-region only)"),
    maintenanceStart: z.string().optional().describe("Maintenance window start as ISO datetime string (Pro plan+)"),
    maintenanceEnd: z.string().optional().describe("Maintenance window end as ISO datetime string (Pro plan+)"),
  },
  {
      readOnlyHint: false,
      destructiveHint: true,
      openWorldHint: false,
  },
  async (params) => {
    const body = stripUndefined(params as Record<string, unknown>);
    const data = await apiRequest("/monitors", {
      method: "POST",
      body: JSON.stringify(body),
    });
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  }
);

// 3. get_monitor (read-only)
server.tool(
  "get_monitor",
  "Get detailed information about a specific monitor including its current status.",
  {
    id: z.string().describe("Monitor ID"),
  },
  {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
  },
  async ({ id }) => {
    const data = await apiRequest(`/monitors/${id}`);
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  }
);

// 4. update_monitor (destructive - modifies data)
server.tool(
  "update_monitor",
  "Update an existing monitor's configuration. Only provided fields are changed.",
  {
    id: z.string().describe("Monitor ID"),
    name: z.string().optional().describe("Display name"),
    url: z.string().url().optional().describe("URL to monitor (http type only)"),
    method: z.enum(["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"]).optional().describe("HTTP method"),
    expectedStatusCode: z.number().int().min(100).max(599).optional().describe("Expected HTTP status code"),
    timeout: z.number().int().min(1).max(120).optional().describe("Request timeout in seconds (1-120)"),
    keyword: z.string().max(500).optional().describe("Keyword to search for in response body (Pro plan+)"),
    keywordMatchType: z.enum(["contains", "not_contains"]).optional().describe("Whether the keyword should be present or absent"),
    headers: z.string().max(4096).optional().describe("Custom request headers as JSON string"),
    regions: z.string().max(500).optional().describe("Comma-separated region IDs for multi-region checks (Team plan+)"),
    failureThreshold: z.number().int().min(0).max(5).optional().describe("Number of regions that must fail before alerting"),
    maintenanceStart: z.string().optional().describe("Maintenance window start as ISO datetime string"),
    maintenanceEnd: z.string().optional().describe("Maintenance window end as ISO datetime string"),
    paused: z.boolean().optional().describe("Pause or resume the monitor"),
  },
  {
      readOnlyHint: false,
      destructiveHint: true,
      openWorldHint: false,
  },
  async ({ id, ...fields }) => {
    const body = stripUndefined(fields as Record<string, unknown>);
    const data = await apiRequest(`/monitors/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  }
);

// 5. delete_monitor (destructive - deletes data permanently)
server.tool(
  "delete_monitor",
  "Permanently delete a monitor and all its check history. This cannot be undone.",
  {
    id: z.string().describe("Monitor ID"),
  },
  {
      readOnlyHint: false,
      destructiveHint: true,
      openWorldHint: false,
  },
  async ({ id }) => {
    const data = await apiRequest(`/monitors/${id}`, { method: "DELETE" });
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  }
);

// 6. get_check_results (read-only)
server.tool(
  "get_check_results",
  "Get recent check results for a monitor, including response times, status codes, and uptime percentage.",
  {
    id: z.string().describe("Monitor ID"),
    page: z.number().int().positive().optional().describe("Page number"),
    limit: z.number().int().positive().max(100).optional().describe("Results per page (max 100)"),
  },
  {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
  },
  async ({ id, page, limit }) => {
    const qs = buildQueryString({ page, limit });
    const data = await apiRequest(`/monitors/${id}/checks${qs}`);
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  }
);

// 7. get_monitor_incidents (read-only)
server.tool(
  "get_monitor_incidents",
  "Get incidents for a specific monitor — periods when the monitor was down.",
  {
    id: z.string().describe("Monitor ID"),
    page: z.number().int().positive().optional().describe("Page number"),
    limit: z.number().int().positive().max(100).optional().describe("Results per page (max 100)"),
  },
  {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
  },
  async ({ id, page, limit }) => {
    const qs = buildQueryString({ page, limit });
    const data = await apiRequest(`/monitors/${id}/incidents${qs}`);
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  }
);

// 8. list_incidents (read-only)
server.tool(
  "list_incidents",
  "List all active incidents across all monitors.",
  {},
  {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
  },
  async () => {
    const data = await apiRequest("/incidents");
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  }
);

// 9. list_status_pages (read-only)
server.tool(
  "list_status_pages",
  "List all public status pages configured for your account.",
  {},
  {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
  },
  async () => {
    const data = await apiRequest("/status-pages");
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  }
);

// 10. add_incident_update (write - posts a status update on an incident)
server.tool(
  "add_incident_update",
  "Post a status update on an active incident. Updates appear on the public status page.",
  {
    incidentId: z.string().describe("Incident ID"),
    status: z.enum(["investigating", "identified", "monitoring", "update", "resolved"]).describe("Update status"),
    message: z.string().describe("Update message text"),
  },
  {
      readOnlyHint: false,
      destructiveHint: false,
      openWorldHint: false,
  },
  async ({ incidentId, status, message }) => {
    const data = await apiRequest(`/incidents/${incidentId}/updates`, {
      method: "POST",
      body: JSON.stringify({ status, message }),
    });
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  }
);

// 11. get_incident_updates (read-only)
server.tool(
  "get_incident_updates",
  "Get status updates for a specific incident.",
  {
    incidentId: z.string().describe("Incident ID"),
  },
  {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
  },
  async ({ incidentId }) => {
    const data = await apiRequest(`/incidents/${incidentId}/updates`);
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("CronAlert MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
