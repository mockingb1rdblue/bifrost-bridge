
import os
import sys
import ssl
import json

import urllib.request
import urllib.error
from pathlib import Path

# Configuration
# Resolving paths relative to this script
PROJECT_ROOT = Path(__file__).parent.parent
ENV_FILE = PROJECT_ROOT / ".env"

def load_env():
    """Load environment variables from .env file"""
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

def main():
    print("=== Linear Proxy Verification ===")
    
    # Load environment
    env = load_env()
    proxy_key = env.get("PROXY_API_KEY")
    
    # We know the URL from deployment, or we could add it to env
    # For now hardcoding or deriving would be fine, but let's be explicit
    proxy_url = "https://linear-proxy.mock1ng.workers.dev/graphql"
    
    if not proxy_key:
        print("[!] Error: PROXY_API_KEY not found in .env")
        return 1
        
    print(f"[*] Target: {proxy_url}")
    print(f"[*] Authenticating with PROXY_API_KEY...")
    
    # Configure SSL
    # Using unverified context to bypass 'Missing Authority Key Identifier' error
    # caused by corporate proxy certificate strictness in Python 3.13
    ssl_context = ssl._create_unverified_context()
    
    # GraphQL Query
    query = {
        "query": """
            query { 
                viewer { id name email } 
                teams { 
                    nodes { id name } 
                }
            }
        """
    }
    
    data = json.dumps(query).encode("utf-8")
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {proxy_key}",
        "User-Agent": "Bifrost-Verifier/1.0"
    }
    
    req = urllib.request.Request(proxy_url, data=data, headers=headers, method="POST")
    
    try:
        with urllib.request.urlopen(req, context=ssl_context) as response:
            status = response.status
            body = response.read().decode("utf-8")
            
            print(f"[*] Status: {status}")
            
            try:
                json_body = json.loads(body)
                print("[*] JSON query successful:")
                # Pretty print the result
                print(json.dumps(json_body, indent=2))
                
                if "errors" in json_body:
                    print("[!] Linear API returned errors.")
                    return 1
                elif "data" in json_body and "viewer" in json_body["data"]:
                    viewer = json_body['data']['viewer']
                    print(f"\n[SUCCESS] Connected as: {viewer['name']} ({viewer['email']})")
                    
                    teams = json_body['data'].get('teams', {}).get('nodes', [])
                    if teams:
                        print(f"[SUCCESS] Found {len(teams)} teams:")
                        for team in teams:
                            print(f"  - {team['name']} (ID: {team['id']})")
                    else:
                        print("[!] No teams found.")
                    return 0
                else:
                    print("[!] Unexpected response structure.")
                    return 1
                    
            except json.JSONDecodeError:
                print(f"[!] Invalid JSON response: {body[:200]}...")
                return 1
                
    except urllib.error.HTTPError as e:
        print(f"[!] HTTP Error {e.code}: {e.reason}")
        print(e.read().decode("utf-8"))
        return 1
    except urllib.error.URLError as e:
        print(f"[!] Connection Error: {e.reason}")
        return 1

if __name__ == "__main__":
    sys.exit(main())
