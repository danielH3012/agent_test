import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import BookList from './components/BookList.jsx';
import BookForm from './components/BookForm.jsx';

function App() {
  return (
    <BrowserRouter>
      <div style={{ fontFamily: 'sans-serif', padding: 20, maxWidth: 900, margin: '0 auto' }}>
        <h1>Toko Buku</h1>
        <nav style={{ marginBottom: 20 }}>
          <Link to="/" style={{ marginRight: 15 }}>Daftar Buku</Link>
          <Link to="/tambah">Tambah Buku</Link>
        </nav>
        <Routes>
          <Route path="/" element={<BookList />} />
          <Route path="/tambah" element={<BookForm />} />
          <Route path="/edit/:id" element={<BookForm />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
