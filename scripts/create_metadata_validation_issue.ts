import { LinearClient } from '../src/linear-client';
import * as dotenv from 'dotenv';

dotenv.config();

const client = new LinearClient(process.env.LINEAR_API_KEY!, 'https://api.linear.app/graphql');
const teamId = process.env.LINEAR_TEAM_ID!;
const projectId = '1c5d02ad-c00a-4a3b-9a08-9223d65a821d';

async function createMetadataValidationIssue() {
  const title = '[AUTO-001] Linear Metadata Quality Assurance System';
  const description = `**Priority**: P1 | **Estimate**: 90 min

## Problem
Linear issues created by agents often lack complete metadata:
- Priorities not set (defaults to None)
- Labels missing (no filtering/grouping)
- Dependencies not linked (text-only "Deps: X")
- Milestones unassigned (no phased delivery tracking)

This reduces project management effectiveness and makes filtering/sorting difficult.

## Solution: Pre-Flight Metadata Validator

Create system that validates and enforces metadata quality BEFORE issue creation.

### Implementation

**File**: \`src/utils/linear-metadata-validator.ts\`

**Core Functions**:

1. **\`validateIssueMetadata(issue)\`**: Pre-creation validation
\`\`\`typescript
interface IssueMetadata {
  title: string;
  description: string;
  priority?: number;        // 0-4, default 3
  labels?: string[];        // ['sprites', 'month-2']
  milestone?: string;       // 'Month 2'
  blockedBy?: string[];     // ['BIF-70']
}

// Auto-infer from description if missing:
- Extract "P1" -> priority = 2 (High)
- Extract "MONTH 2" -> milestone = 'Month 2'
- Extract "Deps: BIF-X" -> blockedBy = ['BIF-X']
\`\`\`

2. **\`enrichMetadata(issue)\`**: Auto-populate from description
\`\`\`typescript
// Parse description for:
- Priority markers ("P0", "P1", "P2", "P3") -> priority field
- Phase markers ("MONTH 2", "MONTH 3") -> milestone
- Dependencies ("Deps: BIF-70") -> blockedBy relations
- Category keywords ("Sprites", "Security") -> labels
\`\`\`

3. **\`auditExistingIssues(projectId)\`**: Scan for incomplete metadata
\`\`\`typescript
// Report issues with:
- No priority set
- No labels
- Text dependencies not linked
- Missing milestones for phased work
\`\`\`

### Integration Points

**Update**: \`src/linear-client.ts\` - \`createIssue()\`
\`\`\`typescript
async createIssue(data: IssueInput) {
  // NEW: Enrich metadata before creation
  const enriched = enrichMetadata(data);
  
  // NEW: Validate metadata quality
  validateIssueMetadata(enriched);
  
  // Existing: Create issue
  return this.query(mutation, enriched);
}
\`\`\`

**Add**: \`scripts/audit_linear_metadata.ts\`
\`\`\`bash
npm start -- audit-metadata
# Output: Report of all issues missing metadata
\`\`\`

**Add**: \`scripts/fix_metadata.ts\`
\`\`\`bash
npm start -- fix-metadata --dry-run
npm start -- fix-metadata --apply
# Re-process all issues, enrich metadata from descriptions
\`\`\`

### Validation Rules

**Minimum Required**:
- [ ] Priority set (default to 3 if unspecified)
- [ ] At least 1 label
- [ ] Description >50 chars
- [ ] Title <120 chars

**Best Practice** (warnings):
- [ ] Milestone for phased work (Month 2, Month 3)
- [ ] Dependencies linked (not just text)
- [ ] Time estimate in description
- [ ] Acceptance criteria present

## Acceptance Criteria
- [ ] \`validateIssueMetadata()\` function created
- [ ] \`enrichMetadata()\` auto-infers from description text
- [ ] \`createIssue()\` calls validation before GraphQL mutation
- [ ] \`audit_linear_metadata.ts\` script reports gaps
- [ ] \`fix_metadata.ts\` script bulk-enriches existing issues
- [ ] README documents metadata standards

## Dependencies
- BIF-101 (auth hardening) - ensures proper API access

## Testing
- Create issue with "P1 | MONTH 2 | Deps: BIF-70" in description
- Verify auto-populated: priority=2, milestone='Month 2', blockedBy=['BIF-70']
- Run audit on existing 32 issues
- Verify report shows missing labels, milestones

## Notes
This ensures ALL future agent-created issues meet metadata quality standards automatically.`;

  const result = await client.createIssue({
    teamId,
    title,
    description,
    projectId
  });

  console.log(`✅ Created metadata validation system issue: ${result.identifier}`);
  console.log(`   Title: ${title}`);
  console.log(`   This will ensure all future Linear issues have complete metadata!`);
  
  return result.identifier;
}

createMetadataValidationIssue().catch(console.error);
