import os
import sys
import json
import pandas as pd
import numpy as np
import joblib
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.metrics import r2_score, mean_squared_error, mean_absolute_error

def main():
    print("Initializing Machine Learning Pipeline...")
    # Load dataset
    dataset_path = os.path.join("..", "dataset", "Combined12.csv")
    if not os.path.exists(dataset_path):
        dataset_path = os.path.join("dataset", "Combined12.csv")
    
    if not os.path.exists(dataset_path):
        print(f"Error: Dataset not found at {dataset_path}")
        sys.exit(1)
        
    print(f"Loading dataset from {dataset_path}...")
    df = pd.read_csv(dataset_path)
    print(f"Loaded {len(df)} records.")
    
    # 1. Handle Missing Values
    null_counts = df.isnull().sum().sum()
    if null_counts > 0:
        print(f"Found {null_counts} missing values. Imputing...")
        df = df.fillna(df.mean())
    else:
        print("No missing values detected.")
        
    # 2. Remove Duplicates
    dup_count = df.duplicated().sum()
    if dup_count > 0:
        print(f"Removing {dup_count} duplicate rows...")
        df = df.drop_duplicates().reset_index(drop=True)
        print(f"Cleaned dataset contains {len(df)} records.")
    else:
        print("No duplicate records detected.")
        
    # 3. Detect and Handle Outliers using IQR method (capping)
    print("Detecting and handling outliers via IQR capping...")
    features = ['Pressure', 'global_radiation', 'temp_mean(c)', 'temp_min(c)', 'temp_max(c)', 'Wind_Speed', 'Wind_Bearing']
    for col in features:
        Q1 = df[col].quantile(0.25)
        Q3 = df[col].quantile(0.75)
        IQR = Q3 - Q1
        lower_bound = Q1 - 1.5 * IQR
        upper_bound = Q3 + 1.5 * IQR
        
        # Cap outliers
        df[col] = np.clip(df[col], lower_bound, upper_bound)
        
    # Correlation Matrix
    corr_matrix = df.corr().to_dict()
    
    # Calculate dataset insights
    insights = {
        "total_records": len(df),
        "averages": {
            "pressure": float(df["Pressure"].mean()),
            "radiation": float(df["global_radiation"].mean()),
            "temp_mean": float(df["temp_mean(c)"].mean()),
            "temp_min": float(df["temp_min(c)"].mean()),
            "temp_max": float(df["temp_max(c)"].mean()),
            "wind_speed": float(df["Wind_Speed"].mean()),
            "wind_bearing": float(df["Wind_Bearing"].mean()),
            "risk_score": float(df["normalized_label"].mean() * 33.33)
        },
        "ranges": {
            "pressure": [float(df["Pressure"].min()), float(df["Pressure"].max())],
            "radiation": [float(df["global_radiation"].min()), float(df["global_radiation"].max())],
            "temp_mean": [float(df["temp_mean(c)"].min()), float(df["temp_mean(c)"].max())],
            "wind_speed": [float(df["Wind_Speed"].min()), float(df["Wind_Speed"].max())]
        }
    }
    
    # 4. Sampling for model training efficiency (e.g. 100,000 samples)
    sample_size = min(100000, len(df))
    print(f"Sampling {sample_size} records for model training...")
    df_sample = df.sample(n=sample_size, random_state=42).reset_index(drop=True)
    
    X = df_sample[features]
    y = df_sample['normalized_label']
    
    # Split into train/test
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    # Feature scaling
    print("Scaling features...")
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    
    # Save scaler
    scaler_path = "scaler.pkl"
    joblib.dump(scaler, scaler_path)
    print(f"Scaler saved to {scaler_path}")
    
    # Define models
    models = {
        "Linear Regression": LinearRegression(),
        "Random Forest Regressor": RandomForestRegressor(n_estimators=30, max_depth=10, random_state=42, n_jobs=-1),
        "Gradient Boosting Regressor": GradientBoostingRegressor(n_estimators=30, max_depth=5, random_state=42)
    }
    
    model_metrics = {}
    best_r2 = -float("inf")
    best_model_name = None
    best_model_obj = None
    
    for name, model in models.items():
        print(f"Training {name}...")
        model.fit(X_train_scaled, y_train)
        preds = model.predict(X_test_scaled)
        
        # Calculate metrics
        r2 = r2_score(y_test, preds)
        mse = mean_squared_error(y_test, preds)
        rmse = np.sqrt(mse)
        mae = mean_absolute_error(y_test, preds)
        
        model_metrics[name] = {
            "r2": float(r2),
            "rmse": float(rmse),
            "mae": float(mae)
        }
        print(f"{name} Results - R2: {r2:.4f}, RMSE: {rmse:.4f}, MAE: {mae:.4f}")
        
        # Select best model based on R2 score
        if r2 > best_r2:
            best_r2 = r2
            best_model_name = name
            best_model_obj = model
            
    print(f"Best Model Selected: {best_model_name} with R2: {best_r2:.4f}")
    
    # Save best model
    best_model_path = "best_model.pkl"
    joblib.dump(best_model_obj, best_model_path)
    print(f"Best model saved to {best_model_path}")
    
    # Calculate feature importance
    print("Calculating feature importance...")
    feature_importance = {}
    if hasattr(best_model_obj, 'feature_importances_'):
        importances = best_model_obj.feature_importances_
        for feat, imp in zip(features, importances):
            feature_importance[feat] = float(imp)
    elif hasattr(best_model_obj, 'coef_'):
        coefs = np.abs(best_model_obj.coef_)
        total_coef = np.sum(coefs) if np.sum(coefs) > 0 else 1.0
        importances = coefs / total_coef
        for feat, imp in zip(features, importances):
            feature_importance[feat] = float(imp)
    else:
        for feat in features:
            feature_importance[feat] = 1.0 / len(features)
            
    # Save metrics to json file
    metrics_data = {
        "best_model": best_model_name,
        "models": model_metrics,
        "feature_importance": feature_importance,
        "correlation_matrix": corr_matrix,
        "insights": insights,
        "status": "success",
        "last_trained": pd.Timestamp.now().isoformat()
    }
    
    metrics_path = "model_metrics.json"
    with open(metrics_path, "w") as f:
        json.dump(metrics_data, f, indent=2)
    print(f"Metrics saved to {metrics_path}")
    print("Training process completed successfully.")

if __name__ == "__main__":
    main()
