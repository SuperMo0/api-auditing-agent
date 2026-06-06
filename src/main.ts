import 'dotenv/config';

// Catch unhandled rejections (e.g., from the hidden amount > 50000 bug) so the
// audit agent process survives all 3 iterations and can write its report.
process.on('unhandledRejection', (reason) => {
  console.error('[Unhandled]', reason);
});

import { createServer } from 'http';
import { createApp } from './api/server.js';
import { buildAuditGraph } from './agent/graph.js';

const PORT = 3000;

async function waitForServer(url: string, retries = 15): Promise<void> {
  for (let i = 0; i < retries; i++) {
    try {
      await fetch(url);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  throw new Error(`Server at ${url} did not become ready within timeout`);
}

async function main() {
  const app = createApp();
  const server = createServer(app);

  await new Promise<void>((resolve) => server.listen(PORT, resolve));
  console.log(`[API] Server running on http://localhost:${PORT}`);

  await waitForServer(`http://localhost:${PORT}/docs.json`);

  const schemaResponse = await fetch(`http://localhost:${PORT}/docs.json`);
  const apiSchema = JSON.stringify(await schemaResponse.json());
  console.log('[Agent] OpenAPI schema fetched. Starting audit...\n');

  const graph = buildAuditGraph();
  await graph.invoke({ apiSchema });

  server.close();
  console.log('\n[Done] API server shut down.');
}

main().catch((err) => {
  console.error('[Fatal]', err);
  process.exit(1);
});
