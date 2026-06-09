# AI Climate Risk Intelligence Platform

A complete, production-grade, full-stack AI-powered platform designed to ingest raw meteorological datasets, train and evaluate machine learning regression pipelines (Linear Regression, Random Forest, Gradient Boosting), and serve hazard index predictions through an enterprise-grade dashboard.

Developed in alignment with design aesthetics inspired by Google Cloud, IBM Watson, and Palantir.

---

## 🌎 Key System Capabilities
1. **Machine Learning Pipeline**: Complete cleaning, outlier detection/capping via IQR, and data split. Compares three models: Linear Regression, Random Forest, and Gradient Boosting Regressors, saving the best performer.
2. **Dynamic Risk Calculations**: Predicts a 0-100 hazard index and categorizes it into Low, Moderate, and High risks with dynamic explanation texts.
3. **Enterprise UI Console**: Contains:
   - **Operator Dashboard**: High-level statistical summaries and interactive Chart.js charts.
   - **Predictor Workspace**: Form inputs with dynamic risk gauges and confidence sliders.
   - **ML Pipeline Analytics**: Interactive Horizontal bar charts of feature importances and correlation matrix heatmaps.
   - **Data Explorer**: paginated browsable data grids with searches, sorting, filters, and CSV/Excel exports.
   - **Control Console**: trigger retraining jobs, view audit ledgers, and download PDF reports.
4. **PWA Integration**: Configured with static asset service worker caching for offline performance.
5. **Secure Authentication**: Role-based access control (Admin / User credentials) secured via JSON Web Tokens.

---

## 🛠️ Project Structure
```text
AIPRO/
├── backend/
│   ├── best_model.pkl          # Pickled best model (Random Forest Regressor)
│   ├── scaler.pkl              # Pickled StandardScaler
│   ├── model_metrics.json      # Pipeline metrics, correlation, feature importances
│   ├── database.js             # SQLite / JSON storage manager
│   ├── database.json           # User / prediction records fallback
│   ├── package.json            # Node backend dependencies
│   ├── server.js               # Main Express.js API server
│   ├── train_model.py          # ML cleaning and model training script
│   └── predict.py              # Prediction scoring helper script
├── dataset/
│   └── Combined12.csv          # Raw climate records (500k+ rows)
├── frontend/
│   ├── index.html              # Marketing Landing page
│   ├── login.html              # Authenticator gateway
│   ├── dashboard.html          # Operator console
│   ├── predict.html            # Parameter calculator
│   ├── analytics.html          # ML analytics page
│   ├── explorer.html           # Raw table explorer
│   ├── admin.html              # Maintenance center
│   ├── app.js                  # Frontend client orchestrator
│   ├── style.css               # Design system and global styling
│   ├── manifest.json           # PWA configuration
│   └── sw.js                   # Service Worker script
├── datada.zip                  # Dataset archive
└── README.md                   # Operational guidelines
```

---

## ⚙️ Quick Start Installation

### Prerequisites
- Python 3.10+ (must have `scikit-learn`, `pandas`, `numpy`, `joblib` installed)
- Node.js v16+ (installed embedded version included in the workspace profile)

### Step 1: Initialize Backend Node Modules
Open your terminal inside the `backend` directory and install the packages:
```bash
npm install
```

### Step 2: Running the Server
Start the Express API server. This also starts hosting the frontend assets on `http://localhost:5000`:
```bash
npm start
```
*Note: The server will automatically load the raw dataset from `../dataset/Combined12.csv` in the background when it boots to optimize explorer loading speeds.*

---

## 🔓 Access Credentials

To login, open `http://localhost:5000` (or click Get Started on the home page) and enter one of the default accounts:

* **Administrator Role**:
  * Username: `admin`
  * Password: `admin123`
  *(Accesses: Dashboard, Predictor, Analytics, Data Explorer, Admin retrain triggers, Audit logs)*

* **Standard User Role**:
  * Username: `user`
  * Password: `user123`
  *(Accesses: Dashboard, Predictor, Analytics, Data Explorer)*

---

## 🔄 Retraining & Modifying ML Model
If you add new rows to `Combined12.csv`, you can retrain the model directly from the UI (Admin Panel > Trigger Pipeline Retraining) or execute the script locally from the `backend/` directory:
```bash
python train_model.py
```
This runs the full cleaning pipeline and evaluates all candidate algorithms:
* **Linear Regression** (Baseline model)
* **Random Forest Regressor** (Best performer: R² ~89.27%)
* **Gradient Boosting Regressor** (Alternative: R² ~86.14%)

Once complete, `train_model.py` updates `best_model.pkl`, `scaler.pkl`, and `model_metrics.json` automatically, prompting immediate updates across the dashboard and analytics pages.
