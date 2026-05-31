export type PaymentTimelineInput = {
  payment_hash?: string;
  status?: string;
  failed_error?: string | null;
  fee?: string;
  created_at?: number;
  last_updated_at?: number;
  dry_run?: boolean;
  routers?: unknown[];
};

export type PaymentTimelineStep = {
  label: string;
  detail: string;
  state: "done" | "active" | "failed" | "pending";
};

export function buildPaymentTimeline(payment: PaymentTimelineInput): PaymentTimelineStep[] {
  const status = (payment.status ?? "").toLowerCase();
  const createdAt = formatTimestamp(payment.created_at);
  const updatedAt = formatTimestamp(payment.last_updated_at);
  const hasRoute = Array.isArray(payment.routers) && payment.routers.length > 0;
  const failed = status === "failed" || Boolean(payment.failed_error);
  const succeeded = status === "success" || status === "succeeded";
  const inflight = status === "inflight" || status === "pending";

  return [
    {
      label: "Created",
      detail: createdAt ? `Created ${createdAt}` : "Created timestamp not returned",
      state: "done",
    },
    {
      label: "Routing",
      detail: hasRoute ? `${payment.routers?.length ?? 0} route hop groups returned` : "Route details not returned",
      state: hasRoute ? "done" : failed ? "failed" : "pending",
    },
    {
      label: "Pending",
      detail: payment.dry_run ? "Dry-run preview only" : inflight ? "Payment is in flight" : "No pending state reported",
      state: inflight ? "active" : succeeded || failed ? "done" : "pending",
    },
    {
      label: succeeded ? "Succeeded" : failed ? "Failed" : "Final",
      detail: failed
        ? payment.failed_error || "Payment failed"
        : succeeded
          ? `Fee ${payment.fee ?? "unknown"}${updatedAt ? ` / updated ${updatedAt}` : ""}`
          : "Final state not reported",
      state: failed ? "failed" : succeeded ? "done" : "pending",
    },
  ];
}

function formatTimestamp(value: number | undefined): string {
  if (!value) {
    return "";
  }

  return new Date(value).toISOString();
}
