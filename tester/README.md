<!--
Dokumentasi Struktur Aplikasi Toko Buku
========================================
Backend: GoLang (folder backend/)
- main.go: REST API dengan endpoint:
  * GET /books         -> daftar semua buku
  * POST /books        -> tambah buku baru
  * GET /books/{id}    -> ambil detail buku
  * PUT /books/{id}    -> perbarui buku
  * DELETE /books/{id} -> hapus buku
- Port: 8080
- Struktur data: Book (ID, Title, Author, Price)

Frontend: React JS + Vite (folder frontend/)
- src/App.jsx         -> routing utama (/, /tambah, /edit/:id)
- src/components/BookList.jsx -> komponen daftar buku (fetch, tampil tabel, hapus)
- src/components/BookForm.jsx -> komponen form tambah/edit buku
- Menggunakan react-router-dom untuk navigasi

Endpoint utama digunakan oleh frontend untuk operasi CRUD buku.
-->

Aplikasi toko buku dengan backend GoLang dan frontend React JS.

## Struktur

- `backend/` - REST API Go (port 8080)
- `frontend/` - React + Vite

## Cara Jalankan

Backend:
```bash
cd backend
go run main.go
```

Frontend:
```bash
cd frontend
npm install
npm run dev
```
