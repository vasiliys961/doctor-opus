#!/usr/bin/env bash
set -euo pipefail

# End-to-end hackathon verification script.
# Usage:
#   ./hackathon/demo/e2e.sh http://localhost:3000
#   AUTH_COOKIE='next-auth.session-token=...' ./hackathon/demo/e2e.sh http://localhost:3000
#   BASE_URL=http://localhost:3000 AUTH_COOKIE='...' ./hackathon/demo/e2e.sh

BASE_URL="${1:-${BASE_URL:-}}"
AUTH_COOKIE="${AUTH_COOKIE:-}"

if [[ -z "${BASE_URL}" ]]; then
  echo "Usage: $0 <base-url>"
  echo "Example: $0 http://localhost:3000"
  exit 2
fi

BASE_URL="${BASE_URL%/}"
TMP_BODY="$(mktemp)"
trap 'rm -f "$TMP_BODY"' EXIT

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

FAILURES=0
WARNINGS=0

print_pass() { echo -e "${GREEN}PASS${NC} $1"; }
print_fail() { echo -e "${RED}FAIL${NC} $1"; FAILURES=$((FAILURES + 1)); }
print_warn() { echo -e "${YELLOW}WARN${NC} $1"; WARNINGS=$((WARNINGS + 1)); }

request() {
  local method="$1"
  local path="$2"
  local json_body="${3:-}"
  local url="${BASE_URL}${path}"
  local code

  if [[ -n "${json_body}" ]]; then
    if [[ -n "${AUTH_COOKIE}" ]]; then
      code="$(curl -sS -o "$TMP_BODY" -w "%{http_code}" -X "$method" "$url" -H "Content-Type: application/json" -H "Cookie: ${AUTH_COOKIE}" -d "$json_body" || true)"
    else
      code="$(curl -sS -o "$TMP_BODY" -w "%{http_code}" -X "$method" "$url" -H "Content-Type: application/json" -d "$json_body" || true)"
    fi
  else
    if [[ -n "${AUTH_COOKIE}" ]]; then
      code="$(curl -sS -o "$TMP_BODY" -w "%{http_code}" -X "$method" "$url" -H "Cookie: ${AUTH_COOKIE}" || true)"
    else
      code="$(curl -sS -o "$TMP_BODY" -w "%{http_code}" -X "$method" "$url" || true)"
    fi
  fi

  echo "$code"
}

body_contains() {
  local needle="$1"
  if rg -q "$needle" "$TMP_BODY"; then
    return 0
  fi
  return 1
}

echo "Doctor Opus Hackathon E2E"
echo "Base URL: ${BASE_URL}"
if [[ -n "${AUTH_COOKIE}" ]]; then
  echo "Auth mode: enabled via AUTH_COOKIE"
else
  echo "Auth mode: not provided (auth-required checks will be skipped with warning)"
fi
echo

# 1) Public well-known health
code="$(request GET "/.well-known/health")"
if [[ "$code" == "200" ]] && body_contains '"status":"ok"'; then
  print_pass "/.well-known/health"
else
  print_fail "/.well-known/health (HTTP ${code})"
fi

# 2) Public agent card
code="$(request GET "/.well-known/agent.json")"
if [[ "$code" == "200" ]] && body_contains '"name":"Doctor Opus Clinical Orchestrator"'; then
  print_pass "/.well-known/agent.json"
else
  print_fail "/.well-known/agent.json (HTTP ${code})"
fi

# 3) Public marketplace config
code="$(request GET "/.well-known/marketplace-config.json")"
if [[ "$code" == "200" ]] && body_contains '"mcp_server"' && body_contains '"a2a_agent"'; then
  print_pass "/.well-known/marketplace-config.json"
else
  print_fail "/.well-known/marketplace-config.json (HTTP ${code})"
fi

# Auth-required block
if [[ -z "${AUTH_COOKIE}" ]]; then
  print_warn "Skipping auth-required API checks. Provide AUTH_COOKIE to validate /api/hackathon/* and /api/chat."
else
  # 4) FHIR conversion
  code="$(request POST "/api/hackathon/fhir" '{
    "patient": { "id": "synthetic-p-001", "fullName": "Synthetic Patient", "gender": "male", "birthDate": "1980-04-10" },
    "observations": [
      { "code": "8867-4", "display": "Heart rate", "value": 118, "unit": "bpm" },
      { "code": "59408-5", "display": "SpO2", "value": 91, "unit": "%" }
    ],
    "conditions": [
      { "code": "I20.0", "display": "Unstable angina", "clinicalStatus": "active" }
    ]
  }')"
  if [[ "$code" == "200" ]] && body_contains '"success":true' && body_contains '"resourceType":"Bundle"'; then
    print_pass "POST /api/hackathon/fhir"
  else
    print_fail "POST /api/hackathon/fhir (HTTP ${code})"
  fi

  # 5) MCP tools list
  code="$(request GET "/api/hackathon/mcp")"
  if [[ "$code" == "200" ]] && body_contains '"tools"'; then
    print_pass "GET /api/hackathon/mcp"
  else
    print_fail "GET /api/hackathon/mcp (HTTP ${code})"
  fi

  # 6) MCP tool execute
  code="$(request POST "/api/hackathon/mcp" '{"tool":"triage_from_vitals","args":{"sbp":88,"hr":132,"spo2":89}}')"
  if [[ "$code" == "200" ]] && body_contains '"success":true' && body_contains '"emergent"'; then
    print_pass "POST /api/hackathon/mcp"
  else
    print_fail "POST /api/hackathon/mcp (HTTP ${code})"
  fi

  # 7) A2A dispatch
  code="$(request POST "/api/hackathon/a2a" '{
    "taskId": "demo-triage-001",
    "type": "triage",
    "payload": { "sbp": 92, "hr": 124, "spo2": 90 }
  }')"
  if [[ "$code" == "200" ]] && body_contains '"status":"completed"'; then
    print_pass "POST /api/hackathon/a2a"
  else
    print_fail "POST /api/hackathon/a2a (HTTP ${code})"
  fi

  # 8) Chat interop bridge
  code="$(request POST "/api/chat" '{
    "message": "Give brief triage recommendation.",
    "useStreaming": false,
    "interop": {
      "fhirData": {
        "patient": { "id": "synthetic-p-001", "fullName": "Synthetic Patient" },
        "observations": [{ "code":"8867-4", "display":"Heart rate", "value":132, "unit":"bpm" }]
      },
      "a2aTask": {
        "taskId": "chat-a2a-1",
        "type": "triage",
        "payload": { "sbp": 90, "hr": 132, "spo2": 89 }
      },
      "mcpToolCall": {
        "tool": "triage_from_vitals",
        "args": { "sbp": 90, "hr": 132, "spo2": 89 }
      }
    }
  }')"
  if [[ "$code" == "200" ]] && body_contains '"success":true'; then
    print_pass "POST /api/chat (interop)"
  else
    print_fail "POST /api/chat (interop) (HTTP ${code})"
  fi
fi

echo
if [[ "$FAILURES" -eq 0 ]]; then
  if [[ "$WARNINGS" -gt 0 ]]; then
    echo -e "${YELLOW}E2E PASSED WITH WARNINGS${NC}: ${WARNINGS} warning(s), ${FAILURES} failure(s)."
  else
    echo -e "${GREEN}E2E PASSED${NC}: all checks are green."
  fi
  exit 0
fi

echo -e "${RED}E2E FAILED${NC}: ${FAILURES} failure(s), ${WARNINGS} warning(s)."
exit 1
