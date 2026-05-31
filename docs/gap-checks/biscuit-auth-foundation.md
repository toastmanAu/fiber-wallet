# Biscuit Auth Foundation Gap Check

Date: 2026-05-31

## Knowledge Graph Check

No MCP knowledge graph resources were exposed in this session. Gap checking used the local milestone docs and source references:

- `docs/rpc-permission-map.md`
- `docs/config-schema.md`
- `references/fiber/crates/fiber-lib/src/rpc/biscuit.rs`
- Local `biscuit-auth 6.0.0-beta.3` crate source, matching Fiber's current dependency.

## Implemented

- Added backend Biscuit keypair generation and private-key import using Fiber's Biscuit crate.
- Added token generation for read-only, operator, watchtower, and custom Datalog source templates.
- Added RFC3339 UTC expiry checks to generated tokens.
- Added verified token inspection using a configured public key.
- Persisted only the Biscuit public key in the active profile for generated FNN config.
- Kept Biscuit private keys and session tokens out of persisted frontend profile storage.
- Wired the Auth Vault UI to generate/import keys, generate/import/export tokens by text field, inspect tokens, and apply a session token.

## Verification

- Rust unit coverage added for keypair import round-trip, operator source generation, and generated token verification/inspection.
- Existing public RPC guard still blocks public endpoints without a session Biscuit token.

## Remaining Gaps

- No live FNN auth smoke test yet; token behavior is verified against the Biscuit crate and source-derived permission templates.
- Token export is text-field based; there is no file save dialog yet.
- Private key storage remains intentionally session-only until the hardened OS secret backend is implemented.
- Revocation list management is inspect-only; no node-side revocation configuration workflow yet.
- Custom source is accepted as Biscuit Datalog and parsed by the backend, but there is no richer permission diff UI against the generated method map yet.
