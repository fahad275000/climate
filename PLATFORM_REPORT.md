# 🌍 AI Climate Risk Intelligence Platform — Full System Report

> **Platform Version:** v1.0 Production  
> **Report Generated:** June 9, 2026  
> **Execution Node:** GPU Acceleration (CUDA — NVIDIA H200 Tensor Core GPU)  
> **Driver Version:** 535.104.05  
> **Server URL:** http://localhost:5000  

---

## 🖥️ Hardware & Execution Environment

| Property | Value |
|---|---|
| **Execution Mode** | `GPU (CUDA)` |
| **GPU Device** | NVIDIA H200 Tensor Core GPU |
| **CUDA Available** | ✅ Yes |
| **Driver Version** | 535.104.05 |
| **H200 Active** | ✅ Yes |
| **CPU Fallback** | Not required |

> The platform automatically checks hardware at server startup via `check_hardware.py`.
> This status is dynamically shown on:
> - **Climate Risk Calculator** (`predict.html`) — "Execution Node" tag in the Decision Parameters card
> - **ML Analytics** (`analytics.html`) — Top-right execution node badge
> - **Admin Control Panel** (`admin.html`) — System diagnostics badge + console log
> - **Exported PDF Reports** — "Execution Node" metadata row in the report header

---

## 🤖 Machine Learning Pipeline

### Model Training Results

| Model | R² Score | RMSE | MAE | Status |
|---|---|---|---|---|
| Linear Regression | 0.5945 | 0.6388 | 0.5199 | Candidate |
| **Random Forest Regressor** | **0.8927** | **0.3285** | **0.2363** | ✅ **Best / Selected** |
| Gradient Boosting Regressor | 0.8614 | 0.3734 | 0.2928 | Candidate |

### Dataset Statistics

| Metric | Value |
|---|---|
| Raw Records | 533,312 |
| Duplicate Rows Removed | 16,264 |
| Cleaned Records | 517,048 |
| Training Sample Size | 100,000 |
| Outlier Handling | IQR Capping |
| Feature Scaling | StandardScaler |

### Feature Importance (Random Forest)

```
temp_max(c)         ████████████████████  ~28%
temp_mean(c)        ████████████████████  ~26%
temp_min(c)         ███████████████       ~21%
global_radiation    ████████              ~11%
Pressure            ████████              ~10%
Wind_Speed          ██                    ~4%
Wind_Bearing        █                     ~1%
```

### 5-Day Forecaster Model

| Metric | Value |
|---|---|
| Algorithm | Multi-Output Random Forest |
| Forecast Horizon | 5 days |
| Lag Features | 5 sequential lags per parameter |
| Average R² | 0.5596 |
| Output per Day | Pressure, Temp Mean/Min/Max, Radiation, Wind Speed, Risk Score |

---

## 🌐 API Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/login` | Public | JWT login |
| `POST` | `/api/auth/register` | Public | New user registration |
| `GET` | `/api/stats` | 🔐 JWT | System statistics |
| `GET` | `/api/dashboard` | 🔐 JWT | Dashboard metrics |
| `POST` | `/api/predict` | 🔐 JWT | Climate risk prediction |
| `GET` | `/api/predictions/history` | 🔐 JWT | Prediction history |
| `GET` | `/api/predictions/report/pdf` | 🔐 JWT | Export prediction as PDF |
| `GET` | `/api/model-metrics` | 🔐 JWT | ML model metrics |
| `GET` | `/api/feature-importance` | 🔐 JWT | Feature importance scores |
| `POST` | `/api/forecast` | 🔐 JWT | 5-day climate forecast |
| `GET` | `/api/hardware` | 🔐 JWT | GPU/CUDA diagnostics |
| `POST` | `/api/retrain` | 🔐 Admin | Trigger model retraining |
| `GET` | `/api/data` | 🔐 JWT | Paginated raw dataset |
| `GET` | `/api/audit-logs` | 🔐 Admin | Audit log access |

---

## 📄 PDF Report Contents

Each exported Climate Risk Assessment PDF includes:

1. **Header Banner** — Platform branding in teal
2. **Metadata Section:**
   - Report ID
   - Generated For (username)
   - Timestamp (UTC)
   - **Execution Node** — dynamically shows `GPU Acceleration (CUDA - NVIDIA H200 Tensor Core GPU)` or `CPU Execution (device name)` based on detected hardware
3. **Environmental Risk Summary** — Color-coded risk score gauge (0–100) and risk category
4. **Weather Parameters Table** — 7 inputs with global historical averages
5. **AI Explanation & Intelligence Report** — AI-generated natural-language risk explanation
6. **Disclaimer Footer**

---

## 🖥️ Frontend Pages

| Page | URL | Description |
|---|---|---|
| Landing | `/` | Public marketing page with feature overview |
| Login | `/login.html` | JWT authentication portal |
| Dashboard | `/dashboard.html` | Live metrics, KPIs, Chart.js visualizations |
| Climate Predictor | `/predict.html` | Risk calculator + 5-day forecast + GPU status badge |
| ML Analytics | `/analytics.html` | Model comparison, R² table, feature importance + GPU badge |
| Data Explorer | `/explorer.html` | Paginated, sortable, searchable dataset table |
| Admin Panel | `/admin.html` | User predictions, retraining, hardware diagnostics console |

---

## 🔐 Default Credentials

| Role | Username | Password |
|---|---|---|
| Administrator | `admin` | `admin123` |
| Standard User | `user` | `user123` |

> ⚠️ Change credentials before deploying to production.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | HTML5, CSS3 (custom design system), Vanilla JS, Chart.js |
| **Backend** | Node.js v16, Express.js |
| **Authentication** | JWT (jsonwebtoken), bcryptjs |
| **Database** | JSON flat-file (SQLite-ready fallback) |
| **PDF Generation** | PDFKit |
| **ML** | Python 3, Scikit-Learn, pandas, numpy, joblib |
| **Hardware Check** | nvidia-smi, PyTorch CUDA probe |
| **PWA** | manifest.json + Service Worker cache |

---

## 📁 Project Structure

```
AI_CLIMATE_PLATFORM/
├── backend/
│   ├── server.js               # Express API server (JWT, PDF, routes)
│   ├── database.js             # SQLite + JSON fallback database layer
│   ├── train_model.py          # ML training pipeline (3 models, best selection)
│   ├── predict.py              # Single prediction script (CLI args → JSON)
│   ├── train_forecast.py       # 5-day multi-output forecaster training
│   ├── forecast.py             # 5-day forecast inference script
│   ├── check_hardware.py       # GPU/CUDA hardware diagnostics
│   ├── best_model.pkl          # Trained Random Forest model (2.1 MB)
│   ├── forecaster_model.pkl    # Trained multi-output forecaster (2.6 MB)
│   ├── scaler.pkl              # StandardScaler weights
│   ├── model_metrics.json      # Training results, feature importance, insights
│   └── forecaster_metrics.json # Forecaster R² scores
├── frontend/
│   ├── index.html              # Public landing page
│   ├── login.html              # Authentication portal
│   ├── dashboard.html          # Operator dashboard
│   ├── predict.html            # Climate risk calculator + 5-day forecast
│   ├── analytics.html          # ML model analytics + GPU badge
│   ├── explorer.html           # Raw dataset explorer
│   ├── admin.html              # Admin control panel + hardware diagnostics
│   ├── app.js                  # Global JS (auth, sidebar, API, theme)
│   ├── style.css               # Complete design system (light + dark mode)
│   ├── manifest.json           # PWA manifest
│   └── sw.js                   # Service Worker (cache strategy)
├── dataset/
│   └── Combined12.csv          # Raw climate dataset (533k rows)
├── PLATFORM_REPORT.md          # This report
└── README.md                   # Project overview
```

---

## ✅ Verification Checklist

- [x] Server starts and auto-detects H200 GPU on startup
- [x] `/api/hardware` returns CUDA active + NVIDIA H200 device info
- [x] `predict.html` shows "Execution Node: GPU Active (NVIDIA H200 Tensor Core GPU)"
- [x] `analytics.html` shows GPU badge with teal background
- [x] `admin.html` console logs GPU detection and H200 activity
- [x] PDF Report includes dynamic "Execution Node" metadata row
- [x] PDF layout has no text overlaps (AI section at y=550+)
- [x] 5-Day forecast renders Chart.js trend lines (Risk, Temp, Wind)
- [x] All predictions stored and retrievable via history
- [x] Retraining endpoint works (Admin only)
- [x] Audit logs capture all key actions
- [x] PWA manifest + service worker registered
- [x] Light/Dark mode toggle functional on all pages
- [x] JWT auth protects all data endpoints

---

## 🚀 How to Run

```powershell
# 1. Install backend dependencies
cd backend
npm install

# 2. Train the ML models (first time only)
python train_model.py
python train_forecast.py

# 3. Start the server
node server.js

# 4. Open in browser
# http://localhost:5000
```

---

*Report auto-generated by the AI Climate Risk Intelligence Platform.*  
*All ML metrics are computed from live training runs on the Combined12.csv dataset.*
