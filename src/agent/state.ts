import { Annotation } from '@langchain/langgraph';

export interface TestLog {
  payload: Record<string, unknown>;
  statusCode: number;
  responseBody: unknown;
  durationMs: number;
}

export interface Vulnerability {
  severity: 'Low' | 'Moderate' | 'High';
  trigger: Record<string, unknown>;
  statusCode: number;
  description: string;
}

export const AuditStateAnnotation = Annotation.Root({
  // Raw JSON string of the OpenAPI spec fetched from /docs.json
  apiSchema: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => '',
  }),
  // Payloads queued by Strategize, consumed by Execute
  pendingPayloads: Annotation<Record<string, unknown>[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),
  // Results from the most recent Execute run (replaced each iteration)
  currentBatch: Annotation<TestLog[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),
  // All results accumulated across all iterations
  testLogs: Annotation<TestLog[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  // All confirmed vulnerabilities accumulated across all iterations
  discoveredVulnerabilities: Annotation<Vulnerability[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  // Incremented by Evaluate after each iteration; controls the loop exit
  iterationCount: Annotation<number>({
    reducer: (_prev, next) => next,
    default: () => 0,
  }),
  // Populated only by the Report node
  finalReport: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => '',
  }),
});

export type AuditState = typeof AuditStateAnnotation.State;
