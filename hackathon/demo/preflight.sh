#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ./hackathon/demo/preflight.sh https://doctor-opus.online
# or
#   BASE_URL=https://doctor-opus.online ./hackathon/demo/preflight.sh

BASE_URL="${1:-${BASE_URL:-}}"

if [[ -z "${BASE_URL}" ]]; then
  echo "Usage: $0 <base-url>"
  echo "Example: $0 https://doctor-opus.online"
  exit 2
fi

BASE_URL="${BASE_URL%/}"

declare -a ENDPOINTS=(
  "/.well-known/health"
  "/.well-known/agent.json"
  "/.well-known/marketplace-config.json"
)

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

FAILURES=0

check_endpoint() {
  local path="$1"
  local url="${BASE_URL}${path}"

  echo "Checking ${url}"
  local http_code
  http_code="$(curl -sS -o /tmp/doctor_opus_preflight_body.json -w "%{http_code}" "${url}" || true)"

  if [[ "${http_code}" != "200" ]]; then
    echo -e "${RED}FAIL${NC} ${path} (HTTP ${http_code})"
    FAILURES=$((FAILURES + 1))
    return
  fi

  local body
  body="$(< /tmp/doctor_opus_preflight_body.json)"

  if [[ "${path}" == "/.well-known/health" ]]; then
    if [[ "${body}" == *'"status":"ok"'* ]]; then
      echo -e "${GREEN}PASS${NC} ${path} (status=ok)"
    else
      echo -e "${YELLOW}WARN${NC} ${path} (status is not ok)"
      FAILURES=$((FAILURES + 1))
    fi
    return
  fi

  if [[ "${path}" == "/.well-known/agent.json" ]]; then
    if [[ "${body}" == *'"name":"Doctor Opus Clinical Orchestrator"'* && "${body}" == *'"skills"'* ]]; then
      echo -e "${GREEN}PASS${NC} ${path}"
    else
      echo -e "${RED}FAIL${NC} ${path} (unexpected content)"
      FAILURES=$((FAILURES + 1))
    fi
    return
  fi

  if [[ "${path}" == "/.well-known/marketplace-config.json" ]]; then
    if [[ "${body}" == *'"mcp_server"'* && "${body}" == *'"a2a_agent"'* ]]; then
      echo -e "${GREEN}PASS${NC} ${path}"
    else
      echo -e "${RED}FAIL${NC} ${path} (unexpected content)"
      FAILURES=$((FAILURES + 1))
    fi
    return
  fi
}

echo "Doctor Opus Hackathon preflight"
echo "Base URL: ${BASE_URL}"
echo

for endpoint in "${ENDPOINTS[@]}"; do
  check_endpoint "${endpoint}"
done

echo
if [[ "${FAILURES}" -eq 0 ]]; then
  echo -e "${GREEN}Preflight PASSED${NC}: all well-known endpoints are ready."
  exit 0
fi

echo -e "${RED}Preflight FAILED${NC}: ${FAILURES} check(s) failed."
exit 1
