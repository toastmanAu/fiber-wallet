# Fiber Config Schema Notes

Generated from pinned Fiber config sources.

## Source Files

- `references/fiber/config/testnet/config.yml`
- `references/fiber/config/mainnet/config.yml`
- `references/fiber/crates/fiber-types/src/config.rs`
- `references/fiber/crates/fiber-lib/src/config.rs`
- `references/fiber/crates/fiber-lib/src/ckb/config.rs`

## Observed Top-Level Sections

Testnet config:

- `fiber`
- `rpc`
- `ckb`
- `services`

Mainnet config:

- `fiber`
- `rpc`
- `ckb`
- `services`

## Source-Backed Startup Requirements

- FNN uses a data directory passed with `fnn -d`.
- FNN uses a config file passed with `fnn -c`.
- Built-in wallet funding key material is stored at `ckb/key` under the node data directory.
- `FIBER_SECRET_KEY_PASSWORD` must be set before starting FNN so the wallet private key file can be encrypted/decrypted.
- `RUST_LOG` can configure log verbosity.
- Biscuit RPC public key can be configured under the `rpc` section as `biscuit_public_key`.
- If `biscuit_public_key` is unset, RPC does not require authentication.
- Fiber refuses to start on a public IP address if authentication is not enabled.

## App Implications

- Managed local profiles must model config path, data dir, RPC bind address, RPC port, CKB RPC endpoint, FNN binary path, and unlock state.
- Public/non-loopback RPC bind must be blocked unless Biscuit auth is configured.
- Config editing should use schema-backed forms rather than arbitrary text editing for MVP.
- Node start should fail before spawning if key/password/config/data-dir prerequisites are missing.
