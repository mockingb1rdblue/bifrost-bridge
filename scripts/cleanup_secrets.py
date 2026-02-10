import os

REPLACEMENTS = {
    '<YOUR_LINEAR_API_KEY>': '<YOUR_LINEAR_API_KEY>',
    '<YOUR_LINEAR_WEBHOOK_SECRET>': '<YOUR_LINEAR_WEBHOOK_SECRET>'
}

FILES = [
    'workers/linear-proxy/README.md',
    'workers/linear-proxy/DEPLOY.md',
    'README.md'
]

def scrub():
    for rel_path in FILES:
        if os.path.exists(rel_path):
            with open(rel_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            new_content = content
            for old, new in REPLACEMENTS.items():
                new_content = new_content.replace(old, new)
            
            if new_content != content:
                with open(rel_path, 'w', encoding='utf-8') as f:
                    f.write(new_content)
                print(f"Scrubbed {rel_path}")
            else:
                print(f"No secrets found in {rel_path}")

if __name__ == '__main__':
    scrub()
