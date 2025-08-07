const express = require('express');
const os = require('os-utils');
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3000;
const logPath = path.join(__dirname, 'logs', 'access.log');

// Ensure log dir exists
fs.mkdirSync(path.dirname(logPath), { recursive: true });

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'sysinfo',
};

// Retry DB connection helper
async function connectWithRetry(config, retries = 5, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      const conn = await mysql.createConnection(config);
      return conn;
    } catch (err) {
      console.error(`DB connection failed (attempt ${i + 1}):`, err.message);
      if (i < retries - 1) {
        await new Promise(res => setTimeout(res, delay));
      }
    }
  }
  throw new Error('Failed to connect to DB after retries.');
}

app.get('/', async (req, res) => {
  let conn;
  try {
    conn = await connectWithRetry(dbConfig);

    const cpu = await new Promise(resolve => os.cpuUsage(resolve));
    const memory = ((os.totalmem() - os.freemem()) / os.totalmem()) * 100;
    const uptime = os.sysUptime() / 60;

    await conn.execute(
      `INSERT INTO usage_stats (cpu, memory, uptime) VALUES (?, ?, ?)`,
      [(cpu * 100).toFixed(2), memory.toFixed(2), uptime.toFixed(2)]
    );

    const [rows] = await conn.execute(
      `SELECT * FROM usage_stats ORDER BY timestamp DESC`
    );

    // Log each access
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] Access recorded\n`);

    let html = `
      <html>
        <head><title>System Usage</title></head>
        <body>
          <h1>System Usage</h1>
          <ul>
            <li>CPU: ${(cpu * 100).toFixed(2)}%</li>
            <li>Memory: ${memory.toFixed(2)}%</li>
            <li>Uptime: ${uptime.toFixed(2)} min</li>
          </ul>
          <h2>History</h2>
          <table border="1">
            <tr><th>Time</th><th>CPU</th><th>Memory</th><th>Uptime</th></tr>
            ${rows.map(r => `
              <tr>
                <td>${r.timestamp}</td>
                <td>${r.cpu}</td>
                <td>${r.memory}</td>
                <td>${r.uptime}</td>
              </tr>`).join('')}
          </table>
        </body>
      </html>
    `;

    res.send(html);
  } catch (err) {
    console.error('Error in / handler:', err);
    res.status(500).send('Internal Server Error');
  } finally {
    if (conn) await conn.end();
  }
});

app.listen(port, () => {
  console.log(`System Monitor listening on port ${port}`);
});
