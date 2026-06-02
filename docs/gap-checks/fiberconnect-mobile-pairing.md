# FiberConnect Mobile Pairing Gap Check

Date: 2026-06-01

## Knowledge Graph Check

No MCP knowledge graph resources were exposed in this session. Gap checking used the local protocol document provided by the user:

- `/home/phill/.gemini/antigravity/brain/616fa02a-59c5-473d-bcd3-c6ee6cac3459/fiberconnect_protocol.md`

## Source Findings

- FiberConnect pairing URIs use `fiberconnect://` followed by a Base64-URL encoded minified JSON payload.
- Required payload fields are `rpc_url` and `auth_token`.
- Optional payload field is `cert_fingerprint` for self-signed TLS certificate pinning.
- Desktop WebGUI should expose a "Pair Mobile Wallet" flow, generate a limited Biscuit token, display a high-density QR code, and provide a copyable link.
- The recommended mobile token scope is limited to node monitoring, channel/peer/payment reads, and invoice creation.

## Implemented

- Added a `mobile_pairing` Biscuit template with:
  - `read("node")`
  - `read("peers")`
  - `read("channels")`
  - `read("payments")`
  - `write("invoices")`
- Added FiberConnect URI creation/parsing helpers with Base64-URL encoding and payload validation.
- Added Auth Vault "Pair Mobile Wallet" controls for pairing RPC URL, 30-day mobile token expiry, optional TLS certificate fingerprint, QR generation, and link copy.
- QR generation is local in the app through the `qrcode` package; no token is sent to an external QR service.
- Added desktop-side Biscuit inspection before QR/link creation. The UI now verifies the generated token against the exact limited mobile-pairing scope and expiry, and clears any stale QR before regeneration.
- Added tests for FiberConnect URI round-trip, omitted empty fingerprints, invalid URL schemes, and mobile-pairing Biscuit scope.

## Verification

- `npm run lint` passes.
- `npm test` passes (61 tests across 13 files).
- `cargo fmt --check` passes.
- `cargo test` passes (24 tests, 24 pass).

## Remaining Gaps

- No end-to-end scan was performed against the companion app camera flow.
- Certificate fingerprint format is not normalized or verified against a live TLS endpoint yet.
- The QR payload can be large; very long Biscuit tokens may need QR version/error-correction tuning after real-device scans.
