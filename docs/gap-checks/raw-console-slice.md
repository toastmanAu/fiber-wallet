# Raw RPC Console Slice Gap Check

Date: 2026-05-31

## Knowledge Graph Availability

No knowledge graph tools, MCP resources, or local graph files were exposed in this session. This slice uses the generated Milestone 0 RPC and permission maps as its baseline.

## Implemented

- Added switchable app navigation without introducing a router.
- Added a raw JSON-RPC console view.
- Console method dropdown is limited to the 20 MVP allowlisted methods.
- Params input accepts only a JSON array.
- Response viewer redacts known secret patterns before display.
- Console uses the existing profile RPC mode:
  - mock mode calls local fixtures
  - live mode calls the Tauri `rpc_call` command

## Security Notes

- Advanced/dev methods remain unavailable in the UI.
- No saved snippets are implemented yet, so no snippet redaction/storage surface exists.
- Biscuit token remains session-only.

## Remaining Gaps

- Method-specific parameter forms and schema validation are not implemented yet.
- The method list is duplicated in TypeScript and Rust; a generated shared artifact should replace this.
- Console output is plain JSON for now; syntax highlighting can come later.
- Live smoke tests still require a pinned or bundled FNN node.
