#!/usr/bin/env python3
import os
import sys
import subprocess
import shutil
import urllib.request
import urllib.error
import ssl
import socket
import time
from pathlib import Path

# --- Configuration ---
ROOT_DIR = Path(__file__).parent.parent.absolute()
ENV_FILE = ROOT_DIR / ".env"
CERTS_DIR = ROOT_DIR / ".certs"
WORKERS_DIR = ROOT_DIR / "workers"
IS_WINDOWS = os.name == 'nt'

# --- Colors ---
class Colors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'

    @staticmethod
    def print(msg, color=ENDC):
        if IS_WINDOWS: # Simple colored output support on modern Windows terminal
            os.system('color')
        print(f"{color}{msg}{Colors.ENDC}")

# --- Core Functions ---

def load_env():
    """Manually load .env to avoid 'python-dotenv' dependency"""
    if not ENV_FILE.exists():
        Colors.print(f"[!] Warning: .env file not found at {ENV_FILE}", Colors.WARNING)
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
        pass

def mtls_context():
    """Create an SSL context that uses the corporate bundle if available"""
    ctx = ssl.create_default_context()
    cert_path = CERTS_DIR / "corporate_bundle.pem"
    if cert_path.exists():
        ctx.load_verify_locations(str(cert_path))
    return ctx

def run_command(cmd_list, cwd=None, env=None):
    """Run a subprocess command with OS-specific adjustments"""
    process_env = os.environ.copy()
    if env:
        process_env.update(env)

    if IS_WINDOWS:
        candidate = cmd_list[0]
        if candidate in ["npm", "npx", "wrangler"]:
            cmd_list = ["cmd", "/c"] + cmd_list
    
    print(f"[$] {' '.join(cmd_list)} (cwd: {cwd or '.'})")
    
    try:
        subprocess.check_call(cmd_list, cwd=cwd, env=process_env)
    except subprocess.CalledProcessError as e:
        Colors.print(f"[!] Command failed with exit code {e.returncode}", Colors.FAIL)
        sys.exit(e.returncode)
    except FileNotFoundError:
        Colors.print(f"[!] Error: Executable not found: {cmd_list[0]}", Colors.FAIL)
        sys.exit(1)

def deploy_proxy():
    """Deploy the Perplexity Proxy worker"""
    print("\n=== Deploying Perplexity Proxy ===")
    proxy_dir = WORKERS_DIR / "perplexity-proxy"
    if not proxy_dir.exists():
        Colors.print(f"[!] Error: Proxy directory not found at {proxy_dir}", Colors.FAIL)
        return

    run_command(["npm", "install"], cwd=str(proxy_dir))
    run_command(["npx", "wrangler", "deploy"], cwd=str(proxy_dir))

    pplx_key = os.environ.get("PERPLEXITY_API_KEY")
    proxy_key = os.environ.get("PROXY_API_KEY")
    
    if pplx_key:
        print("[*] Uploading PERPLEXITY_API_KEY secret...")
        run_command_with_input(["npx", "wrangler", "secret", "put", "PERPLEXITY_API_KEY"], 
                               input_text=pplx_key, cwd=str(proxy_dir))
    else:
        Colors.print("[!] Warning: PERPLEXITY_API_KEY not set in .env.", Colors.WARNING)

    if proxy_key:
        print("[*] Uploading PROXY_API_KEY secret...")
        run_command_with_input(["npx", "wrangler", "secret", "put", "PROXY_API_KEY"], 
                               input_text=proxy_key, cwd=str(proxy_dir))
    else:
        Colors.print("[!] Warning: PROXY_API_KEY not set in .env.", Colors.WARNING)

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
        Colors.print(f"[!] Command failed: {e}", Colors.FAIL)

# --- Network Detective ---

def check_url(url, description):
    """Test connectivity to a URL and return result"""
    print(f"  > Testing {description:15} ({url})...", end=" ", flush=True)
    start = time.time()
    try:
        req = urllib.request.Request(url, method='HEAD')
        # Use a user agent to avoid some 403s
        req.add_header('User-Agent', 'Bifrost-Bridge-Detective/1.0')
        
        ctx = mtls_context()
        with urllib.request.urlopen(req, timeout=5, context=ctx) as response:
            duration = (time.time() - start) * 1000
            Colors.print(f"OK ({response.status}) - {duration:.0f}ms", Colors.OKGREEN)
            return True
    except urllib.error.URLError as e:
        Colors.print(f"FAIL ({e.reason})", Colors.FAIL)
        return False
    except socket.timeout:
        Colors.print(f"TIMEOUT", Colors.FAIL)
        return False
    except Exception as e:
        Colors.print(f"ERROR ({e})", Colors.FAIL)
        return False

def check_ssl_interception():
    """Check if the certificate for google.com is signed by Google or a corporate proxy"""
    hostname = 'google.com'
    print(f"  > Inspecting SSL Issuer for {hostname}...", end=" ", flush=True)
    try:
        ctx = ssl.create_default_context()
        with socket.create_connection((hostname, 443), timeout=3) as sock:
            with ctx.wrap_socket(sock, server_hostname=hostname) as ssock:
                cert = ssock.getpeercert()
                issuer = dict(x[0] for x in cert['issuer'])
                org = issuer.get('organizationName')
                common_name = issuer.get('commonName')
                
                if org == 'Google Trust Services LLC' or 'Google' in (org or ''):
                     Colors.print(f"Standard ({org}) - No visible interception", Colors.OKCYAN)
                else:
                     Colors.print(f"INTERCEPTED ({org or common_name}) - Corporate Proxy Detected", Colors.WARNING)
    except Exception as e:
         Colors.print(f"Check Failed ({e})", Colors.FAIL)

def run_detective():
    print(f"\n{Colors.HEADER}=== Network Detective Report ==={Colors.ENDC}")
    
    # 1. Proxy Vars
    print(f"\n{Colors.BOLD}[1] Proxy Configuration:{Colors.ENDC}")
    http_proxy = os.environ.get('HTTP_PROXY') or os.environ.get('http_proxy')
    https_proxy = os.environ.get('HTTPS_PROXY') or os.environ.get('https_proxy')
    print(f"  HTTP_PROXY:  {http_proxy or 'None'}")
    print(f"  HTTPS_PROXY: {https_proxy or 'None'}")
    
    # 2. Connectivity
    print(f"\n{Colors.BOLD}[2] Standard Connectivity:{Colors.ENDC}")
    check_url('https://www.google.com', 'Internet')
    check_url('https://github.com', 'GitHub')
    check_url('https://registry.npmjs.org', 'NPM Registry')
    check_url('https://pypi.org', 'PyPi')
    
    # 3. AI Services
    print(f"\n{Colors.BOLD}[3] AI Services:{Colors.ENDC}")
    check_url('https://api.perplexity.ai', 'Perplexity API')
    check_url('https://api.openai.com', 'OpenAI API')
    check_url('https://api.anthropic.com', 'Anthropic API')
    
    # 4. Cloudflare
    print(f"\n{Colors.BOLD}[4] Cloudflare Edge:{Colors.ENDC}")
    check_url('https://1.1.1.1', 'Cloudflare DNS')
    # Default Cloudlfare Workers domain
    check_url('https://workers.dev', 'Workers.dev')

    # 5. SSL Inspection
    print(f"\n{Colors.BOLD}[5] SSL Inspection Check:{Colors.ENDC}")
    check_ssl_interception()
    
    print("\n" + "="*30 + "\n")

def main():
    if len(sys.argv) < 2:
        print("Usage: python bifrost.py [command]")
        print("Commands:")
        print("  setup        - Verify environment and certs")
        print("  deploy-proxy - Deploy the Perplexity MCP Proxy")
        print("  detect       - Run network diagnostics")
        return

    command = sys.argv[1]
    
    load_env()
    set_node_certs()
    
    if command == "setup":
        print("[*] Setup verification complete.")
        print(f"    NODE_EXTRA_CA_CERTS: {os.environ.get('NODE_EXTRA_CA_CERTS', 'Not Set')}")
        print(f"    PERPLEXITY_API_KEY:  {'Set' if os.environ.get('PERPLEXITY_API_KEY') else 'Missing'}")
    elif command == "deploy-proxy":
        deploy_proxy()
    elif command == "detect":
        run_detective()
    else:
        print(f"[!] Unknown command: {command}")

if __name__ == "__main__":
    main()
