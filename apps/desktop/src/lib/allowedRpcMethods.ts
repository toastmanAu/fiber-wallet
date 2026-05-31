export const allowedRpcMethods = [
  "node_info",
  "connect_peer",
  "disconnect_peer",
  "list_peers",
  "open_channel",
  "accept_channel",
  "list_channels",
  "update_channel",
  "shutdown_channel",
  "new_invoice",
  "parse_invoice",
  "get_invoice",
  "cancel_invoice",
  "send_payment",
  "get_payment",
  "build_router",
  "send_payment_with_router",
  "list_payments",
  "graph_nodes",
  "graph_channels",
] as const;

export type AllowedRpcMethod = (typeof allowedRpcMethods)[number];

