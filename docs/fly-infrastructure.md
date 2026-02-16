# Fly.io Infrastructure

The swarm's physical runtime environment is hosted on Fly.io, providing low-latency, containerized execution for agents and persistent storage for events.

## Core Applications

The following apps have been provisioned:

1.  **`bifrost-runner-mock1ng`**: The host app for agent runners (Worker Bees). Agents run as Fly Machines within this app.
2.  **`bifrost-events-mock1ng`**: The host for the "Annals of Ankou" event store, which maintains the swarm's collective memory in a SQLite database.

## Networking: WireGuard 6PN

To allow secure communication between local components (like the custom router or management scripts) and the Fly.io internal network, a WireGuard tunnel is used.

### Configuration
The WireGuard configuration is stored in `.fly/wireguard.conf`. This file contains the private key and endpoint details needed to connect to the `sea` region peer.

### Establishing the Connection
You can use the WireGuard CLI or a GUI client to import this configuration and establish the 6PN (Private Network) tunnel.

## App Management

Apps are created and managed via `flyctl`.

-   **Create App**: `flyctl apps create [name]`
-   **Create WireGuard Peer**: `flyctl wireguard create [org] [region] [name] stdout`
-   **Status**: `flyctl status -a [app-name]`
