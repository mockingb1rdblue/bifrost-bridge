# Chrome Automation Specification

> [!IMPORTANT]
> **Status**: Ready for Use
> **Phase**: 6 (Audit & Refactor)
> **Source**: Refactored from `046_Revolutionary_Capabilities...`

## Overview

Antigravity Agents have native access to a headless Chrome instance via Chrome DevTools Protocol (CDP). This allows for "Visual Implementation" patterns that bypass complex manual scripting.

## Capabilities

### 1. Certificate Extraction

Instead of writing OpenSSL scripts, simply ask the agent:

> "Navigate to https://mcp.linear.app, extract the SSL certificate chain from the Security panel, and save it as linear-cert.pem"

### 2. Network Testing (Corporate Bypass)

Reliably test connectivity from the deployment environment:

> "Test connection to https://api.openai.com and capture any SSL handshake errors or firewall blocks."

### 3. Visual Verification

Render and verify UI components without a full QA team:

> "Render the citations as a webpage, open in Chrome, and click each link to verify it loads."

### 4. Zero-Config Scraping

> "Browse the internal IT policy site, scroll through the 'Network Restrictions' page, and extract the list of blocked ports."

## usage Strategy

- **Prefer Agentic Browsing** over complex `curl`/`wget` scripts for one-off tasks.
- **Use for debugging** elusive SSL/Network issues ("Show me what the browser sees").
