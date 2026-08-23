import { anthropic } from "@ai-sdk/anthropic";
import { Output, streamText, tool } from "ai";
import { z } from "zod";

const backendUrl = process.env.RECON_BACKEND_URL || "http://127.0.0.1:8000";

async function financeRequest(path, options) {
  const response = await fetch(`${backendUrl}${path}`, options);
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
});

const financeContext = tool({
  description: "Retrieve current reconciliation summary and the highest-ranked finance records.",
  inputSchema: z.object({
    focus: z.string().describe("The finance topic to investigate"),
  }),
  execute: async ({ focus }) => {
    const [summary, search, memories] = await Promise.all([
      financeRequest("/stats/summary"),
      financeRequest(`/finance/search?q=${encodeURIComponent(focus)}&limit=8`),
      financeRequest(`/memory/search?query=${encodeURIComponent(focus)}&limit=5`),
    ]);
    return {
      focus,
      summary,
      retrieved_records: search.results,
      reranked: search.reranked,
      previous_handling: memories.results,
      memory_provider: memories.provider,
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
  description: "Update an exception status only after comparison confirms the intended resolution.",
  inputSchema: z.object({
    source_ref: z.string(),
    status: z.enum(["open", "resolved"]),
    resolution_reason: z.string(),
    pattern_type: z.string().nullable().default(null),
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

  const result = streamText({
    model: anthropic("claude-sonnet-4-6"),
    system: "You are a concise financial reconciliation analyst. Return every field in the required schema. Use null for matched_transaction and confidence_score when the question is not about one transaction. Never invent amounts. Start broad questions with searchFinanceRecords and searchMemory to retrieve and rerank relevant records and previous vendor handling. Treat prior memories as guidance, not proof. For transaction investigations, follow this sequence: fetchTransaction, checkInvoice, compareAmount, then updateReconciliationStatus only when the user explicitly requests a status update and the comparison supports it. Do not update records for a read-only question.",
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
    providerOptions: {
      anthropic: {
        thinking: { type: "enabled", budgetTokens: 1024 },
      },
    },
    maxOutputTokens: 1600,
  });

  return result.toTextStreamResponse();
}
