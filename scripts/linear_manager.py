import os
import sys
import json
import urllib.request
import urllib.parse
import ssl
from pathlib import Path

# Setup paths
ROOT_DIR = Path(__file__).parent.parent
ENV_FILE = ROOT_DIR / ".env"

def load_env():
    env = {}
    if ENV_FILE.exists():
        with open(ENV_FILE, "r") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"): continue
                if "=" in line:
                    k, v = line.split("=", 1)
                    env[k.strip()] = v.strip().strip("'").strip('"')
    return env

ENV = load_env()
PROXY_URL = "https://linear-proxy.mock1ng.workers.dev/graphql"
PROXY_KEY = ENV.get("PROXY_API_KEY")

if not PROXY_KEY:
    print("Error: PROXY_API_KEY not found in .env")
    sys.exit(1)

def graphql_query(query, variables=None):
    data = {"query": query, "variables": variables or {}}
    json_data = json.dumps(data).encode("utf-8")
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {PROXY_KEY}",
        "User-Agent": "Bifrost-Manager/1.0"
    }
    
    # Unverified context for corporate proxy if needed (bifrost handles certs usually, but python direct needs help or cert path)
    # We'll try to find the cert from bifrost logic
    ctx = ssl.create_default_context()
    cert_path = ROOT_DIR / ".certs" / "nutrien_root_ca.pem"
    if cert_path.exists():
        ctx.load_verify_locations(cert_path)
    else:
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE

    req = urllib.request.Request(PROXY_URL, data=json_data, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, context=ctx) as res:
            return json.loads(res.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        print(f"Request failed: {e}")
        print(e.read().decode("utf-8"))
        return None
    except Exception as e:
        print(f"Request failed: {e}")
        return None

def list_projects(match="Bifrost"):
    query = """
    query {
        projects(first: 50) {
            nodes {
                id
                name
                description
                state
            }
        }
    }
    """
    result = graphql_query(query)
    if not result or 'data' not in result:
        print("Failed to fetch projects")
        if result and 'errors' in result:
             print("Errors:", result['errors'])
        return

    projects = result['data']['projects']['nodes']
    print(f"\nFound {len(projects)} projects:")
    print("-" * 80)
    print(f"{'ID':<38} | {'Name':<30} | {'State'}")
    print("-" * 80)
    
    matches = []
    for p in projects:
        if match.lower() in p['name'].lower():
            print(f"{p['id']:<38} | {p['name']:<30} | {p['state']}")
            matches.append(p)
            
    return matches

def merge_projects(target_id, source_ids):
    print(f"[*] Merging sources {source_ids} into target {target_id}...")
    
    for source_id in source_ids:
        # 1. Fetch Issues
        print(f"[*] Fetching issues from source {source_id}...")
        query = """
        query($projectId: String!) {
            project(id: $projectId) {
                name
                issues(first: 100) {
                    nodes {
                        id
                        title
                    }
                }
            }
        }
        """
        res = graphql_query(query, {"projectId": source_id})
        if not res or 'data' not in res or not res['data']['project']:
            print(f"[!] Could not find source project {source_id}")
            continue
            
        project_name = res['data']['project']['name']
        issues = res['data']['project']['issues']['nodes']
        print(f"[*] Found {len(issues)} issues in '{project_name}'")
        
        # 2. Move Issues
        for issue in issues:
            print(f"  -> Moving '{issue['title']}'...")
            mutation = """
            mutation($issueId: String!, $projectId: String!) {
                issueUpdate(id: $issueId, input: { projectId: $projectId }) {
                    success
                    issue { id }
                }
            }
            """
            m_res = graphql_query(mutation, {"issueId": issue['id'], "projectId": target_id})
            if not m_res or 'data' not in m_res or not m_res['data']['issueUpdate']['success']:
                 print(f"  [!] Failed to move issue {issue['id']}")

        # 3. Delete Project
        print(f"[*] Deleting empty project '{project_name}' ({source_id})...")
        del_mutation = """
        mutation($projectId: String!) {
            projectDelete(id: $projectId) {
                success
            }
        }
        """
        d_res = graphql_query(del_mutation, {"projectId": source_id})
        if d_res and 'data' in d_res and d_res['data']['projectDelete']['success']:
            print("  [+] Deleted successfully.")
        else:
             print("  [!] Failed to delete project.")

def create_project(name, description=""):
    print(f"[*] Creating project '{name}'...")
    mutation = """
    mutation($name: String!, $description: String, $teamId: String!) {
        projectCreate(input: { name: $name, description: $description, teamIds: [$teamId] }) {
            success
            project {
                id
                name
            }
        }
    }
    """
    # Note: teamId is hardcoded above, typically you'd query teams first.
    # I'll fetch the first team ID dynamically to be safe.
    
    # 1. Fetch Team ID
    t_query = "{ teams { nodes { id } } }"
    t_res = graphql_query(t_query)
    if not t_res or 'data' not in t_res:
        print("[!] Failed to fetch teams")
        return
        
    teams = t_res['data']['teams']['nodes']
    if not teams:
        print("[!] No teams found")
        return
    
    team_id = teams[0]['id']
    
    # 2. Create Project
    res = graphql_query(mutation, 
                       {"name": name, "description": description, "teamId": team_id})
                       
    if res and 'data' in res and res['data']['projectCreate']['success']:
        p = res['data']['projectCreate']['project']
        print(f"[+] Created Project: {p['name']} ({p['id']})")
        return p['id']
    else:
        print(f"[!] Failed to create project: {res}")
        return None

def list_issues(project_id):
    query = """
    query($projectId: String!) {
        project(id: $projectId) {
            name
            issues(first: 100) {
                nodes {
                    id
                    title
                    priority
                    state { name }
                }
            }
        }
    }
    """
    res = graphql_query(query, {"projectId": project_id})
    if not res or 'data' not in res or not res['data']['project']:
        print(f"[!] Could not find project {project_id}")
        return

    proj = res['data']['project']
    issues = proj['issues']['nodes']
    
    print(f"\nIssues in '{proj['name']}' ({len(issues)}):")
    print("-" * 100)
    print(f"{'ID':<38} | {'Priority':<8} | {'State':<12} | {'Title'}")
    print("-" * 100)
    
    for i in issues:
        prio = str(i['priority'])
        state = i['state']['name'] if i['state'] else "Unknown"
        print(f"{i['id']:<38} | {prio:<8} | {state:<12} | {i['title']}")
    
    return issues

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command")
    
    list_parser = subparsers.add_parser("list")
    list_parser.add_argument("--match", default="Bifrost", help="Filter by name")
    
    merge_parser = subparsers.add_parser("merge")
    merge_parser.add_argument("--target", required=True, help="Target Project ID")
    merge_parser.add_argument("--sources", required=True, help="Comma-separated Source Project IDs")
    
    create_parser = subparsers.add_parser("create")
    create_parser.add_argument("--name", required=True, help="Project Name")
    create_parser.add_argument("--desc", default="", help="Description")
    
    issues_parser = subparsers.add_parser("issues")
    issues_parser.add_argument("--project", required=True, help="Project ID")


def dedupe_issues(project_id):
    issues = list_issues(project_id)
    if not issues: return
    
    seen = {}
    duplicates = []
    
    print("\n[*] Checking for duplicates...")
    for i in issues:
        title = i['title']
        if title in seen:
            duplicates.append(i)
        else:
            seen[title] = i
            
    if not duplicates:
        print("[*] No duplicates found.")
        return
        
    print(f"[*] Found {len(duplicates)} duplicates. Deleting...")
    for i in duplicates:
        print(f"  -> Deleting '{i['title']}' ({i['id']})...")
        mutation = """
        mutation($issueId: String!) {
            issueDelete(id: $issueId) {
                success
            }
        }
        """
        res = graphql_query(mutation, {"issueId": i['id']})
        if res and 'data' in res and res['data']['issueDelete']['success']:
            print("     [+] Deleted.")
        else:
            print("     [!] Failed to delete.")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command")
    
    list_parser = subparsers.add_parser("list")
    list_parser.add_argument("--match", default="Bifrost", help="Filter by name")
    
    merge_parser = subparsers.add_parser("merge")
    merge_parser.add_argument("--target", required=True, help="Target Project ID")
    merge_parser.add_argument("--sources", required=True, help="Comma-separated Source Project IDs")
    
    create_parser = subparsers.add_parser("create")
    create_parser.add_argument("--name", required=True, help="Project Name")
    create_parser.add_argument("--desc", default="", help="Description")
    
    issues_parser = subparsers.add_parser("issues")
    issues_parser.add_argument("--project", required=True, help="Project ID")
    
    dedupe_parser = subparsers.add_parser("dedupe")
    dedupe_parser.add_argument("--project", required=True, help="Project ID")
    
    args = parser.parse_args()
    
    if args.command == "list":
        list_projects(args.match)
    elif args.command == "merge":
        sources = [s.strip() for s in args.sources.split(",")]
        merge_projects(args.target, sources)
    elif args.command == "create":
        create_project(args.name, args.desc)
    elif args.command == "issues":
        list_issues(args.project)
    elif args.command == "dedupe":
        dedupe_issues(args.project)
    else:
        parser.print_help()
