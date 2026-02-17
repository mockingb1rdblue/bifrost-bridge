
const { execSync } = require('child_process');

async function checkSwarm() {
  console.log('🐝 --- Swarm Status Audit --- 🐝');

  // 1. Check Port 8787
  try {
    const lsof = execSync('lsof -i :8787 -t').toString().trim();
    console.log(`✅ Port 8787 is occupied by PID: ${lsof}`);
  } catch (e) {
    console.log('❌ Port 8787 is NOT responding.');
  }

  // 2. Check Linear issues
  try {
    const linearQuery = `curl -s -X POST "https://api.linear.app/graphql" \
      -H "Authorization: ${process.env.LINEAR_API_KEY}" \
      -H "Content-Type: application/json" \
      -d '{ "query": "{ issues(filter: { labels: { some: { name: { eq: \\"sluagh:active\\" } } } }) { nodes { identifier title state { name } } } }" }'`;
    const res = JSON.parse(execSync(linearQuery).toString());
    const activeCount = res.data.issues.nodes.length;
    console.log(`✅ Linear: ${activeCount} issues in sluagh:active state.`);
  } catch (e) {
    console.error('❌ Failed to query Linear.', e.message);
  }

  // 3. Check Metrics
  try {
    const metricsCmd = `curl -s "http://127.0.0.1:8787/metrics" -H "Authorization: Bearer ${process.env.PROXY_API_KEY}"`;
    const metrics = JSON.parse(execSync(metricsCmd).toString());
    console.log(`✅ Router Metrics: totalTasks=${metrics.totalTasks || 0}, successCount=${metrics.successCount || 0}`);
  } catch (e) {
    console.log('❌ Failed to fetch router metrics (401 or timeout).');
  }

  console.log('----------------------------');
}

checkSwarm();
