/* CLI: run the agent once. `npm run ask -- "Assess SHP-26-0911"` */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

async function main() {
  const prompt = process.argv.slice(2).join(" ") || "Assess shipment SHP-26-0911 and draft the disposition memo.";
  const { buildAgent } = await import("../lib/agent");
  const { agent, close, mode } = await buildAgent();
  console.error(`[disposition-desk] content mode: ${mode}`);
  try {
    const result = await agent.generate({
      prompt,
      onToolExecutionStart({ toolCall }) {
        console.error(`  → ${toolCall.toolName} ${JSON.stringify(toolCall.input).slice(0, 160)}`);
      },
    });
    console.log(result.text);
    console.error(`\n[usage] ${JSON.stringify(result.totalUsage)}  steps=${result.steps.length}`);
  } finally {
    await close();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
