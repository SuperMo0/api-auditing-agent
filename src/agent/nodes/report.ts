import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import type { AuditState, Vulnerability } from '../state.js';

function vulnSection(vulns: Vulnerability[], severity: 'High' | 'Moderate' | 'Low'): string {
  const filtered = vulns.filter((v) => v.severity === severity);
  if (filtered.length === 0) return '_None discovered._\n';

  return filtered
    .map(
      (v, i) => `**${i + 1}. ${v.description}**

- Status Code: \`${v.statusCode}\`
- Trigger Payload:
\`\`\`json
${JSON.stringify(v.trigger, null, 2)}
\`\`\`
`
    )
    .join('\n');
}

export async function reportNode(state: AuditState): Promise<Partial<AuditState>> {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-');

  const high = state.discoveredVulnerabilities.filter((v) => v.severity === 'High');
  const moderate = state.discoveredVulnerabilities.filter((v) => v.severity === 'Moderate');
  const low = state.discoveredVulnerabilities.filter((v) => v.severity === 'Low');

  const report = `# API Security Audit Report

**Generated:** ${now.toUTCString()}
**Target:** \`POST http://localhost:3000/api/v1/transactions\`
**Iterations:** ${state.iterationCount}
**Total Payloads Executed:** ${state.testLogs.length}

---

## Summary

| Severity | Count |
|----------|-------|
| 🔴 High | ${high.length} |
| 🟡 Moderate | ${moderate.length} |
| 🟢 Low | ${low.length} |
| **Total** | **${state.discoveredVulnerabilities.length}** |

---

## 🔴 High Severity

${vulnSection(state.discoveredVulnerabilities, 'High')}

---

## 🟡 Moderate Severity

${vulnSection(state.discoveredVulnerabilities, 'Moderate')}

---

## 🟢 Low Severity

${vulnSection(state.discoveredVulnerabilities, 'Low')}

---

## Full Test Log

<details>
<summary>All ${state.testLogs.length} test executions</summary>

${state.testLogs
  .map(
    (log, i) => `### Test ${i + 1} — HTTP ${log.statusCode} (${log.durationMs}ms)

**Payload:**
\`\`\`json
${JSON.stringify(log.payload, null, 2)}
\`\`\`

**Response:**
\`\`\`json
${JSON.stringify(log.responseBody, null, 2)}
\`\`\`
`
  )
  .join('\n')}

</details>
`;

  await mkdir('reports', { recursive: true });
  const filePath = join('reports', `audit-report-${timestamp}.md`);
  await writeFile(filePath, report, 'utf-8');

  console.log(`\n[Report] Saved to: ${filePath}`);
  console.log(`[Report] ${high.length} High  |  ${moderate.length} Moderate  |  ${low.length} Low`);

  return { finalReport: report };
}
