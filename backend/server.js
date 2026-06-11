const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const PDFDocument = require('pdfkit');

const db = require('./database');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'climate-risk-platform-secret-key-13579';

app.use(cors());
app.use(express.json());

// Serve static frontend files from '../frontend' directory
app.use(express.static(path.join(__dirname, '../frontend')));

// Memory Cache for raw dataset to enable fast pagination/filtering
let rawDataset = [];
const csvFilePath = path.join(__dirname, '../dataset/Combined12.csv');

// Hardware Cache for GPU/CUDA Diagnostics
let hardwareInfo = {
  cuda_available: false,
  gpu_detected: false,
  device_name: "Generic CPU",
  driver_version: "N/A",
  execution_mode: "CPU",
  is_h200_active: false
};

// Check hardware on startup
const checkHardwareOnStartup = () => {
  const scriptPath = path.join(__dirname, 'check_hardware.py');
  exec(`python "${scriptPath}"`, (error, stdout, stderr) => {
    if (!error) {
      try {
        hardwareInfo = JSON.parse(stdout.trim());
        console.log("Hardware diagnostics loaded:", hardwareInfo);
      } catch (e) {
        console.error("Failed to parse hardware info on startup:", e);
      }
    } else {
      console.error("Failed to execute hardware diagnostics on startup:", error);
    }
  });
};
checkHardwareOnStartup();

function loadDatasetAsync() {
  console.log("Starting background load of climate dataset...");
  if (!fs.existsSync(csvFilePath)) {
    console.error(`Dataset not found at ${csvFilePath}. Explorer page will be unavailable.`);
    return;
  }
  
  // Read and parse CSV
  const data = fs.readFileSync(csvFilePath, 'utf8');
  const lines = data.split('\n');
  const headers = lines[0].trim().split(',');
  
  const parsed = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = line.split(',');
    if (values.length !== headers.length) continue;
    
    const row = {};
    headers.forEach((header, index) => {
      const val = parseFloat(values[index]);
      row[header] = isNaN(val) ? values[index] : val;
    });
    parsed.push(row);
  }
  rawDataset = parsed;
  console.log(`Loaded ${rawDataset.length} rows into cache.`);
}

// Start dataset caching in background
setTimeout(loadDatasetAsync, 1000);

// ==========================================
// Authentication Middleware
// ==========================================
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'] || req.query.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: "Access denied. Token missing." });
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid or expired token." });
    req.user = user;
    next();
  });
}

function requireAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ error: "Access forbidden. Admin privilege required." });
  }
}

// ==========================================
// Auth Routes
// ==========================================
app.post('/api/auth/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required." });
  }
  
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await db.createUser(username, hashedPassword, 'user');
    await db.logAudit(username, 'register', 'Successfully registered user account.');
    res.status(201).json({ message: "User registered successfully.", username: user.username });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required." });
  }
  
  try {
    const user = await db.findUserByUsername(username);
    if (!user) return res.status(400).json({ error: "Invalid username or password." });
    
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ error: "Invalid username or password." });
    
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    await db.logAudit(username, 'login', 'Successfully logged into the system.');
    res.json({ token, role: user.role, username: user.username });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// API Stats Endpoint
// ==========================================
app.get('/api/stats', authenticateToken, async (req, res) => {
  try {
    const metricsPath = path.join(__dirname, 'model_metrics.json');
    let mlInsights = { total_records: 0, averages: {} };
    if (fs.existsSync(metricsPath)) {
      const metrics = JSON.parse(fs.readFileSync(metricsPath, 'utf8'));
      mlInsights = metrics.insights || mlInsights;
    }
    
    const dbStats = await db.getDbStats();
    const status = await db.getSystemStatus();
    
    res.json({
      total_records: mlInsights.total_records || 533312,
      averages: mlInsights.averages || {
        pressure: 1011.4,
        radiation: 1.31,
        temp_mean: 15.2,
        temp_min: 10.1,
        temp_max: 20.3,
        wind_speed: 4.8,
        wind_bearing: 192.5
      },
      db_stats: dbStats,
      model_status: status.retraining_status,
      last_retrained: status.last_retrained
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// Dashboard Data Endpoint
// ==========================================
app.get('/api/dashboard', authenticateToken, async (req, res) => {
  try {
    const metricsPath = path.join(__dirname, 'model_metrics.json');
    let mlData = {};
    if (fs.existsSync(metricsPath)) {
      mlData = JSON.parse(fs.readFileSync(metricsPath, 'utf8'));
    }
    
    const dbStats = await db.getDbStats();
    
    // Send correlation, averages, and predictions summary
    res.json({
      averages: mlData.insights?.averages || {},
      correlation_matrix: mlData.correlation_matrix || {},
      predictions_count: dbStats.total_predictions,
      predictions_distribution: dbStats.distribution,
      best_model: mlData.best_model || 'Random Forest Regressor'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// Raw Dataset Data Endpoint
// ==========================================
app.get('/api/data', authenticateToken, (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const search = req.query.search || '';
  const sortBy = req.query.sortBy || '';
  const sortOrder = req.query.sortOrder || 'asc';
  
  let data = [...rawDataset];
  
  // Filtering
  if (search) {
    const s = search.toLowerCase();
    data = data.filter(row => {
      return Object.values(row).some(val => String(val).toLowerCase().includes(s));
    });
  }
  
  // Sorting
  if (sortBy) {
    data.sort((a, b) => {
      let valA = a[sortBy];
      let valB = b[sortBy];
      if (typeof valA === 'string') {
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      } else {
        return sortOrder === 'asc' ? valA - valB : valB - valA;
      }
    });
  }
  
  // Pagination
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  const paginatedData = data.slice(startIndex, endIndex);
  
  res.json({
    total: data.length,
    page,
    limit,
    totalPages: Math.ceil(data.length / limit),
    data: paginatedData
  });
});

// ==========================================
// Prediction Endpoint
// ==========================================
app.post('/api/predict', authenticateToken, async (req, res) => {
  const { pressure, global_radiation, temp_mean, temp_min, temp_max, wind_speed, wind_bearing } = req.body;
  
  if (
    pressure === undefined || global_radiation === undefined ||
    temp_mean === undefined || temp_min === undefined || temp_max === undefined ||
    wind_speed === undefined || wind_bearing === undefined
  ) {
    return res.status(400).json({ error: "Missing required environmental features." });
  }
  
  const scriptPath = path.join(__dirname, 'predict.py');
  const cmd = `python "${scriptPath}" ${pressure} ${global_radiation} ${temp_mean} ${temp_min} ${temp_max} ${wind_speed} ${wind_bearing}`;
  
  exec(cmd, async (error, stdout, stderr) => {
    if (error) {
      console.error("Exec error:", error, stderr);
      return res.status(500).json({ error: "Failed to run prediction. Model might not be trained." });
    }
    
    try {
      const predResult = JSON.parse(stdout.trim());
      if (predResult.error) {
        return res.status(400).json({ error: predResult.error });
      }
      
      const saved = await db.savePrediction({
        username: req.user.username,
        pressure: parseFloat(pressure),
        global_radiation: parseFloat(global_radiation),
        temp_mean: parseFloat(temp_mean),
        temp_min: parseFloat(temp_min),
        temp_max: parseFloat(temp_max),
        wind_speed: parseFloat(wind_speed),
        wind_bearing: parseFloat(wind_bearing),
        risk_score: predResult.risk_score,
        risk_category: predResult.risk_category,
        explanation: predResult.explanation,
        confidence: predResult.confidence
      });
      
      await db.logAudit(req.user.username, 'predict', `Created climate prediction. Score: ${predResult.risk_score}`);
      res.json({ ...saved, predicted_label: predResult.predicted_label });
    } catch (e) {
      console.error("Parse prediction response error:", e, stdout);
      res.status(500).json({ error: "Invalid output from prediction model." });
    }
  });
});

app.get('/api/predictions/history', authenticateToken, async (req, res) => {
  try {
    const history = await db.getPredictions(req.user.username, 50);
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// ML Metrics Endpoints
// ==========================================
app.get('/api/model-metrics', authenticateToken, (req, res) => {
  const metricsPath = path.join(__dirname, 'model_metrics.json');
  if (!fs.existsSync(metricsPath)) {
    return res.status(404).json({ error: "Metrics not found. Please train model." });
  }
  
  try {
    const data = JSON.parse(fs.readFileSync(metricsPath, 'utf8'));
    res.json(data.models);
  } catch (e) {
    res.status(500).json({ error: "Error reading model metrics." });
  }
});

app.get('/api/feature-importance', authenticateToken, (req, res) => {
  const metricsPath = path.join(__dirname, 'model_metrics.json');
  if (!fs.existsSync(metricsPath)) {
    return res.status(404).json({ error: "Metrics not found. Please train model." });
  }
  
  try {
    const data = JSON.parse(fs.readFileSync(metricsPath, 'utf8'));
    res.json({
      feature_importance: data.feature_importance,
      correlation_matrix: data.correlation_matrix
    });
  } catch (e) {
    res.status(500).json({ error: "Error reading feature importance." });
  }
});

// ==========================================
// Model Retraining Endpoint
// ==========================================
app.post('/api/retrain', authenticateToken, requireAdmin, async (req, res) => {
  const status = await db.getSystemStatus();
  if (status.retraining_status === 'training') {
    return res.status(400).json({ error: "Retraining is already in progress." });
  }
  
  await db.updateRetrainStatus('training');
  await db.logAudit(req.user.username, 'retrain_start', 'Admin triggered model retraining pipeline.');
  
  const scriptPath = path.join(__dirname, 'train_model.py');
  
  // Trigger retraining in background
  exec(`python "${scriptPath}"`, async (error, stdout, stderr) => {
    if (error) {
      console.error("Retrain error:", error, stderr);
      await db.updateRetrainStatus('failed', stderr || error.message);
      await db.logAudit('SYSTEM', 'retrain_fail', `Model training failed. Error: ${error.message}`);
    } else {
      console.log("Retrain complete:\n", stdout);
      await db.updateRetrainStatus('success');
      await db.logAudit('SYSTEM', 'retrain_success', 'Successfully finished retraining pipeline and generated metrics.');
    }
  });
  
  res.json({ message: "Retraining initiated in background." });
});

app.get('/api/retrain/status', authenticateToken, async (req, res) => {
  try {
    const status = await db.getSystemStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// Audit Logs Endpoint
// ==========================================
app.get('/api/audit-logs', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const logs = await db.getAuditLogs(100);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// Helper to run 5-day forecast for PDF generator
// ==========================================
function runForecastHelper(pred) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, 'forecast.py');
    const cmd = `python "${scriptPath}" ${pred.pressure} ${pred.global_radiation} ${pred.temp_mean} ${pred.temp_min} ${pred.temp_max} ${pred.wind_speed} ${pred.wind_bearing}`;
    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        try {
          resolve(JSON.parse(stdout.trim()));
        } catch (e) {
          reject(e);
        }
      }
    });
  });
}

// ==========================================
// PDF Report Generator Endpoint
// ==========================================
app.get('/api/predictions/report/pdf', authenticateToken, async (req, res) => {
  const id = req.query.id;
  if (!id) return res.status(400).json({ error: "Prediction ID is required." });
  
  try {
    const history = await db.getPredictions(null, 500);
    const pred = history.find(p => p.id === parseInt(id));
    if (!pred) return res.status(404).json({ error: "Prediction record not found." });
    
    // Check ownership
    if (req.user.role !== 'admin' && pred.username !== req.user.username) {
      return res.status(403).json({ error: "Access forbidden. Report belongs to another user." });
    }

    // Run 5-Day Forecast dynamically
    let forecast = [];
    try {
      forecast = await runForecastHelper(pred);
    } catch (errForecast) {
      console.error("Failed to run forecast parameters for PDF:", errForecast);
    }
    
    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=ClimateRiskReport_${pred.id}.pdf`);
    
    doc.pipe(res);
    
    // Document Design Palette (Teal & Blue)
    const primaryColor = '#0F766E'; // Teal
    const secondaryColor = '#1D4ED8'; // Blue
    const textColor = '#1F2937'; // Slate Gray
    const lightBg = '#F3F4F6';
    
    // Header Banner
    doc.fillColor(primaryColor).rect(0, 0, 612, 100).fill();
    doc.fillColor('#FFFFFF').fontSize(24).font('Helvetica-Bold').text('CLIMATE RISK ASSESSMENT REPORT', 50, 40);
    doc.fontSize(10).font('Helvetica').text('AI Climate Risk Intelligence Platform', 50, 70);
    
    // Add margin space
    doc.moveDown(4);
    
    // Meta Data
    doc.fillColor(textColor).fontSize(10).font('Helvetica-Bold').text(`Report ID: `, 50, 130).font('Helvetica').text(`${pred.id}`, 120, 130);
    doc.font('Helvetica-Bold').text(`Generated For: `, 50, 145).font('Helvetica').text(`${pred.username}`, 130, 145);
    doc.font('Helvetica-Bold').text(`Timestamp: `, 50, 160).font('Helvetica').text(`${new Date(pred.timestamp).toUTCString()}`, 120, 160);
    
    const execNodeText = hardwareInfo.gpu_detected 
      ? `GPU Acceleration (CUDA - ${hardwareInfo.device_name})` 
      : `CPU Execution (${hardwareInfo.device_name})`;
    doc.font('Helvetica-Bold').text(`Execution Node: `, 50, 175).font('Helvetica').text(execNodeText, 145, 175);
    
    // Divider
    doc.moveTo(50, 195).lineTo(562, 195).strokeColor('#E5E7EB').stroke();
    
    // Risk Score Section
    doc.moveDown(3);
    doc.fillColor(primaryColor).fontSize(16).font('Helvetica-Bold').text('Environmental Risk Summary', 50, 215);
    
    // Glassmorphism Card Style
    doc.fillColor(lightBg).rect(50, 235, 512, 80).fill();
    
    // Risk Score Metric
    doc.fillColor(textColor).fontSize(12).font('Helvetica-Bold').text('Calculated Risk Score:', 70, 255);
    
    let scoreColor = '#10B981'; // Green (Low)
    if (pred.risk_category === 'Moderate Risk') scoreColor = '#F59E0B'; // Orange
    if (pred.risk_category === 'High Risk') scoreColor = '#EF4444'; // Red
    
    doc.fillColor(scoreColor).fontSize(28).font('Helvetica-Bold').text(`${pred.risk_score} / 100`, 70, 270);
    doc.fontSize(14).font('Helvetica-Bold').text(`Category: ${pred.risk_category}`, 280, 255);
    doc.fillColor(textColor).fontSize(10).font('Helvetica').text(`Prediction Confidence: ${pred.confidence}%`, 280, 285);
    
    // Environmental Inputs
    doc.moveDown(5);
    doc.fillColor(secondaryColor).fontSize(14).font('Helvetica-Bold').text('Weather Parameters Inputs', 50, 345);
    
    // Table Headers
    const startY = 370;
    doc.fillColor(lightBg).rect(50, startY, 512, 20).fill();
    doc.fillColor(textColor).fontSize(9).font('Helvetica-Bold');
    doc.text('Parameter', 60, startY + 5);
    doc.text('Input Value', 250, startY + 5);
    doc.text('Global Historical Avg', 400, startY + 5);
    
    // Row Helper
    const drawRow = (index, name, val, unit, avg) => {
      const rowY = startY + 20 + (index * 20);
      if (index % 2 === 1) {
        doc.fillColor('#F9FAFB').rect(50, rowY, 512, 20).fill();
      }
      doc.fillColor(textColor).fontSize(9).font('Helvetica');
      doc.text(name, 60, rowY + 5);
      doc.text(`${val} ${unit}`, 250, rowY + 5);
      doc.text(`${avg} ${unit}`, 400, rowY + 5);
      doc.moveTo(50, rowY + 20).lineTo(562, rowY + 20).strokeColor('#F3F4F6').stroke();
    };
    
    drawRow(0, 'Atmospheric Pressure', pred.pressure, 'hPa', '1011.4');
    drawRow(1, 'Global Radiation', pred.global_radiation, 'kW/m²', '1.31');
    drawRow(2, 'Mean Temperature', pred.temp_mean, '°C', '15.2');
    drawRow(3, 'Minimum Temperature', pred.temp_min, '°C', '10.1');
    drawRow(4, 'Maximum Temperature', pred.temp_max, '°C', '20.3');
    drawRow(5, 'Wind Speed', pred.wind_speed, 'm/s', '4.8');
    drawRow(6, 'Wind Bearing', pred.wind_bearing, '°', '192.5');
    
    // AI Explanation Section
    doc.moveDown(3);
    doc.fillColor(primaryColor).fontSize(14).font('Helvetica-Bold').text('AI Explanation & Intelligence Report', 50, 530);
    doc.fillColor('#F0FDFA').rect(50, 550, 512, 70).fill();
    doc.strokeColor('#CCFBF1').rect(50, 550, 512, 70).stroke();
    
    doc.fillColor(primaryColor).fontSize(10).font('Helvetica-Bold').text('AI Generated Explanation:', 65, 565);
    doc.fillColor(textColor).fontSize(10).font('Helvetica-Oblique').text(`"${pred.explanation}"`, 65, 585, { width: 480 });
    
    // Page 1 Footer
    doc.fillColor('#9CA3AF').fontSize(8).font('Helvetica').text('Disclaimer: This report is generated automatically by the AI Climate Risk Intelligence model using meteorological inputs. Predictions are mathematical estimations based on past models and should be used with professional diligence.', 50, 680, { align: 'center', width: 512 });
    
    // Add Page 2 for 5-Day Forecast if available
    if (forecast && forecast.length > 0) {
      doc.addPage();
      
      // Page 2 Header Banner
      doc.fillColor(primaryColor).rect(0, 0, 612, 100).fill();
      doc.fillColor('#FFFFFF').fontSize(16).font('Helvetica-Bold').text('FUTURE PROJECTION VECTORS (5-DAY FORECAST)', 50, 42);
      doc.fontSize(9).font('Helvetica').text('Autoregressive weather elements & index metrics over a 5-step horizon.', 50, 68);
      
      doc.moveDown(4);
      
      // Table Header for Forecast
      const forecastStartY = 130;
      doc.fillColor(lightBg).rect(50, forecastStartY, 512, 24).fill();
      doc.fillColor(textColor).fontSize(9).font('Helvetica-Bold');
      doc.text('Day', 60, forecastStartY + 7);
      doc.text('Temp Profile (Min - Max)', 105, forecastStartY + 7);
      doc.text('Pressure', 245, forecastStartY + 7);
      doc.text('Wind Speed', 320, forecastStartY + 7);
      doc.text('Solar Intensity', 395, forecastStartY + 7);
      doc.text('Risk Score', 485, forecastStartY + 7);
      
      forecast.forEach((dayData, index) => {
        const rowY = forecastStartY + 24 + (index * 32);
        
        // Alternating row background
        if (index % 2 === 1) {
          doc.fillColor('#F9FAFB').rect(50, rowY, 512, 32).fill();
        }
        
        doc.fillColor(textColor).fontSize(9).font('Helvetica');
        
        // Day Label
        doc.font('Helvetica-Bold').text(`Day ${dayData.day}`, 60, rowY + 11);
        
        // Temperature range & mean
        doc.font('Helvetica').text(`${dayData.temp_mean.toFixed(1)}°C (${dayData.temp_min.toFixed(1)} - ${dayData.temp_max.toFixed(1)})`, 105, rowY + 11);
        
        // Pressure
        doc.text(`${dayData.pressure.toFixed(0)} hPa`, 245, rowY + 11);
        
        // Wind Speed
        doc.text(`${dayData.wind_speed.toFixed(1)} m/s`, 320, rowY + 11);
        
        // Solar Intensity
        doc.text(`${dayData.global_radiation.toFixed(2)} kW/m²`, 395, rowY + 11);
        
        // Risk
        let riskColor = '#10B981'; // green
        if (dayData.risk_category === 'Moderate Risk') riskColor = '#F59E0B'; // orange
        if (dayData.risk_category === 'High Risk') riskColor = '#EF4444'; // red
        
        doc.fillColor(riskColor).font('Helvetica-Bold').text(`${dayData.risk_score.toFixed(1)}%`, 485, rowY + 6);
        doc.fillColor('#9CA3AF').fontSize(7).font('Helvetica').text(dayData.risk_category.replace(' Risk', ''), 485, rowY + 18);
        
        // Horizontal line
        doc.moveTo(50, rowY + 32).lineTo(562, rowY + 32).strokeColor('#F3F4F6').stroke();
      });
      
      // Add a visual forecast notes card
      doc.moveDown(3);
      doc.fillColor('#F0FDF4').rect(50, 340, 512, 90).fill();
      doc.strokeColor('#BBF7D0').rect(50, 340, 512, 90).stroke();
      
      doc.fillColor(primaryColor).fontSize(10).font('Helvetica-Bold').text('Forecasting Summary & Trends:', 65, 355);
      
      const avgTemp = forecast.reduce((acc, d) => acc + d.temp_mean, 0) / forecast.length;
      const maxRisk = Math.max(...forecast.map(d => d.risk_score));
      const summaryText = `Over the next 5 days, the average forecasted mean temperature is ${avgTemp.toFixed(1)}°C, with a maximum climate hazard risk score of ${maxRisk.toFixed(1)}% projected during this period. These projections are calculated using the trained multi-layer decision forecaster model.`;
      
      doc.fillColor(textColor).fontSize(9).font('Helvetica').text(summaryText, 65, 375, { width: 480, lineGap: 3 });
      
      // Page 2 Footer
      doc.fillColor('#9CA3AF').fontSize(8).font('Helvetica').text('Disclaimer: This report is generated automatically by the AI Climate Risk Intelligence model using meteorological inputs. Predictions are mathematical estimations based on past models and should be used with professional diligence.', 50, 680, { align: 'center', width: 512 });
    }
    
    doc.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// GPU & Hardware Diagnostics Endpoint
// ==========================================
app.get('/api/hardware', authenticateToken, (req, res) => {
  const scriptPath = path.join(__dirname, 'check_hardware.py');
  exec(`python "${scriptPath}"`, (error, stdout, stderr) => {
    if (error) {
      console.error("Hardware check error:", error);
      return res.json({
        cuda_available: false,
        gpu_detected: false,
        device_name: "Generic CPU",
        driver_version: "N/A",
        execution_mode: "CPU",
        is_h200_active: false
      });
    }
    try {
      const result = JSON.parse(stdout.trim());
      hardwareInfo = result;
      res.json(result);
    } catch (e) {
      res.json({
        cuda_available: false,
        gpu_detected: false,
        device_name: "Generic CPU",
        driver_version: "N/A",
        execution_mode: "CPU",
        is_h200_active: false
      });
    }
  });
});

// ==========================================
// 5-Day Weather & Risk Forecast Endpoint
// ==========================================
app.post('/api/forecast', authenticateToken, (req, res) => {
  const { pressure, global_radiation, temp_mean, temp_min, temp_max, wind_speed, wind_bearing } = req.body;
  
  if (
    pressure === undefined || global_radiation === undefined ||
    temp_mean === undefined || temp_min === undefined || temp_max === undefined ||
    wind_speed === undefined || wind_bearing === undefined
  ) {
    return res.status(400).json({ error: "Missing required environmental features for forecast." });
  }
  
  const scriptPath = path.join(__dirname, 'forecast.py');
  const cmd = `python "${scriptPath}" ${pressure} ${global_radiation} ${temp_mean} ${temp_min} ${temp_max} ${wind_speed} ${wind_bearing}`;
  
  exec(cmd, (error, stdout, stderr) => {
    if (error) {
      console.error("Forecast exec error:", error, stderr);
      return res.status(500).json({ error: "Failed to run forecast parameters." });
    }
    
    try {
      const forecastResult = JSON.parse(stdout.trim());
      res.json(forecastResult);
    } catch (e) {
      console.error("Parse forecast response error:", e, stdout);
      res.status(500).json({ error: "Invalid output from forecasting model." });
    }
  });
});

// All other routes redirect to frontend index.html for static hosting
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
