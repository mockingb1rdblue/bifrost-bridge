#!/usr/bin/env python3
import os
import sys
import subprocess
import shutil
from pathlib import Path

# --- Configuration ---
ROOT_DIR = Path(__file__).parent.parent.absolute()
ENV_FILE = ROOT_DIR / ".env"
CERTS_DIR = ROOT_DIR / ".certs"
WORKERS_DIR = ROOT_DIR / "workers"
IS_WINDOWS = os.name == 'nt'

def load_env():
    """Manually load .env to avoid 'python-dotenv' dependency"""
    if not ENV_FILE.exists():
        print(f"[!] Warning: .env file not found at {ENV_FILE}")
        return
    
    print(f"[*] Loading environment from {ENV_FILE.name}...")
    with open(ENV_FILE, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                key, value = line.split("=", 1)
                os.environ[key.strip()] = value.strip()

def set_node_certs():
    """Configure NODE_EXTRA_CA_CERTS if a corporate bundle exists"""
    cert_path = CERTS_DIR / "corporate_bundle.pem"
    if cert_path.exists():
        print(f"[*] Found corporate cert bundle: {cert_path.name}")
        os.environ["NODE_EXTRA_CA_CERTS"] = str(cert_path)
    else:
        # Check system store or fallback logic could go here
        pass

def run_command(cmd_list, cwd=None, env=None):
    """Run a subprocess command with OS-specific adjustments"""
    # Merge current env with any custom env vars
    process_env = os.environ.copy()
    if env:
        process_env.update(env)

    # Windows Nuance: npm/npx are batch files, need shell=True or explicit execution via cmd
    use_shell = False
    
    if IS_WINDOWS:
        # If calling npm/npx/wrangler directly, we must use shell=True or prepend cmd /c
        # Prepending cmd /c is safer/more explicit than shell=True for some contexts,
        # but shell=True is often robust enough for simple commands.
        # Let's use the explicit "cmd /c" strategy if the first arg is not an exe
        candidate = cmd_list[0]
        if candidate in ["npm", "npx", "wrangler"]:
            cmd_list = ["cmd", "/c"] + cmd_list
        # Note: shell=False is default
    
    print(f"[$] {' '.join(cmd_list)} (cwd: {cwd or '.'})")
    
    try:
        subprocess.check_call(cmd_list, cwd=cwd, env=process_env)
    except subprocess.CalledProcessError as e:
        print(f"[!] Command failed with exit code {e.returncode}")
        sys.exit(e.returncode)
    except FileNotFoundError:
        print(f"[!] Error: Executable not found: {cmd_list[0]}")
        sys.exit(1)

def deploy_proxy():
    """Deploy the Perplexity Proxy worker"""
    print("\n=== Deploying Perplexity Proxy ===")
    proxy_dir = WORKERS_DIR / "perplexity-proxy"
    if not proxy_dir.exists():
        print(f"[!] Error: Proxy directory not found at {proxy_dir}")
        return

    # 1. Install Deps
    run_command(["npm", "install"], cwd=str(proxy_dir))

    # 2. Deploy
    # We rely on .env having CLOUDFLARE_API_TOKEN etc.
    run_command(["npx", "wrangler", "deploy"], cwd=str(proxy_dir))

    # 3. Set Secrets
    # We verify the keys exist before trying
    pplx_key = os.environ.get("PERPLEXITY_API_KEY")
    proxy_key = os.environ.get("PROXY_API_KEY")
    
    if pplx_key:
        print("[*] Uploading PERPLEXITY_API_KEY secret...")
        # echoing piped input to wrangler secret put is tricky across OSs.
        # We will try the standard input pipe method
        run_command_with_input(["npx", "wrangler", "secret", "put", "PERPLEXITY_API_KEY"], 
                               input_text=pplx_key, cwd=str(proxy_dir))
    else:
        print("[!] Warning: PERPLEXITY_API_KEY not set in .env. Skipping secret upload.")

    if proxy_key:
        print("[*] Uploading PROXY_API_KEY secret...")
        run_command_with_input(["npx", "wrangler", "secret", "put", "PROXY_API_KEY"], 
                               input_text=proxy_key, cwd=str(proxy_dir))
    else:
        print("[!] Warning: PROXY_API_KEY not set in .env. Skipping secret upload.")

def run_command_with_input(cmd_list, input_text, cwd=None):
    """Run command and pipe input to stdin (for secrets)"""
    if IS_WINDOWS:
         if cmd_list[0] in ["npm", "npx", "wrangler"]:
            cmd_list = ["cmd", "/c"] + cmd_list
            
    print(f"[$] {' '.join(cmd_list)} (cwd: {cwd or '.'}) << [REDACTED INPUT]")
    try:
        subprocess.run(
            cmd_list, 
            input=input_text.encode('utf-8'), 
            cwd=cwd, 
            check=True,
            env=os.environ.copy()
        )
    except subprocess.CalledProcessError as e:
        print(f"[!] Command failed: {e}")

def main():
    if len(sys.argv) < 2:
        print("Usage: python bifrost.py [command]")
        print("Commands:")
        print("  setup        - Verify environment and certs")
        print("  deploy-proxy - Deploy the Perplexity MCP Proxy")
        return

    command = sys.argv[1]
    
    # 1. Bootstrap
    load_env()
    set_node_certs()
    
    # 2. Execute
    if command == "setup":
        print("[*] Setup verification complete.")
        print(f"    NODE_EXTRA_CA_CERTS: {os.environ.get('NODE_EXTRA_CA_CERTS', 'Not Set')}")
        print(f"    PERPLEXITY_API_KEY:  {'Set' if os.environ.get('PERPLEXITY_API_KEY') else 'Missing'}")
    elif command == "deploy-proxy":
        deploy_proxy()
    else:
        print(f"[!] Unknown command: {command}")

if __name__ == "__main__":
    main()
