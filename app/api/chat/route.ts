import { createAgentUIStreamResponse } from "ai";
import { buildAgent } from "@/lib/agent";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { messages } = await req.json();
  const { agent, close } = await buildAgent();
  return createAgentUIStreamResponse({
    agent,
    uiMessages: messages,
    onFinish: async () => { await close(); },
    onError: (e) => (e instanceof Error ? e.message : String(e)),
  });
}
