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
  enabled?: boolean;
  tlc_expiry_delta?: string;
  tlc_minimum_value?: string;
  tlc_fee_proportional_millionths?: string;
};

type MockInvoice = {
  invoice_address: string;
  invoice: {
    amount: string;
    currency: string;
    description?: string;
    payment_hash: string;
    payment_preimage?: string;
    fallback_address?: string;
    final_expiry_delta?: string;
    udt_type_script?: unknown;
    allow_mpp?: boolean;
    allow_trampoline_routing?: boolean;
  };
  status: string;
};

type MockPayment = {
  payment_hash: string;
  status: string;
  created_at: number;
  last_updated_at: number;
  failed_error: string | null;
  fee: string;
  routers: unknown[];
  invoice?: string;
  target_pubkey?: string;
  amount?: string;
  dry_run?: boolean;
};

const mockPeers: MockPeer[] = [];
const mockChannels: MockChannel[] = [];
const mockInvoices: MockInvoice[] = [];
const mockPayments: MockPayment[] = [];

const mockGraphNodes = [
  {
    pubkey: "02b6d4e3ab86a2ca2fad6fae0ecb2e1e559e0b911939872a90abdda6d20302be71",
    node_name: "fiber-testnet-public-bottle",
    addresses: [],
  },
  {
    pubkey: "0291a6576bd5a94bd74b27080a48340875338fff9f6d6361fe6b8db8d0d1912fcc",
    node_name: "fiber-testnet-public-bracer",
    addresses: [],
  },
  {
    pubkey: "03aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    node_name: "mock-local-node",
    addresses: ["/ip4/127.0.0.1/tcp/8228"],
  },
];

const mockGraphChannels = [
  {
    channel_id: `0x${"31".repeat(32)}`,
    node1: mockGraphNodes[0].pubkey,
    node2: mockGraphNodes[1].pubkey,
    capacity: "49900000000",
  },
  {
    channel_id: `0x${"32".repeat(32)}`,
    node1: mockGraphNodes[2].pubkey,
    node2: mockGraphNodes[0].pubkey,
    capacity: "49900000000",
  },
];

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

  if (method === "accept_channel") {
    const input = objectParams(params);
    const temporaryChannelId = stringParam(input.temporary_channel_id);
    const fundingAmount = stringParam(input.funding_amount);

    if (!temporaryChannelId || !fundingAmount) {
      throw new Error("mock RPC accept_channel requires temporary_channel_id and funding_amount");
    }

    const channelId = `0x${(mockChannels.length + 1).toString(16).padStart(64, "a")}`;
    mockChannels.push({
      channel_id: channelId,
      peer_pubkey: `02${"ac".repeat(32)}`,
      state: "accepted",
      funding_amount: fundingAmount,
      public: true,
      enabled: true,
    });

    return { channel_id: channelId };
  }

  if (method === "update_channel") {
    const input = objectParams(params);
    const channelId = stringParam(input.channel_id);
    const channel = mockChannels.find((item) => item.channel_id === channelId);

    if (!channel) {
      throw new Error("mock RPC channel not found");
    }

    channel.enabled = input.enabled !== false;
    channel.tlc_expiry_delta = stringParam(input.tlc_expiry_delta) ?? channel.tlc_expiry_delta;
    channel.tlc_minimum_value = stringParam(input.tlc_minimum_value) ?? channel.tlc_minimum_value;
    channel.tlc_fee_proportional_millionths =
      stringParam(input.tlc_fee_proportional_millionths) ?? channel.tlc_fee_proportional_millionths;

    return {};
  }

  if (method === "open_channel_with_external_funding") {
    const input = objectParams(params);
    const pubkey = stringParam(input.pubkey);
    const fundingAmount = stringParam(input.funding_amount) ?? stringParam(input.fundingAmount);

    if (!pubkey || !fundingAmount || !input.shutdown_script || !input.funding_lock_script) {
      throw new Error("mock RPC external funding requires pubkey, funding_amount, shutdown_script, and funding_lock_script");
    }

    const channelId = `0x${(mockChannels.length + 1).toString(16).padStart(64, "4")}`;
    mockChannels.push({
      channel_id: channelId,
      peer_pubkey: pubkey,
      state: "awaiting_external_funding",
      funding_amount: fundingAmount,
      public: input.public !== false,
    });

    return {
      channel_id: channelId,
      unsigned_funding_tx: mockFundingTx(input.funding_lock_script, input.shutdown_script, fundingAmount),
    };
  }

  if (method === "shutdown_channel") {
    const channelId = stringParam(objectParams(params).channel_id);
    const channel = mockChannels.find((item) => item.channel_id === channelId);
    if (channel) {
      channel.state = "closed";
    }

    return {};
  }

  if (method === "submit_signed_funding_tx") {
    const input = objectParams(params);
    const channelId = stringParam(input.channel_id);
    const channel = mockChannels.find((item) => item.channel_id === channelId);
    if (channel) {
      channel.state = "funding_tx_submitted";
    }

    return {
      channel_id: channelId,
      funding_tx_hash: `0x${"55".repeat(32)}`,
    };
  }

  if (method === "sign_external_funding_tx") {
    const input = objectParams(params);
    const unsignedTx = isRecord(input.unsigned_funding_tx) ? input.unsigned_funding_tx : {};
    return {
      signed_funding_tx: {
        ...unsignedTx,
        witnesses: ["0x5500000010000000550000005500000041000000"],
      },
    };
  }

  if (method === "new_invoice") {
    const input = objectParams(params);
    const amount = stringParam(input.amount) ?? "0";
    const currency = stringParam(input.currency) ?? "Fibt";
    const paymentHash = `0x${(mockInvoices.length + 1).toString(16).padStart(64, "1")}`;
    const invoice = {
      invoice_address: `${currency.toLowerCase()}1mock${mockInvoices.length + 1}`,
      invoice: {
        amount,
        currency,
        description: stringParam(input.description),
        payment_hash: stringParam(input.payment_hash) ?? paymentHash,
        payment_preimage: stringParam(input.payment_preimage),
        fallback_address: stringParam(input.fallback_address),
        final_expiry_delta: stringParam(input.final_expiry_delta),
        udt_type_script: input.udt_type_script,
        allow_mpp: input.allow_mpp === true ? true : undefined,
        allow_trampoline_routing: input.allow_trampoline_routing === true ? true : undefined,
      },
      status: "Open",
    };
    mockInvoices.push(invoice);
    return structuredClone(invoice);
  }

  if (method === "parse_invoice") {
    const invoiceAddress = stringParam(objectParams(params).invoice) ?? "";
    const invoice = mockInvoices.find((item) => item.invoice_address === invoiceAddress);

    return {
      invoice: structuredClone(
        invoice?.invoice ?? {
          amount: "0",
          currency: invoiceAddress.slice(0, 4) || "Fibt",
          payment_hash: `0x${"0".repeat(64)}`,
        },
      ),
    };
  }

  if (method === "get_invoice" || method === "cancel_invoice") {
    const paymentHash = stringParam(objectParams(params).payment_hash);
    const invoice = mockInvoices.find((item) => item.invoice.payment_hash === paymentHash);
    if (!invoice) {
      throw new Error("mock RPC invoice not found");
    }

    if (method === "cancel_invoice") {
      invoice.status = "Canceled";
    }

    return structuredClone(invoice);
  }

  if (method === "send_payment") {
    const input = objectParams(params);
    const dryRun = input.dry_run === true;
    const invoiceAddress = stringParam(input.invoice);
    const invoice = invoiceAddress ? mockInvoices.find((item) => item.invoice_address === invoiceAddress) : undefined;
    const paymentHash = invoice?.invoice.payment_hash ?? `0x${(mockPayments.length + 1).toString(16).padStart(64, "2")}`;
    const now = Date.now();
    const payment: MockPayment = {
      payment_hash: paymentHash,
      status: "Success",
      created_at: now,
      last_updated_at: now,
      failed_error: null,
      fee: dryRun ? "1000" : "2000",
      routers: [],
      invoice: invoiceAddress,
      target_pubkey: stringParam(input.target_pubkey),
      amount: stringParam(input.amount) ?? invoice?.invoice.amount,
      dry_run: dryRun,
    };

    if (!dryRun) {
      mockPayments.unshift(payment);
    }

    return structuredClone(payment);
  }

  if (method === "send_payment_with_router") {
    const input = objectParams(params);
    const dryRun = input.dry_run === true;
    const router = Array.isArray(input.router) ? input.router : [];
    const paymentHash = stringParam(input.payment_hash) ?? `0x${(mockPayments.length + 1).toString(16).padStart(64, "6")}`;
    const now = Date.now();
    const payment: MockPayment = {
      payment_hash: paymentHash,
      status: router.length ? "Success" : "Failed",
      created_at: now,
      last_updated_at: now,
      failed_error: router.length ? null : "route not found",
      fee: dryRun ? "1200" : "2400",
      routers: router,
      invoice: stringParam(input.invoice),
      dry_run: dryRun,
    };

    if (!dryRun) {
      mockPayments.unshift(payment);
    }

    return structuredClone(payment);
  }

  if (method === "get_payment") {
    const paymentHash = stringParam(objectParams(params).payment_hash);
    const payment = mockPayments.find((item) => item.payment_hash === paymentHash);
    if (!payment) {
      throw new Error("mock RPC payment not found");
    }

    return structuredClone(payment);
  }

  if (method === "list_payments") {
    const input = objectParams(params);
    const status = stringParam(input.status);
    const limit = numberParam(input.limit) ?? 15;
    const payments = mockPayments
      .filter((payment) => !status || payment.status === status)
      .slice(0, limit);

    return {
      payments: structuredClone(payments),
      last_cursor: payments.at(-1)?.payment_hash ?? null,
    };
  }

  if (method === "build_router") {
    const input = objectParams(params);
    const hopsInfo = Array.isArray(input.hops_info) ? input.hops_info : [];
    const amount = stringParam(input.amount) ?? "100000000";

    return {
      router_hops: hopsInfo.length
        ? structuredClone(hopsInfo)
        : [
            {
              pubkey: mockGraphNodes[0].pubkey,
              amount,
              fee: "1000",
              tlc_expiry_delta: stringParam(input.final_tlc_expiry_delta) ?? "86400000",
            },
          ],
    };
  }

  if (method === "graph_nodes") {
    const limit = numberParam(objectParams(params).limit) ?? 500;
    return {
      nodes: structuredClone(mockGraphNodes.slice(0, limit)),
      last_cursor: null,
    };
  }

  if (method === "graph_channels") {
    const limit = numberParam(objectParams(params).limit) ?? 500;
    return {
      channels: structuredClone(mockGraphChannels.slice(0, limit)),
      last_cursor: null,
    };
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
  if (typeof value === "number" || typeof value === "bigint") {
    return value.toString();
  }

  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberParam(value: unknown): number | undefined {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
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

function mockFundingTx(fundingLockScript: unknown, shutdownScript: unknown, fundingAmount: string): Record<string, unknown> {
  return {
    version: "0x0",
    cell_deps: [],
    header_deps: [],
    inputs: [
      {
        previous_output: {
          tx_hash: `0x${"11".repeat(32)}`,
          index: "0x0",
        },
        since: "0x0",
      },
    ],
    outputs: [
      {
        capacity: fundingAmount,
        lock: fundingLockScript,
      },
      {
        capacity: "0x0",
        lock: shutdownScript,
      },
    ],
    outputs_data: ["0x", "0x"],
    witnesses: [],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
