const fs = require('fs');
const path = require('path');

let dbType = 'json';
let sqliteDb = null;
const jsonFilePath = path.join(__dirname, 'database.json');

// Helper to get fresh JSON database structure
function getInitialDb() {
  return {
    users: [
      // Seed default admin and user
      // password hashes are generated using bcryptjs (password: 'admin123' and 'user123')
      {
        id: 1,
        username: 'admin',
        password: '$2a$10$Iu6nbpqkIsl7Z/TmtQPqfOFRihAqb7rOZCePlC83wn.tJazJCTSya', // admin123
        role: 'admin'
      },
      {
        id: 2,
        username: 'user',
        password: '$2a$10$pc/wFUqey0l0B8B4ipe5qOuuIewGXSoK7SErvzZI71snZo8CHQn7m', // user123
        role: 'user'
      }
    ],
    predictions: [],
    audit_logs: [],
    system_status: {
      last_retrained: null,
      retraining_status: 'idle',
      retraining_error: null
    }
  };
}

// Initialize JSON database file if it doesn't exist
if (!fs.existsSync(jsonFilePath)) {
  fs.writeFileSync(jsonFilePath, JSON.stringify(getInitialDb(), null, 2));
}

// Try to load sqlite3 dynamically
try {
  const sqlite3 = require('sqlite3').verbose();
  const dbPath = path.join(__dirname, 'climate_platform.db');
  
  sqliteDb = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.warn("Could not connect to SQLite database. Falling back to JSON database.", err.message);
      dbType = 'json';
    } else {
      console.log("Connected to SQLite database successfully.");
      dbType = 'sqlite';
      createSqliteTables();
    }
  });
} catch (e) {
  console.log("sqlite3 library not available. Falling back to JSON database.");
  dbType = 'json';
}

function createSqliteTables() {
  sqliteDb.serialize(() => {
    // Users Table
    sqliteDb.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT,
      role TEXT
    )`);

    // Add default users if table is empty
    sqliteDb.get("SELECT count(*) as count FROM users", (err, row) => {
      if (!err && row.count === 0) {
        sqliteDb.run("INSERT INTO users (username, password, role) VALUES (?, ?, ?)", 
          ['admin', '$2a$10$Iu6nbpqkIsl7Z/TmtQPqfOFRihAqb7rOZCePlC83wn.tJazJCTSya', 'admin']);
        sqliteDb.run("INSERT INTO users (username, password, role) VALUES (?, ?, ?)", 
          ['user', '$2a$10$pc/wFUqey0l0B8B4ipe5qOuuIewGXSoK7SErvzZI71snZo8CHQn7m', 'user']);
      }
    });

    // Predictions Table
    sqliteDb.run(`CREATE TABLE IF NOT EXISTS predictions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT,
      timestamp TEXT,
      pressure REAL,
      global_radiation REAL,
      temp_mean REAL,
      temp_min REAL,
      temp_max REAL,
      wind_speed REAL,
      wind_bearing REAL,
      risk_score REAL,
      risk_category TEXT,
      explanation TEXT,
      confidence REAL
    )`);

    // Audit Logs Table
    sqliteDb.run(`CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT,
      action TEXT,
      details TEXT,
      timestamp TEXT
    )`);

    // System Status Table
    sqliteDb.run(`CREATE TABLE IF NOT EXISTS system_status (
      key TEXT PRIMARY KEY,
      value TEXT
    )`);
    
    // Set default system status
    sqliteDb.run("INSERT OR IGNORE INTO system_status (key, value) VALUES (?, ?)", ['retraining_status', 'idle']);
    sqliteDb.run("INSERT OR IGNORE INTO system_status (key, value) VALUES (?, ?)", ['last_retrained', '']);
    sqliteDb.run("INSERT OR IGNORE INTO system_status (key, value) VALUES (?, ?)", ['retraining_error', '']);
  });
}

// ==========================================
// JSON DB Helpers
// ==========================================
function readJsonDb() {
  try {
    const data = fs.readFileSync(jsonFilePath, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    return getInitialDb();
  }
}

function writeJsonDb(data) {
  try {
    fs.writeFileSync(jsonFilePath, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("Failed to write to JSON database:", e);
  }
}

// ==========================================
// User Operations
// ==========================================
function createUser(username, hashedPassword, role = 'user') {
  return new Promise((resolve, reject) => {
    if (dbType === 'sqlite') {
      sqliteDb.run("INSERT INTO users (username, password, role) VALUES (?, ?, ?)", 
        [username, hashedPassword, role], 
        function(err) {
          if (err) {
            if (err.message.includes('UNIQUE')) {
              reject(new Error("Username already exists"));
            } else {
              reject(err);
            }
          } else {
            resolve({ id: this.lastID, username, role });
          }
        }
      );
    } else {
      const db = readJsonDb();
      if (db.users.find(u => u.username === username)) {
        return reject(new Error("Username already exists"));
      }
      const newUser = {
        id: db.users.length + 1,
        username,
        password: hashedPassword,
        role
      };
      db.users.push(newUser);
      writeJsonDb(db);
      resolve({ id: newUser.id, username, role });
    }
  });
}

function findUserByUsername(username) {
  return new Promise((resolve, reject) => {
    if (dbType === 'sqlite') {
      sqliteDb.get("SELECT * FROM users WHERE username = ?", [username], (err, row) => {
        if (err) reject(err);
        else resolve(row || null);
      });
    } else {
      const db = readJsonDb();
      const user = db.users.find(u => u.username === username);
      resolve(user || null);
    }
  });
}

// ==========================================
// Prediction Operations
// ==========================================
function savePrediction(prediction) {
  const timestamp = new Date().toISOString();
  return new Promise((resolve, reject) => {
    if (dbType === 'sqlite') {
      sqliteDb.run(`INSERT INTO predictions (
        username, timestamp, pressure, global_radiation, temp_mean, temp_min, temp_max, wind_speed, wind_bearing, risk_score, risk_category, explanation, confidence
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        prediction.username,
        timestamp,
        prediction.pressure,
        prediction.global_radiation,
        prediction.temp_mean,
        prediction.temp_min,
        prediction.temp_max,
        prediction.wind_speed,
        prediction.wind_bearing,
        prediction.risk_score,
        prediction.risk_category,
        prediction.explanation,
        prediction.confidence
      ],
      function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID, timestamp, ...prediction });
      });
    } else {
      const db = readJsonDb();
      const newPred = {
        id: db.predictions.length + 1,
        timestamp,
        ...prediction
      };
      db.predictions.push(newPred);
      writeJsonDb(db);
      resolve(newPred);
    }
  });
}

function getPredictions(username = null, limit = 100) {
  return new Promise((resolve, reject) => {
    if (dbType === 'sqlite') {
      let query = "SELECT * FROM predictions";
      const params = [];
      if (username) {
        query += " WHERE username = ?";
        params.push(username);
      }
      query += " ORDER BY id DESC LIMIT ?";
      params.push(limit);

      sqliteDb.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    } else {
      const db = readJsonDb();
      let preds = [...db.predictions];
      if (username) {
        preds = preds.filter(p => p.username === username);
      }
      preds.sort((a, b) => b.id - a.id);
      resolve(preds.slice(0, limit));
    }
  });
}

// ==========================================
// Audit Log Operations
// ==========================================
function logAudit(username, action, details) {
  const timestamp = new Date().toISOString();
  return new Promise((resolve, reject) => {
    if (dbType === 'sqlite') {
      sqliteDb.run("INSERT INTO audit_logs (username, action, details, timestamp) VALUES (?, ?, ?, ?)",
        [username, action, details, timestamp],
        function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID, username, action, details, timestamp });
        }
      );
    } else {
      const db = readJsonDb();
      const log = {
        id: db.audit_logs.length + 1,
        username,
        action,
        details,
        timestamp
      };
      db.audit_logs.push(log);
      writeJsonDb(db);
      resolve(log);
    }
  });
}

function getAuditLogs(limit = 100) {
  return new Promise((resolve, reject) => {
    if (dbType === 'sqlite') {
      sqliteDb.all("SELECT * FROM audit_logs ORDER BY id DESC LIMIT ?", [limit], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    } else {
      const db = readJsonDb();
      const logs = [...db.audit_logs].sort((a, b) => b.id - a.id);
      resolve(logs.slice(0, limit));
    }
  });
}

// ==========================================
// Retraining & System Status
// ==========================================
function updateRetrainStatus(status, error = '') {
  const timestamp = new Date().toISOString();
  return new Promise((resolve, reject) => {
    if (dbType === 'sqlite') {
      sqliteDb.serialize(() => {
        sqliteDb.run("INSERT OR REPLACE INTO system_status (key, value) VALUES (?, ?)", ['retraining_status', status]);
        if (status === 'success') {
          sqliteDb.run("INSERT OR REPLACE INTO system_status (key, value) VALUES (?, ?)", ['last_retrained', timestamp]);
        }
        sqliteDb.run("INSERT OR REPLACE INTO system_status (key, value) VALUES (?, ?)", ['retraining_error', error || ''], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    } else {
      const db = readJsonDb();
      db.system_status.retraining_status = status;
      if (status === 'success') {
        db.system_status.last_retrained = timestamp;
      }
      db.system_status.retraining_error = error || null;
      writeJsonDb(db);
      resolve();
    }
  });
}

function getSystemStatus() {
  return new Promise((resolve, reject) => {
    if (dbType === 'sqlite') {
      sqliteDb.all("SELECT * FROM system_status", [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          const status = { retraining_status: 'idle', last_retrained: null, retraining_error: null };
          rows.forEach(r => {
            if (r.key === 'retraining_status') status.retraining_status = r.value;
            if (r.key === 'last_retrained') status.last_retrained = r.value || null;
            if (r.key === 'retraining_error') status.retraining_error = r.value || null;
          });
          resolve(status);
        }
      });
    } else {
      const db = readJsonDb();
      resolve(db.system_status);
    }
  });
}

// ==========================================
// Dashboard Statistics Helpers
// ==========================================
function getDbStats() {
  return new Promise((resolve, reject) => {
    if (dbType === 'sqlite') {
      const stats = {};
      sqliteDb.get("SELECT COUNT(*) as count FROM predictions", (err, row) => {
        if (err) return reject(err);
        stats.total_predictions = row.count;
        
        sqliteDb.get("SELECT AVG(risk_score) as avg_risk, COUNT(CASE WHEN risk_category='Low Risk' THEN 1 END) as low, COUNT(CASE WHEN risk_category='Moderate Risk' THEN 1 END) as moderate, COUNT(CASE WHEN risk_category='High Risk' THEN 1 END) as high FROM predictions", (err, row2) => {
          if (err) return reject(err);
          stats.avg_risk = row2.avg_risk || 0;
          stats.distribution = {
            low: row2.low || 0,
            moderate: row2.moderate || 0,
            high: row2.high || 0
          };
          resolve(stats);
        });
      });
    } else {
      const db = readJsonDb();
      const preds = db.predictions;
      const total = preds.length;
      let sumRisk = 0;
      let low = 0, moderate = 0, high = 0;
      
      preds.forEach(p => {
        sumRisk += p.risk_score;
        if (p.risk_category === 'Low Risk') low++;
        else if (p.risk_category === 'Moderate Risk') moderate++;
        else if (p.risk_category === 'High Risk') high++;
      });
      
      resolve({
        total_predictions: total,
        avg_risk: total > 0 ? sumRisk / total : 0,
        distribution: { low, moderate, high }
      });
    }
  });
}

module.exports = {
  createUser,
  findUserByUsername,
  savePrediction,
  getPredictions,
  logAudit,
  getAuditLogs,
  updateRetrainStatus,
  getSystemStatus,
  getDbStats,
  dbType
};
