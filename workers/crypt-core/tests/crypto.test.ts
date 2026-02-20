import { describe, it, expect } from 'vitest';
import { verifyLinearSignature } from '../src/utils/crypto';

describe('verifyLinearSignature', () => {
  const secret = 'test-secret';
  const payload = '{"action":"update","type":"Issue"}';
  
  // Helper to generate signature
  async function generateSignature(payload: string, secret: string) {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signature = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(payload)
    );
    return Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  it('should verify correct signature without prefix', async () => {
    const signature = await generateSignature(payload, secret);
    const isValid = await verifyLinearSignature(payload, signature, secret);
    expect(isValid).toBe(true);
  });

  it('should verify correct signature with sha256= prefix', async () => {
    const signature = await generateSignature(payload, secret);
    const isValid = await verifyLinearSignature(payload, `sha256=${signature}`, secret);
    expect(isValid).toBe(true);
  });

  it('should reject invalid signature', async () => {
    const signature = await generateSignature(payload, 'wrong-secret');
    const isValid = await verifyLinearSignature(payload, signature, secret);
    expect(isValid).toBe(false);
  });

  it('should reject invalid signature with prefix', async () => {
    const signature = await generateSignature(payload, 'wrong-secret');
    const isValid = await verifyLinearSignature(payload, `sha256=${signature}`, secret);
    expect(isValid).toBe(false);
  });
});
