# Fiber Wallet

Desktop control panel and wallet for Fiber Network Node.

This repository is building the desktop Fiber Wallet described in `docs/project-plan.md`: a Tauri 2 + React + TypeScript control panel for Fiber RPC profiles, CKB readiness, Biscuit auth, peers/channels, payments, wallet key handling, and diagnostics.

## Status

Phase 1 is complete and the app has moved through several source-backed vertical slices beyond the initial skeleton. See `docs/current-status.md` for the latest checkpoint and `docs/phase-1-writeup.md` for the historical scaffold summary.

Milestone 0 source pinning has started. Generated source-backed docs live in:

- `docs/references/manifest.md`
- `docs/rpc-method-map.md`
- `docs/rpc-permission-map.md`
- `docs/config-schema.md`
- `docs/gap-checks/milestone-0.md`

To refresh them after updating the ignored local `references/` checkouts:

```bash
npm run docs:milestone0
```

## Development

```bash
npm install
npm run dev
```

Useful checks:

```bash
npm run lint
npm test
npm run build:web
```

The current checkpoint has these checks passing:

```bash
npm run lint
npm test
npm run build:web
```

The full desktop runtime uses Tauri:

```bash
npm run tauri:dev
```
