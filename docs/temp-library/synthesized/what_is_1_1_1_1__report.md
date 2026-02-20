# Engineering Overview: 1.1.1.1 DNS Resolver

## Definition and Core Function

**1.1.1.1** is Cloudflare’s public Recursive DNS resolver. It serves as a directory for the internet by translating human-readable domain names (e.g., `cloudflare.com`) into the machine-readable IP addresses (e.g., `104.16.123.96`) required to establish network connections.

## Key Technical Attributes

### 1. Performance and Infrastructure

- **Speed:** 1.1.1.1 has been measured as the fastest DNS resolver available.
- **Global Distribution:** The service is deployed in hundreds of cities worldwide.
- **Low Latency:** It achieves high performance by having access to the addresses of millions of domain names directly on the same servers where the resolver runs.

### 2. Privacy and Security

- **Data Privacy:** Unlike many traditional DNS resolvers, 1.1.1.1 does not sell user data to advertisers.
- **Encryption Protocols:** To prevent eavesdropping and manipulation, the service supports encrypted DNS queries via:
  - **DNS over HTTPS (DoH)**
  - **DNS over TLS (DoT)**
- **Tor Integration:** Users can access 1.1.1.1 as a Tor hidden service for enhanced anonymity.

## Service Variants

### 1.1.1.1 for Families

This specialized version of the resolver includes built-in security filtering to provide:

- **Malware Protection:** Automatically blocks known malicious domains.
- **Adult Content Filtering:** Blocks access to adult-oriented material.

## Implementation and Integration

The service is free and can be configured in several ways:

- **Standard Setup:** Can be configured at the operating system or router level without special software.
- **WARP Client:** A related product that utilizes Cloudflare's network to provide a more secure and private internet experience.
- **Alternative Integrations:**
  - DNS in Google Sheets.
  - DNS over Discord.
  - DNS over Tor.

## Related Cloudflare Infrastructure

While 1.1.1.1 is a public resolver, it is part of a broader DNS ecosystem that includes:

- **Authoritative DNS:** Cloudflare's global DNS platform for domain owners, providing DNSSEC and protection against route leaks/hijacking.
- **Cloudflare Spectrum:** Acceleration and security for TCP/UDP-based applications.
- **Cloudflare Workers:** A serverless execution environment that can interact with web requests. For example, a Worker can be used to fetch resources from a remote host:

```javascript
export default {
  async fetch(request) {
    /**
     * Replace `remote` with the host you wish to send requests to
     */
    const remote = 'https://example.com';

    return await fetch(remote, request);
  },
};
```
