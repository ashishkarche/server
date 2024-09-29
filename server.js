const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const fs = require('fs');
const bodyParser = require('body-parser');

const app = express();
const PORT = 5000;

app.use(cors());
app.use(bodyParser.json());

const db = mysql.createConnection({
  host: 'gateway01.ap-southeast-1.prod.aws.tidbcloud.com',
  user: '3wpVC1PBcNR2QzZ.root',
  password: 'JEXKYgpaNzuc47xI',
  database: 'test',
  ssl: {
    ca: fs.readFileSync('./isrgrootx1.pem'),
  },
});

db.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL:', err);
    return;
  }
  console.log('Connected to MySQL');
});

app.post('/check-token', (req, res) => {
  const { token } = req.body;

  const query = 'SELECT * FROM download_links WHERE token = ?';
  db.query(query, [token], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'Database error' });
    }

    if (results.length > 0) {
      res.json({ success: true, message: 'Token exists!' });
    } else {
      res.json({ success: false, message: 'Token not found' });
    }
  });
});

app.get('/download', (req, res) => {
  const { token } = req.query;

  const query = 'SELECT file_name, file_id FROM download_links WHERE token = ?';
  db.query(query, [token], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: 'Database error' });
    }

    if (results.length > 0) {
      const { file_name, file_id } = results[0];

      const fileQuery = 'SELECT file_data FROM uploaded_files WHERE file_id = ?';
      db.query(fileQuery, [file_id], (err, fileResults) => {
        if (err) {
          console.error(err);
          return res.status(500).json({ message: 'Database error' });
        }

        if (fileResults.length > 0) {
          const fileData = fileResults[0].file_data;

          res.setHeader('Content-Disposition', `attachment; filename=${file_name}`);
          res.setHeader('Content-Type', 'application/octet-stream');
          res.send(fileData);
        } else {
          res.status(404).json({ message: 'File not found' });
        }
      });
    } else {
      res.status(404).json({ message: 'Token expired or not found' });
    }
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
