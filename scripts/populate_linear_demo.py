
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
        "User-Agent": "Bifrost-Demo/1.0"
    }
    
    req = urllib.request.Request(PROXY_URL, data=data, headers=headers, method="POST")
    context = get_ssl_context()
    
    with urllib.request.urlopen(req, context=context) as response:
        body = response.read().decode("utf-8")
        return json.loads(body)

def generate_project_idea():
    """Use Perplexity (via bifrost.py) to generate project content"""
    print("[*] Asking Perplexity for a demo project idea...")
    
    prompt = """
    Generate a JSON object for a software demo project. 
    It should verify a 'Bifrost Bridge' system.
    Authentication is handled by 'bifrost.py'.
    
    Structure:
    {
        "name": "Project Name",
        "description": "Short description",
        "issues": [
            { "title": "Issue 1", "description": "Markdown description" },
            { "title": "Issue 2", "description": "Markdown description" },
            { "title": "Issue 3", "description": "Markdown description" }
        ]
    }
    Return ONLY JSON. No markdown formatting.
    """
    
    # We call bifrost.py ask to get the content
    # In a real scenario we'd use the SDK directly, but let's use the CLI for now
    # We need to strip standard output noise from bifrost.py
    
    cmd = [sys.executable, str(PROJECT_ROOT / "scripts" / "bifrost.py"), "ask", prompt]
    
    # Clean env for subprocess
    env = os.environ.copy()
    
    result = subprocess.run(cmd, capture_output=True, text=True, env=env)
    
    if result.returncode != 0:
        print(f"[!] Perplexity generation failed: {result.stderr}")
        return None
        
    # extract JSON from output
    output = result.stdout
    # Heuristic to find JSON start/end
    try:
        start = output.find('{')
        end = output.rfind('}') + 1
        if start == -1 or end == 0:
            raise ValueError("No JSON found")
            
        json_str = output[start:end]
        return json.loads(json_str)
    except Exception as e:
        print(f"[!] Failed to parse Perplexity output: {e}")
        print(f"Output was: {output}")
        return None

def main():
    print("=== Bifrost Linear Demo Generator ===")
    
    # 1. Get Team ID
    print("[*] Fetching Linear Team ID...")
    team_query = "{ teams { nodes { id name } } }"
    res = graphql_request(team_query)
    teams = res.get('data', {}).get('teams', {}).get('nodes', [])
    
    if not teams:
        print("[!] No teams found in Linear.")
        return 1
        
    team = teams[0]
    print(f"[*] Using Team: {team['name']} ({team['id']})")
    
    # 2. Generate Content
    project_data = generate_project_idea()
    if not project_data:
        # Fallback data if API fails to avoid blocking the demo
        print("[!] Using fallback project data due to generation failure")
        project_data = {
            "name": "Bifrost Connectivity Check",
            "description": "Automated connectivity verification project",
            "issues": [
                {"title": "Verify SSL Handshake", "description": "Ensure corporate certificate bundle is loaded"},
                {"title": "Test GQL Mutation", "description": "Verify ability to create issues via proxy"}
            ]
        }
        
    print(f"[*] Generated Project: {project_data['name']}")
    
    # 3. Create Project
    print("[*] Creating Project in Linear...")
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
            "name": project_data['name'],
            "description": project_data['description']
        }
    }
    
    res = graphql_request(create_project_mutation, project_variables)
    if 'errors' in res:
        print(f"[!] Failed to create project: {res['errors']}")
        return 1
        
    project = res['data']['projectCreate']['project']
    print(f"[SUCCESS] Created Project: {project['name']} ({project['id']})")
    
    # 4. Create Issues
    print("[*] Creating Issues...")
    create_issue_mutation = """
    mutation IssueCreate($input: IssueCreateInput!) {
        issueCreate(input: $input) {
            success
            issue { id title url }
        }
    }
    """
    
    for issue in project_data['issues']:
        variables = {
            "input": {
                "teamId": team['id'],
                "projectId": project['id'],
                "title": issue['title'],
                "description": issue['description']
            }
        }
        
        iex_res = graphql_request(create_issue_mutation, variables)
        if 'errors' in iex_res:
             print(f"[!] Failed to create issue '{issue['title']}': {iex_res['errors']}")
        else:
            new_issue = iex_res['data']['issueCreate']['issue']
            print(f"  + Created: {new_issue['title']} ({new_issue.get('url', new_issue['id'])})")
            
    print("\n[SUCCESS] Demo population complete!")
    return 0

if __name__ == "__main__":
    sys.exit(main())
