# Engineering Overview: Fly.io Machines and Migration Patterns

This report provides a high-level technical summary of Fly.io's compute infrastructure (Fly Machines) and the established patterns for managing database migrations in production environments, specifically focusing on Elixir/Phoenix applications.

---

## 1. Fly Machines: High-Level Architecture

Fly Machines are hardware-virtualized sandboxes designed to run any code with the speed of a container and the security of a virtual machine.

### Core Characteristics

- **Hardware Virtualization:** All applications run in isolated sandboxes using KVM hardware isolation on a memory-safe Rust and Go stack.
- **Instant Scaling:** Machines are "sprites" that launch in under a second. They can be started to handle individual HTTP requests and shut down when idle to optimize costs.
- **Process-like Management:** VMs can be forked like processes, allowing applications to scale into tens of thousands of instances.
- **Global Distribution:** Deployable across 18 regions (e.g., Sydney, São Paulo) to maintain sub-100ms latency.
- **Resource Efficiency:** Billed by the second for actual CPU and memory consumption.

### Infrastructure Components

- **Storage:** Supports fast local NVMe for low-latency workloads and durable global object storage. Environments can be snapshotted and restored.
- **Networking:** Built-in private networking with granular routing and automatic end-to-end encryption.
- **Specialized Workloads:** Optimized for AI agents (dedicated CPUs/GPUs, private filesystems) and clustered databases (CockroachDB, Postgres).

---

## 2. Migration Patterns for Production Releases

In production environments using compiled releases (such as Elixir Mix Releases), the `mix` tool is typically unavailable. This necessitates a programmatic approach to database management.

### The Release Module Pattern

The recommended pattern is to encapsulate migration logic within a dedicated module (e.g., `MyApp.Release`). This module acts as the entry point for administrative tasks.

#### Implementation Example:

```elixir
defmodule MyApp.Release do
  @app :my_app

  def migrate do
    for repo <- repos() do
      {:ok, _, _} = Ecto.Migrator.with_repo(repo, &Ecto.Migrator.run(&1, :up, all: true))
    end
  end

  def rollback(repo, version) do
    {:ok, _, _} = Ecto.Migrator.with_repo(repo, &Ecto.Migrator.run(&1, :down, to: version))
  end

  defp repos do
    Application.load(@app)
    Application.fetch_env!(@app, :ecto_repos)
  end
end
```

### Execution via CLI

Tasks are executed on the Fly Machine using the `eval` command, which starts a slim instance of the Erlang VM:

- **Run Migrations:** `bin/my_app eval "MyApp.Release.migrate()"`
- **Check Status:** `bin/my_app eval "MyApp.Release.migration_status()"`
- **Rollback:** `bin/my_app eval "MyApp.Release.rollback(MyApp.Repo, 20210709121212)"`

---

## 3. Engineering Best Practices for Safe Migrations

To avoid "unscheduled maintenance" and system downtime, migrations must be designed with database locks and timeouts in mind.

### Database Safeguards

- **Migration Locking:** Ecto automatically acquires a `SHARE UPDATE EXCLUSIVE` lock on the `schema_migrations` table. This prevents multiple nodes from running migrations simultaneously during a rolling deploy.
- **Lock Timeouts:** To prevent a migration from hanging and blocking application traffic, a `lock_timeout` should be set. This aborts any statement waiting too long for a lock.
- **Statement Timeouts:** A `statement_timeout` should be configured (e.g., at the Database Role level) to kill any query exceeding a reasonable duration (e.g., 10 minutes).

### Transaction Management

- **DDL Transactions:** By default, Ecto wraps migrations in a transaction. If a migration fails, the database is not left in a partial state.
- **Non-Transactional Operations:** Certain operations, such as `CREATE INDEX CONCURRENTLY`, cannot run inside a transaction. In these cases, developers must use `@disable_ddl_transaction true` and `@disable_migration_lock true`.

### Data Backfilling

Data migrations (backfilling) should be handled separately from schema migrations to avoid long-running locks on production tables.

- **Pattern:** Generate migrations in a custom path (e.g., `priv/repo/data_migrations`).
- **Execution:** Use a dedicated `migrate_data` function in the Release module to run these one-off processes.

```elixir
def migrate_data(opts \\ [all: true]) do
  for repo <- repos() do
    path = Ecto.Migrator.migrations_path(repo, "data_migrations")
    {:ok, _, _} = Ecto.Migrator.with_repo(repo, &Ecto.Migrator.run(&1, path, :up, opts))
  end
end
```
