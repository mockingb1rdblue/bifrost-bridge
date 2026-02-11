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
                if not cert:
                     Colors.print("No certificate received", Colors.FAIL)
                     return

                # Parse issuer fields securely
                issuer: dict[str, str] = {}
                if 'issuer' in cert:
                    for rdn in cert['issuer']:
                        if rdn and len(rdn) > 0:
                            key, value = rdn[0]
                            # Use casting to avoid linter confusion
                            if key:
                                issuer[str(key)] = str(value)
                
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

def show_help():
    print("""
╔═══════════════════════════════════════════════════════════════╗
║              Bifrost Bridge - Universal Runner                ║
╚═══════════════════════════════════════════════════════════════╝

USAGE:
  python bifrost.py <command> [args...]

COMMANDS:
  extract-certs           Extract SSL certificates from corporate proxy
  detect                  Run network detective to test connectivity
  deploy-proxy            Deploy Perplexity proxy to Cloudflare
  test-sdk                Test SDK connectivity via proxy
  ask <query>             Quick question (Sonar model)
  research <query>        Deep research (Sonar Reasoning Pro)
  slice <pattern>         Slice markdown files into backlog items
  
  setup-shell             Setup portable PowerShell Core environment
  shell                   Launch portable PowerShell Core
  deploy <worker>         Deploy a Cloudflare Worker
  secret <worker> <name>  Set a worker secret
  workers                 List available workers

EXAMPLES:
  python bifrost.py extract-certs
  python bifrost.py detect
  python bifrost.py ask "What is TypeScript?"
  python bifrost.py research "Best practices for error handling"
  python bifrost.py setup-shell
  python bifrost.py deploy linear-proxy
  python bifrost.py secret linear-proxy LINEAR_API_KEY
""")

def main():
    if len(sys.argv) < 2:
        show_help()
        return

    command = sys.argv[1]
    
    load_env()
    set_node_certs()
    
    if command == "setup":
        run_setup()
    elif command == "refresh":
        refresh_environment()
    elif command == "detect":
        run_detective()
    elif command == "slice":
        if len(sys.argv) < 3:
            print("[!] Usage: python bifrost.py slice <source_file_or_pattern>")
            return
        run_thinslice(sys.argv[2])
    elif command == "test-sdk":
        run_test_sdk()
    elif command in ["ask", "research"]:
        # Pass through to CLI
        # args: bifrost.py ask <query> -> ts-node src/cli.ts ask <query>
        cli_args = list(sys.argv[2:])
        pass_through_cli(command, cli_args)
    elif command == "setup-shell":
        setup_shell()
    elif command == "shell":
        launch_shell()
    elif command == "deploy":
        if len(sys.argv) < 3:
            print("[!] Usage: bifrost.py deploy <worker-name> [wrangler-args...]")
            list_workers()
        else:
            worker = sys.argv[2]
            wrangler_args = list(sys.argv[3:])
            deploy_worker(worker, *wrangler_args)
    elif command == "secret":
        if len(sys.argv) < 4:
            print("[!] Usage: bifrost.py secret <worker-name> <secret-name> [secret-value]")
        else:
            worker = sys.argv[2]
            secret = sys.argv[3]
            value = sys.argv[4] if len(sys.argv) > 4 else None
            set_worker_secret(worker, secret, value)
    elif command == "workers":
        list_workers()
    else:
        print(f"[!] Unknown command: {command}")

def pass_through_cli(subcommand, args):
    """Pass commands to the TypeScript CLI"""
    # Ensure environment is prepped
    set_node_certs()
    
    cmd = ["npx", "ts-node", "src/cli.ts", subcommand] + args
    run_command(cmd)

def run_test_sdk():
    """Run the TypeScript SDK verification script with correct environment"""
    print("\n=== Running SDK Connectivity Test ===")
    
    # Ensure certs are set in current process for run_command to inherit
    set_node_certs()
    
    if "NODE_EXTRA_CA_CERTS" not in os.environ:
         Colors.print("[!] Warning: NODE_EXTRA_CA_CERTS not set. Test may fail if behind proxy.", Colors.WARNING)

    # Check for correct keys
    if not os.environ.get("PERPLEXITY_BASE_URL"):
         Colors.print("[!] Warning: PERPLEXITY_BASE_URL not set. Test will use direct API (likely blocked).", Colors.WARNING)

    # Run via ts-node
    # We use 'npx' prefix which run_command handles (cmd /c on windows)
    # We point to the local ts-node
    run_command(["npx", "ts-node", "tests/test_sdk.ts"])

def run_thinslice(source_pattern):
    """Slice a markdown file into backlog items"""
    import glob
    import re
    
    # Resolve source files
    # Check if user provided an absolute path or relative to current dir
    # But usually sources are in docs/reference
    # Let's try to find it
    
    files = []
    if os.path.exists(source_pattern):
         files.append(source_pattern)
    else:
         # Try globbing
         files = glob.glob(source_pattern)
         
    if not files:
         # Try looking in docs/reference if not found
         ref_path = ROOT_DIR / "docs" / "reference" / source_pattern
         if ref_path.exists():
             files.append(str(ref_path))
         else:
             # Try glob in docs/reference
             files = glob.glob(str(ref_path))

    if not files:
        Colors.print(f"[!] No files found matching '{source_pattern}'", Colors.FAIL)
        return

    backlog_dir = ROOT_DIR / "docs" / "backlog"
    
    # Find max index
    existing = glob.glob(str(backlog_dir / "*.md"))
    max_index = 0
    for f in existing:
        basename = os.path.basename(f)
        parts = basename.split('_')
        if parts[0].isdigit():
            idx = int(parts[0])
            if idx > max_index:
                max_index = idx
    
    current_index = int(max_index) + 1
    print(f"[*] Starting backlog index: {current_index:03d}")

    for source_file in files:
        print(f"[*] Processing {source_file}...")
        try:
            with open(source_file, 'r', encoding='utf-8') as f:
                content = f.read()
        except Exception as e:
            Colors.print(f"[!] Could not read {source_file}: {e}", Colors.FAIL)
            continue

        # Split by level 2 headers
        sections = re.split(r'(^##\s+.+$)', content, flags=re.MULTILINE)
        
        # Preamble
        if sections[0].strip():
            # Create preamble file
            base_name = os.path.basename(source_file).replace('.md', '')
            filename = f"{current_index:03d}_{base_name}_Preamble.md"
            filepath = backlog_dir / filename
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(sections[0].strip() + "\n")
            Colors.print(f"  + Created {filename}", Colors.OKGREEN)
            current_index += 1
            
        # Sections
        for i in range(1, len(sections), 2):
            header = sections[i].strip()
            body = sections[i+1].strip() if i+1 < len(sections) else ""
            
            title_raw = header.replace('##', '').strip()
            safe_title = "".join([c if c.isalnum() or c in (' ', '-', '_') else '' for c in title_raw]).strip()
            safe_title = safe_title.replace(' ', '_')
            
            filename = f"{current_index:03d}_{safe_title}.md"
            filepath = backlog_dir / filename
            
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(f"{header}\n\n{body}\n")
            
            Colors.print(f"  + Created {filename}", Colors.OKGREEN)
            current_index += 1

# --- Portable Shell Commands ---

def setup_shell():
    """Setup portable PowerShell Core environment"""
    setup_script = ROOT_DIR / "scripts" / "setup_portable_shell.py"
    print("[*] Setting up portable PowerShell Core...")
    run_command([sys.executable, str(setup_script)])

def launch_shell():
    """Launch portable PowerShell Core"""
    pwsh_bat = ROOT_DIR / "scripts" / "pwsh.bat"
    
    if not pwsh_bat.exists():
        Colors.print("[!] Launcher not found. Running setup first...", Colors.WARNING)
        setup_shell()
    
    print("[*] Launching portable PowerShell...")
    if IS_WINDOWS:
        run_command([str(pwsh_bat)])
    else:
        Colors.print("[!] Portable shell is Windows-only", Colors.FAIL)

def deploy_worker(worker_name, *args):
    """Deploy a Cloudflare Worker"""
    deploy_script = ROOT_DIR / "scripts" / "deploy_worker.py"
    cmd = [sys.executable, str(deploy_script), worker_name] + list(args)
    run_command(cmd)

def set_worker_secret(worker_name, secret_name, secret_value=None):
    """Set a Cloudflare Worker secret"""
    deploy_script = ROOT_DIR / "scripts" / "deploy_worker.py"
    cmd = [sys.executable, str(deploy_script), "secret", worker_name, secret_name]
    if secret_value:
        cmd.append(secret_value)
    run_command(cmd)

def list_workers():
    """List available workers"""
    deploy_script = ROOT_DIR / "scripts" / "deploy_worker.py"
    run_command([sys.executable, str(deploy_script), "list"])

# --- Setup & Environment Dominance ---

def run_setup():
    """Aggregated setup for fresh environments"""
    print(f"\n{Colors.HEADER}=== Bifrost Universal Setup ==={Colors.ENDC}")
    
    # 1. Extract Certificates (if needed)
    print("\n[Step 1/4] Checking SSL Certificates...")
    if not (CERTS_DIR / "corporate_bundle.pem").exists():
        extract_certs()
    else:
        print("[*] Corporate bundle already exists. Use 'extract-certs' to force update.")

    # 2. Setup Portable PowerShell
    print("\n[Step 2/4] Setting up Portable PowerShell Core...")
    setup_shell()

    # 3. Setup Portable Node.js
    print("\n[Step 3/4] Setting up Portable Node.js...")
    setup_node_script = ROOT_DIR / "scripts" / "setup_portable_node.py"
    if setup_node_script.exists():
        run_command([sys.executable, str(setup_node_script)])
    else:
        Colors.print("[!] setup_portable_node.py not found!", Colors.WARNING)

    # 4. Record Global Paths
    print("\n[Step 4/4] Recording Global Tool Paths in Registry...")
    record_global_paths()

    print(f"\n{Colors.OKGREEN}Setup Complete!{Colors.ENDC}")
    print("[*] Please restart your terminal/VS Code to refresh environment variables.")
    print("[*] Or run: python scripts/bifrost.py refresh (in current shell)")

def record_global_paths():
    """Inject prioritized paths into User Registry"""
    if not IS_WINDOWS:
        return

    # Tools to prioritize
    node_dir = ROOT_DIR / ".tools" / "nodejs"
    pwsh_dir = ROOT_DIR / ".tools" / "pwsh"
    
    # Common AppData paths
    user_appdata = Path(os.environ.get("APPDATA", ""))
    user_local_appdata = Path(os.environ.get("LOCALAPPDATA", ""))
    
    python_dir = user_local_appdata / "Programs" / "Python" / "Python314"
    python_scripts = python_dir / "Scripts"
    git_dir = user_local_appdata / "Programs" / "Git" / "cmd"
    npm_dir = user_appdata / "npm"
    
    tools = [
        str(python_dir),
        str(python_scripts),
        str(git_dir),
        str(pwsh_dir),
        str(node_dir),
        str(npm_dir)
    ]
    
    # Use PowerShell to perform the Registry update safely
    ps_cmd = f'''
    $tools = @('{ "','".join(tools) }')
    $currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
    $entries = $currentPath -split ";" | Where-Object {{ $_ -and ($tools -notcontains $_) }}
    $newPath = (($tools + $entries) | Select-Object -Unique) -join ";"
    [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
    Set-ItemProperty -Path "HKCU:\\Environment" -Name "Path" -Type ExpandString -Value $newPath
    '''
    
    try:
        subprocess.run(["powershell", "-Command", ps_cmd], check=True)
        print("[*] User PATH updated and prioritized in Registry.")
    except Exception as e:
        Colors.print(f"[!] Failed to update Registry: {e}", Colors.FAIL)

def refresh_environment():
    """Force current process to reload Registry PATH (Dominance hack)"""
    if not IS_WINDOWS:
        return
        
    print("[*] Forcing environment dominance (Registry -> Process)...")
    ps_cmd = '''
    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    $machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
    $fullPath = "$userPath;$machinePath"
    [Environment]::SetEnvironmentVariable("Path", $fullPath, "Process")
    Write-Host "Process PATH refreshed. Tools check:"
    try { & node --version; & npx --version; & python --version } catch { Write-Host "Some tools still missing in current sub-context." }
    '''
    subprocess.run(["powershell", "-Command", ps_cmd])

def extract_certs():
    """Extract SSL certificates from corporate proxy"""
    extract_script = ROOT_DIR / "scripts" / "extract_certs.js"
    if not extract_script.exists():
        Colors.print(f"[!] extract_certs.js not found at {extract_script}", Colors.FAIL)
        return
    
    CERTS_DIR.mkdir(exist_ok=True)
    print("[*] Running certificate extraction...")
    # This requires node to be present. If it fails, we advise setup.
    try:
        run_command(["node", str(extract_script)])
    except Exception:
        Colors.print("[!] Node.js not found. Run 'python scripts/bifrost.py setup' first.", Colors.FAIL)

if __name__ == "__main__":
    # Ensure commands that need specific args are handled
    if len(sys.argv) > 1 and sys.argv[1] == "extract-certs":
        extract_certs()
    elif len(sys.argv) > 1 and sys.argv[1] in ["ask", "research"]:
         # Handle ask/research before main to avoid double load_env/set_certs
         load_env()
         set_node_certs()
         pass_through_cli(sys.argv[1], sys.argv[2:])
    else:
        main()
