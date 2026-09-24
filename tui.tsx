import React, { useState, useEffect } from "react";
import { createCliRenderer } from "@opentui/core";
import { createRoot, useKeyboard, useRenderer } from "@opentui/react";
import { spawn } from "node:child_process";

export interface AgentNode {
  id: string;
  name: string;
  role: "parent" | "subagent";
  parentId?: string;
  owner: "claude" | "opencode";
  status: "idle" | "running" | "completed" | "failed";
  task: string;
  currentTool?: string;
  logs: string[];
}

interface AppProps {
  initialPrompt?: string;
  isDemo?: boolean;
}

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

const KNOWN_SUBAGENTS = [
  "software-agent",
  "testing-agent",
  "file-summarizer",
  "code-fixer",
  "code-reviewer",
  "code-optimizer",
  "code-documenter",
  "mcp__filesystem",
];

export function App({ initialPrompt = "", isDemo = false }: AppProps) {
  const renderer = useRenderer();

  const [prompt, setPrompt] = useState(initialPrompt);
  const [isStarted, setIsStarted] = useState(Boolean(initialPrompt) || isDemo);
  const [globalStatus, setGlobalStatus] = useState<string>(isDemo ? "Demo Simulation Running" : "Idle");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [spinnerIndex, setSpinnerIndex] = useState(0);

  // Dua parent: Claude Code & OpenCode
  const [agents, setAgents] = useState<AgentNode[]>([
    {
      id: "claude-parent",
      name: "Claude Code",
      role: "parent",
      owner: "claude",
      status: isDemo ? "running" : "idle",
      task: isDemo ? "Menjalankan demo multi-agent..." : "Menunggu instruksi...",
      logs: ["Sistem siap. Menunggu tugas dari Orchestrator."],
    },
    {
      id: "opencode-parent",
      name: "OpenCode",
      role: "parent",
      owner: "opencode",
      status: isDemo ? "running" : "idle",
      task: isDemo ? "Menjalankan demo multi-agent..." : "Menunggu instruksi...",
      logs: ["Sistem siap. Menunggu tugas dari Orchestrator."],
    },
  ]);

  // Spinner animation loop
  useEffect(() => {
    const interval = setInterval(() => {
      setSpinnerIndex((prev) => (prev + 1) % SPINNER_FRAMES.length);
    }, 80);
    return () => clearInterval(interval);
  }, []);

  // Keyboard navigation
  useKeyboard((key) => {
    if (key.name === "q" || key.name === "escape" || (key.ctrl && key.name === "c")) {
      renderer.destroy();
      process.exit(0);
    }

    if (key.name === "up") {
      setSelectedIndex((prev) => Math.max(0, prev - 1));
    } else if (key.name === "down") {
      setSelectedIndex((prev) => Math.min(agents.length - 1, prev + 1));
    }
  });

  // ---------- Demo Simulation ----------
  useEffect(() => {
    if (!isDemo) return;

    let timeoutId: NodeJS.Timeout;
    const runDemo = async () => {
      const addLog = (id: string, text: string) => {
        setAgents((prev) =>
          prev.map((a) => (a.id === id ? { ...a, logs: [...a.logs, text] } : a))
        );
      };

      const setStatus = (id: string, status: AgentNode["status"], currentTool?: string) => {
        setAgents((prev) =>
          prev.map((a) => (a.id === id ? { ...a, status, currentTool } : a))
        );
      };

      const spawnSubAgent = (id: string, name: string, task: string, owner: "claude" | "opencode") => {
        const parentId = owner === "claude" ? "claude-parent" : "opencode-parent";
        setAgents((prev) => {
          // Insert sub-agent right after its parent's last child (or after parent itself)
          const parentIndex = prev.findIndex((a) => a.id === parentId);
          let insertIndex = parentIndex + 1;
          while (insertIndex < prev.length && prev[insertIndex].owner === owner && prev[insertIndex].role === "subagent") {
            insertIndex++;
          }
          const newAgent: AgentNode = {
            id,
            name,
            role: "subagent",
            parentId,
            owner,
            status: "running",
            task,
            logs: [`[SPAWN] Mendeploy sub-agent '${name}' untuk task: ${task}`],
          };
          const next = [...prev.slice(0, insertIndex), newAgent, ...prev.slice(insertIndex)];
          setSelectedIndex(next.findIndex((a) => a.id === id));
          return next;
        });
      };

      // ---- CLAUDE DEMO ----
      addLog("claude-parent", "[ORCHESTRATOR] Membaca instruksi user...");
      addLog("opencode-parent", "[ORCHESTRATOR] Membaca instruksi user...");
      await new Promise((r) => setTimeout(r, 1100));

      addLog("claude-parent", "[THINK] Analisis kebutuhan: Memerlukan pembuatan modul kalkulator.");
      addLog("opencode-parent", "[THINK] Analisis kebutuhan: Memerlukan testing kalkulator.");
      await new Promise((r) => setTimeout(r, 1000));

      // Claude: spawn software-agent
      addLog("claude-parent", "[STAGE 1/2] Mendeploy software-agent...");
      spawnSubAgent("claude-sub-1", "software-agent", "Membuat file kalkulator src/calculator.py", "claude");
      await new Promise((r) => setTimeout(r, 800));

      setStatus("claude-sub-1", "running", "Write('src/calculator.py')");
      addLog("claude-sub-1", "[TOOL USE] Write('src/calculator.py')");
      await new Promise((r) => setTimeout(r, 600));

      // OpenCode: spawn software-agent simultaneously
      addLog("opencode-parent", "[STAGE 1/2] Mendeploy software-agent...");
      spawnSubAgent("opencode-sub-1", "software-agent", "Membuat file utils src/utils.py", "opencode");
      await new Promise((r) => setTimeout(r, 600));

      setStatus("opencode-sub-1", "running", "Write('src/utils.py')");
      addLog("opencode-sub-1", "[TOOL USE] Write('src/utils.py')");
      await new Promise((r) => setTimeout(r, 800));

      // Claude: software-agent done
      addLog("claude-sub-1", "[TOOL RESULT] Berhasil membuat src/calculator.py dengan fungsi add, sub, mul, div.");
      setStatus("claude-sub-1", "completed", undefined);
      addLog("claude-parent", "[DONE] software-agent selesai dengan sukses.");
      await new Promise((r) => setTimeout(r, 600));

      // OpenCode: software-agent done
      addLog("opencode-sub-1", "[TOOL RESULT] Berhasil membuat src/utils.py.");
      setStatus("opencode-sub-1", "completed", undefined);
      addLog("opencode-parent", "[DONE] software-agent selesai dengan sukses.");
      await new Promise((r) => setTimeout(r, 600));

      // Claude: spawn testing-agent
      addLog("claude-parent", "[STAGE 2/2] Kode siap. Mendeploy testing-agent...");
      spawnSubAgent("claude-sub-2", "testing-agent", "Menjalankan pytest untuk calculator.py", "claude");
      await new Promise((r) => setTimeout(r, 800));

      setStatus("claude-sub-2", "running", "Bash('pytest tests/')");
      addLog("claude-sub-2", "[TOOL USE] Bash('pytest tests/test_calculator.py')");
      await new Promise((r) => setTimeout(r, 600));

      // OpenCode: spawn testing-agent
      addLog("opencode-parent", "[STAGE 2/2] Kode siap. Mendeploy testing-agent...");
      spawnSubAgent("opencode-sub-2", "testing-agent", "Menjalankan pytest untuk utils.py", "opencode");
      await new Promise((r) => setTimeout(r, 800));

      setStatus("opencode-sub-2", "running", "Bash('pytest tests/')");
      addLog("opencode-sub-2", "[TOOL USE] Bash('pytest tests/test_utils.py')");
      await new Promise((r) => setTimeout(r, 1000));

      // Claude: testing done
      addLog("claude-sub-2", "[OUTPUT] =================== 4 passed in 0.04s ===================");
      addLog("claude-sub-2", "[TOOL RESULT] Tests: 4 passed, 0 failed.");
      setStatus("claude-sub-2", "completed", undefined);
      addLog("claude-parent", "[DONE] testing-agent selesai dengan sukses.");
      await new Promise((r) => setTimeout(r, 600));

      // OpenCode: testing done
      addLog("opencode-sub-2", "[OUTPUT] =================== 3 passed in 0.02s ===================");
      addLog("opencode-sub-2", "[TOOL RESULT] Tests: 3 passed, 0 failed.");
      setStatus("opencode-sub-2", "completed", undefined);
      addLog("opencode-parent", "[DONE] testing-agent selesai dengan sukses.");
      await new Promise((r) => setTimeout(r, 600));

      // Both parents done
      setSelectedIndex(0);
      addLog("claude-parent", "[ORCHESTRATOR COMPLETE] Semua stage Claude Code berhasil!");
      setStatus("claude-parent", "completed", undefined);

      addLog("opencode-parent", "[ORCHESTRATOR COMPLETE] Semua stage OpenCode berhasil!");
      setStatus("opencode-parent", "completed", undefined);

      setGlobalStatus("All Stages Completed Successfully (Demo)");
    };

    timeoutId = setTimeout(() => {
      runDemo().catch(console.error);
    }, 400);

    return () => clearTimeout(timeoutId);
  }, [isDemo]);

  // ---------- Real execution via agen.ts ----------
  const handleStartPrompt = (submittedPrompt: string) => {
    if (!submittedPrompt.trim()) return;
    setIsStarted(true);
    setGlobalStatus("Running Orchestrator via agen.ts...");

    // Activate both parents
    setAgents((prev) =>
      prev.map((a) =>
        a.role === "parent"
          ? {
              ...a,
              status: "running",
              task: submittedPrompt,
              logs: [...a.logs, `[PROMPT] ${submittedPrompt}`],
            }
          : a
      )
    );

    const child = spawn("npx", ["tsx", "agen.ts"], {
      cwd: process.cwd(),
      env: { ...process.env },
      shell: true,
    });

    child.stdin.write(`${submittedPrompt}\n`);
    child.stdin.end();

    // Track active sub-agent per owner
    let activeSubIds: Record<string, string> = {
      claude: "claude-parent",
      opencode: "opencode-parent",
    };
    let stdoutBuffer = "";

    const processLine = (rawLine: string) => {
      const line = rawLine.trim();
      if (!line || line.startsWith("masukan prompt:")) return;

      // Determine owner from prefix
      let owner: "claude" | "opencode" | null = null;
      let cleanLine = line;

      if (line.startsWith("[CLAUDE]")) {
        owner = "claude";
        cleanLine = line.slice("[CLAUDE]".length).trim();
      } else if (line.startsWith("[OPENCODE]")) {
        owner = "opencode";
        cleanLine = line.slice("[OPENCODE]".length).trim();
      }

      // If no prefix detected, try to infer from content, default to logging to both
      if (!owner) {
        // Log untagged lines to both parents
        setAgents((prev) =>
          prev.map((a) =>
            a.role === "parent"
              ? { ...a, logs: [...a.logs, `[UNTAGGED] ${line}`] }
              : a
          )
        );
        return;
      }

      const parentId = owner === "claude" ? "claude-parent" : "opencode-parent";
      const activeSubId = activeSubIds[owner];
      const lowerClean = cleanLine.toLowerCase();

      // 1. Detect sub-agent invocations (tool 'Agent', 'Task', or 'subagent_type')
      const isNewToolInvocation =
        lowerClean.includes("tool dipanggil: agent") ||
        lowerClean.includes("tool dipanggil: task");

      const hasSubagentProperty = cleanLine.includes('"subagent_type":') || cleanLine.includes('"subagent":');

      // If this line carries subagent_type for a recently spawned agent whose name is still generic
      if (hasSubagentProperty && !isNewToolInvocation && activeSubId !== parentId) {
        const typeMatch = cleanLine.match(/["'](?:subagent_type|subagent)["']\s*:\s*["']([^"'\\]+)["']/i);
        if (typeMatch) {
          const detectedName = typeMatch[1];
          setAgents((prev) =>
            prev.map((a) => {
              if (a.id === activeSubId && (a.name.startsWith("subagent-") || a.name === "subagent-worker")) {
                return { ...a, name: detectedName };
              }
              return a;
            })
          );
        }
        return;
      }

      const isSubagentCall = isNewToolInvocation || (hasSubagentProperty && activeSubId === parentId);

      if (isSubagentCall) {
        let subName = "";
        let subTask = "";

        // Try parsing via JSON
        try {
          const jsonIndex = cleanLine.indexOf("{");
          if (jsonIndex !== -1) {
            const jsonPart = cleanLine.slice(jsonIndex);
            const input = JSON.parse(jsonPart);
            subName = input.subagent_type || input.subagent || input.agent || "";
            subTask = input.description || input.prompt || "";
          }
        } catch {
          // Fallback
        }

        // Extract subagent_type via regex
        if (!subName) {
          const typeMatch = cleanLine.match(/["'](?:subagent_type|subagent|agent)["']\s*:\s*["']([^"'\\]+)["']/i);
          if (typeMatch) subName = typeMatch[1];
        }

        // Known subagents
        if (!subName) {
          for (const known of KNOWN_SUBAGENTS) {
            if (cleanLine.includes(known)) {
              subName = known;
              break;
            }
          }
        }

        // Task description
        if (!subTask) {
          const descMatch = cleanLine.match(/["']description["']\s*:\s*["']([^"'\\]+)["']/i);
          if (descMatch) subTask = descMatch[1];
          else subTask = "Menjalankan sub-task delegasi";
        }

        if (!subName) {
          subName = subTask ? `subagent-${subTask.slice(0, 15).replace(/\s+/g, "_")}` : "subagent-worker";
        }

        const subId = `${owner}-sub-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        activeSubIds[owner] = subId;

        setAgents((prev) => {
          // Mark previous running sub-agents of this owner as completed
          const updated = prev.map((a) =>
            a.owner === owner && a.role === "subagent" && a.status === "running"
              ? { ...a, status: "completed" as const, currentTool: undefined }
              : a
          );

          // Find insertion point: after the last sub-agent of this owner (or after parent)
          const parentIdx = updated.findIndex((a) => a.id === parentId);
          let insertIdx = parentIdx + 1;
          while (insertIdx < updated.length && updated[insertIdx].owner === owner && updated[insertIdx].role === "subagent") {
            insertIdx++;
          }

          const newAgent: AgentNode = {
            id: subId,
            name: subName,
            role: "subagent",
            parentId,
            owner,
            status: "running",
            task: subTask,
            logs: [
              `[SPAWN] Mendeploy sub-agent '${subName}'`,
              `[TARGET] ${subTask}`,
            ],
          };
          const next = [...updated.slice(0, insertIdx), newAgent, ...updated.slice(insertIdx)];
          setSelectedIndex(next.findIndex((a) => a.id === subId));
          return next;
        });

        // Mirror info to parent log
        setAgents((prev) =>
          prev.map((a) =>
            a.id === parentId
              ? {
                  ...a,
                  logs: [...a.logs, `[ORCHESTRATOR] Mendeploy '${subName}' -> ${subTask}`],
                }
              : a
          )
        );
        return;
      }

      // 2. Detect tool calls by active agent
      if (cleanLine.includes("Tool dipanggil:")) {
        const toolMatch = cleanLine.match(/Tool dipanggil:\s*([a-zA-Z0-9_]+)/i);
        const toolName = toolMatch ? toolMatch[1] : undefined;
        if (toolName && toolName.toLowerCase() !== "agent" && toolName.toLowerCase() !== "task") {
          setAgents((prev) =>
            prev.map((a) => (a.id === activeSubId ? { ...a, currentTool: toolName } : a))
          );
        }
      }

      // 2b. Detect tool completion (from OpenCode SSE events)
      if (lowerClean.includes("tool selesai:")) {
        const isTaskDone = lowerClean.includes("tool selesai: task");
        if (isTaskDone) {
          // Tandai subagent aktif sebagai selesai
          setAgents((prev) =>
            prev.map((a) =>
              a.id === activeSubId
                ? { ...a, status: "completed" as const, currentTool: undefined }
                : a
            )
          );
          // Kembalikan target log ke parent orchestrator
          activeSubIds[owner] = parentId;
        } else {
          setAgents((prev) =>
            prev.map((a) => (a.id === activeSubId ? { ...a, currentTool: undefined } : a))
          );
        }
      }

      // 3. Log to active agent and mirror to parent
      setAgents((prev) =>
        prev.map((a) => {
          if (a.id === activeSubId) {
            return { ...a, logs: [...a.logs, cleanLine] };
          }
          if (activeSubId !== parentId && a.id === parentId) {
            return { ...a, logs: [...a.logs, `[${activeSubId.slice(0, 12)}] ${cleanLine}`] };
          }
          return a;
        })
      );
    };

    child.stdout.on("data", (data) => {
      stdoutBuffer += data.toString();
      const lines = stdoutBuffer.split("\n");
      stdoutBuffer = lines.pop() || "";
      for (const rawLine of lines) {
        processLine(rawLine);
      }
    });

    child.stderr.on("data", (data) => {
      const errText = data.toString().trim();
      if (errText) {
        setAgents((prev) =>
          prev.map((a) =>
            a.role === "parent" ? { ...a, logs: [...a.logs, `[STDERR] ${errText}`] } : a
          )
        );
      }
    });

    child.on("close", (code) => {
      if (stdoutBuffer.trim()) {
        processLine(stdoutBuffer);
        stdoutBuffer = "";
      }
      setAgents((prev) =>
        prev.map((a) => ({
          ...a,
          status: code === 0 ? "completed" : "failed",
          currentTool: undefined,
        }))
      );
      setGlobalStatus(code === 0 ? "Selesai (Semua agen selesai)" : `Keluar dengan kode ${code}`);
    });
  };

  const selectedAgent = agents[selectedIndex] || agents[0];
  const currentSpinner = SPINNER_FRAMES[spinnerIndex];

  // Helper: get agents grouped by owner
  const claudeAgents = agents.filter((a) => a.owner === "claude");
  const opencodeAgents = agents.filter((a) => a.owner === "opencode");

  // Helper render status icon
  const renderStatusIcon = (status: AgentNode["status"]) => {
    switch (status) {
      case "running":
        return <span fg="yellow">{currentSpinner} </span>;
      case "completed":
        return <span fg="green">✔ </span>;
      case "failed":
        return <span fg="red">✖ </span>;
      default:
        return <span fg="gray">○ </span>;
    }
  };

  // Render an agent tree section
  const renderAgentTree = (ownerAgents: AgentNode[], headerLabel: string, headerColor: string) => {
    const parent = ownerAgents.find((a) => a.role === "parent");
    const subs = ownerAgents.filter((a) => a.role === "subagent");
    const globalIdx = (id: string) => agents.findIndex((a) => a.id === id);

    return (
      <box flexDirection="column" style={{ marginBottom: 1 }}>
        {/* Section header */}
        <box style={{ marginBottom: 0 }}>
          <text>
            <strong fg={headerColor}>{headerLabel}</strong>
          </text>
        </box>

        {/* Parent */}
        {parent && (() => {
          const idx = globalIdx(parent.id);
          const isSelected = idx === selectedIndex;
          return (
            <box key={`agent-${parent.id}`}>
              <text>
                <span fg={isSelected ? "cyan" : "gray"}>
                  {isSelected ? "❯ " : "  "}
                </span>
                <span fg="gray">▼ </span>
                {renderStatusIcon(parent.status)}
                <span fg={isSelected ? "cyan" : "white"}>
                  {parent.name}
                </span>
              </text>
            </box>
          );
        })()}

        {/* Sub-agents */}
        {subs.map((agent, i) => {
          const idx = globalIdx(agent.id);
          const isSelected = idx === selectedIndex;
          const isLast = i === subs.length - 1;
          const treePrefix = isLast ? "  └─ " : "  ├─ ";

          return (
            <box key={`agent-${agent.id}`}>
              <text>
                <span fg={isSelected ? "cyan" : "gray"}>
                  {isSelected ? "❯ " : "  "}
                </span>
                <span fg="gray">{treePrefix}</span>
                {renderStatusIcon(agent.status)}
                <span fg={isSelected ? "cyan" : "gray"}>
                  {agent.name.length > 16 ? agent.name.slice(0, 14) + "…" : agent.name}
                </span>
              </text>
            </box>
          );
        })}
      </box>
    );
  };

  return (
    <box flexDirection="column" style={{ padding: 1, width: "100%" }}>
      {/* HEADER BAR */}
      <box
        border
        borderStyle="single"
        borderColor="cyan"
        flexDirection="column"
        style={{ paddingLeft: 1, paddingRight: 1, marginBottom: 1 }}
      >
        <box flexDirection="row" justifyContent="space-between">
          <text>
            <strong fg="cyan">🤖 DUAL-AGENT ORCHESTRATOR MONITOR (OpenTUI)</strong>
          </text>
          <text>
            <span fg="gray">Tekan [q] atau [ESC] untuk keluar</span>
          </text>
        </box>
        <box style={{ marginTop: 0 }}>
          <text>
            <span fg="gray">Status Global: </span>
            <strong fg={globalStatus.includes("Error") || globalStatus.includes("kode") ? "red" : "green"}>
              {globalStatus}
            </strong>
          </text>
        </box>
      </box>

      {/* INPUT FORM (Tampil jika belum dimulai) */}
      {!isStarted && (
        <box
          border
          borderStyle="single"
          borderColor="yellow"
          flexDirection="column"
          style={{ paddingLeft: 1, paddingRight: 1, marginBottom: 1 }}
        >
          <text>
            <strong fg="yellow">Masukkan Tugas / Prompt untuk Orchestrator:</strong>
          </text>
          <box style={{ marginTop: 1, height: 3 }}>
            <input
              placeholder="Ketik instruksi di sini dan tekan Enter..."
              value={prompt}
              onInput={setPrompt}
              onSubmit={(val: any) => handleStartPrompt(typeof val === "string" ? val : prompt)}
              focused
            />
          </box>
          <text>
            <span fg="gray">Tekan [Enter] untuk mengeksekusi agen.ts</span>
          </text>
        </box>
      )}

      {/* MAIN VIEW: DUAL PANE (HIERARKI KIRI, LOG KANAN) */}
      <box flexDirection="row" style={{ height: 22 }}>
        {/* PANEL KIRI: DUAL TREE HIERARKI AGEN */}
        <box
          border
          borderStyle="single"
          borderColor="blue"
          flexDirection="column"
          style={{ width: 38, paddingLeft: 1, paddingRight: 1, marginRight: 1 }}
        >
          <box style={{ marginBottom: 1 }}>
            <text>
              <strong fg="blue">📋 HIERARKI AGEN (↑ / ↓)</strong>
            </text>
          </box>

          {/* Claude Code tree */}
          {renderAgentTree(claudeAgents, "🟣 Claude Code", "magenta")}

          {/* Separator */}
          <box style={{ marginBottom: 1 }}>
            <text>
              <span fg="gray">──────────────────────────</span>
            </text>
          </box>

          {/* OpenCode tree */}
          {renderAgentTree(opencodeAgents, "🟢 OpenCode", "green")}
        </box>

        {/* PANEL KANAN: INSPEKSI & LOG DETAIL */}
        <box
          border
          borderStyle="single"
          borderColor="green"
          flexDirection="column"
          style={{ flexGrow: 1, paddingLeft: 1, paddingRight: 1 }}
        >
          {/* Header Inspeksi */}
          <box flexDirection="row" justifyContent="space-between" style={{ marginBottom: 1 }}>
            <text>
              <strong fg="green">
                🔍 {selectedAgent?.role === "parent" ? "ORCHESTRATOR" : "SUB-AGENT"}: {selectedAgent?.name}
              </strong>
              <span fg={selectedAgent?.owner === "claude" ? "magenta" : "green"}>
                {" "}({selectedAgent?.owner === "claude" ? "Claude Code" : "OpenCode"})
              </span>
            </text>
            <text>
              <span fg={selectedAgent?.status === "running" ? "yellow" : "gray"}>
                [{selectedAgent?.status.toUpperCase()}]
              </span>
              {selectedAgent?.currentTool && (
                <span fg="yellow"> | Tool: {selectedAgent.currentTool}</span>
              )}
            </text>
          </box>

          {/* Goal / Task Banner */}
          {selectedAgent?.task && (
            <box style={{ marginBottom: 1 }}>
              <text>
                <em fg="magenta">🎯 Target: {selectedAgent.task}</em>
              </text>
            </box>
          )}

          {/* Log Stream Terisolasi */}
          <box flexDirection="column" style={{ flexGrow: 1 }}>
            {selectedAgent?.logs.slice(-14).map((log, idx) => {
              let cleanLog = log.replace(/\r/g, "");
              if (cleanLog.length > 90) {
                cleanLog = cleanLog.slice(0, 87) + "...";
              }
              let fgColor = "white";
              if (cleanLog.startsWith("[TOOL USE]") || cleanLog.includes("Tool dipanggil")) fgColor = "yellow";
              else if (cleanLog.startsWith("[TOOL RESULT]") || cleanLog.startsWith("[OUTPUT]") || cleanLog.includes("Tool selesai")) fgColor = "cyan";
              else if (cleanLog.startsWith("[SPAWN]") || cleanLog.startsWith("[STAGE") || cleanLog.startsWith("[TARGET]")) fgColor = "magenta";
              else if (cleanLog.startsWith("[ORCHESTRATOR") || cleanLog.startsWith("[DONE]")) fgColor = "green";
              else if (cleanLog.startsWith("[STDERR]") || cleanLog.startsWith("[ERROR]") || cleanLog.includes("Tool error")) fgColor = "red";
              else if (cleanLog.startsWith("[PROMPT]")) fgColor = "blue";
              else if (cleanLog.startsWith("[THINK]")) fgColor = "magenta";
              else if (cleanLog.startsWith("[UNTAGGED]")) fgColor = "gray";

              return (
                <text key={`log-${selectedAgent.id}-${idx}`}>
                  <span fg={fgColor}>{cleanLog}</span>
                </text>
              );
            })}
          </box>
        </box>
      </box>

      {/* FOOTER BAR */}
      <box
        border
        borderStyle="single"
        borderColor="gray"
        flexDirection="row"
        justifyContent="space-between"
        style={{ paddingLeft: 1, paddingRight: 1, marginTop: 1 }}
      >
        <text>
          <span fg="gray">Navigasi: </span>
          <strong fg="cyan">[↑ / ↓]</strong>
          <span fg="gray"> Pilih Agen | </span>
          <strong fg="cyan">[q / ESC]</strong>
          <span fg="gray"> Keluar</span>
        </text>
        <text>
          <span fg="gray">
            Agen: {selectedIndex + 1}/{agents.length} |
            Claude: {claudeAgents.filter((a) => a.role === "subagent").length} sub |
            OpenCode: {opencodeAgents.filter((a) => a.role === "subagent").length} sub
          </span>
        </text>
      </box>
    </box>
  );
}

// Inisialisasi CLI
const args = process.argv.slice(2);
const isDemo = args.includes("--demo");
const initialPrompt = args.find((a) => !a.startsWith("--")) || "";

const renderer = await createCliRenderer({ exitOnCtrlC: true });
createRoot(renderer).render(<App isDemo={isDemo} initialPrompt={initialPrompt} />);
