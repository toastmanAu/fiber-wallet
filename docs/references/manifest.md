# Reference Manifest

Generated: 2026-05-31

## Knowledge Graph

No knowledge graph tools, MCP resources, or local graph files were exposed in this session. Milestone 0 generated docs from pinned local source checkouts under `references/`.

## Pinned Source References

| Source | Remote | Branch | Commit | Local Path |
| --- | --- | --- | --- | --- |
| Fiber | https://github.com/nervosnetwork/fiber.git | develop | `cc8bc439892b5fe1b37a2299e4915e9a82608c5d` | `references/fiber` |
| CCC | https://github.com/ckb-devrel/ccc.git | master | `2d17eee0dee054517254aca792117520bb0ef3ef` | `references/ccc` |
| JoyID SDK JS | https://github.com/nervina-labs/joyid-sdk-js.git | main | `5f25794006dca5276f6b1f287aa81b460bd9af78` | `references/joyid-sdk-js` |
| CKB | https://github.com/nervosnetwork/ckb.git | develop | `4141cea1fa6f5c21d4d4e8a1ed2b433dd087b0ad` | `references/ckb` |

## Local Toolchain Baseline

| Tool | Version |
| --- | --- |
| Node | `v22.22.0` |
| npm | `captured in package-lock.json / verify with npm --version` |
| rustc | `verify with rustc --version` |
| cargo | `verify with cargo --version` |

## App Package Baseline

- fiber-wallet@0.1.0
- @fiber-wallet/desktop@0.1.0
- Tauri API: `^2.9.0`
- Tauri CLI: `^2.9.4`
- React: `^19.2.0`
- Vite: `^7.2.4`

## Rust Baseline

```toml
[package]
name = "fiber-wallet-desktop"
version = "0.1.0"
description = "Desktop wallet and control panel for Fiber Network Node"
authors = ["Fiber Wallet Contributors"]
license = "MIT"
edition = "2021"

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tauri = { version = "2", features = [] }

```

## Source Files Used

- `references/fiber/README.md`
- `references/fiber/crates/fiber-lib/src/rpc/README.md`
- `references/fiber/crates/fiber-lib/src/rpc/biscuit.rs`
- `references/fiber/docs/biscuit-auth.md`
- `references/fiber/docs/public-nodes.md`
- `references/fiber/config/testnet/config.yml`
- `references/fiber/config/mainnet/config.yml`
- `references/fiber/crates/fiber-types/src/config.rs`
- `references/fiber/crates/fiber-lib/src/config.rs`
- `references/fiber/crates/fiber-lib/src/ckb/config.rs`
