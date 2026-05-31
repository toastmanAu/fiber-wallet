# Fiber RPC Permission Map

Generated from `references/fiber/crates/fiber-lib/src/rpc/biscuit.rs`.

Fiber Biscuit permissions are method-specific. A write permission does not imply the matching read permission.

| Method | Rule | Requires RPC Context |
| --- | --- | --- |
| `abandon_channel` | `allow if write("channels");` | no |
| `accept_channel` | `allow if write("channels");` | no |
| `add_tlc` | `allow if write("channels");` | no |
| `build_router` | `allow if read("payments");` | no |
| `cancel_invoice` | `allow if write("invoices");` | no |
| `check_channel_shutdown` | `allow if write("channels");` | no |
| `commitment_signed` | `allow if write("messages");` | no |
| `connect_peer` | `allow if write("peers");` | no |
| `create_preimage` | `allow if write("watchtower");` | yes |
| `create_watch_channel` | `allow if write("watchtower");` | yes |
| `disconnect_peer` | `allow if write("peers");` | no |
| `get_cch_order` | `allow if read("cch");` | no |
| `get_invoice` | `allow if read("invoices");` | no |
| `get_payment` | `allow if read("payments");` | no |
| `graph_channels` | `allow if read("graph");` | no |
| `graph_nodes` | `allow if read("graph");` | no |
| `list_channels` | `allow if read("channels");` | no |
| `list_payments` | `allow if read("payments");` | no |
| `list_peers` | `allow if read("peers");` | no |
| `new_invoice` | `allow if write("invoices");` | no |
| `node_info` | `allow if read("node");` | no |
| `open_channel` | `allow if write("channels");` | no |
| `open_channel_with_external_funding` | `allow if write("channels");` | no |
| `parse_invoice` | `allow if read("invoices");` | no |
| `pprof` | `allow if write("pprof");` | no |
| `receive_btc` | `allow if read("cch");` | no |
| `remove_preimage` | `allow if write("watchtower");` | yes |
| `remove_tlc` | `allow if write("channels");` | no |
| `remove_watch_channel` | `allow if write("watchtower");` | yes |
| `send_btc` | `allow if write("cch");` | no |
| `send_payment` | `allow if write("payments");` | no |
| `send_payment_with_router` | `allow if write("payments");` | no |
| `settle_invoice` | `allow if write("invoices");` | no |
| `shutdown_channel` | `allow if write("channels");` | no |
| `sign_external_funding_tx` | `allow if write("channels");` | no |
| `submit_commitment_transaction` | `allow if write("chain");` | no |
| `submit_signed_funding_tx` | `allow if write("channels");` | no |
| `subscribe_store_changes` | `allow if read("cch");` | no |
| `update_channel` | `allow if write("channels");` | no |
| `update_local_settlement` | `allow if write("watchtower");` | yes |
| `update_pending_remote_settlement` | `allow if write("watchtower");` | yes |
| `update_revocation` | `allow if write("watchtower");` | yes |

## Token Template Inputs

Read-only dashboard:

```biscuit
read("node");
read("peers");
read("channels");
read("payments");
read("invoices");
read("graph");
check if time($time), $time <= <expiry>;
```

Operator:

```biscuit
read("node");
read("peers");
write("peers");
read("channels");
write("channels");
read("payments");
write("payments");
read("invoices");
write("invoices");
read("graph");
check if time($time), $time <= <expiry>;
```

Watchtower:

```biscuit
write("watchtower");
check if time($time), $time <= <expiry>;
```
