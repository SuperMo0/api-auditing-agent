import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { z } from 'zod';
import type { AuditState } from '../state.js';

const model = new ChatGoogleGenerativeAI({
  model: 'gemini-2.5-flash',
  apiKey: process.env.GEMINI_API_KEY,
  temperature: 1,
});

// Explicit payload schema that mirrors the Transaction shape so Gemini can generate
// fully-populated objects with the right fields. All fields are strings/numbers/booleans
// to keep the schema simple for structured output.
const SenderPayloadSchema = z.object({
  accountId: z.string().describe('8–16 alphanumeric characters'),
  name: z.string().describe('Sender full name, 2–50 chars'),
  kycVerified: z.boolean().describe('MUST be true to pass validation'),
});

const RecipientPayloadSchema = z.object({
  accountId: z.string().describe('8–16 alphanumeric characters, MUST differ from sender'),
  name: z.string().describe('Recipient full name, 2–50 chars'),
  bankCode: z.string().describe('Exactly 9 digits, e.g. 021000021'),
});

const MetadataPayloadSchema = z.object({
  ipAddress: z.string().describe('Valid IPv4 address, e.g. 192.168.1.1'),
  userAgent: z.string().describe('Any user agent string under 200 chars'),
  timestamp: z.string().describe('ISO 8601 datetime string'),
});

const TransactionPayloadSchema = z.object({
  transactionId: z.string().describe('A valid UUID v4'),
  amount: z.number().describe('Positive number, multiple of 0.01, max 999999.99'),
  currency: z.string().describe('One of: USD, EUR, GBP'),
  sender: SenderPayloadSchema,
  recipient: RecipientPayloadSchema,
  metadata: MetadataPayloadSchema,
});

const FuzzBatchSchema = z.object({
  payloads: z.array(TransactionPayloadSchema).min(10).max(10),
  reasoning: z.string().describe('Brief explanation of the fuzzing strategy for this iteration'),
});

const structuredModel = model.withStructuredOutput(FuzzBatchSchema, {
  name: 'fuzz_batch',
});

export async function strategizeNode(state: AuditState): Promise<Partial<AuditState>> {
  const isFirstIteration = state.iterationCount === 0;

  const failures = state.currentBatch.filter((log) => log.statusCode >= 500);

  const now = new Date().toISOString();

  const prompt = isFirstIteration
    ? `You are a security researcher performing black-box API fuzzing against a financial transactions API.

CRITICAL RULE: Every payload you generate MUST pass the OpenAPI schema validation completely. If a payload fails schema validation the server returns 400 and we learn nothing. We need payloads that PASS validation but trigger crashes (500 errors) in business logic.

Schema constraints you MUST satisfy for every payload:
- transactionId: valid UUID v4 (e.g. "550e8400-e29b-41d4-a716-446655440000")
- amount: positive number, multiple of 0.01, max 999999.99. Try: 0.01, 50001.00, 99999.99, 75000.00, 100000.00
- currency: one of "USD", "EUR", "GBP"
- sender.accountId: 8–16 alphanumeric characters (e.g. "ACCT1234")
- sender.name: 2–50 characters (e.g. "Alice Smith")
- sender.kycVerified: boolean — MUST be true (false triggers a 400)
- recipient.accountId: 8–16 alphanumeric chars, MUST differ from sender.accountId
- recipient.name: 2–50 characters
- recipient.bankCode: EXACTLY 9 digits (e.g. "021000021")
- metadata.ipAddress: valid IPv4 (e.g. "192.168.1.1")
- metadata.userAgent: any string under 200 chars
- metadata.timestamp: ISO 8601 datetime — try the EXACT current time: "${now}"

Business logic edge cases that may trigger 500s:
1. amount = 0.01 (the minimum valid amount — may trigger division-by-zero in fee calculation)
2. amount > 50000 (e.g. 50001.00, 75000.00, 100000.00 — may trigger async audit failure)
3. metadata.timestamp = current time (the timestamp RIGHT NOW: "${now}" — may trigger division-by-zero in age calculation)

Generate exactly 10 payloads. Include at least:
- 2 payloads with amount = 0.01
- 3 payloads with amount > 50000 (various amounts like 50001.00, 75000.00, 100000.00)
- 3 payloads with metadata.timestamp = "${now}"
- 2 payloads combining edge cases (e.g. amount = 0.01 AND timestamp = "${now}")`
    : `You are a security researcher analyzing API failures.

Previous iteration found these 500-level errors:
${JSON.stringify(failures, null, 2)}

Generate exactly 10 mutated payloads that probe the same failure modes more deeply.

CRITICAL RULE: Every payload MUST be structurally valid (pass schema validation). Only valid payloads can trigger 500 crashes.

Schema constraints (must satisfy ALL):
- transactionId: valid UUID v4
- amount: positive, multiple of 0.01, max 999999.99
- currency: "USD", "EUR", or "GBP"
- sender.accountId: 8–16 alphanumeric
- sender.name: 2–50 chars
- sender.kycVerified: MUST be true
- recipient.accountId: 8–16 alphanumeric, different from sender
- recipient.name: 2–50 chars
- recipient.bankCode: exactly 9 digits
- metadata.ipAddress: valid IPv4
- metadata.userAgent: under 200 chars
- metadata.timestamp: ISO 8601 datetime

Current timestamp: "${now}"

Focus on: amount = 0.01, amounts > 50000, and timestamps at or near "${now}".`;

  const result = await structuredModel.invoke(prompt);

  console.log(`\n[Strategize] Iteration ${state.iterationCount + 1}/3 — ${result.payloads.length} payloads queued`);
  console.log(`[Strategize] Strategy: ${result.reasoning}`);

  return { pendingPayloads: result.payloads };
}
