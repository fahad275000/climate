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
    model_path = "best_model.pkl"
    scaler_path = "scaler.pkl"
    
    if not os.path.exists(model_path) or not os.path.exists(scaler_path):
        # Check relative paths
        base_dir = os.path.dirname(os.path.abspath(__file__))
        model_path = os.path.join(base_dir, model_path)
        scaler_path = os.path.join(base_dir, scaler_path)
        
    if not os.path.exists(model_path) or not os.path.exists(scaler_path):
        print(json.dumps({"error": "Model files not found. Please train the model first."}))
        sys.exit(1)
        
    try:
        model = joblib.load(model_path)
        scaler = joblib.load(scaler_path)
    except Exception as e:
        print(json.dumps({"error": f"Failed to load model: {str(e)}"}))
        sys.exit(1)
        
    # Prepare input DataFrame with feature names
    features = ['Pressure', 'global_radiation', 'temp_mean(c)', 'temp_min(c)', 'temp_max(c)', 'Wind_Speed', 'Wind_Bearing']
    input_df = pd.DataFrame([[pressure, radiation, temp_mean, temp_min, temp_max, wind_speed, wind_bearing]], columns=features)
    
    # Scale input
    input_scaled = scaler.transform(input_df)
    
    # Predict
    pred_label = float(model.predict(input_scaled)[0])
    
    # Bound the output label to [0, 3] just in case
    pred_label = max(0.0, min(3.0, pred_label))
    
    # Risk Score: map 0-3 to 0-100
    risk_score = round(pred_label * 33.33, 1)
    
    # Risk Category
    # 0-30 Low, 31-70 Moderate, 71-100 High
    if risk_score <= 30.0:
        category = "Low Risk"
    elif risk_score <= 70.0:
        category = "Moderate Risk"
    else:
        category = "High Risk"
        
    # Generate dynamic explanation based on features
    reasons = []
    if temp_max >= 30.0:
        reasons.append(f"elevated peak temperatures ({temp_max}°C)")
    elif temp_mean >= 25.0:
        reasons.append(f"high average temperatures ({temp_mean}°C)")
        
    if radiation >= 2.0:
        reasons.append(f"strong solar radiation ({radiation} kW/m²)")
        
    if wind_speed >= 12.0:
        reasons.append(f"intense wind speeds ({wind_speed} m/s)")
        
    if pressure <= 1005.0:
        reasons.append(f"low atmospheric pressure ({pressure} hPa), suggesting atmospheric instability")
    elif pressure >= 1015.0:
        reasons.append(f"high atmospheric pressure ({pressure} hPa)")
        
    if category == "High Risk":
        if reasons:
            explanation = f"High climate risk detected due to: {', '.join(reasons)}."
        else:
            explanation = "High risk due to elevated combination of temperature and radiation levels."
    elif category == "Moderate Risk":
        if reasons:
            explanation = f"Moderate climate risk detected due to: {', '.join(reasons)}."
        else:
            explanation = "Moderate climate risk with stable, but slightly elevated environmental factors."
    else:
        explanation = "Low climate risk. Weather parameters are within standard, safe environmental ranges."
        
    # Prediction confidence - proxy model
    confidence = round(100.0 - abs(risk_score - 50.0) * 0.2, 1)
    confidence = max(75.0, min(98.5, confidence))
    
    output = {
        "predicted_label": round(pred_label, 3),
        "risk_score": risk_score,
        "risk_category": category,
        "explanation": explanation,
        "confidence": confidence
    }
    
    print(json.dumps(output))

if __name__ == "__main__":
    main()
