import { query } from "@anthropic-ai/claude-agent-sdk";
import { createOpencodeServer, createOpencodeClient } from "@opencode-ai/sdk";
import dotenv from "dotenv";
import * as fs from 'node:fs';
import * as net from 'node:net';
import * as path from 'node:path';
import * as process from 'node:process';
import * as readline from 'node:readline/promises';

dotenv.config({ override: true });

async function getFreePort(): Promise<number> {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.unref();
    srv.listen(0, "127.0.0.1", () => {
      const address = srv.address();
      const port = typeof address === "object" && address ? address.port : 4097;
      srv.close(() => resolve(port));
    });
  });
}

const key = process.env.OPENROUTER_API_KEY;
if (!key) throw new Error("OPENROUTER_API_KEY kosong");

// Atomic stdout writer — mencegah interleaving saat Claude & OpenCode tulis bersamaan.
// fs.writeSync(1, ...) menulis ke fd 1 (stdout) secara sinkron dalam satu syscall.
function atomicLog(line: string) {
  fs.writeSync(1, line + "\n");
}

// Helper: log multi-line string, setiap baris di-prefix
function logPrefixed(prefix: string, text: string) {
  for (const line of text.split("\n")) {
    atomicLog(`${prefix} ${line}`);
  }
}

const MODEL = "thinkingmachines/inkling:free";

const ROOT_DIR = "C:/Users/user/OneDrive/Documents/proyek_DH/QTERA/agent_test";
const BASE_PROJECT = path.join(ROOT_DIR, "project");
const CLAUDE_DIR = path.join(ROOT_DIR, "claude");
const OPENCODE_DIR = path.join(ROOT_DIR, "opencode");

function freshCopy(src: string, dest: string) {
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
}

// ---------- Claude Agent SDK setup ----------
process.env.ANTHROPIC_BASE_URL = "https://openrouter.ai/api";
process.env.ANTHROPIC_AUTH_TOKEN = key;
process.env.ANTHROPIC_API_KEY = "";
process.env.ANTHROPIC_DEFAULT_OPUS_MODEL = MODEL;
process.env.ANTHROPIC_DEFAULT_SONNET_MODEL = MODEL;
process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL = MODEL;

const claudeSdkSubagents = {
  "file-summarizer": {
    description: "Membaca dan merangkum isi file teks/dokumen. Panggil kalau task butuh ringkasan konten.",
    prompt: "Kamu ahli merangkum dokumen teknis secara akurat dan padat.",
    tools: ["Read", "Glob"],
  },
  "code-fixer": {
    description: "Mencari bug yang bisa crash dan memperbaikinya langsung di kode. Panggil kalau task butuh eksekusi perbaikan bug.",
    prompt: "Kamu senior engineer. Perbaiki bug dengan perubahan minimal dan aman. Verifikasi fix dengan menjalankan test/build terkait.",
    tools: ["Read", "Edit", "Grep", "Bash"],
  },
  "software-agent": {
    description: "Membuat software baru dari nol berdasarkan spesifikasi. Panggil kalau task butuh implementasi fitur/modul baru.",
    prompt: "Kamu senior engineer. Buat software dengan desain minimal dan aman.",
    tools: ["Read", "Edit", "Grep", "Write", "Glob"],
  },
  "testing-agent": {
    description: "Menulis dan menjalankan test untuk software. Panggil kalau task butuh test coverage atau verifikasi behavior.",
    prompt: "Kamu QA engineer. Tulis test yang mencakup edge case penting, lalu jalankan dan laporkan hasilnya.",
    tools: ["Read", "Write", "Edit", "Grep", "Glob", "Bash"],
  },
  "code-reviewer": {
    description: "Membaca kode dan memberi feedback tanpa mengubahnya. Panggil kalau task butuh review/audit kode.",
    prompt: "Kamu senior engineer. Review kode secara kritis: bug, security, readability. Jangan ubah kode, hanya laporkan temuan.",
    tools: ["Read", "Grep", "Glob"],
  },
  "code-optimizer": {
    description: "Mencari bottleneck performa dan mengoptimalkan kode. Panggil kalau task butuh peningkatan performa/efisiensi.",
    prompt: "Kamu senior engineer. Optimalkan kode dengan perubahan minimal dan aman, jaga behavior tetap sama.",
    tools: ["Read", "Edit", "Grep", "Bash"],
  },
  "code-documenter": {
    description: "Menulis dan memperbarui dokumentasi kode (komentar, README, docs). Panggil kalau task butuh dokumentasi.",
    prompt: "Kamu senior engineer. Dokumentasikan kode dengan jelas tanpa mengubah logika program.",
    tools: ["Read", "Edit", "Write", "Grep", "Glob"],
  },
  "mcp__filesystem": {
    description: "Membaca dan menulis file di folder project lewat MCP filesystem server. Panggil kalau task butuh akses file di luar workspace lokal atau menyebut MCP server.",
    prompt: "Kamu subagent untuk mengakses folder project lewat MCP filesystem server. " +
      "Gunakan tool mcp__filesystem__list_directory, mcp__filesystem__read_file, dan mcp__filesystem__write_file. Jangan gunakan tool Read/Write biasa.",
    tools: ["mcp__filesystem__*"],
  }
};

const ORCHESTRATOR_SYSTEM_PROMPT =
  "Kamu adalah orchestrator. Tentukan langkah-langkah yang diperlukan, " +
  "lalu delegasikan setiap langkah ke subagent yang paling sesuai lewat tool Task. " +
  "setelah anda melakukan perubahan dan/atau penambahan kode, lakukan testing dengan testing-agent untuk memastikan kode berjalan dengan baik. " +
  "Jangan mengerjakan detail teknisnya sendiri. " +
  "Jika task butuh membaca file, gunakan subagent file-summarizer. " +
  "Jika task butuh memperbaiki bug, gunakan subagent code-fixer. " +
  "Jika task butuh membuat software baru, gunakan subagent software-agent. " +
  "Jika task butuh menulis atau menjalankan test, gunakan subagent testing-agent. " +
  "Jika task butuh review kode, gunakan subagent code-reviewer. " +
  "Jika task butuh optimasi performa, gunakan subagent code-optimizer. " +
  "Jika task butuh dokumentasi kode, gunakan subagent code-documenter. " +
  "Jika task menyebut MCP server atau butuh akses ke folder project di luar workspace lokal, gunakan subagent mcp__filesystem. " +
  "Berikan hasil akhir berupa ringkasan perubahan yang dilakukan.";

async function runClaudeSdkOrchestrator(userPrompt: string, cwd: string): Promise<string> {
  let finalResult = "";
  atomicLog("[CLAUDE] Agent dimulai");

  for await (
    const message of query({
      prompt: userPrompt,
      options: {
        pathToClaudeCodeExecutable:
          "C:/Users/user/OneDrive/Documents/proyek_DH/QTERA/agent_test/node_modules/@anthropic-ai/claude-agent-sdk-win32-x64/claude.exe",
        systemPrompt: ORCHESTRATOR_SYSTEM_PROMPT,
        mcpServers: {
          filesystem: {
            command: "npx",
            args: ["-y", "@modelcontextprotocol/server-filesystem", cwd]
          },
        },
        agents: claudeSdkSubagents,
        allowedTools: ["Task", "mcp__filesystem__*"],
        cwd,
        permissionMode: "bypassPermissions",
      },
    })
  ) {
    if (message.type === "assistant") {
      for (const block of message.message.content) {
        if (block.type === "tool_use") {
          atomicLog(`[CLAUDE] Tool dipanggil: ${block.name} ${JSON.stringify(block.input)}`);
        }
      }
    }
    if (message.type === "result") {
      if (message.subtype === "success") finalResult = message.result;
      else throw new Error(`Orchestrator gagal: ${message.subtype}`);
    }
  }

  atomicLog("[CLAUDE] Agent selesai");
  return finalResult;
}

// ---------- opencode SDK setup ----------
// port beda supaya dua instance opencode (kalau nanti mau dua-duanya opencode juga) tidak bentrok
function buildOpencodeAgents(cwd: string) {
  return {
    build: { mode: "primary" as const, model: `openrouter/${MODEL}`, prompt: ORCHESTRATOR_SYSTEM_PROMPT },
    "file-summarizer": { description: claudeSdkSubagents["file-summarizer"].description, mode: "subagent" as const, model: `openrouter/${MODEL}`, prompt: claudeSdkSubagents["file-summarizer"].prompt, tools: { read: true, glob: true, write: false, edit: false, bash: false } },
    "code-fixer": { description: claudeSdkSubagents["code-fixer"].description, mode: "subagent" as const, model: `openrouter/${MODEL}`, prompt: claudeSdkSubagents["code-fixer"].prompt, tools: { read: true, edit: true, grep: true, bash: true, write: false } },
    "software-agent": { description: claudeSdkSubagents["software-agent"].description, mode: "subagent" as const, model: `openrouter/${MODEL}`, prompt: claudeSdkSubagents["software-agent"].prompt, tools: { read: true, edit: true, grep: true, write: true, glob: true } },
    "testing-agent": { description: claudeSdkSubagents["testing-agent"].description, mode: "subagent" as const, model: `openrouter/${MODEL}`, prompt: claudeSdkSubagents["testing-agent"].prompt, tools: { read: true, write: true, edit: true, grep: true, glob: true, bash: true } },
    "code-reviewer": { description: claudeSdkSubagents["code-reviewer"].description, mode: "subagent" as const, model: `openrouter/${MODEL}`, prompt: claudeSdkSubagents["code-reviewer"].prompt, tools: { read: true, grep: true, glob: true, edit: false, write: false } },
    "code-optimizer": { description: claudeSdkSubagents["code-optimizer"].description, mode: "subagent" as const, model: `openrouter/${MODEL}`, prompt: claudeSdkSubagents["code-optimizer"].prompt, tools: { read: true, edit: true, grep: true, bash: true, write: false } },
    "code-documenter": { description: claudeSdkSubagents["code-documenter"].description, mode: "subagent" as const, model: `openrouter/${MODEL}`, prompt: claudeSdkSubagents["code-documenter"].prompt, tools: { read: true, edit: true, write: true, grep: true, glob: true } },
  };
}

async function runOpencodeOrchestrator(userPrompt: string, cwd: string): Promise<string> {
  atomicLog("[OPENCODE] Agent dimulai");
  try {
    const port = await getFreePort();
    const server = await createOpencodeServer({
      hostname: "127.0.0.1",
      port, // Port dinamis bebas bentrok dengan instance lama/lain
      config: {
        default_agent: "build", // agent "build" jadi primary default untuk session baru
        subagent_depth: 3, // Mengizinkan sub-agent memanggil task / sub-agent (default: 1)
        agent: buildOpencodeAgents(cwd),
        tools: { read: false, write: false, edit: false, grep: false, bash: false, glob: false, task: true },
        model: `openrouter/${MODEL}`,
        provider: {
          openrouter: {
            npm: "@openrouter/ai-sdk-provider",
            name: "OpenRouter",
            options: { apiKey: key },
          },
        },
        mcp: {
          filesystem: {
            type: "local",
            command: ["npx", "-y", "@modelcontextprotocol/server-filesystem", cwd],
          },
        },
      } as any,
    });

    const client = createOpencodeClient({
      baseUrl: server.url,
      directory: cwd, // Mengisolasi ruang kerja OpenCode ke folder runs/opencode-run (bukan project master)
    });

    try {
      const session = await client.session.create({ body: { title: "opencode orchestrator" } });
      if (session.error || !session.data) {
        const issues = (session.error as any)?.data?.issues;
        const issueMsg = Array.isArray(issues) ? issues.map((i: any) => i.message).join(", ") : "";
        const errMsg = issueMsg || (session.error as any)?.name || "Gagal membuat session";
        throw new Error(`Gagal membuat session: ${errMsg}`);
      }
      const sessionId = session.data.id;

      // Subscribe ke event stream SEBELUM mengirim prompt
      const { stream } = await client.event.subscribe();

      // Kirim prompt secara async (non-blocking)
      await client.session.promptAsync({
        path: { id: sessionId },
        body: { parts: [{ type: "text", text: userPrompt }] },
      });

      let finalResult = "";
      // Track tool states yang sudah di-log supaya tidak duplikat
      const loggedTools = new Set<string>();

      // Consume SSE event stream
      for await (const event of stream) {
        const evt = event as any;
        const evtType: string = evt?.type ?? "";

        if (evtType === "message.part.updated") {
          const part = evt.properties?.part;
          if (!part) continue;

          // Tool call event
          if (part.type === "tool") {
            const toolName: string = part.tool || "unknown";
            const state = part.state;
            const toolKey = `${part.callID || part.id}-${toolName}`;

            // Hanya log saat status "running" (skip "pending" agar tidak duplikat)
            if (state?.status === "running") {
              if (!loggedTools.has(toolKey)) {
                loggedTools.add(toolKey);
                const inputStr = state.input ? JSON.stringify(state.input) : "{}";
                atomicLog(`[OPENCODE] Tool dipanggil: ${toolName} ${inputStr}`);
              }
            } else if (state?.status === "completed") {
              const title = state.title || toolName;
              atomicLog(`[OPENCODE] Tool selesai: ${title}`);
            } else if (state?.status === "error") {
              atomicLog(`[OPENCODE] Tool error: ${toolName} - ${state.error}`);
            }
          }

          // Sub-agent (AgentPart) — indicates agent switch
          if (part.type === "agent") {
            if (part.name && part.name !== "build") {
              atomicLog(`[OPENCODE] Tool dipanggil: Task {"subagent_type":"${part.name}","description":"Sub-agent ${part.name} diaktifkan"}`);
            } else {
              atomicLog(`[OPENCODE] Tool selesai: task`);
            }
          }

          // Subtask spawn — explicit sub-agent delegation
          if (part.type === "subtask") {
            atomicLog(`[OPENCODE] Tool dipanggil: Task {"subagent_type":"${part.agent}","description":"${part.description || part.prompt || 'Sub-task'}"}`);
          }

          // Text part (assistant response text)
          if (part.type === "text" && part.text) {
            // Capture final text for result
            finalResult = part.text;
          }
        }

        // Session completed
        if (evtType === "session.idle") {
          if (evt.properties?.sessionID === sessionId) {
            break;
          }
        }

        // Session error
        if (evtType === "session.error") {
          if (evt.properties?.sessionID === sessionId) {
            const errMsg = evt.properties?.error?.data?.message || "Unknown error";
            atomicLog(`[OPENCODE] Error: ${errMsg}`);
            break;
          }
        }
      }

      // Fallback: jika tidak ada text part, ambil messages dari session
      if (!finalResult) {
        try {
          const messages = await client.session.messages({
            path: { id: sessionId },
          });
          const msgData = messages.data as any;
          if (Array.isArray(msgData)) {
            const lastAssistant = [...msgData].reverse().find((m: any) => m.role === "assistant");
            if (lastAssistant) {
              finalResult = JSON.stringify(lastAssistant, null, 2);
            }
          }
        } catch {
          finalResult = "(Tidak dapat mengambil hasil akhir)";
        }
      }

      atomicLog("[OPENCODE] Agent selesai");
      return finalResult;
    } finally {
      await server.close();
    }
  } catch (err: any) {
    atomicLog(`[OPENCODE] Error: ${err.message || err}`);
    throw err;
  }
}

// ---------- Main: jalankan bersamaan, direktori terpisah ----------
async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const prompt: string = await rl.question('masukan prompt: ');
  rl.close();

  // Pastikan direktori kerja kedua agen tersedia (tanpa clone/copy dari folder project/)
  fs.mkdirSync(CLAUDE_DIR, { recursive: true });
  fs.mkdirSync(OPENCODE_DIR, { recursive: true });

  const [claudeRes, opencodeRes] = await Promise.allSettled([
    runClaudeSdkOrchestrator(prompt, CLAUDE_DIR),
    runOpencodeOrchestrator(prompt, OPENCODE_DIR),
  ]);

  atomicLog("[CLAUDE] === Hasil Claude Agent SDK ===");
  const claudeOutput = claudeRes.status === "fulfilled" ? claudeRes.value : `ERROR: ${claudeRes.reason}`;
  logPrefixed("[CLAUDE]", claudeOutput);
  atomicLog(`[CLAUDE] (hasil file: ${CLAUDE_DIR})`);

  atomicLog("[OPENCODE] === Hasil opencode SDK ===");
  const opencodeOutput = opencodeRes.status === "fulfilled" ? opencodeRes.value : `ERROR: ${opencodeRes.reason}`;
  logPrefixed("[OPENCODE]", opencodeOutput);
  atomicLog(`[OPENCODE] (hasil file: ${OPENCODE_DIR})`);
}

main().catch(console.error);