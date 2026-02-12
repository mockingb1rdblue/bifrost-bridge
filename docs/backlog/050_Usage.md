## Usage

- Research: `npm run research "your query"`
- Chat: `npm run chat`
- Stream: `npm run chat:stream`

````

### 5.2 **NPX-Friendly CLI Tool**
```json
// package.json
{
  "name": "@your-org/perplexity-research",
  "bin": {
    "pplx-research": "./dist/cli.js"
  },
  "scripts": {
    "build": "tsup src/cli.ts --format esm",
    "dev": "tsup src/cli.ts --format esm --watch"
  }
}
````

Usage: `npx @your-org/perplexity-research "latest AI developments"`

---
