#!/usr/bin/env pwsh
# Create all 38 Fly.io migration issues in Linear
# Project: Bifrost v3 (1c5d02ad-c00a-4a3b-9a08-9223d65a821d)

$PROJECT_ID = "1c5d02ad-c00a-4a3b-9a08-9223d65a821d"

# Infrastructure Setup (FLY-001 to FLY-004)
npm start -- linear create-issue --title "[FLY-001] Initialize Fly.io Account & CLI" --description "**Priority**: P1 | **Estimate**: 15 min`n`n**Task**: Install flyctl, authenticate, verify access`n`n**Acceptance Criteria**:`n- flyctl auth whoami returns valid user`n- CLI version >= 0.2.0`n`n**Steps**:`n1. Run curl -L https://fly.io/install.sh | sh`n2. Run flyctl auth login`n3. Verify with flyctl auth whoami" --project $PROJECT_ID

npm start -- linear create-issue --title "[FLY-002] Create bifrost-runner App Scaffold" --description "**Priority**: P1 | **Estimate**: 10 min`n`n**Task**: Initialize Fly.io app for agent runners`n`n**Acceptance Criteria**:`n- App visible in flyctl apps list`n- Initial fly.toml created`n`n**Steps**:`n1. Run flyctl apps create bifrost-runner`n2. Verify app creation`n`n**Dependencies**: FLY-001" --project $PROJECT_ID

npm start -- linear create-issue --title "[FLY-003] Create bifrost-events App Scaffold" --description "**Priority**: P1 | **Estimate**: 10 min`n`n**Task**: Initialize Fly.io app for event store`n`n**Acceptance Criteria**:`n- App visible in dashboard`n- Initial fly.toml created`n`n**Dependencies**: FLY-001" --project $PROJECT_ID

npm start -- linear create-issue --title "[FLY-004] Configure WireGuard Private Network" --description "**Priority**: P1 | **Estimate**: 20 min`n`n**Task**: Set up 6PN secure access to Fly.io`n`n**Acceptance Criteria**:`n- Can ping Fly.io internal DNS`n- WireGuard config saved`n`n**Steps**:`n1. Run flyctl wireguard create`n2. Save config to .fly/wireguard.conf`n3. Test connectivity`n`n**Dependencies**: FLY-001" --project $PROJECT_ID

Write-Host "Created infrastructure issues (FLY-001 to FLY-004)" -ForegroundColor Green
