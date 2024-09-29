const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const fs = require('fs');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 5000; // Use dynamic port for deployment

// Enable CORS for all origins (can restrict to your frontend URL if needed)
app.use(cors({
  origin: 'https://ashishkarche.github.io', // Allow only your frontend URL
  methods: ['GET', 'POST', 'OPTIONS'], // Ensure OPTIONS is allowed for preflight requests
  allowedHeaders: ['Content-Type', 'Authorization'], // Allow Content-Type and Authorization headers
  credentials: true // Allow credentials if you are using cookies or authorization headers
}));


// Handle preflight OPTIONS request for CORS
app.options('*', cors());

// Establish connection to the MySQL database with SSL
const db = mysql.createConnection({
  host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
  user: '3wpVC1PBcNR2QzZ.root',
  password: 'JEXKYgpaNzuc47xI',
  database: 'test',
  ssl: {
    ca: fs.readFileSync('./isrgrootx1.pem'), // Make sure the path to the SSL CA file is correct
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

// POST route to check if the token is valid
app.post('/check-token', (req, res) => {
  const { token } = req.body;

  // Validate that token is provided
  if (!token) {
    return res.status(400).json({ success: false, message: 'Token is required' });
  }

  // Query to check if token exists in the database
  const query = 'SELECT * FROM download_links WHERE token = ?';
  db.query(query, [token], (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ success: false, message: 'Database error' });
    }

    // If token is found, return success
    if (results.length > 0) {
      res.json({ success: true, message: 'Token exists!' });
    } else {
      res.json({ success: false, message: 'Token not found' });
    }
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
