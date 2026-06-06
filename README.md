# API Auditing Agent

An autonomous LangGraph agent that fuzzes an Express API, evaluates the responses with Gemini, and writes a Markdown vulnerability report.

## Run

```bash
npm install
echo "GEMINI_API_KEY=your_key_here" > .env
npm start
```

The script boots the target API on `:3000`, runs 3 fuzz iterations, and writes a timestamped report to `reports/`.

## How it works

```text
strategize → execute → evaluate → (loop ×3) → report
```

- **strategize** — Gemini generates 10 edge-case payloads from the OpenAPI spec
- **execute** — fires them at `POST /api/v1/transactions`
- **evaluate** — Gemini judges each response (Low / Moderate / High)
- **report** — writes `reports/audit-report-<timestamp>.md`

## Scripts

```bash
npm start        # full audit run
npm test         # vitest
npm run typecheck
```
