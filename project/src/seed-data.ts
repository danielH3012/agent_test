import dotenv from 'dotenv';
import { insertApiSpecFull } from './tools';

dotenv.config();

async function seed() {
  // Domain 1: Auth & User Management API
  const authSpec = await insertApiSpecFull(
    "Auth & User Management API",
    "1.0.0",
    "Layanan autentikasi berbasis JWT, pendaftaran pengguna, perpanjangan token, dan pengelolaan profil pengguna.",
    [
      {
        path: "/api/v1/auth/register",
        method: "POST",
        description: "Mendaftarkan pengguna baru dengan email dan kata sandi.",
        schema: {
          type: "object",
          properties: {
            name: { type: "string", example: "John Doe" },
            email: { type: "string", format: "email", example: "john@example.com" },
            password: { type: "string", minLength: 8, example: "Secret123!" },
          },
          required: ["name", "email", "password"],
        },
      },
      {
        path: "/api/v1/auth/login",
        method: "POST",
        description: "Login menggunakan kredensial email dan password, mengembalikan access token dan refresh token.",
        schema: {
          type: "object",
          properties: {
            email: { type: "string", format: "email", example: "john@example.com" },
            password: { type: "string", example: "Secret123!" },
          },
          required: ["email", "password"],
        },
      },
      {
        path: "/api/v1/auth/refresh-token",
        method: "POST",
        description: "Memperbarui access token yang telah expired menggunakan refresh token.",
        schema: {
          type: "object",
          properties: {
            refreshToken: { type: "string" },
          },
          required: ["refreshToken"],
        },
      },
      {
        path: "/api/v1/users/me",
        method: "GET",
        description: "Mendapatkan data profil pengguna yang sedang login (memerlukan Header Authorization).",
        schema: {
          type: "object",
          properties: {
            id: { type: "number" },
            name: { type: "string" },
            email: { type: "string" },
            bio: { type: "string" },
            role: { type: "string", example: "user" },
          },
        },
      },
      {
        path: "/api/v1/users/profile",
        method: "PUT",
        description: "Memperbarui data profil pengguna saat ini.",
        schema: {
          type: "object",
          properties: {
            name: { type: "string" },
            bio: { type: "string" },
            avatarUrl: { type: "string", format: "uri" },
          },
        },
      },
    ]
  );
  console.log("Inserted Auth spec:", authSpec.apiSpec.id, "with", authSpec.endpoints.length, "endpoints");

  // Domain 2: Task Management API
  const taskSpec = await insertApiSpecFull(
    "Task Management API",
    "1.0.0",
    "Layanan manajemen tugas (CRUD, filter query parameter, prioritas, dan siklus status).",
    [
      {
        path: "/api/v1/tasks",
        method: "GET",
        description: "Mengambil daftar tugas dengan filter status, prioritas, dan pagination.",
        schema: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["TODO", "IN_PROGRESS", "DONE"] },
            priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
            page: { type: "integer", default: 1 },
            limit: { type: "integer", default: 10 },
          },
        },
      },
      {
        path: "/api/v1/tasks",
        method: "POST",
        description: "Membuat tugas baru.",
        schema: {
          type: "object",
          properties: {
            title: { type: "string", example: "Implement unit tests" },
            description: { type: "string" },
            priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"], default: "MEDIUM" },
            dueDate: { type: "string", format: "date-time" },
          },
          required: ["title"],
        },
      },
      {
        path: "/api/v1/tasks/:id/status",
        method: "PATCH",
        description: "Memperbarui status pengerjaan tugas (TODO -> IN_PROGRESS -> DONE).",
        schema: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["TODO", "IN_PROGRESS", "DONE"] },
          },
          required: ["status"],
        },
      },
      {
        path: "/api/v1/tasks/:id",
        method: "DELETE",
        description: "Menghapus tugas berdasarkan ID.",
        schema: {
          type: "object",
          properties: {
            id: { type: "number" },
          },
          required: ["id"],
        },
      },
    ]
  );
  console.log("Inserted Task spec:", taskSpec.apiSpec.id, "with", taskSpec.endpoints.length, "endpoints");
}

seed().catch((err) => {
  console.error("Error seeding data:", err);
  process.exit(1);
});
