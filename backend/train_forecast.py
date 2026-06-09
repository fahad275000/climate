import os
import sys
import json
import pandas as pd
import numpy as np
import joblib
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import r2_score

def main():
    print("Initializing Weather Forecast Training Pipeline...")
    dataset_path = os.path.join("..", "dataset", "Combined12.csv")
    if not os.path.exists(dataset_path):
        dataset_path = os.path.join("dataset", "Combined12.csv")
        
    if not os.path.exists(dataset_path):
        print(f"Error: Dataset not found at {dataset_path}")
        sys.exit(1)
        
    print("Loading dataset...")
    df = pd.read_csv(dataset_path)
    
    # 1. Cleaning duplicates and outliers (same as model training)
    df = df.drop_duplicates().reset_index(drop=True)
    features = ['Pressure', 'global_radiation', 'temp_mean(c)', 'temp_min(c)', 'temp_max(c)', 'Wind_Speed', 'Wind_Bearing']
    for col in features:
        Q1 = df[col].quantile(0.25)
        Q3 = df[col].quantile(0.75)
        IQR = Q3 - Q1
        lower_bound = Q1 - 1.5 * IQR
        upper_bound = Q3 + 1.5 * IQR
        df[col] = np.clip(df[col], lower_bound, upper_bound)
        
    # 2. Construct 5-day Future Weather target columns
    print("Constructing multi-step future targets (lags 1 to 5)...")
    target_cols = []
    for d in range(1, 6):
        for col in features:
            col_name = f"{col}_day{d}"
            df[col_name] = df[col].shift(-d)
            target_cols.append(col_name)
            
    # Drop rows with NaNs (last 5 rows)
    df = df.dropna().reset_index(drop=True)
    
    X = df[features]
    y = df[target_cols]
    
    # 3. Sample for training efficiency
    sample_size = min(100000, len(df))
    print(f"Sampling {sample_size} records for forecasting model training...")
    idx = np.random.RandomState(42).choice(len(df), sample_size, replace=False)
    X_sample = X.iloc[idx].reset_index(drop=True)
    y_sample = y.iloc[idx].reset_index(drop=True)
    
    X_train, X_test, y_train, y_test = train_test_split(X_sample, y_sample, test_size=0.2, random_state=42)
    
    # Scale inputs using existing scaler
    scaler_path = "scaler.pkl"
    if not os.path.exists(scaler_path):
        scaler_path = os.path.join(os.path.dirname(__file__), scaler_path)
    
    if os.path.exists(scaler_path):
        print("Loading standard scaler...")
        scaler = joblib.load(scaler_path)
    else:
        from sklearn.preprocessing import StandardScaler
        print("Standard scaler not found. Creating a new one...")
        scaler = StandardScaler()
        scaler.fit(X_train)
        joblib.dump(scaler, "scaler.pkl")
        
    X_train_scaled = scaler.transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    
    # 4. Fit Multi-Output Random Forest Regressor
    print("Training Multi-Output Forecaster Model (Random Forest)...")
    # Low estimators/depth to ensure fast training, while maintaining quality
    forecaster = RandomForestRegressor(n_estimators=15, max_depth=8, random_state=42, n_jobs=-1)
    forecaster.fit(X_train_scaled, y_train)
    
    # Evaluate
    preds = forecaster.predict(X_test_scaled)
    r2 = r2_score(y_test, preds, multioutput='uniform_average')
    print(f"Forecaster training completed. Average R² across all horizons: {r2:.4f}")
    
    # Save forecaster model
    forecaster_path = "forecaster_model.pkl"
    joblib.dump(forecaster, forecaster_path)
    print(f"Forecaster saved to {forecaster_path}")
    
    # Save forecaster metrics
    metrics_path = "forecaster_metrics.json"
    with open(metrics_path, "w") as f:
        json.dump({
            "average_r2": float(r2),
            "status": "success",
            "last_trained": pd.Timestamp.now().isoformat()
        }, f, indent=2)

if __name__ == "__main__":
    main()
