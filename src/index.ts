#!/usr/bin/env node

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

const server = new McpServer({
  name: "cronalert",
  version: "1.0.1",
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
  "Create a new uptime monitor that periodically checks a URL and alerts on failure.",
  {
    name: z.string().describe("Display name for the monitor"),
    url: z.string().url().describe("URL to monitor"),
    checkInterval: z.number().int().positive().optional().default(180).describe("Check interval in seconds (default 180)"),
    method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"]).optional().default("GET").describe("HTTP method (default GET)"),
    expectedStatusCode: z.number().int().optional().default(200).describe("Expected HTTP status code (default 200)"),
  },
  {

      readOnlyHint: false,
      destructiveHint: true,
      openWorldHint: false,
  },
  async ({ name, url, checkInterval, method, expectedStatusCode }) => {
    const data = await apiRequest("/monitors", {
      method: "POST",
      body: JSON.stringify({ name, url, checkInterval, method, expectedStatusCode }),
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
  "Update an existing monitor's configuration (name, URL, interval, method, etc.).",
  {
    id: z.string().describe("Monitor ID"),
    name: z.string().optional().describe("Display name"),
    url: z.string().url().optional().describe("URL to monitor"),
    checkInterval: z.number().int().positive().optional().describe("Check interval in seconds"),
    method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"]).optional().describe("HTTP method"),
    expectedStatusCode: z.number().int().optional().describe("Expected HTTP status code"),
    paused: z.boolean().optional().describe("Pause or resume the monitor"),
  },
  {

      readOnlyHint: false,
      destructiveHint: true,
      openWorldHint: false,
  },
  async ({ id, ...fields }) => {
    const body: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(fields)) {
      if (v !== undefined) body[k] = v;
    }
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

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("CronAlert MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
