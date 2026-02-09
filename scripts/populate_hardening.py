
import os
import sys
import ssl
import json
import urllib.request
import urllib.error
import subprocess
from pathlib import Path

# Configuration
PROJECT_ROOT = Path(__file__).parent.parent
ENV_FILE = PROJECT_ROOT / ".env"
PROXY_URL = "https://linear-proxy.mock1ng.workers.dev/graphql"

def load_env():
    """Load environment variables"""
    env_vars = {}
    if ENV_FILE.exists():
        with open(ENV_FILE, "r") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#"):
                    parts = line.split("=", 1)
                    if len(parts) == 2:
                        key, value = parts
                        env_vars[key.strip()] = value.strip().strip('"').strip("'")
    return env_vars

def get_ssl_context():
    """Create unverified SSL context to bypass corporate proxy issues"""
    return ssl._create_unverified_context()

def graphql_request(query, variables=None):
    """Make GraphQL request to Linear Proxy"""
    env = load_env()
    proxy_key = env.get("PROXY_API_KEY")
    
    if not proxy_key:
        raise ValueError("PROXY_API_KEY not found in .env")

    payload = {"query": query}
    if variables:
        payload["variables"] = variables
        
    data = json.dumps(payload).encode("utf-8")
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {proxy_key}",
        "User-Agent": "Bifrost-Hardening/1.0"
    }
    
    req = urllib.request.Request(PROXY_URL, data=data, headers=headers, method="POST")
    context = get_ssl_context()
    
    with urllib.request.urlopen(req, context=context) as response:
        body = response.read().decode("utf-8")
        return json.loads(body)

def generate_hardening_issues():
    """Use Perplexity (via bifrost.py) to generate hardening issues"""
    print("[*] Asking Perplexity for hardening issues...")
    
    prompt = (
        "Generate a JSON object containing a list of software hardening and optimization tasks. "
        "Context: A project named 'Bifrost Bridge' which is a TypeScript SDK and CLI tool connecting corporate environments to AI services via Cloudflare Worker proxies. "
        "Focus on: Security, Performance, Error Handling, and Type Safety. "
        "Structure: { \"issues\": [ { \"title\": \"Task Title\", \"description\": \"Markdown description\" } ] }. "
        "Return ONLY valid JSON."
    )
    
    cmd = [sys.executable, str(PROJECT_ROOT / "scripts" / "bifrost.py"), "ask", prompt]
    
    # Clean env for subprocess
    env = os.environ.copy()
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, env=env, encoding='utf-8')
    except Exception as e:
        print(f"[!] Subprocess failed: {e}")
        return None
    
    if result.returncode != 0:
        print(f"[!] Perplexity generation failed: {result.stderr}")
        print(f"Stdout: {result.stdout}")
        return None
        
    # extract JSON from output
    output = result.stdout
    try:
        start = output.find('{')
        end = output.rfind('}') + 1
        if start == -1 or end == 0:
            raise ValueError("No JSON found")
            
        json_str = output[start:end]
        return json.loads(json_str)
    except Exception as e:
        print(f"[!] Failed to parse Perplexity output: {e}")
        # print(f"Output was: {output}") # verbose
        return None

def main():
    print("=== Bifrost Hardening Issue Generator ===")
    
    # 1. Get Team ID
    print("[*] Fetching Linear Team ID...")
    team_query = "{ teams { nodes { id name } } }"
    try:
        res = graphql_request(team_query)
        teams = res.get('data', {}).get('teams', {}).get('nodes', [])
    except Exception as e:
        print(f"[!] Connection failed: {e}")
        return 1
    
    if not teams:
        print("[!] No teams found in Linear.")
        return 1
        
    team = teams[0]
    print(f"[*] Using Team: {team['name']} ({team['id']})")
    
    # 2. Generate Content
    data = generate_hardening_issues()
    if not data or 'issues' not in data:
        print("[!] Using fallback data due to generation failure")
        data = {
            "issues": [
                {"title": "Implement Rate Limiting", "description": "Add token bucket rate limiting to Cloudflare Workers"},
                {"title": "Strict TypeScript Config", "description": "Enable strict:true in tsconfig.json and fix errors"},
                {"title": "Audit Dependencies", "description": "Run npm audit and fix vulnerabilities"}
            ]
        }
    
    # 3. Create Hardening Project
    print("[*] Creating 'Bifrost Hardening' Project...")
    create_project_mutation = """
    mutation ProjectCreate($input: ProjectCreateInput!) {
        projectCreate(input: $input) {
            success
            project { id name }
        }
    }
    """
    
    project_variables = {
        "input": {
            "teamIds": [team['id']],
            "name": "Bifrost Hardening (AI)",
            "description": "Generated tasks for hardening and optimizing the bridge."
        }
    }
    
    res = graphql_request(create_project_mutation, project_variables)
    if 'errors' in res:
        print(f"[!] Failed to create project: {res['errors']}")
        return 1
        
    project = res['data']['projectCreate']['project']
    print(f"[SUCCESS] Created Project: {project['name']} ({project['id']})")
    
    # 4. Create Issues
    print(f"[*] Creating {len(data['issues'])} Issues...")
    create_issue_mutation = """
    mutation IssueCreate($input: IssueCreateInput!) {
        issueCreate(input: $input) {
            success
            issue { id title url }
        }
    }
    """
    
    for issue in data['issues']:
        variables = {
            "input": {
                "teamId": team['id'],
                "projectId": project['id'],
                "title": issue['title'],
                "description": issue['description'],
                "priority": 0 # No priority
            }
        }
        
        iex_res = graphql_request(create_issue_mutation, variables)
        if 'errors' in iex_res:
             print(f"[!] Failed to create issue '{issue['title']}': {iex_res['errors']}")
        else:
            new_issue = iex_res['data']['issueCreate']['issue']
            print(f"  + Created: {new_issue['title']} ({new_issue.get('url', new_issue['id'])})")
            
    print("\n[SUCCESS] Hardening population complete!")
    return 0

if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\n[!] Aborted")
        sys.exit(1)
