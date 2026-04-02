import { executeHackathonMcpTool } from '@/lib/hackathon/mcp';
import { HackathonA2AResult, HackathonA2ATask, HackathonAgentId } from '@/lib/hackathon/types';

function pickAgent(type: HackathonA2ATask['type']): HackathonAgentId {
  if (type === 'radiology_review') return 'radiology';
  if (type === 'lab_review') return 'labs';
  return 'triage';
}

function taskSummary(task: HackathonA2ATask, assignedAgent: HackathonAgentId): string {
  if (task.type === 'triage') {
    return 'Triage agent completed priority estimation.';
  }
  if (task.type === 'lab_review') {
    return 'Lab agent prepared interpretation-ready laboratory summary.';
  }
  if (assignedAgent === 'radiology') {
    return 'Radiology agent prepared imaging review handoff.';
  }
  return 'Coordinator processed task.';
}

export function dispatchA2ATask(task: HackathonA2ATask): HackathonA2AResult {
  const assignedAgent = pickAgent(task.type);
  const taskId = task.taskId || `task-${Date.now()}`;

  let artifacts: Record<string, unknown> | undefined;
  if (task.type === 'triage') {
    artifacts = executeHackathonMcpTool({
      tool: 'triage_from_vitals',
      args: task.payload
    });
  }

  return {
    taskId,
    assignedAgent,
    status: 'completed',
    summary: taskSummary(task, assignedAgent),
    artifacts
  };
}
