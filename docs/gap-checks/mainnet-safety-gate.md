# Mainnet Safety Gate Gap Check

Date: 2026-06-01

## Knowledge Graph Check

No MCP knowledge graph resources or templates were exposed in this session. Gap checking used local source references:

- `docs/project-plan.md`
- `apps/desktop/src/lib/profileStore.ts`
- `apps/desktop/src/features/onboarding/OnboardingPanel.tsx`
- `apps/desktop/src/features/dashboard/Dashboard.tsx`

## Implemented

- Kept testnet as the default profile network.
- Added explicit session-only enablement before mainnet can be selected in profile settings.
- Persisted a `mainnetAcknowledgedAt` timestamp when a profile is switched to mainnet.
- Added persistent visible early-build warnings on the Profiles and Dashboard screens for mainnet profiles.
- Switched the default CKB RPC endpoint between testnet and mainnet when the selected network changes.

## Verification

- Frontend typecheck validates the persisted profile shape migration and UI wiring.
- Existing endpoint and RPC tests cover updated profile fixtures.

## Remaining Gaps

- Mainnet selection does not yet require OS keychain unlock or a second operator password.
- Mainnet warnings are visible in core profile/dashboard surfaces but are not repeated on every downstream action screen.
- No live mainnet RPC smoke test was executed.
