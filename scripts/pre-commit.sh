#!/bin/sh
# Pre-commit hook to scan for secrets
python scripts/scan_secrets.py
if [ $? -ne 0 ]; then
    echo "Commit blocked: Secrets detected."
    exit 1
fi
