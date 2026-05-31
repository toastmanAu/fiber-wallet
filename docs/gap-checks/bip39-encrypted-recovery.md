# BIP39 Encrypted Recovery Gap Check

Date: 2026-06-01

## Knowledge Graph Check

No MCP knowledge graph resources or templates were exposed in this session. Gap checking used local source references:

- `docs/project-plan.md`
- `docs/gap-checks/wallet-key-foundation.md`
- `apps/desktop/src-tauri/src/main.rs`
- `apps/desktop/src/features/wallet/WalletKeyPanel.tsx`
- `apps/desktop/src/lib/redaction.ts`

## Implemented

- Added backend-only BIP39 mnemonic import into an encrypted backup envelope.
- Added BIP39 mnemonic word-count and alphabetic-word validation.
- Added encrypted BIP39 backup validation.
- Added Wallet UI controls for confirmed BIP39 import and backup validation.
- Plaintext mnemonic is never returned to the frontend after import and is cleared from UI state on success.
- Added Rust tests proving encrypted BIP39 backup validation and that backup contents do not contain the plaintext phrase.

## Verification

- Rust tests cover encrypted BIP39 import/validation.
- Frontend typecheck validates Wallet UI command wiring.
- Existing redaction tests cover BIP39-style recovery phrase redaction in diagnostics/log text.

## Remaining Gaps

- Mnemonic checksum validation is structural only until a vetted BIP39 wordlist/checksum implementation is added.
- BIP39 backup is not yet used to derive the FNN `ckb/key`; CKB key derivation path remains unspecified.
- BIP39 export is encrypted-backup-only; plaintext mnemonic export remains intentionally unsupported.
- OS keychain/Stronghold-backed secret storage remains pending.
