#!/usr/bin/env python3
import os
import sys
import urllib.request
import zipfile
import shutil
from pathlib import Path

# Configuration
NODE_VERSION = "20.11.1"
NODE_URL = f"https://nodejs.org/dist/v{NODE_VERSION}/node-v{NODE_VERSION}-win-x64.zip"
PROJECT_ROOT = Path(__file__).parent.parent
TOOLS_DIR = PROJECT_ROOT / ".tools"
NODE_DIR = TOOLS_DIR / "nodejs"
NODE_ZIP = TOOLS_DIR / "node.zip"

def print_status(message, status="INFO"):
    colors = {
        "INFO": "\033[94m",
        "SUCCESS": "\033[92m",
        "WARNING": "\033[93m",
        "ERROR": "\033[91m",
    }
    reset = "\033[0m"
    print(f"{colors.get(status, '')}{message}{reset}")

def download_file(url, destination):
    print_status(f"Downloading Node.js from {url}...", "INFO")
    def reporthook(block_num, block_size, total_size):
        downloaded = block_num * block_size
        if total_size > 0:
            percent = min(100, downloaded * 100 / total_size)
            sys.stdout.write(f"\r  Progress: {percent:.1f}% ({downloaded // 1024 // 1024}MB / {total_size // 1024 // 1024}MB)")
            sys.stdout.flush()
    try:
        urllib.request.urlretrieve(url, destination, reporthook)
        print()
        return True
    except Exception as e:
        print(f"\nError: {e}")
        return False

def extract_node():
    print_status(f"Extracting Node.js to {NODE_DIR}...", "INFO")
    try:
        with zipfile.ZipFile(NODE_ZIP, 'r') as zip_ref:
            # The ZIP contains a root folder like 'node-v20.11.1-win-x64'
            root_folder = zip_ref.namelist()[0].split('/')[0]
            zip_ref.extractall(TOOLS_DIR)
            
            # Rename the extracted folder to 'nodejs'
            temp_dir = TOOLS_DIR / root_folder
            if NODE_DIR.exists():
                shutil.rmtree(NODE_DIR)
            temp_dir.rename(NODE_DIR)
        return True
    except Exception as e:
        print_status(f"Extraction failed: {e}", "ERROR")
        return False

def main():
    TOOLS_DIR.mkdir(parents=True, exist_ok=True)
    
    if (NODE_DIR / "node.exe").exists():
        print_status("Node.js already installed in .tools/nodejs", "SUCCESS")
        return 0
        
    if not download_file(NODE_URL, NODE_ZIP):
        return 1
        
    if not extract_node():
        return 1
        
    if NODE_ZIP.exists():
        NODE_ZIP.unlink()
        
    print_status("Node.js setup complete!", "SUCCESS")
    return 0

if __name__ == "__main__":
    sys.exit(main())
