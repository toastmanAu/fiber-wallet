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

  it("rejects unknown methods", async () => {
    await expect(mockFiberRpc("unknown_method")).rejects.toThrow("not implemented");
  });
});
