import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { z } from 'zod';
import type { AuditState, Vulnerability } from '../state.js';

const model = new ChatGoogleGenerativeAI({
  model: 'gemini-2.5-flash',
  apiKey: process.env.GEMINI_API_KEY,
});

// Store the trigger as a JSON-encoded string to avoid Gemini schema issues.
// z.record() emits "propertyNames" which Gemini rejects, and nested object schemas
// cause hallucination loops. A plain string is reliable and can be decoded later.
const VulnerabilitySchema = z.object({
  severity: z.enum(['Low', 'Moderate', 'High']),
  triggerJson: z.string().describe('JSON string of the exact request payload that triggered this vulnerability'),
  statusCode: z.number(),
  description: z.string(),
});

const EvaluationResultSchema = z.object({
  vulnerabilities: z.array(VulnerabilitySchema),
  summary: z.string(),
});

const structuredModel = model.withStructuredOutput(EvaluationResultSchema, {
  name: 'evaluation_result',
});

export async function evaluateNode(state: AuditState): Promise<Partial<AuditState>> {
  const prompt = `You are a security expert reviewing API test results for a financial transactions API.

Analyze the following HTTP responses and identify vulnerabilities using these exact rules:

**Low:** The response leaks internal implementation details — stack traces, file paths, internal variable names, or overly verbose error messages beyond what a client needs.

**Moderate:** The server returned 200 or 201 on a payload that violates a business rule (e.g., a negative amount was accepted, an unverified sender got through, a self-transfer was not rejected).

**High:** The server returned a 500 Internal Server Error or 503. This means the server crashed on this input.

**NOT a vulnerability:** A 400 response — this means validation is working correctly. Do not flag these.

Test results from this iteration:
${JSON.stringify(state.currentBatch, null, 2)}`;

  const result = await structuredModel.invoke(prompt);

  console.log(`\n[Evaluate] Iteration ${state.iterationCount + 1} complete`);
  console.log(`[Evaluate] New vulnerabilities found: ${result.vulnerabilities.length}`);
  console.log(`[Evaluate] ${result.summary}`);

  // Map from LLM output (triggerJson string) to the Vulnerability interface (trigger object).
  const vulnerabilities: Vulnerability[] = result.vulnerabilities.map((v) => {
    let trigger: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(v.triggerJson);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        trigger = parsed as Record<string, unknown>;
      }
    } catch {
      trigger = { raw: v.triggerJson };
    }
    return { severity: v.severity, trigger, statusCode: v.statusCode, description: v.description };
  });

  return {
    discoveredVulnerabilities: vulnerabilities,
    iterationCount: state.iterationCount + 1,
  };
}
