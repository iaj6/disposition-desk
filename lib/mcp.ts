import { createMCPClient } from "@ai-sdk/mcp";
import type { ToolSet } from "ai";

/**
 * Sanity Context MCP. One organization-level token (Context Viewer) and one or two endpoints:
 *  - SANITY_CONTEXT_MCP_URL     GROQ mode over the dataset (initial_context, schema_explorer, groq_query, array_field_reader)
 *  - SANITY_CONTEXT_KB_MCP_URL  Knowledge Base mode (initial_context, knowledge_base_read) — may be the same endpoint with ?mode=knowledge_base
 * Endpoint shape: https://api.sanity.io/v1/context/organizations/<orgId>/mcp/<name>
 */
export function sanityContextConfigured() {
  return Boolean(process.env.SANITY_CONTEXT_MCP_URL && process.env.SANITY_CONTEXT_TOKEN);
}

export async function sanityContextTools(): Promise<{ tools: ToolSet; close: () => Promise<void> }> {
  const token = process.env.SANITY_CONTEXT_TOKEN!;
  const headers = { Authorization: `Bearer ${token}` };
  const clients: Array<{ close: () => Promise<void> }> = [];
  const tools: ToolSet = {};

  const attach = async (url: string, prefix: string) => {
    const client = await createMCPClient({ transport: { type: "http", url, headers }, maxRetries: 2 });
    clients.push(client);
    const t = await client.tools();
    for (const [name, def] of Object.entries(t)) tools[`${prefix}${name}`] = def;
  };

  // Each mode is attached independently: an endpoint may carry only a dataset source or only a
  // Knowledge Base, and the app should use whatever is there.
  const tryAttach = async (url: string | undefined, prefix: string, label: string) => {
    if (!url) return;
    try {
      await attach(url, prefix);
    } catch (e) {
      console.warn(`[disposition-desk] ${label} endpoint unavailable: ${e instanceof Error ? e.message.split("\n")[0].slice(0, 160) : e}`);
    }
  };
  await tryAttach(process.env.SANITY_CONTEXT_MCP_URL, "sanity_", "GROQ-mode");
  await tryAttach(process.env.SANITY_CONTEXT_KB_MCP_URL, "kb_", "Knowledge Base");
  if (Object.keys(tools).length === 0) throw new Error("No Sanity Context tools available from either endpoint");

  return { tools, close: async () => { await Promise.all(clients.map((c) => c.close())); } };
}
