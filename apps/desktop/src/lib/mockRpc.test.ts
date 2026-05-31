import { describe, expect, it } from "vitest";
import { mockFiberRpc } from "./mockRpc";

describe("mockFiberRpc", () => {
  it("returns node_info fixture", async () => {
    await expect(mockFiberRpc("node_info")).resolves.toMatchObject({
      node_name: "mock-fiber-node",
      chain: "testnet",
    });
  });

  it("tracks mock peer connect and disconnect", async () => {
    const pubkey = `03${"11".repeat(32)}`;
    await mockFiberRpc("connect_peer", { pubkey });
    await expect(mockFiberRpc("list_peers")).resolves.toMatchObject({
      peers: [{ pubkey }],
    });

    await mockFiberRpc("disconnect_peer", { pubkey });
    await expect(mockFiberRpc("list_peers")).resolves.toMatchObject({
      peers: [],
    });
  });

  it("tracks mock channel open and shutdown", async () => {
    const pubkey = `03${"22".repeat(32)}`;
    const opened = await mockFiberRpc("open_channel", {
      pubkey,
      funding_amount: "49900000000",
      public: true,
    });
    expect(opened).toMatchObject({ temporary_channel_id: expect.any(String) });

    const channels = await mockFiberRpc("list_channels");
    expect(channels).toMatchObject({
      channels: [{ peer_pubkey: pubkey, state: "awaiting_channel_ready" }],
    });

    await mockFiberRpc("shutdown_channel", {
      channel_id: (opened as { temporary_channel_id: string }).temporary_channel_id,
    });
    await expect(mockFiberRpc("list_channels", { include_closed: true })).resolves.toMatchObject({
      channels: [{ peer_pubkey: pubkey, state: "closed" }],
    });
  });

  it("tracks mock channel accept and update", async () => {
    const accepted = await mockFiberRpc("accept_channel", {
      temporary_channel_id: `0x${"aa".repeat(32)}`,
      funding_amount: "49900000000",
    });
    expect(accepted).toMatchObject({ channel_id: expect.any(String) });

    const channelId = (accepted as { channel_id: string }).channel_id;
    await expect(
      mockFiberRpc("update_channel", {
        channel_id: channelId,
        enabled: false,
        tlc_expiry_delta: "86400000",
        tlc_minimum_value: "1000",
        tlc_fee_proportional_millionths: "100",
      }),
    ).resolves.toEqual({});

    await expect(mockFiberRpc("list_channels")).resolves.toMatchObject({
      channels: [
        expect.objectContaining({
          channel_id: channelId,
          state: "accepted",
          enabled: false,
          tlc_expiry_delta: "86400000",
          tlc_minimum_value: "1000",
          tlc_fee_proportional_millionths: "100",
        }),
      ],
    });
  });

  it("tracks mock external funding open, sign, and submit", async () => {
    const pubkey = `03${"33".repeat(32)}`;
    const script = {
      code_hash: `0x${"44".repeat(32)}`,
      hash_type: "type",
      args: "0x",
    };
    const opened = await mockFiberRpc("open_channel_with_external_funding", {
      pubkey,
      funding_amount: "49900000000",
      public: true,
      shutdown_script: script,
      funding_lock_script: script,
    });
    expect(opened).toMatchObject({
      channel_id: expect.any(String),
      unsigned_funding_tx: {
        witnesses: [],
      },
    });

    const signed = await mockFiberRpc("sign_external_funding_tx", {
      unsigned_funding_tx: (opened as { unsigned_funding_tx: unknown }).unsigned_funding_tx,
      private_key: `0x${"55".repeat(32)}`,
    });
    expect(signed).toMatchObject({
      signed_funding_tx: {
        witnesses: [expect.any(String)],
      },
    });

    await expect(
      mockFiberRpc("submit_signed_funding_tx", {
        channel_id: (opened as { channel_id: string }).channel_id,
        signed_funding_tx: (signed as { signed_funding_tx: unknown }).signed_funding_tx,
      }),
    ).resolves.toMatchObject({
      funding_tx_hash: expect.any(String),
    });
  });

  it("tracks mock invoice and payment flow", async () => {
    const invoice = await mockFiberRpc("new_invoice", {
      amount: "100000000",
      currency: "Fibt",
      description: "test invoice",
    });
    expect(invoice).toMatchObject({
      invoice_address: expect.stringContaining("fibt1mock"),
      invoice: {
        amount: "100000000",
        currency: "Fibt",
      },
      status: "Open",
    });

    const invoiceAddress = (invoice as { invoice_address: string }).invoice_address;
    const preview = await mockFiberRpc("send_payment", {
      invoice: invoiceAddress,
      dry_run: true,
    });
    expect(preview).toMatchObject({
      status: "Success",
      dry_run: true,
    });

    const sent = await mockFiberRpc("send_payment", {
      invoice: invoiceAddress,
    });
    expect(sent).toMatchObject({
      status: "Success",
      invoice: invoiceAddress,
    });
    await expect(mockFiberRpc("list_payments")).resolves.toMatchObject({
      payments: [{ invoice: invoiceAddress }],
    });
  });

  it("tracks mock router build and router payment flow", async () => {
    const route = await mockFiberRpc("build_router", {
      amount: "100000000",
      hops_info: [],
      final_tlc_expiry_delta: "86400000",
    });
    expect(route).toMatchObject({
      router_hops: [expect.objectContaining({ pubkey: expect.any(String) })],
    });

    const router = (route as { router_hops: unknown[] }).router_hops;
    await expect(
      mockFiberRpc("send_payment_with_router", {
        payment_hash: `0x${"77".repeat(32)}`,
        router,
        dry_run: true,
      }),
    ).resolves.toMatchObject({
      status: "Success",
      dry_run: true,
      routers: router,
    });

    await expect(
      mockFiberRpc("send_payment_with_router", {
        payment_hash: `0x${"88".repeat(32)}`,
        router,
      }),
    ).resolves.toMatchObject({
      status: "Success",
      routers: router,
    });
  });

  it("rejects unknown methods", async () => {
    await expect(mockFiberRpc("unknown_method")).rejects.toThrow("not implemented");
  });
});
