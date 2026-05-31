# Wallet Action Confirmations Gap Check

Date: 2026-06-01

## Knowledge Graph Check

No MCP knowledge graph resources or templates were exposed in this session. Gap checking used local source references:

- `docs/project-plan.md`
- `docs/gap-checks/wallet-key-foundation.md`
- `apps/desktop/src/features/wallet/WalletKeyPanel.tsx`
- `apps/desktop/src/features/common/ConfirmActionButton.tsx`

## Implemented

- Added explicit confirmation before funding key import writes to `ckb/key`.
- Added explicit confirmation before encrypted backup export.
- Added explicit confirmation before encrypted backup restore.
- Confirmation details show data directory, overwrite state, and whether required secret material was provided without echoing secrets.

## Verification

- Frontend typecheck validates the wallet confirmation wiring.
- Existing confirmation component tests cover the dialog-before-action behavior.

## Remaining Gaps

- Confirmations do not yet require OS keychain unlock or second-factor operator authentication.
- Backup export destination is still fixed under the profile data directory.
- Funding address and balance display are still pending real CKB address/lock derivation and live CKB balance integration.
