import sys
import os
import json
import subprocess
import time
from pathlib import Path

# Setup paths
SCRIPT_DIR = Path(__file__).parent
ROOT_DIR = SCRIPT_DIR.parent
BIFROST_SCRIPT = SCRIPT_DIR / "bifrost.py"

def load_file(path):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            return f.read()
    except Exception:
        return ""

def load_env_to_dict(env_dict):
    """Load .env file into the provided dictionary"""
    env_file = ROOT_DIR / ".env"
    if env_file.exists():
        with open(env_file, "r") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    k, v = line.split("=", 1)
                    # Simple unquote
                    v = v.strip().strip("'").strip('"')
                    env_dict[k.strip()] = v

def set_node_certs(env):
    # Mimic bifrost.py cert logic
    cert_path = ROOT_DIR / ".certs" / "nutrien_root_ca.pem"
    if cert_path.exists():
        env["NODE_EXTRA_CA_CERTS"] = str(cert_path)

def run_bifrost_json(command, query):
    """Run bifrost command with --json and return parsed response"""
    # Use bifrost.py run wrapper to ensure environment is set up correctly (SSL, etc)
    cli_js = ROOT_DIR / "dist" / "src" / "cli.js"
    cmd = [sys.executable, str(BIFROST_SCRIPT), "run", "node", str(cli_js), command, "--json", query]
    
    # We don't need to pass env manually, bifrost.py handles it
    print(f"[*] Running: bifrost run node cli.js {command}...")
    
    try:
        # Capture output
        result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8')
    except Exception as e:
        print(f"[!] Subprocess failed: {e}")
        return None
    
    if result.returncode != 0:
        print(f"[!] Command failed (Exit {result.returncode}):")
        # print(f"Stderr: {result.stderr}") 
        # bifrost logs to stdout mostly due to structure, but check stderr too
        return None
        
    output = result.stdout
    # Filter out bifrost.py logs (lines starting with [*], [$], [!])
    lines = output.splitlines()
    clean_lines = []
    for line in lines:
        s = line.strip()
        if s.startswith("[*]") or s.startswith("[$]") or s.startswith("[!]"):
            continue
        clean_lines.append(line)
    
    clean_output = "\n".join(clean_lines)
    
    # Try to find the JSON start/end in clean output
    try:
        start = clean_output.find('{')
        end = clean_output.rfind('}') + 1
        if start == -1 or end == 0:
            print("[!] No JSON found in output")
            # print("Output was:", output)
            return None
            
        json_str = clean_output[start:end]
        data = json.loads(json_str)
        return data
    except json.JSONDecodeError as e:
        print(f"[!] JSON Decode Error: {e}")
        print("Output snippet:", output[:200])
        return None

def main():
    print("=== Bifrost Strategic Audit ===")
    
    # 1. Gather Context
    print("[*] Gathering Project Context...")
    package_json = load_file(ROOT_DIR / "package.json")
    tsconfig = load_file(ROOT_DIR / "tsconfig.json")
    bifrost_py = load_file(ROOT_DIR / "scripts" / "bifrost.py")
    
    # Summarize bifrost.py (too big)
    bifrost_summary = "\n".join([line for line in bifrost_py.splitlines() if "def " in line or "class " in line][:50])

    context = f"""
    Project: Bifrost Bridge (TypeScript SDK + Python Runner)
    
    package.json:
    {package_json}
    
    tsconfig.json:
    {tsconfig}
    
    Structure (bifrost.py functions):
    {bifrost_summary}
    """
    
    # 2. Ask Perplexity for Audit
    print("[*] asking Perplexity for Audit & Tech Debt analysis...")
    prompt = (
        f"Analyze this project context and valid Cloudflare Worker/TypeScript best practices. "
        f"Identify technical debt, security hardening opportunities, and performance optimizations. "
        f"Goal: Eliminate 98% of tech debt. "
        f"Return a valid JSON object with a list of tasks. "
        f"Format: {{ \"tasks\": [ {{ \"title\": \"...\", \"description\": \"...\", \"priority\": \"High|Medium\" }} ] }}. "
        f"Context: {context}"
    )
    
    # We strip newlines from prompt to be safe, though variadic args handle it now.
    prompt_flat = " ".join(prompt.split())
    
    data = run_bifrost_json("ask", prompt_flat)
    
    if not data:
        print("[!] Audit failed. Aborting.")
        return

    # The data returned by --json is the PerplexityResponse object.
    # content is in .choices[0].message.content
    try:
        content = data['choices'][0]['message']['content']
        # Content itself should be JSON string because we asked for it.
        # But it might be wrapped in ```json ... ```
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0]
        elif "```" in content:
             content = content.split("```")[1].split("```")[0]
             
        audit_tasks = json.loads(content)
        tasks = audit_tasks.get('tasks', [])
    except Exception as e:
        print(f"[!] Failed to parse inner JSON from answer: {e}")
        # print(data)
        return

    print(f"[*] Identified {len(tasks)} Strategic Tasks.")
    for t in tasks:
        print(f"  - [{t.get('priority')}] {t.get('title')}")
        
    # 3. Create Linear Project
    print("[*] Creating Linear Project: Bifrost Strategic Hardening...")
    
    # helper for linear requests
    import ssl
    import urllib.request
    import urllib.error
    
    ENV_FILE = ROOT_DIR / ".env"
    env_vars = {}
    if ENV_FILE.exists():
        with open(ENV_FILE, "r") as f:
            for line in f:
                if "=" in line and not line.strip().startswith("#"):
                    k, v = line.strip().split("=", 1)
                    env_vars[k.strip()] = v.strip().strip('"').strip("'")
    
    proxy_key = env_vars.get("PROXY_API_KEY")
    if not proxy_key:
        print("[!] No PROXY_API_KEY found. cannot create issues.")
        return

    proxy_url = "https://linear-proxy.mock1ng.workers.dev/graphql"
    ssl_ctx = ssl._create_unverified_context()
    
    def q(query, variables=None):
        payload = {"query": query}
        if variables:
            payload["variables"] = variables
        
        req = urllib.request.Request(
            proxy_url, 
            data=json.dumps(payload).encode('utf-8'),
            headers={
                "Content-Type": "application/json", 
                "Authorization": f"Bearer {proxy_key}",
                "User-Agent": "Bifrost-Audit"
            },
            method="POST"
        )
        try:
            with urllib.request.urlopen(req, context=ssl_ctx) as res:
                return json.loads(res.read().decode('utf-8'))
        except Exception as e:
            print(f"[!] Request failed: {e}")
            return None

    # Get Team
    print("[*] Fetching Team ID...")
    viewer_res = q("query { teams { nodes { id name } } }")
    if not viewer_res or 'data' not in viewer_res:
        print("[!] Failed to fetch teams")
        return
        
    teams = viewer_res['data']['teams']['nodes']
    team_id = teams[0]['id'] # Default to first team
    print(f"[*] Using Team: {teams[0]['name']} ({team_id})")
    
    # Create Project
    create_proj_mut = """
    mutation ProjectCreate($input: ProjectCreateInput!) {
        projectCreate(input: $input) {
            project { id name }
            success
        }
    }
    """
    
    proj_res = q(create_proj_mut, {
        "input": {
            "name": "Bifrost Strategic Hardening",
            "description": "Tasks identified by Perplexity strategic audit for hardening and tech debt elimination.",
            "teamIds": [team_id]
        }
    })
    
    if not proj_res or 'errors' in proj_res:
        print(f"[!] Project creation failed: {proj_res}")
        return
        
    project_id = proj_res['data']['projectCreate']['project']['id']
    print(f"[SUCCESS] Created Project: {project_id}")
    
    # Create Issues
    create_issue_mut = """
    mutation IssueCreate($input: IssueCreateInput!) {
        issueCreate(input: $input) {
            issue { id identifier url }
            success
        }
    }
    """
    
    print(f"[*] Creating {len(tasks)} issues...")
    for task in tasks:
        title = task.get('title', 'Untitled')
        desc = task.get('description', '')
        priority_label = task.get('priority', 'Medium')
        
        # Map priority to Linear priority (0=No Priority, 1=Urgent, 2=High, 3=Medium, 4=Low)
        # We'll just put it in the description or title for now as mapping is complex without ID knowing
        
        full_desc = f"{desc}\n\n**Priority**: {priority_label}\n**Source**: Perplexity Strategic Audit"
        
        ires = q(create_issue_mut, {
            "input": {
                "teamId": team_id,
                "projectId": project_id,
                "title": title,
                "description": full_desc
            }
        })
        
        if ires and 'data' in ires and ires['data']['issueCreate']['success']:
            issue = ires['data']['issueCreate']['issue']
            print(f"  + Created: {title} ({issue['url']})")
        else:
            print(f"  ! Failed to create: {title} - {ires}")
            
    print("\n[SUCCESS] Audit & Handover Complete.")

if __name__ == "__main__":
    main()
