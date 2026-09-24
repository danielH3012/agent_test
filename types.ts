import { EventEmitter } from "node:events";

export type AgentStatus = "idle" | "running" | "completed" | "failed";

export interface AgentSession {
  id: string;
  name: string;
  status: AgentStatus;
  task?: string;
  logs: string[];
}

export interface AgentSpawnEvent {
  id: string;
  name: string;
  task: string;
}

export interface AgentLogEvent {
  agentId: string;
  text: string;
}

export interface AgentStatusEvent {
  agentId: string;
  status: AgentStatus;
}

export interface OrchestratorDoneEvent {
  success: boolean;
  result?: string;
  error?: string;
}

class AgentEventBus extends EventEmitter {
  emitSpawn(event: AgentSpawnEvent) {
    this.emit("agent:spawn", event);
  }

  emitLog(agentId: string, text: string) {
    this.emit("agent:log", { agentId, text });
  }

  emitStatus(agentId: string, status: AgentStatus) {
    this.emit("agent:status", { agentId, status });
  }

  emitDone(event: OrchestratorDoneEvent) {
    this.emit("orchestrator:done", event);
  }
}

export const agentEvents = new AgentEventBus();
