const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for all origins
app.use(cors({
  origin: 'https://download-server-gamma.vercel.app', // Specify your frontend URL
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Handle preflight OPTIONS request for CORS
app.options('*', (req, res) => {
  res.set('Access-Control-Allow-Origin', 'https://download-server-gamma.vercel.app');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.sendStatus(200);
});

// Add body parser middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Establish connection to the MySQL database with SSL
const sslCert = process.env.SSL_CERT;

const db = mysql.createConnection({
  host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
  user: '3wpVC1PBcNR2QzZ.root',
  password: 'JEXKYgpaNzuc47xI',
  database: 'test',
  ssl: { ca: sslCert },
});

// Connect to the database
db.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL:', err);
    return;
  }
  console.log('Connected to MySQL');
});

// POST route to check if the token is valid and not expired
app.post('/check-token', (req, res) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ success: false, message: 'Token is required' });
  }

  // Check if the token exists and is valid or expired
  const checkTokenQuery = `SELECT * FROM download_links WHERE token = ?`;
  
  db.query(checkTokenQuery, [token], (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ success: false, message: 'Database error' });
    }

    if (results.length === 0) {
      return res.status(404).json({ success: false, message: 'Token not found' });
    }

    const { link_expiry_time } = results[0];

    // Check if the link has expired
    if (new Date(link_expiry_time) < new Date()) {
      // If expired, delete the entry and send an expired message
      const deleteQuery = 'DELETE FROM download_links WHERE token = ?';
      db.query(deleteQuery, [token], (deleteErr) => {
        if (deleteErr) {
          console.error('Error deleting expired token:', deleteErr);
          return res.status(500).json({ success: false, message: 'Database error while deleting expired token' });
        }
      });
      return res.status(403).json({ success: false, message: 'Link expired' });
    }

    // If the token is valid, respond with success
    res.json({ success: true, message: 'Token is valid!' });
  });
});

// GET route to handle file download
app.get('/download', (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).json({ message: 'Token is required' });
  }

  // Query to find the file associated with the token
  const query = 'SELECT file_name, file_id, link_expiry_time FROM download_links WHERE token = ?';
  db.query(query, [token], (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ message: 'Database error' });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: 'Token not found' });
    }

    const { file_name, file_id, link_expiry_time } = results[0];

    // Check if the link has expired
    if (new Date(link_expiry_time) < new Date()) {
      // Delete the expired link
      const deleteQuery = 'DELETE FROM download_links WHERE token = ?';
      db.query(deleteQuery, [token], (deleteErr) => {
        if (deleteErr) {
          console.error('Error deleting expired token:', deleteErr);
          return res.status(500).json({ message: 'Database error while deleting expired token' });
        }
      });
      return res.status(403).json({ message: 'Link is expired' });
    }

    // Query to fetch the file data from the uploaded_files table
    const fileQuery = 'SELECT file_data FROM uploaded_files WHERE file_id = ?';
    db.query(fileQuery, [file_id], (err, fileResults) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ message: 'Database error' });
      }

      if (fileResults.length === 0) {
        return res.status(404).json({ message: 'File not found' });
      }

      // Send the file data as a download
      const fileData = fileResults[0].file_data;
      res.setHeader('Content-Disposition', `attachment; filename="${file_name}"`);
      res.setHeader('Content-Type', 'application/octet-stream');
      res.send(fileData);
    });
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
