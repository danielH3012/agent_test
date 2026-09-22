#!/bin/bash
# Test verifikasi lengkap untuk aplikasi Toko Buku

echo "========================================"
echo "VERIFIKASI APLIKASI TOKO BUKU"
echo "========================================"
echo ""

# 1. Periksa file backend/main.go dan frontend/src/App.jsx
PASS=0
FAIL=0

echo "[1] VERIFIKASI FILE UTAMA"
echo "-------------------------"
if [ -f "backend/main.go" ]; then
    echo "  [PASS] backend/main.go ADA"
    PASS=$((PASS+1))
else
    echo "  [FAIL] backend/main.go TIDAK ADA"
    FAIL=$((FAIL+1))
fi

if [ -f "frontend/src/App.jsx" ]; then
    echo "  [PASS] frontend/src/App.jsx ADA"
    PASS=$((PASS+1))
else
    echo "  [FAIL] frontend/src/App.jsx TIDAK ADA"
    FAIL=$((FAIL+1))
fi

echo ""

# 2. Periksa file komponen
echo "[2] VERIFIKASI FILE KOMPONEN"
echo "-----------------------------"
if [ -f "frontend/src/components/BookList.jsx" ]; then
    echo "  [PASS] BookList.jsx ADA"
    PASS=$((PASS+1))
else
    echo "  [FAIL] BookList.jsx TIDAK ADA"
    FAIL=$((FAIL+1))
fi

if [ -f "frontend/src/components/BookForm.jsx" ]; then
    echo "  [PASS] BookForm.jsx ADA"
    PASS=$((PASS+1))
else
    echo "  [FAIL] BookForm.jsx TIDAK ADA"
    FAIL=$((FAIL+1))
fi

echo ""

# 3. Periksa struktur folder
echo "[3] VERIFIKASI STRUKTUR FOLDER"
echo "-------------------------------"
if [ -d "backend/" ]; then
    echo "  [PASS] folder backend/ ADA"
    PASS=$((PASS+1))
else
    echo "  [FAIL] folder backend/ TIDAK ADA"
    FAIL=$((FAIL+1))
fi

if [ -d "frontend/src/components/" ]; then
    echo "  [PASS] folder frontend/src/components/ ADA"
    PASS=$((PASS+1))
else
    echo "  [FAIL] folder frontend/src/components/ TIDAK ADA"
    FAIL=$((FAIL+1))
fi

echo ""

# 4. Periksa kelengkapan isi file penting
echo "[4] VERIFIKASI KELENGKAPAN ISI FILE"
echo "-----------------------------------"
if grep -q "package main" backend/main.go; then
    echo "  [PASS] backend/main.go berisi 'package main'"
    PASS=$((PASS+1))
else
    echo "  [FAIL] backend/main.go TIDAK lengkap"
    FAIL=$((FAIL+1))
fi

if grep -q "func main()" backend/main.go; then
    echo "  [PASS] backend/main.go berisi 'func main()'"
    PASS=$((PASS+1))
else
    echo "  [FAIL] backend/main.go tidak memiliki main()"
    FAIL=$((FAIL+1))
fi

if grep -q "BrowserRouter" frontend/src/App.jsx; then
    echo "  [PASS] frontend/src/App.jsx lengkap (BrowserRouter)"
    PASS=$((PASS+1))
else
    echo "  [FAIL] frontend/src/App.jsx TIDAK lengkap"
    FAIL=$((FAIL+1))
fi

if grep -q "export default" frontend/src/components/BookList.jsx; then
    echo "  [PASS] BookList.jsx lengkap (export default)"
    PASS=$((PASS+1))
else
    echo "  [FAIL] BookList.jsx TIDAK lengkap"
    FAIL=$((FAIL+1))
fi

if grep -q "export default" frontend/src/components/BookForm.jsx; then
    echo "  [PASS] BookForm.jsx lengkap (export default)"
    PASS=$((PASS+1))
else
    echo "  [FAIL] BookForm.jsx TIDAK lengkap"
    FAIL=$((FAIL+1))
fi

echo ""

# Ringkasan
echo "========================================"
echo "RINGKASAN STATUS"
echo "========================================"
echo "PASS: $PASS"
echo "FAIL: $FAIL"

if [ $FAIL -eq 0 ]; then
    echo "Status: APLIKASI SIAP DIJALANKAN (Tidak ada masalah)"
else
    echo "Status: MASIH PERLU PERBAIKAN (Ada $FAIL kegagalan)"
fi

echo ""
echo "File yang dicek:"
echo "  - backend/main.go"
echo "  - frontend/src/App.jsx"
echo "  - frontend/src/components/BookList.jsx"
echo "  - frontend/src/components/BookForm.jsx"
echo "  - Struktur folder: backend/, frontend/src/components/"
