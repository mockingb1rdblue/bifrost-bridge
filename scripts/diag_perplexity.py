import os
import urllib.request
import json
import ssl
from pathlib import Path

# Load absolute path to .env
ROOT_DIR = Path(__file__).parent.parent.absolute()
ENV_FILE = ROOT_DIR / ".env"
CERTS_DIR = ROOT_DIR / ".certs"

def load_env():
    if not ENV_FILE.exists():
        print("No .env found")
        return
    with open(ENV_FILE, "r") as f:
        for line in f:
            if "=" in line and not line.startswith("#"):
                k, v = line.split("=", 1)
                os.environ[k.strip()] = v.strip()

load_env()

api_key = os.environ.get("PERPLEXITY_API_KEY")
if not api_key:
    print("Error: PERPLEXITY_API_KEY not found in .env")
    exit(1)

cert_path = CERTS_DIR / "corporate_bundle.pem"

print(f"Testing direct Perplexity API with key: {api_key[:10]}...")

url = "https://api.perplexity.ai/chat/completions"
data = json.dumps({
    "model": "sonar",
    "messages": [
        {"role": "system", "content": "Be precise."},
        {"role": "user", "content": "Hello"}
    ]
}).encode("utf-8")

req = urllib.request.Request(url, data=data, method="POST")
req.add_header("Authorization", f"Bearer {api_key}")
req.add_header("Content-Type", "application/json")

ctx = ssl.create_default_context()
if cert_path.exists():
    print(f"Using certs: {cert_path}")
    ctx.load_verify_locations(str(cert_path))

try:
    with urllib.request.urlopen(req, context=ctx, timeout=10) as resp:
        print(f"Success! Status: {resp.status}")
        print(resp.read().decode())
except Exception as e:
    print(f"Failed: {e}")
    # Only HTTPError has read(), generic Exception doesn't
    if hasattr(e, 'read') and callable(getattr(e, 'read')):
        try:
            print(e.read().decode())
        except:
            pass
