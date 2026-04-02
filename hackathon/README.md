# Doctor Opus Clinical Orchestrator

FHIR-native clinical AI orchestration for the Agents Assemble Hackathon (Prompt Opinion + Devpost).

## Submission Scope

This project targets both required tracks:

- Path A: MCP Server listing for clinical tools.
- Path B: A2A Agent listing for orchestration.

The implementation is designed as an interoperability layer on top of the existing Doctor Opus engine, without rewriting core product logic.

## Why This Matters

Clinicians often need fast second opinions under uncertainty when ECG, imaging, labs, and condition history are partially conflicting.  
Doctor Opus Clinical Orchestrator combines multi-modal AI analysis with contradiction-aware reasoning to return explainable clinical outputs.

## Architecture

1. Prompt Opinion sends a task to the A2A agent.
2. Agent reads SHARP context headers.
3. Agent fetches FHIR context (`Patient`, `Observation`, `Condition`, `ImagingStudy`, optional `Encounter`).
4. Agent invokes Doctor Opus MCP tools.
5. Agent invokes TRIZ contradiction MCP tools.
6. Agent returns a structured FHIR `DiagnosticReport` R4.

## Core Components

- `mcp_server/` — clinical analysis tools (`analyze_ecg`, `analyze_ct`, `generate_report`, etc.).
- `triz_mcp_server/` — contradiction detection and tradeoff planning.
- `a2a_agent/` — orchestration agent and agent card.
- `fhir_adapter/` — FHIR read/write adapters and mapping.
- `synthetic_data/` — synthetic FHIR bundles for deterministic demos.
- `prompt_opinion/` — marketplace metadata.
- `demo/` — video script and runbook.

## SHARP Context Headers

- `X-SHARP-Patient-ID`
- `X-SHARP-FHIR-Base-URL`
- `X-SHARP-FHIR-Token`
- `X-SHARP-Encounter-ID`

## Compliance and Safety

- Synthetic/de-identified data only.
- No PHI in logs, payload samples, or demo artifacts.
- Structured error responses for all MCP and A2A flows.

## Judge-Focused Value

### AI Factor

Uses generative multi-modal reasoning and contradiction-aware clinical tradeoff analysis, not rule-only automation.

### Potential Impact

Produces structured second-opinion outputs faster, with explicit rationale and priority plans for clinicians.

### Feasibility

FHIR R4-based interoperability, marketplace discoverability, and deployable service boundaries aligned with current healthcare integration patterns.

## Demo Scenario

Primary scenario: **Chest CT Triage — Clinical Second Opinion**  
See `demo/demo_scenario.md`.

## Required Public Links (to fill before submission)

- MCP Server endpoint: `https://your-deployment-url/mcp`
- Agent card URL: `https://your-deployment-url/.well-known/agent.json`
- A2A endpoint: `https://your-deployment-url/a2a`
- Demo video URL: `https://youtube.com/...` or `https://vimeo.com/...`
- Marketplace listing URL(s): add after publication

The agent card is exposed dynamically from the Next.js route `/.well-known/agent.json`
and derives its base URL from `NEXT_PUBLIC_APP_URL` (fallback: `NEXTAUTH_URL`).

Marketplace config is also exposed dynamically via `/.well-known/marketplace-config.json`
using the same base URL resolution. Optional submission links can be configured via:
`HACKATHON_DEMO_VIDEO_URL`, `HACKATHON_REPOSITORY_URL`, `HACKATHON_DEVPOST_URL`.

For demo readiness checks, use `/.well-known/health` to verify runtime status and
discoverability links before recording or live presentation.

## Quick Start (Submission Checklist)

1. Start services with Docker Compose.
2. Validate MCP tool listing and tool invocation.
3. Validate `/.well-known/agent.json`.
4. Run synthetic Chest CT scenario end-to-end.
5. Record 3-minute public demo video.
6. Publish Marketplace listing and complete Devpost form in English.

Preflight command before live demo:

`./hackathon/demo/preflight.sh https://your-deployment-url`

End-to-end functional check:

`./hackathon/demo/e2e.sh https://your-deployment-url`

For auth-protected API checks, pass session cookie:

`AUTH_COOKIE='next-auth.session-token=...' ./hackathon/demo/e2e.sh https://your-deployment-url`
