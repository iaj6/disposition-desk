import { config } from "dotenv";
config({ path: ".env.local" });
const { sanityContextTools } = await import("../lib/mcp");
const { tools, close } = await sanityContextTools();
for (const [name, t] of Object.entries(tools)) console.log(name, "—", (t as any).description?.slice(0, 110));
await close();
