import React, { useState, useEffect } from "react";
import { createCliRenderer } from "@opentui/core";
import { createRoot, useKeyboard, useRenderer } from "@opentui/react";
import { spawn } from "node:child_process";

interface AgentSession {
  id: string;
  name: string;
  status: "idle" | "running" | "completed" | "failed";
  task: string;
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

  const [agents, setAgents] = useState<AgentSession[]>([
    {
      id: "parent",
      name: "Parent Orchestrator",
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

  // Demo Simulation Flow
  useEffect(() => {
    if (!isDemo) return;

    let timeoutId: NodeJS.Timeout;
    const runDemo = async () => {
      const addLog = (id: string, text: string) => {
        setAgents((prev) =>
          prev.map((a) => (a.id === id ? { ...a, logs: [...a.logs, text] } : a))
        );
      };

      const setStatus = (id: string, status: AgentSession["status"]) => {
        setAgents((prev) =>
          prev.map((a) => (a.id === id ? { ...a, status } : a))
        );
      };

      const spawnAgent = (id: string, name: string, task: string) => {
        setAgents((prev) => [
          ...prev,
          {
            id,
            name,
            status: "running",
            task,
            logs: [`[INITIALIZED] Task: ${task}`],
          },
        ]);
        setSelectedIndex((prev) => prev + 1);
      };

      addLog("parent", "[ORCHESTRATOR] Membaca permintaan user...");
      await new Promise((r) => setTimeout(r, 1000));

      addLog("parent", "[THINK] Butuh membuat schema dan file test. Mendeploy software-agent...");
      await new Promise((r) => setTimeout(r, 900));

      spawnAgent("sub-1", "software-agent", "Membuat tabel database dan fungsi kalkulator");
      addLog("parent", "[SPAWN] software-agent aktif.");
      await new Promise((r) => setTimeout(r, 800));

      addLog("sub-1", "[TOOL USE] Write('src/calculator.ts')");
      await new Promise((r) => setTimeout(r, 1100));
      addLog("sub-1", "[TOOL RESULT] File 'src/calculator.ts' berhasil dibuat.");
      await new Promise((r) => setTimeout(r, 800));
      setStatus("sub-1", "completed");

      addLog("parent", "[THINK] Kode selesai. Sekarang mendeploy testing-agent untuk verifikasi...");
      await new Promise((r) => setTimeout(r, 900));

      spawnAgent("sub-2", "testing-agent", "Menjalankan unit test untuk calculator.ts");
      addLog("parent", "[SPAWN] testing-agent aktif.");
      await new Promise((r) => setTimeout(r, 800));

      addLog("sub-2", "[TOOL USE] Bash('bun test')");
      await new Promise((r) => setTimeout(r, 1300));
      addLog("sub-2", "[TOOL RESULT] Tests: 4 passed, 4 total.");
      setStatus("sub-2", "completed");

      await new Promise((r) => setTimeout(r, 800));
      addLog("parent", "[ORCHESTRATOR COMPLETE] Semua tugas berhasil didelegasikan dan selesai!");
      setStatus("parent", "completed");
      setGlobalStatus("All Tasks Completed Successfully (Demo)");
    };

    timeoutId = setTimeout(() => {
      runDemo().catch(console.error);
    }, 400);

    return () => clearTimeout(timeoutId);
  }, [isDemo]);

  // Eksekusi prompt dengan agen.ts via child_process
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

    child.stdout.on("data", (data) => {
      const lines = data.toString().split("\n");
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line.startsWith("masukan prompt:")) continue;

        // Deteksi spawn sub-agent dari tool "Task"
        if (line.includes("Tool dipanggil: Task")) {
          try {
            const jsonPart = line.slice(line.indexOf("{"));
            const input = JSON.parse(jsonPart);
            const subName = input.subagent || input.agent || "subagent-" + (input.description ? String(input.description).slice(0, 15) : "worker");
            const subId = `sub-${Date.now()}`;
            activeSubId = subId;

            setAgents((prev) => [
              ...prev,
              {
                id: subId,
                name: subName,
                status: "running",
                task: input.description || "Menjalankan subtask",
                logs: [`[SPAWN] ${subName}: ${input.description || ""}`],
              },
            ]);
            setSelectedIndex((prev) => prev + 1);
          } catch {
            // fallback jika json split
          }
        }

        // Simpan log ke active agent
        setAgents((prev) =>
          prev.map((a) =>
            a.id === activeSubId || (activeSubId !== "parent" && a.id === "parent")
              ? { ...a, logs: [...a.logs, line] }
              : a
          )
        );
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
      setAgents((prev) =>
        prev.map((a) => ({
          ...a,
          status: code === 0 ? "completed" : "failed",
        }))
      );
      setGlobalStatus(code === 0 ? "Completed Successfully" : `Exited with code ${code}`);
    });
  };

  const selectedAgent = agents[selectedIndex] || agents[0];
  const currentSpinner = SPINNER_FRAMES[spinnerIndex];

  return (
    <box flexDirection="column" style={{ padding: 1, width: "100%" }}>
      {/* HEADER */}
      <box
        border
        borderStyle="single"
        borderColor="cyan"
        flexDirection="column"
        style={{ paddingLeft: 1, paddingRight: 1, marginBottom: 1 }}
      >
        <box justifyContent="space-between">
          <text>
            <strong fg="cyan">🤖 AGENT ORCHESTRATOR & SUB-AGENTS MONITOR (OpenTUI)</strong>
          </text>
          <text>
            <span fg="gray">Tekan [q] atau [ESC] untuk keluar</span>
          </text>
        </box>
        <box style={{ marginTop: 0 }}>
          <text>
            <span fg="gray">Status: </span>
            <strong fg={globalStatus.includes("Error") || globalStatus.includes("Exit") ? "red" : "green"}>
              {globalStatus}
            </strong>
          </text>
        </box>
      </box>

      {/* INPUT FORM (Jika belum start) */}
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

      {/* MAIN VIEW: DUAL PANE */}
      <box flexDirection="row" style={{ height: 16 }}>
        {/* SIDEBAR: DAFTAR AGENT */}
        <box
          border
          borderStyle="single"
          borderColor="blue"
          flexDirection="column"
          style={{ width: 34, paddingLeft: 1, paddingRight: 1, marginRight: 1 }}
        >
          <box style={{ marginBottom: 1 }}>
            <text>
              <strong fg="blue">📋 DAFTAR AGEN (↑ / ↓)</strong>
            </text>
          </box>

          {agents.map((agent, index) => {
            const isSelected = index === selectedIndex;
            return (
              <box key={`agent-${agent.id}-${index}`} style={{ marginBottom: 0 }}>
                <text>
                  <span fg={isSelected ? "cyan" : "gray"}>
                    {isSelected ? "❯ " : "  "}
                  </span>
                  {agent.status === "running" ? (
                    <span fg="yellow">{currentSpinner} </span>
                  ) : agent.status === "completed" ? (
                    <span fg="green">✔ </span>
                  ) : agent.status === "failed" ? (
                    <span fg="red">✖ </span>
                  ) : (
                    <span fg="gray">○ </span>
                  )}
                  <span fg={isSelected ? "white" : "gray"}>
                    {agent.name.length > 20 ? agent.name.slice(0, 18) + "…" : agent.name}
                  </span>
                </text>
              </box>
            );
          })}
        </box>

        {/* LOG VIEWPORT */}
        <box
          border
          borderStyle="single"
          borderColor="green"
          flexDirection="column"
          style={{ flexGrow: 1, paddingLeft: 1, paddingRight: 1 }}
        >
          <box justifyContent="space-between" style={{ marginBottom: 1 }}>
            <text>
              <strong fg="green">🔍 PROSES: {selectedAgent?.name}</strong>
            </text>
            <text>
              <span fg={selectedAgent?.status === "running" ? "yellow" : "gray"}>
                [{selectedAgent?.status.toUpperCase()}]
              </span>
            </text>
          </box>

          {selectedAgent?.task && (
            <box style={{ marginBottom: 1 }}>
              <text>
                <em fg="magenta">Task: {selectedAgent.task}</em>
              </text>
            </box>
          )}

          {/* STREAMING LOG LINES */}
          <box flexDirection="column" style={{ flexGrow: 1 }}>
            {selectedAgent?.logs.slice(-10).map((log, idx) => {
              let fgColor = "white";
              if (log.startsWith("[TOOL USE]") || log.includes("Tool dipanggil")) fgColor = "yellow";
              else if (log.startsWith("[TOOL RESULT]")) fgColor = "cyan";
              else if (log.startsWith("[SPAWN]")) fgColor = "magenta";
              else if (log.startsWith("[ORCHESTRATOR")) fgColor = "green";
              else if (log.startsWith("[STDERR]") || log.startsWith("[ERROR]")) fgColor = "red";
              else if (log.startsWith("[PROMPT]")) fgColor = "blue";

              return (
                <text key={`log-${selectedAgent.id}-${idx}`}>
                  <span fg={fgColor}>{log}</span>
                </text>
              );
            })}
          </box>
        </box>
      </box>

      {/* FOOTER */}
      <box
        border
        borderStyle="single"
        borderColor="gray"
        justifyContent="space-between"
        style={{ paddingLeft: 1, paddingRight: 1, marginTop: 1 }}
      >
        <text>
          <span fg="gray">Navigasi: </span>
          <strong fg="cyan">[↑ / ↓]</strong>
          <span fg="gray"> Ganti Agen | </span>
          <strong fg="cyan">[q / ESC]</strong>
          <span fg="gray"> Keluar</span>
        </text>
        <text>
          <span fg="gray">Agen Aktif: {selectedIndex + 1}/{agents.length}</span>
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
