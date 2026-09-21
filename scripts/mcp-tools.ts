import { config } from "dotenv";
config({ path: ".env.local" });
config();

async function main() {
  const { sanityContextConfigured, sanityContextTools } = await import("../lib/mcp");
  if (!sanityContextConfigured()) {
    console.log("Sanity Context is not configured (SANITY_CONTEXT_TOKEN and SANITY_CONTEXT_MCP_URL are unset); the agent will use the offline stand-ins.");
    return;
  }
  const { tools, close } = await sanityContextTools();
  for (const [name, t] of Object.entries(tools)) console.log(name, "—", (typeof t.description === "string" ? t.description : "").split("\n")[0].slice(0, 110));
  await close();
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
