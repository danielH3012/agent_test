import { query } from "@anthropic-ai/claude-agent-sdk";
import dotenv from "dotenv";
import * as process from 'node:process';
import * as readline from 'node:readline/promises';

dotenv.config({ override: true });

const key = process.env.OPENROUTER_API_KEY;
if (!key) throw new Error("OPENROUTER_API_KEY kosong");

const MODEL = "thinkingmachines/inkling:free";
process.env.ANTHROPIC_BASE_URL = "https://openrouter.ai/api";
process.env.ANTHROPIC_AUTH_TOKEN = key;
process.env.ANTHROPIC_API_KEY = "";
process.env.ANTHROPIC_DEFAULT_OPUS_MODEL = MODEL;
process.env.ANTHROPIC_DEFAULT_SONNET_MODEL = MODEL;
process.env.ANTHROPIC_DEFAULT_HAIKU_MODEL = MODEL;

const subagents = {
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
      "Gunakan tool mcp__filesystem__list_directory untuk melihat isi folder, " +
      "mcp__filesystem__read_file untuk membaca isi file, dan " +
      "mcp__filesystem__write_file untuk menulis file. Jangan gunakan tool Read/Write biasa.",
    tools: ["mcp__filesystem__*"],
  }
};

async function runOrchestrator(userPrompt: string, cwd: string): Promise<string> {
  let finalResult = "";

  for await (
    const message of query({
      prompt: userPrompt,
      options: {
        pathToClaudeCodeExecutable:
          "C:/Users/user/OneDrive/Documents/proyek_DH/QTERA/agent_test/node_modules/@anthropic-ai/claude-agent-sdk-win32-x64/claude.exe",
        systemPrompt:
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
          "Jika task butuh dokumentasi kode, gunakan subagent code-documenter." +
          "Jika task menyebut MCP server atau butuh akses ke folder project di luar workspace lokal, gunakan subagent mcp__filesystem." +
          "Berikan hasil akhir berupa ringkasan perubahan yang dilakukan.",
        mcpServers: {
          filesystem: {
            command: "npx",
            args: ["-y", "@modelcontextprotocol/server-filesystem", "C:/Users/user/OneDrive/Documents/proyek_DH/QTERA/agent_test/project"]
          },
        },
        agents: subagents,
        allowedTools: [
          "Task",
          "mcp__filesystem__*"
        ],
        cwd: cwd,
        permissionMode: "bypassPermissions",
      },
    })
  ) {
    // ===================== TAMBAHAN LOGGING DI SINI =====================
    // 1) Cek status koneksi MCP server (muncul sekali di awal, message pertama)
    if (message.type === "system" && message.subtype === "init") {
      console.log("[DEBUG] MCP servers status:", message.mcp_servers);
    }

    // 2) Log setiap kali ADA tool yang benar-benar dipanggil (oleh orchestrator
    //    maupun oleh subagent di dalam Task) — ini yang membuktikan apakah
    //    mcp__filesystem__* pernah tersentuh sama sekali
    if (message.type === "assistant") {
      for (const block of message.message.content) {
        if (block.type === "tool_use") {
          console.log("[DEBUG] Tool dipanggil:", block.name, JSON.stringify(block.input));
        }
      }
    }
    // =====================================================================

    if (message.type === "result") {
      if (message.subtype === "success") {
        finalResult = message.result;
      } else {
        throw new Error(
          `Orchestrator gagal: ${message.subtype}`
        );
      }
    }
  }

  return finalResult;
}

async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  const prompt: string = await rl.question('masukan prompt: ');

  const output = await runOrchestrator(
    prompt,
    "C:/Users/user/OneDrive/Documents/proyek_DH/QTERA/agent_test/tester"
  );
  console.log(output);
  rl.close();
}

main().catch(console.error);