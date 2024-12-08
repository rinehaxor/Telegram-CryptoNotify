import sqlite3 from 'sqlite3';

const db = new sqlite3.Database('harga_token.db', (err) => {
   if (err) {
      console.error('Gagal membuka database:', err.message);
   } else {
      console.log('Terhubung ke database SQLite.');
   }
});

// Membuat tabel jika belum ada
db.serialize(() => {
   db.run(`CREATE TABLE IF NOT EXISTS prices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT,
    date TEXT,
    initialPrice REAL,
    finalPrice REAL,
    percentageChange REAL
  )`);
});

export default db;
