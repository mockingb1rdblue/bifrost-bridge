const { execSync } = require('child_process');

console.log('🧪 BIFROST SMOKE TEST: Linear Mutation');

try {
    // 1. Create Issue
    console.log('1. Creating Test Issue via Proxy...');
    const output = execSync('npm start -- linear create-issue "Smoke Test Mutation" --description "Automated test from scripts/test_mutation.js"', { encoding: 'utf8' });
    
    console.log(output);

    // Strip ANSI codes
    const cleanOutput = output.replace(/\u001b\[[0-9;]*m/g, '');
    
    // Extract Issue ID/Identifier from output
    // Looking for: √ Issue created: [BIF-67] Smoke Test Mutation
    const match = cleanOutput.match(/Issue created: \[(.*?)\] (.*)/);
    if (match) {
        console.log(`✅ SUCCESS: Created ${match[1]} - ${match[2]}`);
        
        // Optional: We could parse the ID and archive it immediately if we had an archive command.
        // For now, we just verify creation succeeded.
    } else {
        console.error('❌ FAILED: output did not match expected success pattern.');
        process.exit(1);
    }

} catch (e) {
    console.error('❌ FATAL ERROR during smoke test:');
    console.error(e.message);
    process.exit(1);
}
