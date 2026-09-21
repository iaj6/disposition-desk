import { createAgentUIStreamResponse } from "ai";
import { buildAgent } from "@/lib/agent";
import { ModelConfigError } from "@/lib/model";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { messages } = await req.json();
  let built: Awaited<ReturnType<typeof buildAgent>>;
  try {
    built = await buildAgent();
  } catch (e) {
    // A plain-text body: useChat surfaces it as error.message in the UI.
    const status = e instanceof ModelConfigError ? 503 : 500;
    return new Response(e instanceof Error ? e.message : String(e), { status, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  const { agent, close } = built;
  try {
    return await createAgentUIStreamResponse({
      agent,
      uiMessages: messages,
      onFinish: async () => { await close(); },
      onError: (e) => (e instanceof Error ? e.message : String(e)),
    });
  } catch (e) {
    await close();
    throw e;
  }
}
