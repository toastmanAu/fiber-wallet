import { describe, expect, it } from "vitest";
import { buildPaymentTimeline } from "./paymentTimeline";

describe("buildPaymentTimeline", () => {
  it("marks successful payments complete", () => {
    const timeline = buildPaymentTimeline({
      status: "Success",
      fee: "2000",
      created_at: 1_780_000_000_000,
      last_updated_at: 1_780_000_001_000,
      routers: [{ hops: [] }],
    });

    expect(timeline.map((step) => step.state)).toEqual(["done", "done", "done", "done"]);
    expect(timeline.at(-1)?.detail).toContain("Fee 2000");
  });

  it("marks failed routing clearly", () => {
    const timeline = buildPaymentTimeline({
      status: "Failed",
      failed_error: "route not found",
      routers: [],
    });

    expect(timeline[1]).toMatchObject({ label: "Routing", state: "failed" });
    expect(timeline.at(-1)).toMatchObject({ label: "Failed", state: "failed" });
  });
});
