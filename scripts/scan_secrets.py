import os
import re
import sys

# Define patterns for common secrets
SECRET_PATTERNS = {
    'Cloudflare API Token': r'CLOUDFLARE_API_TOKEN=[a-zA-Z0-9_-]{40}',
    'Linear API Key': r'lin_api_[a-zA-Z0-9]{40}',
    'Linear Webhook Secret': r'lin_wh_[a-zA-Z0-9]{40}',
    'Generic API Key': r'api[_-]?key[:=]\s*["\']?[a-zA-Z0-9]{32,64}["\']?',
}

EXCLUDE_DIRS = {'.git', 'node_modules', '.tools', '.certs', 'dist'}
EXCLUDE_FILES = {'scan_secrets.py', 'package-lock.json'}

def scan_file(file_path):
    findings = []
    try:
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
            for name, pattern in SECRET_PATTERNS.items():
                matches = re.finditer(pattern, content)
                for match in matches:
                    line_no = content.count('\n', 0, match.start()) + 1
                    findings.append((line_no, name))
    except Exception as e:
        pass
    return findings

def main():
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    exit_code = 0
    
    print(f"Scanning for secrets in {root_dir}...")
    
    for root, dirs, files in os.walk(root_dir):
        # Skip excluded directories
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
        
        for file in files:
            if file in EXCLUDE_FILES:
                continue
                
            file_path = os.path.join(root, file)
            rel_path = os.path.relpath(file_path, root_dir)
            
            findings = scan_file(file_path)
            if findings:
                for line_no, secret_name in findings:
                    print(f"CRITICAL: Found {secret_name} in {rel_path} at line {line_no}")
                exit_code = 1

    if exit_code == 0:
        print("SUCCESS: No secrets found.")
    else:
        print("\nFAILURE: Secrets detected! Please remove them before committing.")
        
    sys.exit(exit_code)

if __name__ == '__main__':
    main()
