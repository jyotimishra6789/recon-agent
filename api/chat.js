import { google } from "@ai-sdk/google";
import { Output, streamText, tool } from "ai";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 60;

const backendUrl = process.env.RECON_BACKEND_URL || "http://127.0.0.1:8000";
const geminiModel = process.env.GEMINI_MODEL || "gemini-3.6-flash";

async function financeRequest(path, options) {
  const signal = options?.signal || AbortSignal.timeout(4000);
  const response = await fetch(`${backendUrl}${path}`, { ...options, signal });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.detail || "Finance service request failed");
  return payload;
}

const reconciliationResponseSchema = z.object({
  answer: z.string().describe("A concise plain-language answer"),
  matched_transaction: z.object({
    bank_ref_id: z.string().nullable(),
    order_id: z.string().nullable(),
    invoice_id: z.string().nullable(),
    amount: z.number().nullable(),
  }).nullable().describe("The matched transaction when the question identifies one"),
  confidence_score: z.number().min(0).max(100).nullable(),
  reason: z.string().describe("Why the transaction matched or why it could not be matched"),
  exception_type: z.enum([
    "amount_mismatch_unexplained",
    "missing_counterpart",
    "duplicate",
    "unresolved",
    "none",
  ]).describe("The exception category, or none when no exception applies"),
  human_review_required: z.boolean(),
  guardrail_reasons: z.array(z.string()),
});

const financeContext = tool({
  description: "Retrieve current reconciliation summary and the highest-ranked finance records.",
  inputSchema: z.object({
    focus: z.string().describe("The finance topic to investigate"),
  }),
  execute: async ({ focus }) => {
    const [summary, context] = await Promise.all([
      financeRequest("/stats/summary"),
      financeRequest(`/finance/context?q=${encodeURIComponent(focus)}&limit=6&max_chars=6000`),
    ]);
    return {
      focus,
      summary,
      ...context,
    };
  },
});

const searchMemory = tool({
  description: "Find how similar vendors, receipts, or exceptions were handled in previous reconciliations.",
  inputSchema: z.object({ query: z.string().min(2), limit: z.number().int().min(1).max(10).default(5) }),
  execute: ({ query, limit }) => financeRequest(`/memory/search?query=${encodeURIComponent(query)}&limit=${limit}`),
});

const searchFinanceRecords = tool({
  description: "Search invoices, bank transactions, settlements, matches, exceptions, learned patterns, and finance policies. Results are reranked by relevance.",
  inputSchema: z.object({
    query: z.string().min(2),
    limit: z.number().int().min(1).max(20).default(8),
  }),
  execute: ({ query, limit }) => financeRequest(`/finance/search?q=${encodeURIComponent(query)}&limit=${limit}`),
});

const fetchTransaction = tool({
  description: "Fetch one bank, settlement, or ledger transaction by its reference.",
  inputSchema: z.object({
    source: z.enum(["bank", "settlement", "ledger"]),
    reference: z.string(),
  }),
  execute: ({ source, reference }) => financeRequest(`/finance/transactions/${source}/${encodeURIComponent(reference)}`),
});

const checkInvoice = tool({
  description: "Look up an internal ledger invoice by invoice ID.",
  inputSchema: z.object({ invoice_id: z.string() }),
  execute: ({ invoice_id }) => financeRequest(`/finance/invoices/${encodeURIComponent(invoice_id)}`),
});

const compareAmount = tool({
  description: "Compare a fetched transaction amount with a fetched invoice amount.",
  inputSchema: z.object({
    transaction_ref: z.string(),
    transaction_amount: z.number(),
    invoice_id: z.string(),
    invoice_amount: z.number(),
    tolerance: z.number().default(0.01),
  }),
  execute: (input) => financeRequest("/finance/compare", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }),
});

const updateReconciliationStatus = tool({
  description: "Request a reconciliation status update. Server guardrails block AI approval of high-value, suspicious, low-confidence, or mismatched transactions and return human review requirements.",
  inputSchema: z.object({
    source_ref: z.string(),
    status: z.enum(["open", "resolved"]),
    resolution_reason: z.string(),
    pattern_type: z.string().nullable().default(null),
    transaction_amount: z.number().nullable().default(null),
    invoice_amount: z.number().nullable().default(null),
    confidence_score: z.number().min(0).max(100).nullable().default(null),
    exception_type: z.string().nullable().default(null),
  }),
  execute: (input) => financeRequest("/finance/reconciliation-status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  }),
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
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return Response.json({ error: "Missing GOOGLE_GENERATIVE_AI_API_KEY in this Vercel environment" }, { status: 503 });
  }

  let curatedContext = { context: { records: [], previous_handling: [] }, unavailable: true };
  try {
    curatedContext = await financeRequest(
      `/finance/context?q=${encodeURIComponent(question)}&limit=6&max_chars=6000`,
    );
  } catch (error) {
    curatedContext = {
      context: { records: [], previous_handling: [] },
      unavailable: true,
      message: "Finance backend is unavailable; do not invent database values.",
    };
  }

  const result = streamText({
    model: google(geminiModel),
    system: `You are a concise financial reconciliation analyst. Return every field in the required schema. Use null for matched_transaction and confidence_score when the question is not about one transaction. Never invent amounts. Use the curated finance context below; it has already been filtered, reranked, deduplicated, summarized, and limited to a strict budget. Use searchFinanceRecords or searchMemory only when the curated context is insufficient. Treat prior memories as guidance, not proof. For transaction investigations, follow this sequence: fetchTransaction, checkInvoice, compareAmount, then updateReconciliationStatus only when the user explicitly requests a status update and the comparison supports it. Do not update records for a read-only question.

  CURATED FINANCE CONTEXT:
  ${JSON.stringify(curatedContext)}`,
    messages: [{ role: "user", content: question }],
    tools: {
      financeContext,
      searchFinanceRecords,
      searchMemory,
      fetchTransaction,
      checkInvoice,
      compareAmount,
      updateReconciliationStatus,
    },
    toolChoice: "auto",
    output: Output.object({ schema: reconciliationResponseSchema }),
    onError: ({ error }) => console.error("Gemini stream error:", error),
    maxOutputTokens: 1600,
  });

  return result.toTextStreamResponse();
}
