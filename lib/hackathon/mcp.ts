import { PROTOCOLS } from '@/lib/protocols';
import { HackathonMcpToolCall, HackathonMcpToolDescriptor } from '@/lib/hackathon/types';

const MCP_TOOLS: HackathonMcpToolDescriptor[] = [
  {
    name: 'search_protocols',
    description: 'Find protocol cards by name substring.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' }
      },
      required: ['query']
    }
  },
  {
    name: 'triage_from_vitals',
    description: 'Estimate triage urgency from vital signs.',
    inputSchema: {
      type: 'object',
      properties: {
        sbp: { type: 'number' },
        hr: { type: 'number' },
        spo2: { type: 'number' }
      }
    }
  }
];

function searchProtocols(query: string) {
  const q = query.trim().toLowerCase();
  if (!q) {
    return [];
  }

  const matches: Array<{ category: string; protocol: string; urgency: string }> = [];
  for (const [category, items] of Object.entries(PROTOCOLS)) {
    for (const [protocol, details] of Object.entries(items)) {
      if (protocol.toLowerCase().includes(q) || details.description.toLowerCase().includes(q)) {
        matches.push({
          category,
          protocol,
          urgency: details.urgency
        });
      }
    }
  }

  return matches.slice(0, 10);
}

function triageFromVitals(args: Record<string, unknown>) {
  const sbp = Number(args.sbp ?? 0);
  const hr = Number(args.hr ?? 0);
  const spo2 = Number(args.spo2 ?? 100);

  if ((sbp > 0 && sbp < 90) || hr > 130 || spo2 < 90) {
    return { urgency: 'emergent', rationale: 'Critical vitals threshold exceeded' };
  }
  if ((sbp >= 90 && sbp <= 100) || (hr >= 110 && hr <= 130) || (spo2 >= 90 && spo2 <= 93)) {
    return { urgency: 'urgent', rationale: 'Borderline vitals require priority review' };
  }

  return { urgency: 'routine', rationale: 'No critical vital-sign criteria detected' };
}

export function listHackathonMcpTools(): HackathonMcpToolDescriptor[] {
  return MCP_TOOLS;
}

export function executeHackathonMcpTool(call: HackathonMcpToolCall): Record<string, unknown> {
  const tool = call.tool;
  const args = call.args || {};

  if (tool === 'search_protocols') {
    return { tool, result: searchProtocols(String(args.query || '')) };
  }

  if (tool === 'triage_from_vitals') {
    return { tool, result: triageFromVitals(args) };
  }

  throw new Error(`Unknown MCP tool: ${tool}`);
}
