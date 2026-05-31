export const queryKeys = {
  nodeInfo: (profileId?: string, rpcMode?: string, endpoint?: string) =>
    ["fiber-rpc", "node_info", profileId, rpcMode, endpoint] as const,
  peersRoot: () => ["fiber-rpc", "list_peers"] as const,
  peers: (profileId?: string, rpcMode?: string, endpoint?: string) =>
    ["fiber-rpc", "list_peers", profileId, rpcMode, endpoint] as const,
  channelsRoot: () => ["fiber-rpc", "list_channels"] as const,
  channels: (profileId?: string, rpcMode?: string, endpoint?: string, filters?: string) =>
    ["fiber-rpc", "list_channels", profileId, rpcMode, endpoint, filters] as const,
};
