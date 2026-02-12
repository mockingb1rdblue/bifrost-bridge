# Certificate Extraction via Agent

This workflow uses Antigravity's native Chrome capabilities to extract SSL certificates when the Node.js script fails or when visual verification is needed.

## 1. Direct Extraction (Primary)

// turbo

1. Ask the agent to extract the certificate chain from a target URL.
   > Navigate to https://google.com (or the failing URL). Open the Security panel in DevTools. Export the "Certificate Chain" to a file named `extracted_chain.pem` in `bifrost-bridge/.certs/`.

## 2. Verification

2. Verify the file exists.

   ```powershell
   ls .certs/extracted_chain.pem
   ```

3. (Optional) Inspect the certificate to confirm it is the corporate CA.
   ```powershell
   openssl x509 -in .certs/extracted_chain.pem -text -noout
   ```

## 3. Deployment

4. Set the environment variable for the current session.

   ```powershell
   $env:NODE_EXTRA_CA_CERTS = "$PWD\.certs\extracted_chain.pem"
   ```

5. Test a known failing tool (e.g., recursive npm install or git fetch) to verify the fix.
