import { LinearClient } from '../workers/crypt-core/src/linear';

const config = {
  apiKey: process.env.LINEAR_API_KEY || "",
  teamId: process.env.LINEAR_TEAM_ID || "d43e265a-cbc3-4f07-afcd-7792ce875ad3",
};

async function main() {
  if (!config.apiKey) {
    console.error("❌ ERROR: LINEAR_API_KEY is not set in the environment.");
    process.exit(1);
  }

  const client = new LinearClient({
    apiKey: config.apiKey,
    teamId: config.teamId
  });

  console.log("🔍 Fetching projects...");
  const projects = await client.listProjects();
  const targetProjects = projects.filter(p => p.name.includes("Bifrost") || p.name.includes("Sluagh"));

  if (targetProjects.length === 0) {
    console.log("❌ No target projects found matching 'Bifrost' or 'Sluagh'.");
    console.log("Available projects:", projects.map(p => p.name).join(", "));
    return;
  }

  const readyLabelId = await client.getLabelIdByName(config.teamId, "sluagh:ready");
  if (!readyLabelId) {
    console.log("⚠️ Creating 'sluagh:ready' label...");
    await client.createLabel({ teamId: config.teamId, name: "sluagh:ready", color: "#10B981" });
  }

  for (const project of targetProjects) {
    console.log(`\n📂 Project: ${project.name} (${project.id})`);

    const query = `
      query ProjectIssues($projectId: String!) {
        project(id: $projectId) {
          issues(filter: { state: { name: { nin: ["Completed", "Canceled"] } } }) {
            nodes {
              id
              identifier
              title
              state { name }
              labels { nodes { name } }
            }
          }
        }
      }
    `;

    const data = await (client as any).query(query, { projectId: project.id });
    const issues = data.project.issues.nodes;

    for (const issue of issues) {
      const isReady = issue.labels.nodes.some((l: any) => l.name === "sluagh:ready");
      console.log(`- [${issue.identifier}] ${issue.title} [${issue.state.name}] ${isReady ? "✅ READY" : "⏳"}`);

      if (!isReady && (issue.state.name === "Todo" || issue.state.name === "Backlog")) {
        console.log(`  👉 Labeling as sluagh:ready...`);
        await client.addLabel(issue.id, "sluagh:ready");
      }
    }
  }

  console.log("\n🚀 Triggering Swarm Sync...");
  const routerUrl = process.env.ROUTER_URL || "https://crypt-core.mock1ng.workers.dev/v1/swarm/sync";
  const proxyKey = process.env.PROXY_API_KEY || "";

  if (!proxyKey) {
    console.warn("⚠️ PROXY_API_KEY not set. Swarm sync trigger may fail.");
  }

  const response = await fetch(routerUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${proxyKey}`
    }
  });

  if (response.ok) {
    console.log("✅ Swarm sync triggered successfully.");
  } else {
    console.log(`❌ Failed to trigger sync: ${response.status} ${await response.text()}`);
  }
}

main().catch(console.error);
