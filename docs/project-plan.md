# WebGUI Fiber Network Wallet - Revised Coding Agent Implementation Plan

## Goal
Build a desktop WebGUI wallet/control panel for a local or remote Fiber Network Node (FNN). The app should be a local-first desktop client for Fiber RPC, local node process management, CKB wallet funding flows, Biscuit authentication, peer/channel management, invoices, payments, graph/routing, and diagnostics.

Primary UX: a wallet, node console, and payment-channel cockpit in one. The interface can use a cyberpunk visual direction, but correctness, secret safety, and clear operational state take priority.

## Current workspace state
- Project root currently contains this plan only.
- There is no application scaffold yet.
- The previously referenced `/mnt/data/*.zip` archives are not available in this environment.
- No knowledge graph tools, MCP resources, or local graph files are exposed in the current session.

Because of this, Milestone 0 must first establish the local reference corpus and knowledge graph gap-check path before feature work starts.

## Source of truth and version policy

### Required primary references
Use official/local sources first. If local archives are unavailable, fetch or clone/pin these upstream repositories before implementation:

1. `nervosnetwork/fiber`
   - `README.md`: node build/run, key setup, migration warnings.
   - `crates/fiber-lib/src/rpc/README.md`: generated RPC reference.
   - `docs/biscuit-auth.md`: Biscuit bearer token auth rules and token generation.
   - `docs/public-nodes.md`: public node topology, current pubkey-based RPC examples, channel capacity notes.
   - `crates/fiber-cli/README.md`: CLI command mapping and auth usage.
   - `fiber-js/README.md`: JS/WASM wrapper and external funding notes.
   - `tests/bruno/e2e/*`: JSON-RPC request examples.
   - `crates/fiber-lib/src/rpc/biscuit.rs`: exact method permission rules.

2. `ckb-devrel/ccc`
   - `README.md`, docs, package examples: CKB transaction composition and wallet connector references.

3. `nervina-labs/joyid-sdk-js`
   - `README.md`, `packages/ckb`, examples: JoyID CKB signing/connection references.

4. `nervosnetwork/ckb`
   - CKB RPC and node reference source.

### Version pinning
Before coding any RPC or config behavior, pin:
- Fiber/FNN release or commit.
- RPC documentation commit.
- Public nodes documentation commit.
- FNN config file schema and sample configs.
- CCC package version.
- JoyID package version, if external signing is in scope.
- Tauri, Rust, Node, pnpm/npm package manager versions.

Provisional Fiber baseline: `fnn v0.8.1` or newer after verification. Do not assume older `PeerId` examples are valid; current Fiber docs use `pubkey` in RPC examples.

### Knowledge graph gap-check requirement
At the start of each milestone:
- Query the available knowledge graph for entities and relations covering Fiber RPC methods, auth permissions, FNN config keys, sidecar packaging, key lifecycle, and channel/payment flows.
- Compare graph output against the pinned source corpus.
- Record mismatches in `docs/gap-checks/milestone-N.md`.
- If no knowledge graph is available, record that fact in the gap-check file and perform the same comparison against the pinned source corpus directly.

Gap checks must answer:
- Which planned features have no verified source backing?
- Which source-backed requirements are missing from the plan or implementation?
- Which RPC methods or params changed since the previous baseline?
- Which security or migration warnings are newly relevant?

## Recommended stack
- Desktop shell: Tauri 2.
- Backend: Rust Tauri commands for RPC proxying, node process control, config, secrets, logs, and diagnostics.
- Frontend: React + TypeScript + Vite.
- UI: Tailwind + shadcn/ui + Framer Motion + lucide-react.
- Data fetching: TanStack Query for RPC polling/cache.
- UI state: Zustand.
- Graph visualization: Cytoscape or a focused graph library; avoid overbuilding in MVP.
- Charts: Recharts where actual timeseries data exists.
- Secrets: OS keychain where available; Tauri Stronghold only after an explicit vault unlock model is designed.
- Non-secret local data: SQLite for labels, address book, settings metadata, and history snapshots.
- Fiber integration: JSON-RPC client first.
- CKB tooling: CCC for CKB address/transaction/display helpers.
- External signing: JoyID/CCC after MVP, only for external funding flows.

## Architecture

### 1. Tauri Rust backend
Responsibilities:
- Proxy whitelisted Fiber JSON-RPC calls through `rpc_call`.
- Store endpoint metadata and token references.
- Store secrets only through OS keychain/Stronghold.
- Manage local FNN profiles and config files under the app data directory.
- Spawn/stop/restart bundled FNN sidecars.
- Tail logs and emit structured log events.
- Generate diagnostic bundles with secret redaction.
- Generate/import/export Biscuit tokens and keys only through hardened commands.

Commands:
- `rpc_call`
- `node_start`
- `node_stop`
- `node_restart`
- `node_status`
- `profile_create`
- `profile_update`
- `profile_list`
- `write_config`
- `read_config`
- `read_logs`
- `tail_logs`
- `generate_biscuit_keypair`
- `generate_biscuit_token`
- `import_token`
- `export_token`
- `validate_backup`
- `export_diagnostics`

Security boundaries:
- Never expose arbitrary shell execution to the frontend.
- Keep raw private keys, Biscuit private keys, tokens, and exported key files out of frontend memory wherever possible.
- Redact secrets in logs, diagnostics, errors, and telemetry.
- Enforce an RPC method allowlist by default.
- Gate raw RPC console behind advanced mode and method risk labels.

### 2. Sidecar packaging model
Tauri 2 sidecar support must be implemented explicitly:
- Configure `externalBin` for platform-specific FNN binaries.
- Store sidecar binaries in the expected Tauri bundle path and naming convention.
- Add shell plugin/capabilities only for the exact bundled sidecar.
- Use static argument definitions where possible; allow dynamic args only with narrow regex patterns for config path, data dir, and log path.
- Do not let frontend call the shell plugin directly for FNN.
- Start FNN from Rust commands with controlled environment variables.
- Track PID, profile, data dir, config path, RPC port, P2P port, and log path.
- Detect port collisions before startup.
- Handle app shutdown and crashed sidecars.
- Provide per-profile status: stopped, starting, syncing/booting, ready, unhealthy, crashed.

FNN startup must account for:
- `FIBER_SECRET_KEY_PASSWORD`.
- `RUST_LOG`.
- Config file path.
- Data directory.
- Network selection.
- CKB RPC endpoint.
- RPC listening address, defaulting to `127.0.0.1`.

### 3. RPC service module
Default endpoint: `http://127.0.0.1:8227`.

Responsibilities:
- Construct JSON-RPC 2.0 POST requests.
- Add `Authorization: Bearer <token>` when configured.
- Normalize hex/u128 values for display while preserving raw values.
- Map errors into actionable UI states:
  - auth required
  - invalid/expired token
  - permission denied
  - connection refused
  - malformed params
  - insufficient funds
  - peer offline
  - channel not ready
  - route not found
  - stale graph/route data
  - node version mismatch
- Log request method and response class, never params containing secrets.

Type strategy:
- Generate method param/result types from pinned RPC docs where practical.
- Hand-write focused types only for MVP flows if generation is too slow.
- Keep raw JSON escape hatches only in the advanced console.

### 4. Frontend app
Layout:
- Persistent sidebar on desktop.
- Bottom navigation or condensed rail on narrow screens.
- Dedicated status area for node/profile/network/RPC/auth state.
- Confirmation screens for money-moving and destructive operations.

Frontend principles:
- Show exact node state before offering operations.
- Preview transaction/payment/channel effects before execution.
- Distinguish CKB wallet balance, reserved channel capacity, outbound liquidity, inbound liquidity, and fees.
- Treat mainnet as explicitly enabled, never default.
- Use compact dashboard controls; avoid marketing/landing-page layout.

## MVP feature scope

### 1. Onboarding and profiles
Modes:
- Local node managed by app.
- Existing local Fiber RPC.
- Remote Fiber RPC with Biscuit token.

Profile fields:
- Profile name.
- Network: testnet default; mainnet requires explicit enablement.
- Fiber RPC endpoint.
- CKB RPC endpoint.
- Data directory.
- FNN binary source: bundled, selected local binary, or remote-only.
- RPC auth token reference.
- Biscuit public key configuration state.

Health checks:
- Fiber RPC reachable.
- `node_info` works.
- CKB RPC reachable.
- Auth required/not required.
- Token permission sufficient for dashboard.
- Data dir writable for local profiles.
- Ports available for local profiles.
- FNN version matches pinned supported range.

Acceptance criteria:
- A user can create a remote RPC profile and see `node_info`.
- A user can create a local managed-node profile but is blocked from start if required key/password/config values are missing.
- Health failures produce specific remediation text.

### 2. Wallet/key setup
MVP approach:
- Use FNN built-in wallet key file workflow.
- Keep private key handling in Rust/backend only.
- Support create/import of `ckb/key` into the profile data directory.
- Key generation must support PQR lock profiles after source validation:
  - ML-DSA
  - SPHINCS+
  - Falcon
- Key import/export must support BIP39 mnemonic recovery flows, with encrypted export and explicit seed phrase redaction in all logs/diagnostics.
- Require an unlock/password flow for `FIBER_SECRET_KEY_PASSWORD`.
- Store password only if the user explicitly opts in and a secure backend is available.

Required UI states:
- No key.
- Key imported but node not yet started/encrypted.
- BIP39 mnemonic import pending validation.
- BIP39 encrypted backup available.
- Locked.
- Unlocked for session.
- Running with key.
- Backup recommended.

Key handling:
- Import private key from CKB CLI exported key format by extracting only the private key line.
- Import BIP39 mnemonic only through backend-controlled forms; never persist plaintext mnemonic.
- Export BIP39 mnemonic only through an encrypted backup flow with confirmation.
- Set restrictive file permissions where supported.
- Delete temporary imported/exported material after use.
- Never display raw private key after import.
- Never display full mnemonic after import/export confirmation.
- Export encrypted backup only after confirmation.

Acceptance criteria:
- User can create/import a funding key for a local profile.
- User can choose a PQR lock algorithm profile when generating new funding key material, once the lock scripts and signing flow are verified against pinned sources.
- User can import/export BIP39 wallet recovery material only through encrypted, redacted flows.
- User can start FNN only after entering the required password.
- Diagnostics and logs redact key material.

### 3. Biscuit Auth Vault
Features:
- Generate Ed25519 Biscuit keypair.
- Import existing Biscuit public/private key.
- Configure node `rpc.biscuit_public_key`.
- Generate tokens from exact method permission templates.
- Import/export token as `.fiber-token`.
- Inspect token permissions and expiry.

Token templates must be generated from the pinned permission matrix:
- Read-only dashboard.
- Operator.
- Watchtower.
- Full admin.
- Custom advanced template.

Rules:
- Add expiration by default.
- Warn for no expiry.
- Warn/block public RPC without Biscuit auth.
- Detect missing permission before executing a known RPC method.

Acceptance criteria:
- A read-only token can load dashboard data but cannot open channels or send payments.
- An operator token can perform peer/channel/payment/invoice operations according to the permission matrix.
- Expired or insufficient tokens produce clear UI errors.

### 4. Dashboard
Cards:
- Node: alias, pubkey, addresses, network, version, profile status.
- Wallet: CKB/UDT balances where available.
- Channel liquidity: inbound, outbound, total by asset.
- Peers: count and connection health.
- Payments/invoices: recent activity.
- Warnings: unauthenticated public RPC, stale node, unsupported version, low CKB, disconnected peers, unclosed channels before upgrade, route graph not ready.

Acceptance criteria:
- Dashboard works with mocked RPC and a live/pinned FNN node.
- Dashboard degrades cleanly when optional data is unavailable.

### 5. Peers
Features:
- Connect peer by `pubkey` and address/multiaddr when required by the pinned RPC shape.
- Disconnect peer by `pubkey`.
- List peers.
- Label peers locally.
- Save address book entries.
- QR import/export for peer addresses.
- Include public relay shortcuts from pinned public-node docs.

RPC:
- `connect_peer`
- `disconnect_peer`
- `list_peers`

Acceptance criteria:
- User can connect to a public testnet relay from the UI.
- User can list and disconnect peers.
- Address book labels survive restart.

### 6. Channels
Open channel wizard:
- Select connected peer.
- Show peer pubkey and label.
- Funding amount.
- Asset/UDT script.
- Public/private.
- One-way.
- Fee rate settings.
- Shutdown script.
- Advanced TLC/forwarding params.
- Reserved capacity estimate.
- On-chain fee/change estimate where possible.
- Confirmation preview.

Channel list:
- Filter by state, peer, asset.
- Show temporary vs final channel ID where relevant.
- Show readiness and settlement states.
- Explain why payments may fail immediately after `ChannelReady` if graph/route data is not ready.

Actions:
- Accept channel request.
- Update forwarding parameters.
- Shutdown channel with final warning and settlement preview.
- Hide abandon channel behind advanced/dev gate.

RPC:
- `open_channel`
- `accept_channel`
- `list_channels`
- `update_channel`
- `shutdown_channel`
- `abandon_channel` as advanced/dev only

Acceptance criteria:
- User can open a testnet channel only after seeing reserved-capacity and fee warnings.
- User can track channel state until ready.
- User can shut down a channel only through a confirmation flow.

### 7. Invoices and receive
Features:
- New invoice form: amount, currency, description, expiry, optional preimage.
- Decode/parse invoice.
- Invoice detail with status polling.
- Export invoice as QR, URI, and text.
- Cancel invoice.
- Settle invoice advanced/dev only if appropriate for pinned RPC behavior.

RPC:
- `new_invoice`
- `parse_invoice`
- `get_invoice`
- `cancel_invoice`
- `settle_invoice`

Acceptance criteria:
- User can create a testnet invoice and monitor status.
- User can parse a pasted invoice and see amount/currency/expiry.

### 8. Send/payments
Features:
- Paste invoice.
- Direct payment advanced form.
- Preview route/fees when `build_router` succeeds.
- Explain route-not-found and stale graph states.
- Send payment.
- Payment detail timeline: created, routing, pending, succeeded, failed.
- Retry/lookup payment.

RPC:
- `send_payment`
- `get_payment`
- `build_router`
- `send_payment_with_router`
- `list_payments`

Acceptance criteria:
- User can preview and send a testnet payment.
- Failed route/payment states are actionable.
- Payment history survives app restart as non-secret local metadata.

### 9. Network graph/router
Features:
- Visual graph of known nodes/channels.
- Search by pubkey.
- Highlight local node, peers, channels, and possible routes.
- Show stale/empty graph states without blocking core wallet functionality.

RPC:
- `graph_nodes`
- `graph_channels`

Acceptance criteria:
- Graph renders with mocked data and live RPC data.
- Empty graph states explain how to connect peers/open channels.

### 10. Terminal/raw RPC console
Features:
- Method palette from pinned RPC method map.
- Raw JSON request/response viewer.
- Save snippets locally.
- Risk labels for advanced/dev methods.
- Optional raw method execution only after advanced mode is enabled.

Rules:
- Whitelist MVP methods by default.
- Block known dangerous/dev methods unless explicitly enabled.
- Redact secrets in saved snippets.

Acceptance criteria:
- User can call `node_info` from console.
- Console rejects non-whitelisted methods by default.

### 11. Settings, logs, diagnostics
Features:
- Fiber config editor with schema-backed forms.
- RPC endpoint manager.
- CKB RPC endpoint manager.
- Theme selector.
- Data directory and backup/export.
- Logs screen.
- Diagnostic export with redaction.
- Version/migration status.

Acceptance criteria:
- Diagnostics bundle includes profile metadata, versions, config with secrets redacted, recent logs redacted, RPC health summary, and gap-check baseline.
- Bundle never includes tokens, private keys, seed material, raw exported key files, or unlock passwords.

## RPC method coverage

### MVP
- `node_info`
- `connect_peer`
- `disconnect_peer`
- `list_peers`
- `open_channel`
- `accept_channel`
- `list_channels`
- `update_channel`
- `shutdown_channel`
- `new_invoice`
- `parse_invoice`
- `get_invoice`
- `cancel_invoice`
- `send_payment`
- `get_payment`
- `build_router`
- `send_payment_with_router`
- `list_payments`
- `graph_nodes`
- `graph_channels`

### Advanced/dev after MVP
- CCH: `send_btc`, `receive_btc`, `get_cch_order`
- External funding: `open_channel_with_external_funding`, `submit_signed_funding_tx`, `sign_external_funding_tx`
- Dev/TLC methods: `commitment_signed`, `add_tlc`, `remove_tlc`, `submit_commitment_transaction`, `check_channel_shutdown`
- Profiling: `pprof`
- Watchtower methods:
  - `create_watch_channel`
  - `remove_watch_channel`
  - `update_revocation`
  - `update_pending_remote_settlement`
  - `update_local_settlement`
  - `create_preimage`
  - `remove_preimage`

## Folder structure
```text
fiber-wallet/
  apps/
    desktop/
      src-tauri/
        src/
          main.rs
          commands/
            rpc.rs
            node.rs
            profiles.rs
            config.rs
            secrets.rs
            biscuit.rs
            logs.rs
            diagnostics.rs
          sidecars/
          schemas/
        capabilities/
        tauri.conf.json
      src/
        app/
        components/
        features/
          onboarding/
          dashboard/
          wallet/
          auth/
          peers/
          channels/
          invoices/
          payments/
          graph/
          terminal/
          settings/
        lib/
          fiberRpc.ts
          rpcTypes.ts
          format.ts
          validators.ts
          queryKeys.ts
          redaction.ts
        styles/
  docs/
    references/
    gap-checks/
    rpc-method-map.md
    rpc-permission-map.md
    config-schema.md
    sidecar-packaging.md
    security-model.md
    design-system.md
    testing-playbook.md
  scripts/
    ingest-references.sh
    generate-rpc-method-map.ts
    generate-rpc-permission-map.ts
    verify-redaction.ts
```

## RPC client shape
Frontend:
```ts
export async function fiberRpc<T>(method: string, params: unknown[] = []): Promise<T> {
  return invoke<T>("rpc_call", { method, params });
}
```

Rust command responsibilities:
- Load endpoint/token from secure app state.
- Validate method against allowlist.
- Validate params with method schema where available.
- Construct JSON-RPC body.
- Add bearer token when present.
- Return typed JSON or structured error.
- Never include token or sensitive params in logs.

## Milestones

### Milestone 0 - Reference ingestion, version pinning, and gap checks
Tasks:
- Create project scaffold or confirm target app root.
- Establish `docs/references`.
- Fetch or unpack required source repositories.
- Pin exact versions/commits in `docs/references/manifest.md`.
- Generate `docs/rpc-method-map.md`.
- Generate `docs/rpc-permission-map.md`.
- Generate `docs/config-schema.md`.
- Create `docs/gap-checks/milestone-0.md`.
- Record knowledge graph availability and comparison results.

Acceptance criteria:
- All MVP RPC methods have verified params/returns.
- All MVP RPC methods have permission requirements recorded.
- FNN startup/config requirements are documented.
- Missing local archives are no longer a blocker.

### Milestone 1 - Desktop skeleton
Tasks:
- Create Tauri 2 + React + TS app.
- Add Tailwind/shadcn/lucide.
- Implement layout/navigation.
- Add profile store with non-secret local persistence.
- Add secret backend abstraction with a stub implementation for tests.
- Add mock RPC server/fixtures.

Acceptance criteria:
- App launches locally.
- Navigation works.
- Mock profile can be created.
- Unit tests run.

### Milestone 2 - RPC connectivity vertical slice
Tasks:
- Implement `rpc_call`.
- Add endpoint + token settings.
- Add method allowlist.
- Implement `node_info` dashboard card.
- Add raw RPC console for `node_info`.
- Add mocked and live-smoke tests.

Acceptance criteria:
- Remote/local RPC profile can fetch `node_info`.
- Auth errors are mapped clearly.
- Raw console can call whitelisted `node_info`.

### Milestone 3 - Local node manager
Tasks:
- Configure Tauri sidecar packaging.
- Add FNN binary detection.
- Generate/edit config.yml.
- Implement profile-specific port checks.
- Implement node start/stop/restart/status.
- Implement log tailing.
- Implement unlock/password flow.

Acceptance criteria:
- App can start and stop a pinned local FNN binary.
- App reports missing password/key/config before attempting start.
- Logs stream into UI with redaction.

### Milestone 4 - Wallet/key setup
Tasks:
- Create/import FNN CKB key.
- Add secure unlock behavior.
- Add encrypted backup/export.
- Display funding address and balances where available.
- Add redaction tests for key material.

Acceptance criteria:
- User can prepare a local node key without exposing private key to frontend.
- FNN starts with the key/password flow.
- Backup/export requires confirmation.

### Milestone 5 - Biscuit auth
Tasks:
- Implement keypair generation/import.
- Configure node public key.
- Generate permission templates from `rpc-permission-map.md`.
- Import/export tokens.
- Add expiry and permission inspector.

Acceptance criteria:
- Read-only and operator token behavior is verified against mocked or live RPC.
- Public RPC without auth is blocked or strongly warned.

### Milestone 6 - Peers and channels
Tasks:
- Peer address book.
- Public relay shortcuts.
- Connect/disconnect/list peers.
- Channel list.
- Open/update/shutdown channel wizards.
- Reserved capacity and fee warnings.

Acceptance criteria:
- User can connect to a testnet relay.
- User can open and monitor a testnet channel.
- User can shut down a channel with confirmation.

### Milestone 7 - Invoice/payment flows
Tasks:
- Create/parse/get/cancel invoice.
- Build route and fee preview.
- Send payment.
- Payment history/timeline.
- Route-not-found and graph-stale states.

Acceptance criteria:
- User can create an invoice and send a payment in a controlled testnet setup.
- Payment failures are specific and actionable.

### Milestone 8 - Graph and diagnostics
Tasks:
- Graph visualizer.
- Logs screen.
- Export diagnostic bundle with redaction.
- Include version/gap-check baseline in diagnostics.

Acceptance criteria:
- Graph renders from live and mocked data.
- Diagnostic bundle passes redaction tests.

### Milestone 9 - External wallet/signing
Tasks:
- Integrate CCC for transaction composition/display helpers.
- Add JoyID/CCC signing path.
- Support external funding channel flow.
- Add explicit UX separation between internal FNN wallet and external signer.

Acceptance criteria:
- External funding flow works in testnet with documented signer support.
- User sees exactly which signer controls which funds.

## Security requirements
- Default RPC bind must remain `127.0.0.1`.
- Warn/block public RPC without Biscuit auth.
- Store tokens/keys only through OS keychain/Stronghold.
- Do not log Biscuit private keys, tokens, seed/private keys, raw exported key files, or unlock passwords.
- Every channel open/close/send must have a confirmation screen.
- Mainnet requires explicit enablement and persistent early-version warning.
- Prompt for backup before node upgrade or destructive storage migration.
- Maintain a central redaction library used by logs, errors, snippets, and diagnostics.
- Test redaction with realistic tokens, private keys, exported key files, and config snippets.

## UI direction
- Dark graphite/near-black base.
- Neon green/cyan/magenta accents used sparingly for state and focus.
- Dense dashboard layout with clear operational hierarchy.
- HUD-style metrics only where they communicate live state.
- Animated graph only after correctness and performance are verified.
- QR cards for tokens, invoices, peer addresses.
- Terminal page with syntax-highlighted JSON.
- Strong visual warnings for irreversible actions.
- Avoid decorative UI that competes with operational clarity.

## Testing playbook
- Unit-test RPC request construction.
- Unit-test method allowlist and permission mapping.
- Unit-test config generation.
- Unit-test secret redaction.
- Mock JSON-RPC server for frontend flows.
- Integration test against pinned local FNN testnet/regtest setup.
- Replay Bruno e2e requests from Fiber repo as smoke tests.
- E2E UI tests:
  - onboarding
  - profile creation
  - auth errors
  - peer connect
  - open channel
  - invoice create/parse
  - send payment
  - close channel
  - diagnostics export
- Sidecar tests:
  - missing binary
  - wrong version
  - port collision
  - missing key
  - missing password
  - crash/restart state

## Definition of done for MVP
- User can configure local or remote Fiber RPC.
- User can create/import a funding key for local FNN.
- User can unlock/start/stop a local managed FNN.
- User can import/create/export Biscuit tokens.
- User can view node state.
- User can connect peers.
- User can open/list/update/close channels.
- User can create invoices and send payments.
- User can inspect raw RPC responses through a guarded console.
- User can view graph data.
- User can export a diagnostics bundle with secrets redacted.
- All MVP behavior is tied to pinned source versions and gap-check docs.
