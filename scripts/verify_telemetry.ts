
async function verify() {
    const EVENTS_URL = process.env.EVENTS_URL || "https://bifrost-events.fly.dev";
    const EVENTS_SECRET = process.env.EVENTS_SECRET;
    const ROUTER_URL = process.env.ROUTER_URL || "https://crypt-core.mock1ng.workers.dev";
    const PROXY_API_KEY = process.env.PROXY_API_KEY;

    console.log("🔍 Starting Telemetry Verification...");
    console.log(`📡 Event Store: ${EVENTS_URL}`);
    console.log(`🧠 Orchestrator: ${ROUTER_URL}`);

    // 1. Health Check (Unauthenticated)
    console.log("\n1. Testing Unauthenticated Health Check...");
    const healthRes = await fetch(`${EVENTS_URL}/health`);
    if (healthRes.status === 401) {
        console.log("✅ Auth Check: OK (Correctly rejected without token)");
    } else {
        console.log(`❌ Auth Check: FAILED (Expected 401, got ${healthRes.status})`);
    }

    // 2. Health Check (Authenticated)
    console.log("\n2. Testing Authenticated Health Check...");
    const authHealthRes = await fetch(`${EVENTS_URL}/health`, {
        headers: { "Authorization": `Bearer ${EVENTS_SECRET}` }
    });
    if (authHealthRes.ok) {
        console.log("✅ Health Check: OK (200)");
    } else {
        console.log(`❌ Health Check: FAILED (${authHealthRes.status} ${await authHealthRes.text()})`);
    }

    // 3. Write Event
    console.log("\n3. Testing Event Write...");
    const writeRes = await fetch(`${EVENTS_URL}/events`, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${EVENTS_SECRET}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            type: "HEARTBEAT",
            source: "verification-script",
            topic: "system-check",
            payload: { message: "Telemetry is alive", timestamp: Date.now() }
        })
    });
    if (writeRes.ok) {
        const data = await writeRes.json() as any;
        console.log(`✅ Write Event: OK (ID: ${data.id})`);

        // 4. Read Event
        console.log("\n4. Testing Event Read...");
        const readRes = await fetch(`${EVENTS_URL}/state/system-check`, {
            headers: { "Authorization": `Bearer ${EVENTS_SECRET}` }
        });
        if (readRes.ok) {
            const state = await readRes.json() as any;
            if (state.state.message === "Telemetry is alive") {
                console.log("✅ Read Event: OK (Data match confirmed)");
            } else {
                console.log("❌ Read Event: FAILED (Data mismatch)");
            }
        } else {
            console.log(`❌ Read Event: FAILED (${readRes.status})`);
        }
    } else {
        console.log(`❌ Write Event: FAILED (${writeRes.status} ${await writeRes.text()})`);
    }

    // 5. Orchestrator Sync
    console.log("\n5. Triggering Orchestrator Sync...");
    const syncRes = await fetch(`${ROUTER_URL}/admin/sync-linear`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${PROXY_API_KEY}` }
    });
    if (syncRes.ok) {
        console.log("✅ Orchestrator Sync: OK");
    } else {
        console.log(`❌ Orchestrator Sync: FAILED (${syncRes.status} ${await syncRes.text()})`);
    }

    console.log("\n🏁 Verification Complete.");
}

verify().catch(console.error);
