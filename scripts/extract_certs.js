const tls = require('tls');
const fs = require('fs');
const path = require('path');
const url = require('url');

const DEST_DIR = path.join(__dirname, '..', '.certs');

if (!fs.existsSync(DEST_DIR)) {
  fs.mkdirSync(DEST_DIR);
}

const TARGETS = [
  'google.com',
  'github.com',
  'registry.npmjs.org',
  'api.openai.com',
  'api.anthropic.com',
  // Add corporate proxy URL if known
];

function pemEncode(str, type = 'CERTIFICATE') {
  const b64 = Buffer.from(str).toString('base64');
  let chunks = '';
  for (let i = 0; i < b64.length; i += 64) {
    chunks += b64.slice(i, i + 64) + '\n';
  }
  return `-----BEGIN ${type}-----\n${chunks}-----END ${type}-----\n`;
}

function extractCert(targetUrl) {
  return new Promise((resolve, reject) => {
    const options = {
      host: targetUrl,
      port: 443,
      servername: targetUrl,
      rejectUnauthorized: false, // We want to see the cert even if self-signed/untrusted
    };

    const socket = tls.connect(options, () => {
      const cert = socket.getPeerCertificate(true); // true = get full chain if available? detailed
      // Note: getPeerCertificate(true) returns the peer's cert, and the 'issuerCertificate' property recursively.

      socket.end();

      if (!cert) {
        reject(new Error(`No certificate received from ${targetUrl}`));
        return;
      }

      const certs = [];
      let current = cert;
      while (current) {
        // Check if we have raw data
        if (current.raw) {
          certs.push({
            subject: current.subject,
            issuer: current.issuer,
            raw: current.raw,
          });
        }

        // Move to issuer
        if (current.issuerCertificate && current.issuerCertificate !== current) {
          current = current.issuerCertificate;
        } else {
          current = null;
        }
      }
      resolve(certs);
    });

    socket.on('error', (err) => {
      reject(err);
    });
  });
}

async function main() {
  console.log(`Extracting certificates to ${DEST_DIR}...`);

  let allCerts = [];

  for (const target of TARGETS) {
    try {
      console.log(`Connecting to ${target}...`);
      const chain = await extractCert(target);
      console.log(`  Found ${chain.length} certificates in chain.`);
      allCerts = allCerts.concat(chain);
    } catch (err) {
      console.error(`  Failed to extract from ${target}: ${err.message}`);
    }
  }

  // Deduplicate based on raw buffer
  const uniqueCerts = new Map();
  for (const c of allCerts) {
    const fingerprint = c.raw.toString('hex');
    if (!uniqueCerts.has(fingerprint)) {
      uniqueCerts.set(fingerprint, c);
    }
  }

  console.log(`Found ${uniqueCerts.size} unique certificates.`);

  // Check for self-signed or likely corporate proxies
  // Often corporate proxies replace the issuer with their own CA.

  let combinedPem = '';

  for (const [fingerprint, cert] of uniqueCerts) {
    const subject = cert.subject.CN || 'unknown';
    const issuer = cert.issuer.CN || 'unknown';
    const filename = `cert_${subject.replace(/[^a-zA-Z0-9]/g, '_')}_by_${issuer.replace(/[^a-zA-Z0-9]/g, '_')}.pem`;
    const filepath = path.join(DEST_DIR, filename);

    const pem = pemEncode(cert.raw);
    fs.writeFileSync(filepath, pem);
    console.log(`  Saved: ${filename}`);

    combinedPem += pem;
  }

  // Create a bundle
  const bundlePath = path.join(DEST_DIR, 'corporate_bundle.pem');
  fs.writeFileSync(bundlePath, combinedPem);
  console.log(`\nCreated bundle at: ${bundlePath}`);
  console.log(`\nTo use this bundle in Node.js, set:`);
  console.log(`$env:NODE_EXTRA_CA_CERTS="${bundlePath}"`);
}

main();
