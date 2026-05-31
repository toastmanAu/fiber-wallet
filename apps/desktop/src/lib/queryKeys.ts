export const queryKeys = {
  nodeInfo: () => ["fiber-rpc", "node_info"] as const,
  peers: () => ["fiber-rpc", "list_peers"] as const,
  channels: () => ["fiber-rpc", "list_channels"] as const,
};

