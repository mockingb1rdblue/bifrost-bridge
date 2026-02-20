#!/bin/bash

# Array of core technologies used in the Sluagh Swarm stack
TARGETS=(
  "Linear GraphQL API"
  "Cloudflare Workers Developer Docs"
  "Fly.io Machines API and Docs"
  "Google Gemini API Docs"
  "DeepSeek API Docs"
  "Perplexity API Docs"
  "Cloudflare D1"
  "Cloudflare Vectorize"
  "better-sqlite3 Node.js"
  "sqlite-vec vector extension"
)

echo "Queueing batch sitemap discovery for ${#TARGETS[@]} core stack technologies..."

for TARGET in "${TARGETS[@]}"; do
  echo "----------------------------------------------------"
  echo "Discovering: $TARGET"
  npm run secure:exec scripts/library/1-discover-urls.ts "$TARGET"
  sleep 3 # Add slight delay to respect Perplexity rate limits
done

echo "Batch discovery complete."
