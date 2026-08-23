import { anthropic } from "@ai-sdk/anthropic";
import { streamText, tool } from "ai";
import { z } from "zod";

const backendUrl = process.env.RECON_BACKEND_URL || "http://127.0.0.1:8000";

const financeContext = tool({
  description: "Retrieve current reconciliation summary and open exceptions.",
  inputSchema: z.object({
    focus: z.string().describe("The finance topic to investigate"),
  }),
  execute: async ({ focus }) => {
    const [summaryResponse, exceptionsResponse] = await Promise.all([
      fetch(`${backendUrl}/stats/summary`),
      fetch(`${backendUrl}/exceptions?status=open`),
    ]);
    if (!summaryResponse.ok || !exceptionsResponse.ok) {
      throw new Error("Reconciliation service is unavailable");
    }
    const summary = await summaryResponse.json();
    const exceptions = await exceptionsResponse.json();
    return {
      focus,
      summary,
      open_exceptions: exceptions.slice(0, 10),
    };
  },
});

export default async function handler(request) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const body = await request.json().catch(() => ({}));
  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (!question || question.length > 500) {
    return Response.json({ error: "Question must be between 1 and 500 characters" }, { status: 400 });
  }

  const result = streamText({
    model: anthropic("claude-sonnet-4-6"),
    system: "You are a concise financial reconciliation analyst. Use the financeContext tool for current figures. Explain answers plainly and never invent amounts.",
    messages: [{ role: "user", content: question }],
    tools: { financeContext },
    toolChoice: "auto",
    providerOptions: {
      anthropic: {
        thinking: { type: "enabled", budgetTokens: 1024 },
      },
    },
    maxOutputTokens: 500,
  });

  return result.toTextStreamResponse();
}
