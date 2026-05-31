# Local Node Manager Foundation Gap Check

Date: 2026-05-31

## Knowledge Graph Availability

No knowledge graph tools, MCP resources, or local graph files were exposed in this session. This slice uses `docs/config-schema.md`, the pinned Fiber config files, and `docs/project-plan.md` as its baseline.

## Implemented

- Added local FNN profile fields:
  - FNN binary path
  - data directory
  - config path
  - RPC listen address
  - P2P listen address
- Added Tauri backend commands:
  - `node_preflight`
  - `node_generate_config`
  - `node_write_config`
  - `node_start`
  - `node_stop`
  - `node_status`
  - `node_read_logs`
- Added managed-process state keyed by profile id.
- Added preflight checks for:
  - missing FNN binary
  - missing data directory
  - missing config file
  - missing funding key at `ckb/key`
  - occupied RPC port
- Added `FIBER_SECRET_KEY_PASSWORD` requirement before start.
- Added generated `config.yml` writer for testnet/mainnet skeleton config.
- Added log file capture at `<data_dir>/fiber-wallet-fnn.log`.
- Added log tailing with basic secret redaction.
- Added Settings UI for local node manager controls.
- Added Rust unit coverage for config generation.

## Security Notes

- `node_start` rejects missing unlock passwords before spawn.
- Logs are written to a profile data-dir file and read back through redaction.
- No arbitrary shell execution is exposed; only the configured FNN binary path is executed with fixed args.

## Remaining Gaps

- No bundled pinned `fnn` sidecar binary exists yet.
- Sidecar `externalBin` packaging is not configured yet.
- Config generation is a minimal skeleton and does not preserve the full pinned Fiber testnet/mainnet defaults.
- UI path fields are text inputs; file/folder picker integration is pending.
- Process lifecycle cleanup on app exit is not implemented yet.
- Log streaming is polling/read-back only, not event-based tailing.
- Start/stop behavior has not been smoke-tested against a real FNN binary in this repo.
