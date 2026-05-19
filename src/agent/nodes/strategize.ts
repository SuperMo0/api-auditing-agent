import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { z } from 'zod';
import type { AuditState } from '../state.js';

const model = new ChatGoogleGenerativeAI({
  model: 'gemini-2.5-flash',
  apiKey: process.env.GEMINI_API_KEY,
  temperature: 1,
});

const FuzzBatchSchema = z.object({
  payloads: z.array(z.record(z.string(), z.unknown())).min(10).max(10),
  reasoning: z.string().describe('Brief explanation of the fuzzing strategy for this iteration'),
});

const structuredModel = model.withStructuredOutput(FuzzBatchSchema, {
  name: 'fuzz_batch',
});

export async function strategizeNode(state: AuditState): Promise<Partial<AuditState>> {
  const isFirstIteration = state.iterationCount === 0;

  const failures = state.currentBatch.filter((log) => log.statusCode >= 500);

  const prompt = isFirstIteration
    ? `You are a security researcher performing API fuzzing against a financial transactions API.

Given the OpenAPI schema below, generate exactly 10 diverse edge-case payloads designed to uncover hidden server bugs.

Include a variety of: boundary values (e.g., amount = 0.01, amount = 0.00), type mismatches (strings where numbers are expected), missing required fields, cross-field violations (sender.accountId === recipient.accountId), maximum string lengths, timestamps set to the exact current moment (use an ISO 8601 string for "right now"), very large amounts, and negative values.

The goal is to find inputs that PASS Zod schema validation but trigger unexpected behavior in business logic or crash the server.

OpenAPI Schema:
${state.apiSchema}`
    : `You are a security researcher analyzing API failures.

Previous iteration found these 500-level errors:
${JSON.stringify(failures, null, 2)}

Generate exactly 10 mutated payloads that probe the same failure modes more deeply. Vary the triggering conditions: test adjacent boundary values, combinations of multiple edge-case fields simultaneously, and slight modifications of previously failing payloads.

OpenAPI Schema:
${state.apiSchema}`;

  const result = await structuredModel.invoke(prompt);

  console.log(`\n[Strategize] Iteration ${state.iterationCount + 1}/3 — ${result.payloads.length} payloads queued`);
  console.log(`[Strategize] Strategy: ${result.reasoning}`);

  return { pendingPayloads: result.payloads };
}
