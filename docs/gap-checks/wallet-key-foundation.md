# Wallet Key Foundation Gap Check

Date: 2026-05-31

## Knowledge Graph Availability

No knowledge graph tools, MCP resources, or local graph files were exposed in this session. This slice uses the pinned Fiber README, public-nodes docs, backup guide notes, and `docs/project-plan.md` as its baseline.

## Implemented

- Added backend wallet commands:
  - `wallet_status`
  - `wallet_import_ckb_key`
  - `wallet_export_encrypted_backup`
  - `wallet_validate_backup`
  - `wallet_restore_encrypted_backup`
- Imported CKB CLI exported-key contents by extracting the first non-empty private-key line.
- Validated imported private key material as a 32-byte hex string with optional `0x` prefix.
- Wrote imported key to `<data_dir>/ckb/key`.
- Applied `0600` permissions on Unix for key and backup files.
- Added encrypted key backup envelope:
  - Argon2id-derived key
  - AES-256-GCM encryption
  - random salt and nonce
  - JSON envelope stored at `<data_dir>/ckb/fiber-wallet-key-backup.json`
- Added backup validation and restore commands.
- Added Wallet UI panel for import, backup, validate, and restore.
- Added Rust unit tests for key extraction and encrypted backup round-trip.

## Security Notes

- Raw private key material is accepted only by backend command and is not returned to the frontend.
- The wallet UI clears pasted exported-key contents after import.
- Backup passphrase is session input only and is not persisted.
- Encrypted backups require passphrases of at least 12 characters.

## Remaining Gaps

- Actual new key generation is not implemented yet.
- PQR lock options for ML-DSA, SPHINCS+, and Falcon remain modeled but not source-verified or generated.
- BIP39 mnemonic generation/import/export remains a requirement but is not implemented yet.
- Funding address/balance display is not implemented yet.
- Backup file path is fixed to the profile data dir; user-selected export destinations are pending.
- Restore has not been smoke-tested against a real FNN node.
