import type { AuditState, TestLog } from '../state.js';

const API_URL = 'http://localhost:3000/api/v1/transactions';

export async function executeNode(state: AuditState): Promise<Partial<AuditState>> {
  const results: TestLog[] = [];

  for (const [index, payload] of state.pendingPayloads.entries()) {
    const start = Date.now();
    let statusCode = 0;
    let responseBody: unknown = null;

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      statusCode = response.status;
      responseBody = await response.json().catch(() => null);
    } catch (err) {
      // Network error or server crash
      statusCode = 503;
      responseBody = { error: err instanceof Error ? err.message : String(err) };
    }

    const log: TestLog = {
      payload,
      statusCode,
      responseBody,
      durationMs: Date.now() - start,
    };

    results.push(log);
    console.log(`[Execute] ${index + 1}/10 → HTTP ${statusCode} (${log.durationMs}ms)`);
  }

  return {
    currentBatch: results,
    testLogs: results,
  };
}
