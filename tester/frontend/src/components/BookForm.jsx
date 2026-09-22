import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

export default function BookForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({ title: '', author: '', price: '' });

  useEffect(() => {
    if (id) {
      fetch(`http://localhost:8080/books/${id}`)
        .then(r => r.json())
        .then(data => setForm({ title: data.title, author: data.author, price: data.price }))
        .catch(() => {});
    }
  }, [id]);

  const submit = e => {
    e.preventDefault();
    const url = id ? `http://localhost:8080/books/${id}` : 'http://localhost:8080/books';
    const method = id ? 'PUT' : 'POST';
    fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, price: parseFloat(form.price) })
    }).then(() => navigate('/'));
  };

  return (
    <form onSubmit={submit}>
      <h2>{id ? 'Edit' : 'Tambah'} Buku</h2>
      <div style={{ marginBottom: 10 }}>
        <label>Judul: </label>
        <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
      </div>
      <div style={{ marginBottom: 10 }}>
        <label>Penulis: </label>
        <input value={form.author} onChange={e => setForm({ ...form, author: e.target.value })} required />
      </div>
      <div style={{ marginBottom: 10 }}>
        <label>Harga: </label>
        <input type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} required />
      </div>
      <button type="submit">Simpan</button>
    </form>
  );
}
