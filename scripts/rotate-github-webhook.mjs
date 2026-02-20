/**
 * Rotates the GitHub webhook secret for bifrost-bridge,
 * then updates the Cloudflare Worker secret GITHUB_WEBHOOK_SECRET.
 *
 * Uses GitHub App JWT auth (no PAT needed).
 */
import { execSync } from 'child_process';
import { createSign, createPrivateKey } from 'crypto';

const APP_ID = '2847336';
const INSTALLATION_ID = '109576174';
const OWNER = 'mockingb1rdblue';
const REPO = 'bifrost-bridge';

const PRIVATE_KEY = `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEAo3jKS83spmPVFnIL3zovC+Qpm9kLX+/r7BWMR21a5YBE+Be1
Ovu1K68lieuCQ4cboL47luoh1BZ5tyhvWOFcZOpk/0FNvwRePgKru7vgmfzoOinL
hxF+u5NRYyeO3JeZWH9VcQDezh1R67XnH1YYMlp71sl+dQShPX6PbYpaANOyA5mP
DI32QFR21+yFfbVdIu3XT3KCtrFty15mFqVMNcJmJ9jm/qAzP/cXIs7ShhboloVx
ii94SvmlZkRR0SbYT1vTItL0ubNlRxRpF9qHKyk5hdonupkeL5GZb3y5Wl/Cvs7T
tnf/aIU7tpePgUatsmeo8sQ2Vsvee26Bzd0s0wIDAQABAoIBAQCfd0aIOiJfkkWd
NrWkFgMs6283i7wP42DWlZKZXvDrrnwZNC9jkYWDTsEk0KvrKdJmtQw2RMGpPh+P
747nOjhCbXEGm/K2oxE4FqzmXvlT3iXAD2NuqD9jxer/+efgArbhYJ29taajlHCE
qpcCt561CBWESlzk1BZigaJyriLsaAb49lp3cFk3JqaN33EgQO/V9mSt+ZB6uPBH
Q2sOrtIwATcRMM8mLj3wvXJoodwcyWMl4fxuCkOyQGvQNWBLvGdb6lmRPfiRybL8
lpH9Xcahz9X6TQSH7Lu8d11ldGaa2Ud9O+s0wxGmpuIko2TIXXdrOg0RjNZZFcHn
eB9Z6puRAoGBANRyYuhKKu3kuz5lplZFoK29F73B9QXYRegj8PyYChazs++BUFL1
flu+Zd2MA1oUpQqaNVE0HpTEr3WvMFChZvuh9OrOlrIerjJcm8lNF6MahOEZKrXq
EzbCccKOuyEb5R/DxTS6k1qcGfUx6PgrPdeFUt0EXxR3/FvjBKg7nHF5AoGBAMT8
Gnmt9y+N11pH4F/ruOPLcOJV7/QPaDsESOMubKCXmR3egqaIGoBdPx+0bwYZ7a5O
G9AKoT7WQnEYWapsriuqTL/Y1xeEHEv0KM7Nj63/EbRDVTAdrmKP7fM7tgrBKAnK
FlEkLOuGHPSyLELOT6p1TBZH7pS14c1Jd9+seSmrAoGAcwrSNpnbL2G6Z6qh7Xvc
69hG3/IFHjokePXljNNEO1DqslqjRZk86K9s+BDWy9P8H4asMqH3oXX00dShZDhS
zRbBytk+T4w/pnPxxItjrmYw6Lg5IbN03iVjdwjVmrNBWvcndktGej2n7NgvIRxB
a9D9s0OnvSzQUm3X2sYVDHkCgYBFehGwdx5nBGU/b3iA/HgSyC+BdQQUFdcScblv
f3FK1w1nTpLQP9LxEXJxMUezZDPDtcLzhrxGmHWIxCjkBj8MIZ2+ULHUloEQfQZj
oncZzIwnA1Spit513wPzNU1Iz8XaZg+nANZjH8NYvvsDeRb6LTLv7OEGTHxe1pnU
J1X4zwKBgQCYacFPqvA7D8kAvBE0kVLGRVf6dcBDIRMLMfymsF7Uc6AXJ3PFqGhv
a6hqNyLysdYQ/t6gabUitLoeCFeVjvB0hmnJQGmHhYmpU/P9hjyP4qktfmcDHcXH
kAyiK0QXVoh4M5xeAcaMOkVl/MpKUhADfDhFw/LxSVb/NAu4Z/jf+w==
-----END RSA PRIVATE KEY-----`;

// --- Generate GitHub App JWT ---
function makeJWT() {
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ iat: now - 60, exp: now + 600, iss: APP_ID })).toString('base64url');
    const unsigned = `${header}.${payload}`;
    const sign = createSign('RSA-SHA256');
    sign.update(unsigned);
    const sig = sign.sign(createPrivateKey(PRIVATE_KEY), 'base64url');
    return `${unsigned}.${sig}`;
}

async function getInstallationToken(jwt) {
    const res = await fetch(`https://api.github.com/app/installations/${INSTALLATION_ID}/access_tokens`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${jwt}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
        },
    });
    if (!res.ok) throw new Error(`Failed to get token: ${res.status} ${await res.text()}`);
    const data = await res.json();
    return data.token;
}

async function getWebhookId(token) {
    const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/hooks`, {
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
        },
    });
    if (!res.ok) throw new Error(`Failed to list hooks: ${res.status} ${await res.text()}`);
    const hooks = await res.json();
    // Find the hook pointing at our worker
    const hook = hooks.find(h => h.config?.url?.includes('crypt-core') || h.config?.url?.includes('workers.dev'));
    if (!hook) {
        console.log('All hooks:', JSON.stringify(hooks.map(h => ({ id: h.id, url: h.config?.url })), null, 2));
        throw new Error('Could not find bifrost-bridge webhook. Check the hook URL above.');
    }
    return hook.id;
}

async function rotateWebhookSecret(token, hookId, newSecret) {
    // Get existing hook config first
    const getRes = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/hooks/${hookId}`, {
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
        },
    });
    const hook = await getRes.json();

    const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/hooks/${hookId}`, {
        method: 'PATCH',
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            config: {
                ...hook.config,
                secret: newSecret,
            },
        }),
    });
    if (!res.ok) throw new Error(`Failed to update hook: ${res.status} ${await res.text()}`);
    return res.json();
}

// --- Main ---
const newSecret = Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

console.log('Generating GitHub App JWT...');
const jwt = makeJWT();

console.log('Getting installation token...');
const token = await getInstallationToken(jwt);

console.log('Finding webhook...');
const hookId = await getWebhookId(token);
console.log(`Found webhook ID: ${hookId}`);

console.log('Rotating webhook secret...');
await rotateWebhookSecret(token, hookId, newSecret);
console.log('✅ GitHub webhook secret rotated.');

console.log('Pushing new secret to Cloudflare...');
execSync(
    `echo "${newSecret}" | npx wrangler secret put GITHUB_WEBHOOK_SECRET --env production`,
    { cwd: new URL('../../workers/crypt-core', import.meta.url).pathname, stdio: 'inherit' }
);
console.log('✅ GITHUB_WEBHOOK_SECRET updated in Cloudflare. Done.');
