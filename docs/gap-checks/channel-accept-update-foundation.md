# Channel Accept and Update Foundation Gap Check

Date: 2026-06-01

## Knowledge Graph Check

No MCP knowledge graph resources or templates were exposed in this session. Gap checking used local source references:

- `docs/project-plan.md`
- `docs/rpc-method-map.md`
- `docs/gap-checks/peers-channels-foundation.md`
- `references/fiber/crates/fiber-lib/src/rpc/README.md`
- `references/fiber/crates/fiber-json-types/src/channel.rs`
- `apps/desktop/src/features/channels/ChannelsPanel.tsx`

## Implemented

- Added an `accept_channel` workflow with temporary channel ID and funding amount inputs.
- Added a confirmed `update_channel` workflow for forwarding enabled state and TLC policy fields.
- Reused the high-risk confirmation dialog for both channel write operations.
- Channel list selection now seeds accept/update/shutdown channel ID fields.
- Extended mock RPC for `accept_channel` and `update_channel`.
- Added tests for mock accept/update persistence.

## Verification

- Frontend typecheck validates the channel workflow RPC parameter construction.
- Unit tests cover mock accept-channel and update-channel behavior.

## Remaining Gaps

- No live FNN accept/update smoke test was executed.
- Shutdown scripts, UDT funding scripts, and advanced accept-channel constraints remain raw-console-only.
- Update-channel values are raw string inputs without schema-aware numeric validation.
- Fee and reserve checks are still warning-only until live balance/liquidity data is wired in.
