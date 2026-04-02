# Demo Scenario (<= 3 minutes)

## Title

Chest CT Triage - Clinical Second Opinion

## Objective

Demonstrate that Doctor Opus is:

- Discoverable in Prompt Opinion Marketplace
- MCP + A2A interoperable
- FHIR-native on input/output
- Contradiction-aware via TRIZ-inspired reasoning

## Timeline Script

### 00:00 - 00:15 | Problem Framing

"Clinical decisions often fail when urgency conflicts with diagnostic certainty.  
Doctor Opus resolves this with FHIR-native orchestration and contradiction-aware planning."

### 00:15 - 00:35 | Marketplace Discovery

- Open Prompt Opinion Platform.
- Show Doctor Opus MCP listing.
- Show Doctor Opus A2A agent listing.

### 00:35 - 01:00 | Synthetic Input

- Load synthetic Chest CT case bundle:
  - Patient
  - ImagingStudy
  - Observation (labs/vitals)
  - Condition

### 01:00 - 01:35 | A2A + MCP Orchestration

- Show task accepted by A2A agent.
- Show SHARP context extraction (patient/encounter/FHIR base).
- Show MCP tool calls:
  - `analyze_ct`
  - `summarize_labs` (optional if included in MVP)
  - `generate_report`
- Show TRIZ MCP call:
  - `detect_clinical_contradictions`
  - `resolve_tradeoffs`
  - `generate_priority_plan`

### 01:35 - 02:10 | Clinical Output

- Display contradiction type: `urgency_vs_accuracy`.
- Show resolution options and selected priority plan.
- Show explainable rationale in natural language.

### 02:10 - 02:35 | FHIR Evidence

- Open resulting `DiagnosticReport` R4 JSON.
- Highlight:
  - `resourceType: DiagnosticReport`
  - `status: final`
  - `subject`
  - `conclusion`
  - `presentedForm`

### 02:35 - 03:00 | Closing

"Doctor Opus is FHIR-native, MCP + A2A compliant, and TRIZ-powered for explainable clinical second opinions."

## Backup Plan (if live call fails)

- Keep pre-generated synthetic output files ready.
- Keep a recorded fallback run of the same scenario.
- Continue the narrative with deterministic artifacts.

## Recording Checklist

- Use English narration and captions.
- Keep all URLs visible and readable.
- Avoid PHI entirely.
- Keep total duration under 3:00.
- Run preflight before recording:
  - `./hackathon/demo/preflight.sh https://your-deployment-url`
- Run full functional smoke test:
  - `./hackathon/demo/e2e.sh https://your-deployment-url`
