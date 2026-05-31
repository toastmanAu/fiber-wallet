export const queryKeys = {
  nodeInfo: (profileId?: string, rpcMode?: string, endpoint?: string) =>
    ["fiber-rpc", "node_info", profileId, rpcMode, endpoint] as const,
  peers: () => ["fiber-rpc", "list_peers"] as const,
  channels: () => ["fiber-rpc", "list_channels"] as const,
};
