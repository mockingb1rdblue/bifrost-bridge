const crypto = require('crypto').webcrypto;

async function verifyWebhookSignature(payload, signature, secret) {
  const [algorithm, receivedDigest] = signature.split('=');
  
  if (algorithm !== 'sha256' || !receivedDigest) {
    return false;
  }
  
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(payload)
  );
  
  const computedDigest = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  // Naive comparison for test script (Worker uses constant-time)
  return computedDigest === receivedDigest;
}

async function test() {
  const secret = 'test-secret';
  const payload = '{"test":"data"}';
  
  // Generate valid signature
  const encoder = new TextEncoder();
  const validKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    validKey,
    encoder.encode(payload)
  );
  const validDigest = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  const validSignature = `sha256=${validDigest}`;
  
  console.log('Testing Valid Signature...');
  const isValid = await verifyWebhookSignature(payload, validSignature, secret);
  console.log('Result:', isValid ? 'PASS' : 'FAIL');
  
  console.log('Testing Invalid Secret...');
  const isInvalid = await verifyWebhookSignature(payload, validSignature, 'wrong-secret');
  console.log('Result:', !isInvalid ? 'PASS' : 'FAIL');
  
  console.log('Testing Tampered Payload...');
  const isTampered = await verifyWebhookSignature(payload + '!', validSignature, secret);
  console.log('Result:', !isTampered ? 'PASS' : 'FAIL');
}

test().catch(console.error);
