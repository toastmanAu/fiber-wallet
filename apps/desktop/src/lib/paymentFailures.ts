export type PaymentFailureKind = "route_not_found" | "graph_stale" | "payment_failed" | "unknown";

export type PaymentFailure = {
  kind: PaymentFailureKind;
  message: string;
};

const routeNotFoundPatterns = [/route\s+not\s+found/i, /no\s+route/i, /failed\s+to\s+find\s+route/i];
const graphStalePatterns = [/graph\s+stale/i, /stale\s+graph/i, /unknown\s+channel/i, /channel\s+update/i];

export function classifyPaymentFailure(input: unknown): PaymentFailure {
  const message = failureMessage(input);
  const lower = message.toLowerCase();

  if (routeNotFoundPatterns.some((pattern) => pattern.test(lower))) {
    return {
      kind: "route_not_found",
      message: "Route not found. Refresh graph data, check peer connectivity, or try a manual route.",
    };
  }

  if (graphStalePatterns.some((pattern) => pattern.test(lower))) {
    return {
      kind: "graph_stale",
      message: "Graph data may be stale. Refresh the graph, reconnect peers, then preview the route again.",
    };
  }

  if (message.trim()) {
    return {
      kind: "payment_failed",
      message,
    };
  }

  return {
    kind: "unknown",
    message: "Payment failed without a detailed error payload.",
  };
}

function failureMessage(input: unknown): string {
  if (typeof input === "string") {
    return input;
  }

  if (input && typeof input === "object") {
    const record = input as Record<string, unknown>;
    for (const key of ["failed_error", "message", "error"]) {
      const value = record[key];
      if (typeof value === "string" && value.trim()) {
        return value;
      }
    }
  }

  return "";
}
