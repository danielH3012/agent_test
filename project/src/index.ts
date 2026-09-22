import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getApiSpec, listEndpoints, searchSpecs, insertApiSpec, insertEndpoint, insertApiSpecFull } from "./tools";

const server = new Server(
  { name: "api-spec-server", version: "1.0.0" },
  {
    capabilities: {
      tools: { listChanged: false },
    },
  }
);

// Tool: list available tools
server.setRequestHandler(
  z.object({
    method: z.literal("tools/list"),
    params: z.any().optional(),
  }),
  async () => {
    return {
      tools: [
        {
          name: "getApiSpec",
          description: "Ambil API spec berdasarkan ID",
          inputSchema: {
            type: "object",
            properties: {
              id: { type: "number" },
            },
            required: ["id"],
          },
        },
        {
          name: "listEndpoints",
          description: "Daftar endpoint untuk API spec",
          inputSchema: {
            type: "object",
            properties: {
              apiId: { type: "number" },
            },
            required: ["apiId"],
          },
        },
        {
          name: "searchSpecs",
          description: "Cari API spec berdasarkan query",
          inputSchema: {
            type: "object",
            properties: {
              query: { type: "string" },
            },
            required: ["query"],
          },
        },
        {
          name: "insertApiSpec",
          description: "Masukkan API spec baru",
          inputSchema: {
            type: "object",
            properties: {
              title: { type: "string" },
              version: { type: "string" },
              description: { type: "string" },
            },
            required: ["title", "version"],
          },
        },
        {
          name: "insertEndpoint",
          description: "Masukkan endpoint untuk API spec",
          inputSchema: {
            type: "object",
            properties: {
              apiId: { type: "number" },
              path: { type: "string" },
              method: { type: "string" },
              description: { type: "string" },
              schema: { type: "object" },
            },
            required: ["apiId", "path", "method"],
          },
        },
        {
          name: "insertApiSpecFull",
          description: "Masukkan API spec lengkap dengan endpoint dalam transaksi",
          inputSchema: {
            type: "object",
            properties: {
              title: { type: "string" },
              version: { type: "string" },
              description: { type: "string" },
              endpoints: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    path: { type: "string" },
                    method: { type: "string" },
                    description: { type: "string" },
                    schema: { type: "object" },
                  },
                  required: ["path", "method"],
                },
              },
            },
            required: ["title", "version"],
          },
        },
      ],
    };
  }
);

// Tool call handler
server.setRequestHandler(
  z.object({
    method: z.literal("tools/call"),
    params: z.object({
      name: z.string(),
      arguments: z.record(z.any()).optional(),
    }),
  }),
  async (request: any) => {
    const args = (request.params.arguments || {}) as Record<string, unknown>;
    const name = request.params.name;

    if (name === "getApiSpec") {
      const spec = await getApiSpec(Number(args.id));
      return {
        content: [{ type: "text" as const, text: JSON.stringify(spec, null, 2) }],
      };
    }
    if (name === "listEndpoints") {
      const endpoints = await listEndpoints(Number(args.apiId));
      return {
        content: [{ type: "text" as const, text: JSON.stringify(endpoints, null, 2) }],
      };
    }
    if (name === "searchSpecs") {
      const specs = await searchSpecs(String(args.query));
      return {
        content: [{ type: "text" as const, text: JSON.stringify(specs, null, 2) }],
      };
    }
    if (name === "insertApiSpec") {
      const spec = await insertApiSpec(String(args.title), String(args.version), args.description ? String(args.description) : undefined);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(spec, null, 2) }],
      };
    }
    if (name === "insertEndpoint") {
      const ep = await insertEndpoint(
        Number(args.apiId),
        String(args.path),
        String(args.method),
        args.description ? String(args.description) : undefined,
        args.schema ? (args.schema as any) : undefined
      );
      return {
        content: [{ type: "text" as const, text: JSON.stringify(ep, null, 2) }],
      };
    }
    if (name === "insertApiSpecFull") {
      const result = await insertApiSpecFull(
        String(args.title),
        String(args.version),
        args.description ? String(args.description) : undefined,
        Array.isArray(args.endpoints) ? args.endpoints.map((e: any) => ({
          path: String(e.path),
          method: String(e.method),
          description: e.description ? String(e.description) : undefined,
          schema: e.schema ? (e.schema as any) : undefined,
        })) : undefined
      );
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    }
    return {
      content: [{ type: "text" as const, text: `Tool ${name} not found` }],
      isError: true,
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP API Spec Server running");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
