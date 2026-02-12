
export async function verifyLinearSignature(
    payload: string,
    signature: string,
    secret: string
): Promise<boolean> {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const payloadData = encoder.encode(payload);

    const key = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['verify']
    );

    // Linear sends the signature as a hex string
    const signatureBuffer = hexStringToBuffer(signature);

    return await crypto.subtle.verify(
        'HMAC',
        key,
        signatureBuffer,
        payloadData
    );
}

function hexStringToBuffer(hexString: string): ArrayBuffer {
    const bytes = new Uint8Array(hexString.length / 2);
    for (let i = 0; i < hexString.length; i += 2) {
        bytes[i / 2] = parseInt(hexString.substring(i, i + 2), 16);
    }
    return bytes.buffer;
}
