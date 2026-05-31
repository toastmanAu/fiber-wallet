export type MockRpcValue = Record<string, unknown> | unknown[];

const fixtures: Record<string, MockRpcValue> = {
  node_info: {
    node_name: "mock-fiber-node",
    version: "mock",
    addresses: ["/ip4/127.0.0.1/tcp/8228"],
    chain: "testnet",
    node_id: "02mockpubkey",
  },
  list_peers: [],
  list_channels: [],
};

export async function mockFiberRpc(method: string): Promise<MockRpcValue> {
  const fixture = fixtures[method];

  if (!fixture) {
    throw new Error(`mock RPC method is not implemented: ${method}`);
  }

  return structuredClone(fixture);
}

