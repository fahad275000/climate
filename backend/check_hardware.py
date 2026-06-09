import sys
import json
import subprocess
import shutil

def check_nvidia_smi():
    if not shutil.which("nvidia-smi"):
        return None
    try:
        res = subprocess.run(["nvidia-smi", "--query-gpu=name,driver_version", "--format=csv,noheader"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=3)
        if res.returncode == 0:
            lines = [line.strip() for line in res.stdout.strip().split("\n") if line.strip()]
            return lines
    except Exception:
        return None
    return None

def main():
    cuda_available = False
    device_name = "None"
    gpu_detected = False
    driver_version = "N/A"
    
    # 1. Try PyTorch CUDA check
    try:
        import torch
        if torch.cuda.is_available():
            cuda_available = True
            gpu_detected = True
            device_name = torch.cuda.get_device_name(0)
    except ImportError:
        pass
        
    # 2. Try nvidia-smi execution check
    gpus = check_nvidia_smi()
    if gpus:
        gpu_detected = True
        parts = gpus[0].split(",")
        if device_name == "None" or not cuda_available:
            device_name = parts[0].strip()
        if len(parts) > 1:
            driver_version = parts[1].strip()
            
    # If no GPU detected, report CPU
    if not gpu_detected:
        import platform
        device_name = platform.processor() or "Generic CPU"
        execution_mode = "CPU"
    else:
        execution_mode = f"GPU ({'CUDA' if cuda_available else 'Hardware'})"
        
    is_h200 = "H200" in device_name.upper()
    
    status = {
        "cuda_available": cuda_available,
        "gpu_detected": gpu_detected,
        "device_name": device_name,
        "driver_version": driver_version,
        "execution_mode": execution_mode,
        "is_h200_active": is_h200
    }
    
    print(json.dumps(status))

if __name__ == "__main__":
    main()
