# Peers and Channels Foundation Gap Check

Date: 2026-06-01

## Knowledge Graph Check

No MCP knowledge graph resources were exposed in this session. Gap checking used local generated docs and Fiber source references:

- `docs/rpc-method-map.md`
- `docs/rpc-permission-map.md`
- `references/fiber/crates/fiber-lib/src/rpc/peer.rs`
- `references/fiber/crates/fiber-lib/src/rpc/channel.rs`
- `references/fiber/crates/fiber-lib/src/rpc/README.md`
- `references/fiber/docs/network-nodes.md`
- `references/fiber/docs/public-nodes.md`
- `references/fiber/config/testnet/config.yml`

## Implemented

- Added a Peers view for `list_peers`, `connect_peer`, and `disconnect_peer`.
- Added persisted, non-secret peer address book entries to profile metadata.
- Added public testnet channel-capable node shortcuts from Fiber's pinned public-node docs.
- Added a Channels view for `list_channels`, `open_channel`, and confirmed `shutdown_channel`.
- Added list filters for peer pubkey, closed channels, and pending channels.
- Added a first-pass reserved-capacity warning using the documented public testnet auto-accept baseline.
- Expanded mock RPC state so peer connect/disconnect and channel open/shutdown can be exercised without a live node.

## Verification

- Frontend typecheck validates the new panels and profile schema.
- Frontend unit tests cover mock peer connect/disconnect and channel open/shutdown state.
- Existing guarded RPC behavior still applies to public live endpoints without a Biscuit token.

## Remaining Gaps

- No live FNN testnet relay connection was executed in this slice.
- Channel opening is a minimal wizard; advanced options from `open_channel` are not exposed yet.
- Fee and reserve checks are warning-only until live CKB balance and node liquidity data are wired in.
- Shutdown uses the default/force path only; custom close script and fee-rate fields are not exposed yet.
- Channel update and accept-channel workflows are still pending.
