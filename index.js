const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const fs = require('fs');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 5000; // Use dynamic port for deployment

// Enable CORS for all origins (can restrict to your frontend URL if needed)
app.use(cors({
  origin: 'https://download-server-gamma.vercel.app', // Specify your frontend URL
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true // Set to true if using cookies or authorization headers
}));



// Handle preflight OPTIONS request for CORS
app.options('*', (req, res) => {
  res.set('Access-Control-Allow-Origin', 'https://download-server-gamma.vercel.app');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.sendStatus(200); // Ensure you send a 200 status for preflight
});

// Add body parser middleware
app.use(bodyParser.json()); // For parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // For parsing application/x-www-form-urlencoded

// Establish connection to the MySQL database with SSL
const sslCert = process.env.SSL_CERT;

const db = mysql.createConnection({
  host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
  user: '3wpVC1PBcNR2QzZ.root',
  password: 'JEXKYgpaNzuc47xI',
  database: 'test',
  ssl: {
    ca: sslCert  // Use the environment variable instead of reading from the file
  },
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

  // First, delete expired tokens
  const deleteExpiredQuery = `DELETE FROM download_links WHERE link_expiry_time < NOW()`;

  db.query(deleteExpiredQuery, (err) => {
    if (err) {
      console.error('Error deleting expired tokens:', err);
      return res.status(500).json({ success: false, message: 'Database error' });
    }

    // After deleting expired tokens, check if the provided token is valid
    const checkTokenQuery = `SELECT * FROM download_links WHERE token = ? AND link_expiry_time > NOW()`;

    db.query(checkTokenQuery, [token], (err, results) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ success: false, message: 'Database error' });
      }

      if (results.length > 0) {
        res.json({ success: true, message: 'Token is valid!' });
      } else {
        res.json({ success: false, message: 'Token expired or not found' });
      }
    });
  });
});



// GET route to download the file based on token
app.get('/download', (req, res) => {
  const { token } = req.query;

  // Check if token is provided
  if (!token) {
    return res.status(400).json({ message: 'Token is required' });
  }

  // Query to find the file associated with the token
  const query = 'SELECT file_name, file_id FROM download_links WHERE token = ?';
  db.query(query, [token], (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ message: 'Database error' });
    }

    // If the token is found
    if (results.length > 0) {
      const { file_name, file_id } = results[0];

      // Query to retrieve the actual file data
      const fileQuery = 'SELECT file_data FROM uploaded_files WHERE file_id = ?';
      db.query(fileQuery, [file_id], (err, fileResults) => {
        if (err) {
          console.error('Database error:', err);
          return res.status(500).json({ message: 'Database error' });
        }

        // If file data is found, initiate download
        if (fileResults.length > 0) {
          const fileData = fileResults[0].file_data;

          // Set the headers for file download
          res.setHeader('Content-Disposition', `attachment; filename="${file_name}"`);
          res.setHeader('Content-Type', 'application/octet-stream');
          res.send(fileData);
        } else {
          // If no file data found
          res.status(404).json({ message: 'File not found' });
        }
      });
    } else {
      // If token is not found or expired
      res.status(404).json({ message: 'Token expired or not found' });
    }
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
