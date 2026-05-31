import { describe, expect, it } from "vitest";
import { classifyPaymentFailure } from "./paymentFailures";

describe("classifyPaymentFailure", () => {
  it("classifies route-not-found messages", () => {
    expect(classifyPaymentFailure("Fiber RPC error: route not found")).toMatchObject({
      kind: "route_not_found",
    });
  });

  it("classifies stale graph messages", () => {
    expect(classifyPaymentFailure({ failed_error: "unknown channel in channel update graph" })).toMatchObject({
      kind: "graph_stale",
    });
  });

  it("keeps specific unknown payment errors", () => {
    expect(classifyPaymentFailure({ message: "invoice expired" })).toEqual({
      kind: "payment_failed",
      message: "invoice expired",
    });
  });
});
