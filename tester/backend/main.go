package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
)

type Book struct {
	ID     int     `json:"id"`
	Title  string  `json:"title"`
	Author string  `json:"author"`
	Price  float64 `json:"price"`
}

var books = []Book{
	{ID: 1, Title: "Laskar Pelangi", Author: "Andrea Hirata", Price: 85000},
	{ID: 2, Title: "Negeri 5 Menara", Author: "Ahmad Fuadi", Price: 75000},
	{ID: 3, Title: "Bumi Manusia", Author: "Pramoedya Ananta Toer", Price: 95000},
}

func main() {
	http.HandleFunc("/books", booksHandler)
	http.HandleFunc("/books/", bookDetailHandler)
	fmt.Println("Server berjalan di http://localhost:8080")
	http.ListenAndServe(":8080", nil)
}

func booksHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	switch r.Method {
	case http.MethodGet:
		json.NewEncoder(w).Encode(books)
	case http.MethodPost:
		var b Book
		json.NewDecoder(r.Body).Decode(&b)
		b.ID = len(books) + 1
		books = append(books, b)
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(b)
	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

func bookDetailHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	parts := strings.Split(r.URL.Path, "/")
	idStr := parts[len(parts)-1]
	id, _ := strconv.Atoi(idStr)

	switch r.Method {
	case http.MethodGet:
		for _, b := range books {
			if b.ID == id {
				json.NewEncoder(w).Encode(b)
				return
			}
		}
		w.WriteHeader(http.StatusNotFound)
	case http.MethodPut:
		var updated Book
		json.NewDecoder(r.Body).Decode(&updated)
		for i, b := range books {
			if b.ID == id {
				updated.ID = id
				books[i] = updated
				json.NewEncoder(w).Encode(updated)
				return
			}
		}
	case http.MethodDelete:
		for i, b := range books {
			if b.ID == id {
				books = append(books[:i], books[i+1:]...)
				w.WriteHeader(http.StatusNoContent)
				return
			}
		}
	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}
