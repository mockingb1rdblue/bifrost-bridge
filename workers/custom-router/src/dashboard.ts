export const DASHBOARD_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bifrost Router Dashboard</title>
    <style>
        :root {
            --bg: #0a0a0c;
            --glass: rgba(255, 255, 255, 0.05);
            --glass-border: rgba(255, 255, 255, 0.1);
            --accent: #6d28d9;
            --accent-glow: rgba(109, 40, 217, 0.5);
            --text: #e2e8f0;
            --text-dim: #94a3b8;
            --success: #10b981;
            --warning: #f59e0b;
            --error: #ef4444;
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            background: var(--bg);
            color: var(--text);
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            overflow-x: hidden;
            background-image: radial-gradient(circle at 50% 50%, #1a1a2e 0%, #0a0a0c 100%);
            min-height: 100vh;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 2rem;
        }

        header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 3rem;
        }

        .logo {
            font-size: 1.5rem;
            font-weight: 800;
            background: linear-gradient(to right, #8b5cf6, #ec4899);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            letter-spacing: -0.05em;
        }

        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1.5rem;
            margin-bottom: 3rem;
        }

        .stat-card {
            background: var(--glass);
            backdrop-filter: blur(12px);
            border: 1px solid var(--glass-border);
            border-radius: 1rem;
            padding: 1.5rem;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
            transition: transform 0.3s ease, border-color 0.3s ease;
        }

        .stat-card:hover {
            transform: translateY(-5px);
            border-color: var(--accent);
        }

        .stat-label { color: var(--text-dim); font-size: 0.875rem; margin-bottom: 0.5rem; }
        .stat-value { font-size: 2rem; font-weight: 700; color: #fff; }

        .job-list {
            background: var(--glass);
            backdrop-filter: blur(12px);
            border: 1px solid var(--glass-border);
            border-radius: 1rem;
            overflow: hidden;
        }

        table { width: 100%; border-collapse: collapse; text-align: left; }
        th { 
            padding: 1rem 1.5rem; 
            background: rgba(255,255,255,0.02); 
            color: var(--text-dim); 
            font-size: 0.75rem; 
            text-transform: uppercase; 
            letter-spacing: 0.05em;
        }
        td { padding: 1rem 1.5rem; border-top: 1px solid var(--glass-border); }

        .status-badge {
            padding: 0.25rem 0.75rem;
            border-radius: 9999px;
            font-size: 0.75rem;
            font-weight: 600;
            display: inline-flex;
            align-items: center;
        }

        .status-pending { background: rgba(148, 163, 184, 0.1); color: #94a3b8; }
        .status-processing { background: rgba(59, 130, 246, 0.1); color: #3b82f6; animation: pulse 2s infinite; }
        .status-hitl { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
        .status-completed { background: rgba(16, 185, 129, 0.1); color: #10b981; }
        .status-failed { background: rgba(239, 68, 68, 0.1); color: #ef4444; }

        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.6; }
            100% { opacity: 1; }
        }

        .refresh-btn {
            background: var(--accent);
            color: white;
            border: none;
            padding: 0.5rem 1rem;
            border-radius: 0.5rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 4px 14px var(--accent-glow);
        }

        .refresh-btn:hover {
            filter: brightness(1.2);
            transform: scale(1.05);
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <div class="logo">BIFROST ROUTER</div>
            <button class="refresh-btn" onclick="location.reload()">Refresh Data</button>
        </header>

        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-label">System Health</div>
                <div class="stat-value" id="system-health">-</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Total Requests</div>
                <div class="stat-value" id="total-requests">-</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Active Jules Tasks</div>
                <div class="stat-value" id="active-jules">-</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Error Count</div>
                <div class="stat-value" id="error-count" style="color: var(--error)">-</div>
            </div>
        </div>

        <h2 style="margin-bottom: 1rem;">Jules Agent Tasks</h2>
        <div class="job-list" style="margin-bottom: 3rem;">
            <table>
                <thead>
                    <tr>
                        <th>Task ID</th>
                        <th>Type</th>
                        <th>Status</th>
                        <th>Title</th>
                        <th>Updated</th>
                    </tr>
                </thead>
                <tbody id="jules-table-body">
                    <tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--text-dim);">Loading Jules tasks...</td></tr>
                </tbody>
            </table>
        </div>

        <h2 style="margin-bottom: 1rem;">Standard Job Queue</h2>
        <div class="job-list" style="margin-bottom: 3rem;">
            <table>
                <thead>
                    <tr>
                        <th>Job ID</th>
                        <th>Type</th>
                        <th>Status</th>
                        <th>Identifier</th>
                        <th>Updated</th>
                    </tr>
                </thead>
                <tbody id="job-table-body">
                    <tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--text-dim);">Loading metrics...</td></tr>
                </tbody>
            </table>
        </div>

        <h2 style="margin-bottom: 1rem; color: var(--error);">Recent System Errors</h2>
        <div class="job-list">
            <div id="error-log" style="padding: 1rem; font-family: monospace; font-size: 0.875rem; color: var(--text-dim); max-height: 300px; overflow-y: auto;">
                No recent errors.
            </div>
        </div>
    </div>

    <script>
        const AUTH_HEADER = { 'Authorization': 'Bearer ' + localStorage.getItem('PROXY_API_KEY') };

        async function fetchData(url) {
            const res = await fetch(url, { headers: AUTH_HEADER });
            if (!res.ok) throw new Error(\`Failed to fetch \${url} (\${res.status})\`);
            return await res.json();
        }

        async function loadMetrics() {
            try {
                const [jobs, julesTasks, metrics, errors] = await Promise.all([
                    fetchData('/jobs'),
                    fetchData('/jules/tasks'),
                    fetchData('/metrics'),
                    fetchData('/errors')
                ]);

                renderJobs(jobs);
                renderJulesTasks(julesTasks);
                renderSystemMetrics(metrics, jobs);
                renderErrors(errors);
            } catch (e) {
                console.error(e);
                // Handle unauthorized or missing key
                if (e.message.includes('401') || e.message.includes('403')) {
                     document.getElementById('job-table-body').innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--error);">Unauthorized. Update PROXY_API_KEY in localStorage.</td></tr>';
                     document.getElementById('jules-table-body').innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--error);">Unauthorized. Update PROXY_API_KEY in localStorage.</td></tr>';
                     document.getElementById('error-log').innerHTML = '<div style="color: var(--error);">Unauthorized. Update PROXY_API_KEY in localStorage.</div>';
                } else {
                    document.getElementById('job-table-body').innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--error);">Error loading jobs.</td></tr>';
                    document.getElementById('jules-table-body').innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--error);">Error loading Jules tasks.</td></tr>';
                    document.getElementById('error-log').innerHTML = '<div style="color: var(--error);">Error loading errors.</div>';
                }
            }
        }

        function renderSystemMetrics(metrics, jobs) {
            document.getElementById('total-requests').textContent = metrics.totalRequests;
            document.getElementById('error-count').textContent = metrics.errorCount;
            
            // Calculate pseudo health score (simulating router-do logic)
            const pendingJobs = jobs.filter(j => j.status === 'pending').length;
            let health = '100%';
            let color = 'var(--success)';
            if (pendingJobs > 50) { health = '50%'; color = 'var(--warning)'; }
            if (pendingJobs > 100) { health = 'Crit'; color = 'var(--error)'; }
            
            const healthEl = document.getElementById('system-health');
            healthEl.textContent = health;
            healthEl.style.color = color;
        }

        function renderJobs(jobs) {
            const tbody = document.getElementById('job-table-body');
            tbody.innerHTML = '';
            
            jobs.sort((a,b) => b.updatedAt - a.updatedAt).forEach(job => {
                const row = document.createElement('tr');
                row.innerHTML = \`
                    <td><code style="color: var(--text-dim)">\${job.id.slice(0,8)}...</code></td>
                    <td>\${job.type}</td>
                    <td><span class="status-badge status-\${job.status}">\${job.status.replace('_', ' ')}</span></td>
                    <td>\${job.linearIdentifier || '-'}</td>
                    <td style="color: var(--text-dim); font-size: 0.875rem">\${new Date(job.updatedAt).toLocaleTimeString()}</td>
                \`;
                tbody.appendChild(row);
            });
        }

        function renderJulesTasks(tasks) {
            const tbody = document.getElementById('jules-table-body');
            tbody.innerHTML = '';
            let active = 0;

            tasks.sort((a,b) => b.updatedAt - a.updatedAt).forEach(task => {
                if (task.status === 'active') active++;
                const row = document.createElement('tr');
                row.innerHTML = \`
                    <td><code style="color: var(--text-dim)">\${task.id.slice(0,8)}...</code></td>
                    <td>\${task.type}</td>
                    <td><span class="status-badge status-\${task.status}">\${task.status}</span></td>
                    <td>\${task.title}</td>
                    <td style="color: var(--text-dim); font-size: 0.875rem">\${new Date(task.updatedAt).toLocaleTimeString()}</td>
                \`;
                tbody.appendChild(row);
            });
            document.getElementById('active-jules').textContent = active;
        }

        function renderErrors(errors) {
            const log = document.getElementById('error-log');
            if (!errors || errors.length === 0) {
                log.textContent = 'No recent errors.';
                return;
            }
            log.innerHTML = errors.map(e => \`
                <div style="margin-bottom: 0.5rem; border-bottom: 1px solid var(--glass-border); padding-bottom: 0.5rem;">
                    <div style="color: var(--error)">[\${new Date(e.timestamp).toLocaleTimeString()}] \${e.context}: \${e.message}</div>
                    \${e.stack ? \`<pre style="font-size: 10px; margin-top: 0.25rem; white-space: pre-wrap;">\${e.stack}</pre>\` : ''}
                </div>
            \`).join('');
        }

        loadMetrics();
        setInterval(loadMetrics, 5000);
    </script>
</body>
</html>
`;
