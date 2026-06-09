import os
import sys
import json
import pandas as pd
import numpy as np
import joblib

def main():
    if len(sys.argv) < 8:
        print(json.dumps({"error": "Missing inputs. Required: Pressure, global_radiation, temp_mean, temp_min, temp_max, Wind_Speed, Wind_Bearing"}))
        sys.exit(1)
        
    try:
        pressure = float(sys.argv[1])
        radiation = float(sys.argv[2])
        temp_mean = float(sys.argv[3])
        temp_min = float(sys.argv[4])
        temp_max = float(sys.argv[5])
        wind_speed = float(sys.argv[6])
        wind_bearing = float(sys.argv[7])
    except ValueError:
        print(json.dumps({"error": "Invalid input format. All values must be numeric."}))
        sys.exit(1)
        
    # Check paths
    base_dir = os.path.dirname(os.path.abspath(__file__))
    model_path = os.path.join(base_dir, "best_model.pkl")
    scaler_path = os.path.join(base_dir, "scaler.pkl")
    forecaster_path = os.path.join(base_dir, "forecaster_model.pkl")
    
    if not os.path.exists(model_path) or not os.path.exists(scaler_path) or not os.path.exists(forecaster_path):
        print(json.dumps({"error": "Forecasting models not trained yet."}))
        sys.exit(1)
        
    try:
        model = joblib.load(model_path)
        scaler = joblib.load(scaler_path)
        forecaster = joblib.load(forecaster_path)
    except Exception as e:
        print(json.dumps({"error": f"Failed to load models: {str(e)}"}))
        sys.exit(1)
        
    # Prepare input
    features = ['Pressure', 'global_radiation', 'temp_mean(c)', 'temp_min(c)', 'temp_max(c)', 'Wind_Speed', 'Wind_Bearing']
    input_df = pd.DataFrame([[pressure, radiation, temp_mean, temp_min, temp_max, wind_speed, wind_bearing]], columns=features)
    
    # Scale input
    input_scaled = scaler.transform(input_df)
    
    # Predict next 5 days parameters (raw outputs shape: [1, 35])
    forecasted_raw = forecaster.predict(input_scaled)[0]
    
    forecast_results = []
    
    # Reshape the output vector into 5 steps x 7 features
    for day in range(1, 6):
        offset = (day - 1) * 7
        day_params = forecasted_raw[offset : offset + 7]
        
        # Unpack parameters
        p_pres = float(day_params[0])
        p_rad = float(day_params[1])
        p_tmean = float(day_params[2])
        p_tmin = float(day_params[3])
        p_tmax = float(day_params[4])
        p_wsp = float(day_params[5])
        p_wbg = float(day_params[6])
        
        # Enforce bounds
        p_rad = max(0.0, p_rad)
        p_wsp = max(0.0, p_wsp)
        if p_tmin > p_tmax:
            p_tmin, p_tmax = p_tmax, p_tmean
            
        # Run prediction for risk score
        p_df = pd.DataFrame([[p_pres, p_rad, p_tmean, p_tmin, p_tmax, p_wsp, p_wbg]], columns=features)
        p_scaled = scaler.transform(p_df)
        pred_label = float(model.predict(p_scaled)[0])
        pred_label = max(0.0, min(3.0, pred_label))
        
        risk_score = round(pred_label * 33.33, 1)
        
        # Category
        if risk_score <= 30.0:
            category = "Low Risk"
        elif risk_score <= 70.0:
            category = "Moderate Risk"
        else:
            category = "High Risk"
            
        # Dynamic Explanation
        reasons = []
        if p_tmax >= 30.0:
            reasons.append(f"high temperature ({p_tmax:.1f}°C)")
        if p_rad >= 2.0:
            reasons.append(f"solar radiation ({p_rad:.2f} kW/m²)")
        if p_wsp >= 12.0:
            reasons.append(f"winds ({p_wsp:.1f} m/s)")
            
        if category == "High Risk":
            explanation = f"Forecasted High Risk due to: {', '.join(reasons) if reasons else 'adverse climate factors'}."
        elif category == "Moderate Risk":
            explanation = f"Forecasted Moderate Risk due to: {', '.join(reasons) if reasons else 'slightly elevated weather values'}."
        else:
            explanation = "Stable forecasted parameters with low environmental risk."
            
        forecast_results.append({
            "day": day,
            "pressure": round(p_pres, 1),
            "global_radiation": round(p_rad, 2),
            "temp_mean": round(p_tmean, 1),
            "temp_min": round(p_tmin, 1),
            "temp_max": round(p_tmax, 1),
            "wind_speed": round(p_wsp, 1),
            "wind_bearing": int(p_wbg) % 360,
            "risk_score": risk_score,
            "risk_category": category,
            "explanation": explanation
        })
        
    print(json.dumps(forecast_results))

if __name__ == "__main__":
    main()
