import React, { useState, useEffect } from "react";
import { createCliRenderer } from "@opentui/core";
import { createRoot, useKeyboard, useRenderer } from "@opentui/react";
import { spawn } from "node:child_process";

export interface AgentNode {
  id: string;
  name: string;
  role: "parent" | "subagent";
  parentId?: string;
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

export function App({ initialPrompt = "", isDemo = false }: AppProps) {
  const renderer = useRenderer();

  const [prompt, setPrompt] = useState(initialPrompt);
  const [isStarted, setIsStarted] = useState(Boolean(initialPrompt) || isDemo);
  const [globalStatus, setGlobalStatus] = useState<string>(isDemo ? "Demo Simulation Running" : "Idle");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [spinnerIndex, setSpinnerIndex] = useState(0);

  const [agents, setAgents] = useState<AgentNode[]>([
    {
      id: "parent",
      name: "Parent Orchestrator",
      role: "parent",
      status: isDemo ? "running" : "idle",
      task: isDemo ? "Menjalankan demo multi-agent..." : "Menunggu instruksi...",
      logs: ["Sistem siap. Silakan masukkan tugas untuk Orchestrator."],
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

  // Demo Simulation Flow (menampilkan hierarki Parent & Sub-Agents secara visual)
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

      const spawnSubAgent = (id: string, name: string, task: string) => {
        setAgents((prev) => {
          const next = [
            ...prev,
            {
              id,
              name,
              role: "subagent" as const,
              parentId: "parent",
              status: "running" as const,
              task,
              logs: [`[SPAWN] Mendeploy sub-agent '${name}' untuk task: ${task}`],
            },
          ];
          setSelectedIndex(next.length - 1); // Auto-focus ke sub-agent baru
          return next;
        });
      };

      addLog("parent", "[ORCHESTRATOR] Membaca instruksi user...");
      await new Promise((r) => setTimeout(r, 1100));

      addLog("parent", "[THINK] Analisis kebutuhan: Memerlukan pembuatan modul kalkulator dan verifikasi unit test.");
      await new Promise((r) => setTimeout(r, 1000));

      // 1. Spawn Sub-agent 1: software-agent
      addLog("parent", "[STAGE 1/2] Mendeploy software-agent...");
      spawnSubAgent("sub-1", "software-agent", "Membuat file kalkulator src/calculator.py");
      await new Promise((r) => setTimeout(r, 800));

      setStatus("sub-1", "running", "Write('src/calculator.py')");
      addLog("sub-1", "[TOOL USE] Write('src/calculator.py')");
      await new Promise((r) => setTimeout(r, 1200));

      addLog("sub-1", "[TOOL RESULT] Berhasil membuat src/calculator.py dengan fungsi add, sub, mul, div.");
      setStatus("sub-1", "completed", undefined);
      addLog("parent", "[DONE] software-agent selesai dengan sukses.");
      await new Promise((r) => setTimeout(r, 900));

      // 2. Spawn Sub-agent 2: testing-agent
      addLog("parent", "[STAGE 2/2] Kode siap. Mendeploy testing-agent untuk uji coba...");
      await new Promise((r) => setTimeout(r, 1000));

      spawnSubAgent("sub-2", "testing-agent", "Menjalankan unit test pytest untuk calculator.py");
      await new Promise((r) => setTimeout(r, 800));

      setStatus("sub-2", "running", "Bash('pytest tests/test_calculator.py')");
      addLog("sub-2", "[TOOL USE] Bash('pytest tests/test_calculator.py')");
      await new Promise((r) => setTimeout(r, 1400));

      addLog("sub-2", "[OUTPUT] =================== 4 passed in 0.04s ===================");
      addLog("sub-2", "[TOOL RESULT] Tests: 4 passed, 0 failed. Semua logika kalkulator terverifikasi!");
      setStatus("sub-2", "completed", undefined);
      addLog("parent", "[DONE] testing-agent selesai dengan sukses.");
      await new Promise((r) => setTimeout(r, 900));

      // 3. Parent Concludes
      setSelectedIndex(0); // Kembalikan fokus ke Parent Orchestrator
      addLog("parent", "[ORCHESTRATOR COMPLETE] Semua stage berhasil diselesaikan oleh sub-agent!");
      setStatus("parent", "completed", undefined);
      setGlobalStatus("All Stages Completed Successfully (Demo)");
    };

    timeoutId = setTimeout(() => {
      runDemo().catch(console.error);
    }, 400);

    return () => clearTimeout(timeoutId);
  }, [isDemo]);

  // Eksekusi prompt dengan agen.ts via npx tsx
  const handleStartPrompt = (submittedPrompt: string) => {
    if (!submittedPrompt.trim()) return;
    setIsStarted(true);
    setGlobalStatus("Running Orchestrator via agen.ts...");

    setAgents((prev) =>
      prev.map((a) =>
        a.id === "parent"
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

    let activeSubId = "parent";
    let stdoutBuffer = "";

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

    const processLine = (rawLine: string) => {
      const line = rawLine.trim();
      if (!line || line.startsWith("masukan prompt:")) return;

      // 1. Deteksi pemanggilan Sub-agent (mendukung tool 'Agent', 'Task', atau property 'subagent_type')
      const isNewToolInvocation =
        line.includes("Tool dipanggil: Agent") ||
        line.includes("Tool dipanggil: Task");

      const hasSubagentProperty = line.includes('"subagent_type":');

      // Jika baris ini merupakan potongan JSON lanjutan yang membawa subagent_type untuk agent yang baru saja di-spawn
      if (hasSubagentProperty && !isNewToolInvocation && activeSubId !== "parent") {
        const typeMatch = line.match(/["']subagent_type["']\s*:\s*["']([^"'\\]+)["']/i);
        if (typeMatch) {
          const detectedName = typeMatch[1];
          setAgents((prev) =>
            prev.map((a) =>
              a.id === activeSubId ? { ...a, name: detectedName } : a
            )
          );
        }
        return;
      }

      const isSubagentCall = isNewToolInvocation || (hasSubagentProperty && activeSubId === "parent");

      if (isSubagentCall) {
        let subName = "";
        let subTask = "";

        // Coba parsing via JSON
        try {
          const jsonIndex = line.indexOf("{");
          if (jsonIndex !== -1) {
            const jsonPart = line.slice(jsonIndex);
            const input = JSON.parse(jsonPart);
            subName = input.subagent_type || input.subagent || input.agent || "";
            subTask = input.description || input.prompt || "";
          }
        } catch {
          // Fallback parsing regex jika JSON terpotong di stream chunk
        }

        // Ekstraksi subagent_type via regex
        if (!subName) {
          const typeMatch = line.match(/["']subagent_type["']\s*:\s*["']([^"'\\]+)["']/i);
          if (typeMatch) subName = typeMatch[1];
        }

        // Ekstraksi dari daftar known subagents
        if (!subName) {
          for (const known of KNOWN_SUBAGENTS) {
            if (line.includes(known)) {
              subName = known;
              break;
            }
          }
        }

        // Ekstraksi deskripsi task via regex
        if (!subTask) {
          const descMatch = line.match(/["']description["']\s*:\s*["']([^"'\\]+)["']/i);
          if (descMatch) subTask = descMatch[1];
          else subTask = "Menjalankan sub-task delegasi";
        }

        if (!subName) {
          subName = subTask ? `subagent-${subTask.slice(0, 15).replace(/\s+/g, "_")}` : "subagent-worker";
        }

        const subId = `sub-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        activeSubId = subId;

        setAgents((prev) => {
          // Tandai sub-agent sebelumnya yang masih running sebagai completed
          const updated = prev.map((a) =>
            a.role === "subagent" && a.status === "running"
              ? { ...a, status: "completed" as const, currentTool: undefined }
              : a
          );
          const next = [
            ...updated,
            {
              id: subId,
              name: subName,
              role: "subagent" as const,
              parentId: "parent",
              status: "running" as const,
              task: subTask,
              logs: [
                `[SPAWN] Mendeploy sub-agent '${subName}'`,
                `[TARGET] ${subTask}`,
              ],
            },
          ];
          setSelectedIndex(next.length - 1); // Auto-focus ke sub-agent baru
          return next;
        });

        // Mirror info spawn ke log parent orchestrator
        setAgents((prev) =>
          prev.map((a) =>
            a.id === "parent"
              ? {
                  ...a,
                  logs: [...a.logs, `[ORCHESTRATOR] Mendeploy '${subName}' -> ${subTask}`],
                }
              : a
          )
        );
        return;
      }

      // 2. Deteksi tool yang sedang dipanggil oleh agen aktif (Bash, Write, Read, dll.)
      if (line.includes("Tool dipanggil:")) {
        const toolMatch = line.match(/Tool dipanggil:\s*([a-zA-Z0-9_]+)/);
        const toolName = toolMatch ? toolMatch[1] : undefined;
        if (toolName && toolName !== "Agent" && toolName !== "Task") {
          setAgents((prev) =>
            prev.map((a) => (a.id === activeSubId ? { ...a, currentTool: toolName } : a))
          );
        }
      }

      // 3. Simpan log ke agent aktif dan mirror ke parent jika aktif adalah sub-agent
      setAgents((prev) =>
        prev.map((a) => {
          if (a.id === activeSubId) {
            return { ...a, logs: [...a.logs, line] };
          }
          if (activeSubId !== "parent" && a.id === "parent") {
            return { ...a, logs: [...a.logs, `[${activeSubId.slice(0, 8)}] ${line}`] };
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
            a.id === "parent" ? { ...a, logs: [...a.logs, `[STDERR] ${errText}`] } : a
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
      setGlobalStatus(code === 0 ? "Selesai (Semua sub-agent selesai)" : `Keluar dengan kode ${code}`);
    });
  };

  const selectedAgent = agents[selectedIndex] || agents[0];
  const currentSpinner = SPINNER_FRAMES[spinnerIndex];

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
            <strong fg="cyan">🤖 AGENT ORCHESTRATOR & SUB-AGENTS MONITOR (OpenTUI)</strong>
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
      <box flexDirection="row" style={{ height: 18 }}>
        {/* PANEL KIRI: TREE HIERARKI AGEN */}
        <box
          border
          borderStyle="single"
          borderColor="blue"
          flexDirection="column"
          style={{ width: 36, paddingLeft: 1, paddingRight: 1, marginRight: 1 }}
        >
          <box style={{ marginBottom: 1 }}>
            <text>
              <strong fg="blue">📋 HIERARKI AGEN (↑ / ↓)</strong>
            </text>
          </box>

          {agents.map((agent, index) => {
            const isSelected = index === selectedIndex;
            const isParent = agent.role === "parent";
            const subAgents = agents.filter((a) => a.role === "subagent");
            const isLastSubAgent = !isParent && subAgents[subAgents.length - 1]?.id === agent.id;
            const treePrefix = isParent ? "▼ " : isLastSubAgent ? "  └─ " : "  ├─ ";

            return (
              <box key={`agent-${agent.id}-${index}`} style={{ marginBottom: 0 }}>
                <text>
                  <span fg={isSelected ? "cyan" : "gray"}>
                    {isSelected ? "❯ " : "  "}
                  </span>
                  <span fg="gray">{treePrefix}</span>
                  {renderStatusIcon(agent.status)}
                  <span fg={isSelected ? "cyan" : isParent ? "white" : "gray"}>
                    {agent.name.length > 18 ? agent.name.slice(0, 16) + "…" : agent.name}
                  </span>
                </text>
              </box>
            );
          })}
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
            {selectedAgent?.logs.slice(-12).map((log, idx) => {
              let cleanLog = log.replace(/\r/g, "");
              if (cleanLog.length > 90) {
                cleanLog = cleanLog.slice(0, 87) + "...";
              }
              let fgColor = "white";
              if (cleanLog.startsWith("[TOOL USE]") || cleanLog.includes("Tool dipanggil")) fgColor = "yellow";
              else if (cleanLog.startsWith("[TOOL RESULT]") || cleanLog.startsWith("[OUTPUT]")) fgColor = "cyan";
              else if (cleanLog.startsWith("[SPAWN]") || cleanLog.startsWith("[STAGE") || cleanLog.startsWith("[TARGET]")) fgColor = "magenta";
              else if (cleanLog.startsWith("[ORCHESTRATOR") || cleanLog.startsWith("[DONE]")) fgColor = "green";
              else if (cleanLog.startsWith("[STDERR]") || cleanLog.startsWith("[ERROR]")) fgColor = "red";
              else if (cleanLog.startsWith("[PROMPT]")) fgColor = "blue";
              else if (cleanLog.startsWith("[THINK]")) fgColor = "magenta";

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
            Agen: {selectedIndex + 1}/{agents.length} (
            {agents.filter((a) => a.role === "subagent").length} Sub-agents)
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
