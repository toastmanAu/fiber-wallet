export const queryKeys = {
  nodeInfo: (profileId?: string, rpcMode?: string, endpoint?: string) =>
    ["fiber-rpc", "node_info", profileId, rpcMode, endpoint] as const,
  ckbHealth: (profileId?: string, endpoint?: string) => ["ckb-rpc", "health", profileId, endpoint] as const,
  peersRoot: () => ["fiber-rpc", "list_peers"] as const,
  peers: (profileId?: string, rpcMode?: string, endpoint?: string) =>
    ["fiber-rpc", "list_peers", profileId, rpcMode, endpoint] as const,
  channelsRoot: () => ["fiber-rpc", "list_channels"] as const,
  channels: (profileId?: string, rpcMode?: string, endpoint?: string, filters?: string) =>
    ["fiber-rpc", "list_channels", profileId, rpcMode, endpoint, filters] as const,
  paymentsRoot: () => ["fiber-rpc", "list_payments"] as const,
  payments: (profileId?: string, rpcMode?: string, endpoint?: string, filters?: string) =>
    ["fiber-rpc", "list_payments", profileId, rpcMode, endpoint, filters] as const,
  graphNodes: (profileId?: string, rpcMode?: string, endpoint?: string, limit?: string) =>
    ["fiber-rpc", "graph_nodes", profileId, rpcMode, endpoint, limit] as const,
  graphChannels: (profileId?: string, rpcMode?: string, endpoint?: string, limit?: string) =>
    ["fiber-rpc", "graph_channels", profileId, rpcMode, endpoint, limit] as const,
};
