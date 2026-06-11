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
    gpu_info = check_nvidia_smi()
    
    if gpu_info and len(gpu_info) > 0:
        # Parse the GPU name and driver version (e.g. "NVIDIA GeForce RTX 2050, 610.47")
        parts = gpu_info[0].split(',')
        device_name = parts[0].strip()
        driver_version = parts[1].strip() if len(parts) > 1 else "Unknown"
        
        cuda_available = True
        gpu_detected = True
        execution_mode = "GPU (CUDA)"
        is_h200 = "H200" in device_name
    else:
        cuda_available = False
        gpu_detected = False
        device_name = "Generic CPU"
        driver_version = "N/A"
        execution_mode = "CPU"
        is_h200 = False
    
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
