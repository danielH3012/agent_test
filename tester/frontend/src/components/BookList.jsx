import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

export default function BookList() {
  const [books, setBooks] = useState([]);

  useEffect(() => {
    fetch('http://localhost:8080/books')
      .then(r => r.json())
      .then(data => setBooks(data || []))
      .catch(() => setBooks([]));
  }, []);

  const deleteBook = id => {
    fetch(`http://localhost:8080/books/${id}`, { method: 'DELETE' })
      .then(() => setBooks(books.filter(b => b.id !== id)));
  };

  return (
    <div>
      <h2>Daftar Buku</h2>
      <table border="1" cellPadding="8" style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr><th>ID</th><th>Judul</th><th>Penulis</th><th>Harga</th><th>Aksi</th></tr>
        </thead>
        <tbody>
          {books.map(b => (
            <tr key={b.id}>
              <td>{b.id}</td>
              <td>{b.title}</td>
              <td>{b.author}</td>
              <td>Rp {b.price?.toLocaleString('id-ID')}</td>
              <td>
                <Link to={`/edit/${b.id}`}>Edit</Link>
                <button onClick={() => deleteBook(b.id)} style={{ marginLeft: 8 }}>Hapus</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
