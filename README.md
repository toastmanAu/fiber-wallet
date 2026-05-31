# Fiber Wallet

Desktop control panel and wallet for Fiber Network Node.

This repository is starting with Milestone 1 from `docs/project-plan.md`: a Tauri 2 + React + TypeScript desktop skeleton with profile state, mock RPC fixtures, and baseline tests.

## Status

Phase 1 is complete. See `docs/phase-1-writeup.md` for the implementation summary, validation notes, and next milestone gates.

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

The full desktop runtime uses Tauri:

```bash
npm run tauri:dev
```
