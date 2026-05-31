export type MockRpcValue = Record<string, unknown> | unknown[];

type MockPeer = {
  pubkey: string;
  address: string;
};

type MockChannel = {
  channel_id: string;
  peer_pubkey: string;
  state: string;
  funding_amount: string;
  public: boolean;
};

const mockPeers: MockPeer[] = [];
const mockChannels: MockChannel[] = [];

const fixtures: Record<string, MockRpcValue> = {
  node_info: {
    node_name: "mock-fiber-node",
    version: "mock",
    addresses: ["/ip4/127.0.0.1/tcp/8228"],
    chain: "testnet",
    node_id: "02mockpubkey",
  },
};

export async function mockFiberRpc(method: string, params: unknown[] | Record<string, unknown> = []): Promise<MockRpcValue> {
  if (method === "list_peers") {
    return { peers: structuredClone(mockPeers) };
  }

  if (method === "connect_peer") {
    const input = objectParams(params);
    const address = stringParam(input.address);
    const pubkey = stringParam(input.pubkey) ?? pubkeyFromAddress(address);

    if (!address && !input.pubkey) {
      throw new Error("mock RPC connect_peer requires address or pubkey");
    }

    if (!mockPeers.some((peer) => peer.pubkey === pubkey)) {
      mockPeers.push({
        pubkey,
        address: address ?? "graph-resolved",
      });
    }

    return {};
  }

  if (method === "disconnect_peer") {
    const pubkey = stringParam(objectParams(params).pubkey);
    const index = mockPeers.findIndex((peer) => peer.pubkey === pubkey);
    if (index >= 0) {
      mockPeers.splice(index, 1);
    }

    return {};
  }

  if (method === "list_channels") {
    const input = objectParams(params);
    const includeClosed = input.include_closed === true;
    const onlyPending = input.only_pending === true;
    const pubkey = stringParam(input.pubkey);
    const channels = mockChannels.filter((channel) => {
      if (pubkey && channel.peer_pubkey !== pubkey) {
        return false;
      }

      if (!includeClosed && channel.state === "closed") {
        return false;
      }

      return !onlyPending || channel.state === "awaiting_channel_ready";
    });

    return { channels: structuredClone(channels) };
  }

  if (method === "open_channel") {
    const input = objectParams(params);
    const pubkey = stringParam(input.pubkey);
    const fundingAmount = stringParam(input.funding_amount) ?? stringParam(input.fundingAmount);

    if (!pubkey || !fundingAmount) {
      throw new Error("mock RPC open_channel requires pubkey and funding_amount");
    }

    const channelId = `0x${(mockChannels.length + 1).toString(16).padStart(64, "0")}`;
    mockChannels.push({
      channel_id: channelId,
      peer_pubkey: pubkey,
      state: "awaiting_channel_ready",
      funding_amount: fundingAmount,
      public: input.public !== false,
    });

    return { temporary_channel_id: channelId };
  }

  if (method === "shutdown_channel") {
    const channelId = stringParam(objectParams(params).channel_id);
    const channel = mockChannels.find((item) => item.channel_id === channelId);
    if (channel) {
      channel.state = "closed";
    }

    return {};
  }

  const fixture = fixtures[method];

  if (!fixture) {
    throw new Error(`mock RPC method is not implemented: ${method}`);
  }

  return structuredClone(fixture);
}

function objectParams(params: unknown[] | Record<string, unknown>): Record<string, unknown> {
  if (Array.isArray(params)) {
    const first = params[0];
    return first && typeof first === "object" && !Array.isArray(first) ? (first as Record<string, unknown>) : {};
  }

  return params;
}

function stringParam(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function pubkeyFromAddress(address: string | undefined): string {
  if (!address) {
    return `03${"0".repeat(64)}`;
  }

  const match = address.match(/\/p2p\/([^/]+)$/);
  if (match) {
    return match[1];
  }

  return `03${"ab".repeat(32)}`;
}
