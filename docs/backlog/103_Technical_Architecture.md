## Technical Architecture

### Phase 1: Enhanced Linear Client [linear](https://linear.app/developers/graphql)

```typescript
// src/linear-orchestrator.ts
import { LinearClient } from '@linear/sdk';

export class LinearOrchestrator {
  private client: LinearClient;
  private teamId: string;
  
  constructor(apiKey: string, teamId: string) {
    this.client = new LinearClient({ apiKey });
    this.teamId = teamId;
  }
  
  /**
   * Create a full project with intelligent structure
   */
  async createProject(spec: ProjectSpec): Promise<ProjectResult> {
    // 1. Create the project entity
    const project = await this.client.projectCreate({
      name: spec.name,
      description: spec.description,
      teamIds: [this.teamId],
      targetDate: spec.targetDate,
      state: 'planned' // or 'started', 'paused', 'completed', 'canceled'
    });
    
    // 2. Create milestones
    const milestones = await this.createMilestones(
      project.project.id,
      spec.milestones
    );
    
    // 3. Create epic structure (parent issues)
    const epics = await this.createEpics(
      project.project.id,
      spec.epics,
      milestones
    );
    
    // 4. Create tasks (child issues) with relationships
    const tasks = await this.createTasksWithRelationships(
      epics,
      spec.tasks,
      milestones
    );
    
    // 5. Set up blocking relationships
    await this.createDependencies(tasks, spec.dependencies);
    
    return {
      project: project.project,
      milestones,
      epics,
      tasks,
      summary: this.generateProjectSummary()
    };
  }
  
  /**
   * Create milestones with intelligent date distribution
   */
  private async createMilestones(
    projectId: string,
    milestoneSpecs: MilestoneSpec[]
  ) {
    const milestones = [];
    
    for (const spec of milestoneSpecs) {
      const milestone = await this.client.projectMilestoneCreate({
        projectId,
        name: spec.name,
        description: spec.description,
        targetDate: spec.targetDate,
        sortOrder: spec.order
      });
      
      milestones.push(milestone.projectMilestone);
    }
    
    return milestones;
  }
  
  /**
   * Create epic issues (parents) with proper metadata
   */
  private async createEpics(
    projectId: string,
    epicSpecs: EpicSpec[],
    milestones: any[]
  ) {
    const epics = [];
    
    for (const spec of epicSpecs) {
      const milestone = milestones.find(m => m.name === spec.milestoneName);
      
      const epic = await this.client.issueCreate({
        teamId: this.teamId,
        projectId,
        projectMilestoneId: milestone?.id,
        title: spec.title,
        description: this.formatDescription(spec),
        priority: this.mapPriority(spec.priority),
        estimate: spec.estimate,
        labelIds: await this.getOrCreateLabels(['epic']),
        // Set initial state (Backlog, Todo, etc.)
        stateId: await this.getStateId(spec.initialState || 'Backlog')
      });
      
      epics.push({
        ...epic.issue,
        spec // Keep spec for child creation
      });
    }
    
    return epics;
  }
  
  /**
   * Create tasks with parent-child relationships [web:95]
   */
  private async createTasksWithRelationships(
    epics: any[],
    taskSpecs: TaskSpec[],
    milestones: any[]
  ) {
    const tasks = [];
    
    for (const spec of taskSpecs) {
      const parent = epics.find(e => e.spec.id === spec.parentEpicId);
      const milestone = milestones.find(m => m.name === spec.milestoneName);
      
      const task = await this.client.issueCreate({
        teamId: this.teamId,
        projectId: parent?.projectId,
        projectMilestoneId: milestone?.id,
        title: spec.title,
        description: this.formatDescription(spec),
        priority: this.mapPriority(spec.priority),
        estimate: spec.estimate,
        parentId: parent?.id, // Set parent relationship [web:95]
        stateId: await this.getStateId(spec.initialState || 'Todo'),
        assigneeId: spec.assigneeId
      });
      
      tasks.push({
        ...task.issue,
        spec
      });
    }
    
    return tasks;
  }
  
  /**
   * Create blocking relationships between issues [web:95][web:98]
   */
  private async createDependencies(
    tasks: any[],
    dependencies: DependencySpec[]
  ) {
    for (const dep of dependencies) {
      const blocker = tasks.find(t => t.spec.id === dep.blockerId);
      const blocked = tasks.find(t => t.spec.id === dep.blockedId);
      
      if (blocker && blocked) {
        // Create blocking relationship [web:98]
        await this.client.issueRelationCreate({
          issueId: blocked.id,
          relatedIssueId: blocker.id,
          type: 'blocks' // or 'duplicate', 'related'
        });
      }
    }
  }
  
  /**
   * Format rich description with TLDR and details
   */
  private formatDescription(spec: any): string {
    let md = '';
    
    if (spec.tldr) {
      md += `**TL;DR:** ${spec.tldr}\n\n`;
    }
    
    if (spec.description) {
      md += `## Description\n\n${spec.description}\n\n`;
    }
    
    if (spec.acceptanceCriteria) {
      md += `## Acceptance Criteria\n\n`;
      spec.acceptanceCriteria.forEach((criterion: string, i: number) => {
        md += `- [ ] ${criterion}\n`;
      });
      md += '\n';
    }
    
    if (spec.technicalNotes) {
      md += `+++ Technical Notes\n\n${spec.technicalNotes}\n\n+++\n\n`;
    }
    
    if (spec.resources) {
      md += `## Resources\n\n`;
      spec.resources.forEach((resource: any) => {
        md += `- [${resource.title}](${resource.url})\n`;
      });
    }
    
    return md;
  }
  
  /**
   * Map priority strings to Linear priority values [web:94]
   */
  private mapPriority(priority: string): number {
    const map: Record<string, number> = {
      'urgent': 1,
      'high': 2,
      'medium': 3,
      'low': 4,
      'none': 0
    };
    return map[priority.toLowerCase()] || 3;
  }
  
  /**
   * Get workflow state ID by name
   */
  private async getStateId(stateName: string): Promise<string> {
    const states = await this.client.workflowStates({
      filter: { team: { id: { eq: this.teamId } } }
    });
    
    const state = states.nodes.find(s => 
      s.name.toLowerCase() === stateName.toLowerCase()
    );
    
    return state?.id || states.nodes[0].id; // Default to first state
  }
  
  /**
   * Get or create labels for categorization
   */
  private async getOrCreateLabels(labelNames: string[]): Promise<string[]> {
    const existingLabels = await this.client.issueLabels({
      filter: { team: { id: { eq: this.teamId } } }
    });
    
    const labelIds: string[] = [];
    
    for (const name of labelNames) {
      let label = existingLabels.nodes.find(l => 
        l.name.toLowerCase() === name.toLowerCase()
      );
      
      if (!label) {
        const created = await this.client.issueLabelCreate({
          name,
          teamId: this.teamId
        });
        label = created.issueLabel;
      }
      
      labelIds.push(label.id);
    }
    
    return labelIds;
  }
}
```

***

### Phase 2: Intelligent Project Specification Parser

```typescript
// src/project-parser.ts

/**
 * Parse natural language project description into structured spec
 * Can be called by Antigravity agent or Perplexity for enhancement
 */
export class ProjectSpecParser {
  async parseFromNaturalLanguage(
    projectDescription: string,
    perplexityClient?: PerplexityClient
  ): Promise<ProjectSpec> {
    // Use Perplexity to research and enhance the spec
    if (perplexityClient) {
      const research = await perplexityClient.chat([
        {
          role: 'system',
          content: `You are a project planning expert. Given a project description,
          create a detailed project specification with:
          - Clear project goal and TLDR
          - Epic breakdown (3-7 major components)
          - Task breakdown per epic (5-10 tasks each)
          - Suggested milestones (weekly or bi-weekly)
          - Priority distribution (not everything is urgent!)
          - Dependency identification (what blocks what)
          
          Format as JSON matching ProjectSpec interface.`
        },
        {
          role: 'user',
          content: projectDescription
        }
      ], { model: 'sonar-reasoning-pro' });
      
      return JSON.parse(research.choices[0].message.content);
    }
    
    // Fallback: basic parsing
    return this.basicParse(projectDescription);
  }
  
  /**
   * Generate timeline with intelligent milestone distribution
   */
  generateTimeline(
    startDate: Date,
    durationWeeks: number,
    milestoneCount: number
  ): MilestoneSpec[] {
    const milestones: MilestoneSpec[] = [];
    const weeksPerMilestone = Math.ceil(durationWeeks / milestoneCount);
    
    for (let i = 0; i < milestoneCount; i++) {
      const targetDate = new Date(startDate);
      targetDate.setDate(targetDate.getDate() + (i + 1) * weeksPerMilestone * 7);
      
      milestones.push({
        name: `Milestone ${i + 1}`,
        description: this.generateMilestoneDescription(i, milestoneCount),
        targetDate: targetDate.toISOString(),
        order: i
      });
    }
    
    return milestones;
  }
  
  private generateMilestoneDescription(index: number, total: number): string {
    const phases = [
      'Foundation & Setup',
      'Core Development',
      'Integration & Testing',
      'Polish & Documentation',
      'Launch Preparation'
    ];
    
    const phaseIndex = Math.floor((index / total) * phases.length);
    return phases[phaseIndex] || `Phase ${index + 1}`;
  }
}
```

***

### Phase 3: Antigravity MCP Server Integration

```typescript
// linear-mcp-server/src/index.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { LinearOrchestrator } from './linear-orchestrator.js';
import { ProjectSpecParser } from './project-parser.js';

const server = new Server({
  name: 'linear-orchestrator',
  version: '1.0.0'
}, {
  capabilities: { tools: {} }
});

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'create_structured_project',
        description: 'Create a full Linear project with epics, tasks, milestones, and relationships from natural language description',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Project name' },
            description: { type: 'string', description: 'Full project description in natural language' },
            duration_weeks: { type: 'number', description: 'Project duration in weeks' },
            milestone_count: { type: 'number', description: 'Number of milestones' },
            use_ai_enhancement: { 
              type: 'boolean', 
              description: 'Use Perplexity AI to enhance project spec',
              default: true 
            }
          },
          required: ['name', 'description']
        }
      },
      {
        name: 'update_project_status',
        description: 'Bulk update issue statuses based on milestone progress',
        inputSchema: {
          type: 'object',
          properties: {
            project_id: { type: 'string' },
            milestone_name: { type: 'string' },
            new_status: { type: 'string', enum: ['Backlog', 'Todo', 'In Progress', 'Done', 'Canceled'] }
          },
          required: ['project_id', 'milestone_name', 'new_status']
        }
      },
      {
        name: 'create_dependency_chain',
        description: 'Create blocked-by relationships for a sequence of tasks',
        inputSchema: {
          type: 'object',
          properties: {
            issue_ids: { 
              type: 'array', 
              items: { type: 'string' },
              description: 'Array of issue IDs in dependency order (first blocks second, etc.)'
            }
          },
          required: ['issue_ids']
        }
      },
      {
        name: 'generate_project_report',
        description: 'Generate detailed markdown report of project status, progress, blockers',
        inputSchema: {
          type: 'object',
          properties: {
            project_id: { type: 'string' }
          },
          required: ['project_id']
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  const orchestrator = new LinearOrchestrator(
    process.env.LINEAR_API_KEY!,
    process.env.LINEAR_TEAM_ID!
  );
  
  switch (name) {
    case 'create_structured_project': {
      const parser = new ProjectSpecParser();
      
      // Optionally enhance with Perplexity
      let spec: ProjectSpec;
      if (args.use_ai_enhancement) {
        spec = await parser.parseFromNaturalLanguage(
          args.description,
          perplexityClient
        );
      } else {
        spec = await parser.parseFromNaturalLanguage(args.description);
      }
      
      // Add timeline if specified
      if (args.duration_weeks) {
        spec.milestones = parser.generateTimeline(
          new Date(),
          args.duration_weeks,
          args.milestone_count || 4
        );
      }
      
      // Create the full project
      const result = await orchestrator.createProject(spec);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            project_url: `https://linear.app/team/${result.project.id}`,
            summary: result.summary,
            stats: {
              epics: result.epics.length,
              tasks: result.tasks.length,
              milestones: result.milestones.length
            }
          }, null, 2)
        }]
      };
    }
    
    // ... other tool implementations
  }
});
```

***

### Phase 4: Usage Examples in Antigravity

#### Example 1: Quick Project Creation

```
Prompt to Antigravity:
"Create a Linear project for the Bifrost Bridge toolkit. 
It's a 12-week project to build corporate network bypass tools.
Include 4 milestones, break it into epics for: MCP proxies, 
certificate tools, portable dev environment, and documentation."
```

Agent calls `create_structured_project`, Perplexity enhances the spec, returns full project with URL.

#### Example 2: Complex Dependency Management

```
Prompt:
"For project ID xyz, create a dependency chain where certificate 
extraction must complete before MCP proxy deployment, which must 
complete before integration testing"
```

Agent calls `create_dependency_chain` with the three issue IDs in order. [community.fibery](https://community.fibery.io/t/done-add-blocking-blocked-by-to-issues-and-projects-in-linear-integration/8483)

#### Example 3: Automated Status Updates

```
Prompt:
"Move all issues in Milestone 2 of Bifrost Bridge to 'In Progress' status"
```

Agent calls `update_project_status` with project ID, milestone name, and new status.

***
