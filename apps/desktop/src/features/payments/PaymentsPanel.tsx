import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileSearch, ReceiptText, RefreshCcw, SendHorizontal, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { ConfirmActionButton } from "../common/ConfirmActionButton";
import { fiberRpc, formatRpcError } from "../../lib/fiberRpc";
import { classifyPaymentFailure } from "../../lib/paymentFailures";
import { buildPaymentTimeline, type PaymentTimelineStep } from "../../lib/paymentTimeline";
import { useProfileStore } from "../../lib/profileStore";
import { queryKeys } from "../../lib/queryKeys";

type InvoiceResult = {
  invoice_address?: string;
  invoice?: Record<string, unknown>;
  status?: string;
};

type PaymentResult = {
  payment_hash?: string;
  status?: string;
  failed_error?: string | null;
  fee?: string;
  created_at?: number;
  last_updated_at?: number;
  invoice?: string;
  amount?: string;
  dry_run?: boolean;
  routers?: unknown[];
};

type ListPaymentsResult = {
  payments?: PaymentResult[];
  last_cursor?: string | null;
};

type BuildRouterResult = {
  router_hops?: unknown[];
};

export function PaymentsPanel() {
  const activeProfile = useProfileStore((state) =>
    state.profiles.find((profile) => profile.id === state.activeProfileId),
  );
  const sessionBiscuitToken = useProfileStore((state) => state.sessionBiscuitToken);
  const queryClient = useQueryClient();
  const [invoiceAmount, setInvoiceAmount] = useState("100000000");
  const [invoiceCurrency, setInvoiceCurrency] = useState(activeProfile?.network === "mainnet" ? "Fibb" : "Fibt");
  const [invoiceDescription, setInvoiceDescription] = useState("");
  const [invoiceExpiry, setInvoiceExpiry] = useState("3600");
  const [invoicePaymentPreimage, setInvoicePaymentPreimage] = useState("");
  const [invoicePaymentHash, setInvoicePaymentHash] = useState("");
  const [invoiceFallbackAddress, setInvoiceFallbackAddress] = useState("");
  const [invoiceFinalExpiryDelta, setInvoiceFinalExpiryDelta] = useState("");
  const [invoiceUdtTypeScript, setInvoiceUdtTypeScript] = useState("");
  const [invoiceAllowMpp, setInvoiceAllowMpp] = useState(false);
  const [invoiceAllowTrampoline, setInvoiceAllowTrampoline] = useState(false);
  const [invoiceText, setInvoiceText] = useState("");
  const [paymentHash, setPaymentHash] = useState("");
  const [targetPubkey, setTargetPubkey] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [maxFeeAmount, setMaxFeeAmount] = useState("");
  const [timeout, setTimeoutValue] = useState("60");
  const [keysend, setKeysend] = useState(false);
  const [allowSelfPayment, setAllowSelfPayment] = useState(false);
  const [routeAmount, setRouteAmount] = useState("");
  const [routeHopsInfo, setRouteHopsInfo] = useState("[]");
  const [finalTlcExpiryDelta, setFinalTlcExpiryDelta] = useState("");
  const [routerText, setRouterText] = useState("[]");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("");
  const [selectedPayment, setSelectedPayment] = useState<PaymentResult | null>(null);
  const [status, setStatus] = useState("No invoice or payment action yet");
  const [details, setDetails] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const filterKey = useMemo(() => JSON.stringify({ paymentStatusFilter }), [paymentStatusFilter]);

  const payments = useQuery({
    queryKey: queryKeys.payments(
      activeProfile?.id,
      activeProfile?.rpcMode,
      activeProfile?.fiberRpcEndpoint,
      filterKey,
    ),
    queryFn: async () => {
      if (!activeProfile) {
        throw new Error("No active profile");
      }

      const response = await fiberRpc<ListPaymentsResult>("list_payments", compactObject({
        status: paymentStatusFilter,
        limit: "25",
      }), {
        profile: activeProfile,
        token: sessionBiscuitToken,
      });

      return Array.isArray(response.payments) ? response.payments : [];
    },
    enabled: Boolean(activeProfile),
  });

  if (!activeProfile) {
    return (
      <section className="settings-panel">
        <h2>Payments</h2>
        <p>No active profile.</p>
      </section>
    );
  }
  const profile = activeProfile;

  async function run(action: () => Promise<string>, refreshPayments = false) {
    setIsBusy(true);
    setStatus("");
    setDetails("");
    try {
      setStatus(await action());
      if (refreshPayments) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.paymentsRoot() });
      }
    } catch (error) {
      setStatus(paymentFailureStatus(formatRpcError(error)));
    } finally {
      setIsBusy(false);
    }
  }

  async function sendPayment(dryRun: boolean) {
    const result = await fiberRpc<PaymentResult>("send_payment", compactObject({
      invoice: invoiceText,
      target_pubkey: targetPubkey,
      amount: paymentAmount,
      max_fee_amount: maxFeeAmount,
      timeout,
      keysend,
      allow_self_payment: allowSelfPayment,
      dry_run: dryRun,
    }), {
      profile,
      token: sessionBiscuitToken,
    });
    setDetails(formatJson(result));
    setSelectedPayment(result);
    if (result.status === "Failed" || result.failed_error) {
      return paymentFailureStatus(result.failed_error ?? "payment failed");
    }
    return dryRun ? "Payment preview completed" : "Payment sent";
  }

  async function buildRouter() {
    const result = await fiberRpc<BuildRouterResult>("build_router", compactObject({
      amount: routeAmount || paymentAmount,
      hops_info: parseJsonArray(routeHopsInfo),
      final_tlc_expiry_delta: finalTlcExpiryDelta,
    }), {
      profile,
      token: sessionBiscuitToken,
    });
    setRouterText(formatJson(result.router_hops ?? []));
    setDetails(formatJson(result));
    return "Route built";
  }

  async function sendPaymentWithRouter(dryRun: boolean) {
    const router = parseJsonArray(routerText);
    const result = await fiberRpc<PaymentResult>("send_payment_with_router", compactObject({
      payment_hash: paymentHash,
      router,
      invoice: invoiceText,
      keysend,
      dry_run: dryRun,
    }), {
      profile,
      token: sessionBiscuitToken,
    });
    setDetails(formatJson(result));
    setSelectedPayment(result);
    if (result.status === "Failed" || result.failed_error) {
      return paymentFailureStatus(result.failed_error ?? "payment failed");
    }
    return dryRun ? "Router payment preview completed" : "Router payment sent";
  }

  return (
    <section className="settings-panel">
      <div className="section-heading">
        <div>
          <h2>Payments</h2>
          <p>Invoice creation, payment preview, send, and history.</p>
        </div>
        <button className="command-button" type="button" disabled={payments.isFetching} onClick={() => payments.refetch()}>
          <RefreshCcw size={16} aria-hidden="true" />
          <span>{payments.isFetching ? "Refreshing" : "Refresh"}</span>
        </button>
      </div>

      <div className="resource-grid">
        <div>
          <h2>Create Invoice</h2>
          <div className="settings-form">
            <div className="settings-row">
              <label>
                <span>Amount shannons</span>
                <input value={invoiceAmount} onChange={(event) => setInvoiceAmount(event.target.value)} />
              </label>
              <label>
                <span>Currency</span>
                <select value={invoiceCurrency} onChange={(event) => setInvoiceCurrency(event.target.value)}>
                  <option value="Fibt">Fibt</option>
                  <option value="Fibb">Fibb</option>
                  <option value="Fibd">Fibd</option>
                </select>
              </label>
            </div>
            <label>
              <span>Description</span>
              <input value={invoiceDescription} onChange={(event) => setInvoiceDescription(event.target.value)} />
            </label>
            <label>
              <span>Expiry seconds</span>
              <input value={invoiceExpiry} onChange={(event) => setInvoiceExpiry(event.target.value)} />
            </label>
            <h2>Advanced Invoice</h2>
            <div className="settings-row">
              <label>
                <span>Payment preimage</span>
                <input
                  value={invoicePaymentPreimage}
                  onChange={(event) => setInvoicePaymentPreimage(event.target.value)}
                  placeholder="0x... optional"
                />
              </label>
              <label>
                <span>Payment hash</span>
                <input
                  value={invoicePaymentHash}
                  onChange={(event) => setInvoicePaymentHash(event.target.value)}
                  placeholder="0x... optional"
                />
              </label>
            </div>
            <div className="settings-row">
              <label>
                <span>Fallback address</span>
                <input
                  value={invoiceFallbackAddress}
                  onChange={(event) => setInvoiceFallbackAddress(event.target.value)}
                  placeholder="optional"
                />
              </label>
              <label>
                <span>Final expiry delta ms</span>
                <input
                  value={invoiceFinalExpiryDelta}
                  onChange={(event) => setInvoiceFinalExpiryDelta(event.target.value)}
                  placeholder="optional"
                />
              </label>
            </div>
            <label>
              <span>UDT type script JSON</span>
              <textarea
                className="secret-textarea"
                value={invoiceUdtTypeScript}
                onChange={(event) => setInvoiceUdtTypeScript(event.target.value)}
                rows={4}
                spellCheck={false}
              />
            </label>
            <div className="settings-row">
              <label className="checkbox-row">
                <input checked={invoiceAllowMpp} onChange={(event) => setInvoiceAllowMpp(event.target.checked)} type="checkbox" />
                <span>Allow MPP</span>
              </label>
              <label className="checkbox-row">
                <input
                  checked={invoiceAllowTrampoline}
                  onChange={(event) => setInvoiceAllowTrampoline(event.target.checked)}
                  type="checkbox"
                />
                <span>Allow trampoline routing</span>
              </label>
            </div>
            <button
              className="command-button"
              disabled={isBusy}
              type="button"
              onClick={() =>
                run(async () => {
                  const result = await fiberRpc<InvoiceResult>("new_invoice", compactObject({
                    amount: invoiceAmount,
                    currency: invoiceCurrency,
                    description: invoiceDescription,
                    expiry: invoiceExpiry,
                    payment_preimage: invoicePaymentPreimage,
                    payment_hash: invoicePaymentHash,
                    fallback_address: invoiceFallbackAddress,
                    final_expiry_delta: invoiceFinalExpiryDelta,
                    udt_type_script: parseOptionalJsonObject(invoiceUdtTypeScript),
                    allow_mpp: invoiceAllowMpp ? true : undefined,
                    allow_trampoline_routing: invoiceAllowTrampoline ? true : undefined,
                  }), {
                    profile,
                    token: sessionBiscuitToken,
                  });
                  if (result.invoice_address) {
                    setInvoiceText(result.invoice_address);
                  }
                  const hash = stringField(result.invoice, "payment_hash");
                  if (hash) {
                    setPaymentHash(hash);
                  }
                  setDetails(formatJson(result));
                  return "Invoice created";
                })
              }
            >
              <ReceiptText size={16} aria-hidden="true" />
              <span>Create Invoice</span>
            </button>
          </div>

          <h2>Invoice Lookup</h2>
          <div className="settings-form">
            <label>
              <span>Invoice</span>
              <textarea
                className="secret-textarea"
                value={invoiceText}
                onChange={(event) => setInvoiceText(event.target.value)}
                rows={4}
                spellCheck={false}
              />
            </label>
            <label>
              <span>Payment hash</span>
              <input value={paymentHash} onChange={(event) => setPaymentHash(event.target.value)} placeholder="0x..." />
            </label>
            <div className="node-actions">
              <button
                className="command-button"
                disabled={isBusy}
                type="button"
                onClick={() =>
                  run(async () => {
                    const result = await fiberRpc<InvoiceResult>("parse_invoice", { invoice: invoiceText }, {
                      profile,
                      token: sessionBiscuitToken,
                    });
                    setDetails(formatJson(result));
                    return "Invoice parsed";
                  })
                }
              >
                <FileSearch size={16} aria-hidden="true" />
                <span>Parse</span>
              </button>
              <button
                className="command-button"
                disabled={isBusy}
                type="button"
                onClick={() =>
                  run(async () => {
                    const result = await fiberRpc<InvoiceResult>("get_invoice", { payment_hash: paymentHash }, {
                      profile,
                      token: sessionBiscuitToken,
                    });
                    setDetails(formatJson(result));
                    return "Invoice loaded";
                  })
                }
              >
                <FileSearch size={16} aria-hidden="true" />
                <span>Get</span>
              </button>
              <button
                className="command-button"
                disabled={isBusy}
                type="button"
                onClick={() =>
                  run(async () => {
                    const result = await fiberRpc<InvoiceResult>("cancel_invoice", { payment_hash: paymentHash }, {
                      profile,
                      token: sessionBiscuitToken,
                    });
                    setDetails(formatJson(result));
                    return "Invoice canceled";
                  })
                }
              >
                <XCircle size={16} aria-hidden="true" />
                <span>Cancel</span>
              </button>
            </div>
          </div>
        </div>

        <div>
          <h2>Send Payment</h2>
          <div className="settings-form">
            <label>
              <span>Target pubkey</span>
              <input value={targetPubkey} onChange={(event) => setTargetPubkey(event.target.value)} placeholder="optional with invoice" />
            </label>
            <div className="settings-row">
              <label>
                <span>Amount shannons</span>
                <input value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} placeholder="optional with invoice" />
              </label>
              <label>
                <span>Max fee shannons</span>
                <input value={maxFeeAmount} onChange={(event) => setMaxFeeAmount(event.target.value)} placeholder="optional" />
              </label>
            </div>
            <label>
              <span>Timeout seconds</span>
              <input value={timeout} onChange={(event) => setTimeoutValue(event.target.value)} />
            </label>
            <div className="settings-row">
              <label className="checkbox-row">
                <input checked={keysend} onChange={(event) => setKeysend(event.target.checked)} type="checkbox" />
                <span>Keysend</span>
              </label>
              <label className="checkbox-row">
                <input checked={allowSelfPayment} onChange={(event) => setAllowSelfPayment(event.target.checked)} type="checkbox" />
                <span>Allow self-payment</span>
              </label>
            </div>
            <div className="warning-note">
              <SendHorizontal size={16} aria-hidden="true" />
              <span>Preview runs as a dry run. Send broadcasts through the active Fiber RPC profile.</span>
            </div>
            <div className="node-actions">
              <button className="command-button" disabled={isBusy} type="button" onClick={() => run(() => sendPayment(true))}>
                <FileSearch size={16} aria-hidden="true" />
                <span>Preview</span>
              </button>
              <ConfirmActionButton
                confirmLabel="Send Payment"
                disabled={isBusy}
                icon={<SendHorizontal size={16} aria-hidden="true" />}
                items={[
                  { label: "Invoice", value: invoiceText ? shorten(invoiceText) : "not set" },
                  { label: "Target pubkey", value: targetPubkey ? shorten(targetPubkey) : "not set" },
                  { label: "Amount", value: paymentAmount || "from invoice" },
                  { label: "Max fee", value: maxFeeAmount || "node default" },
                  { label: "Timeout", value: `${timeout} seconds` },
                ]}
                label="Send"
                title="Confirm Payment Send"
                warning="Send broadcasts the payment through the active Fiber RPC profile."
                onConfirm={() => run(() => sendPayment(false), true)}
              />
            </div>
          </div>

          <h2>Manual Route</h2>
          <div className="settings-form">
            <div className="settings-row">
              <label>
                <span>Route amount shannons</span>
                <input value={routeAmount} onChange={(event) => setRouteAmount(event.target.value)} placeholder="uses payment amount" />
              </label>
              <label>
                <span>Final TLC expiry delta ms</span>
                <input value={finalTlcExpiryDelta} onChange={(event) => setFinalTlcExpiryDelta(event.target.value)} placeholder="optional" />
              </label>
            </div>
            <label>
              <span>Hops info JSON</span>
              <textarea
                className="secret-textarea"
                value={routeHopsInfo}
                onChange={(event) => setRouteHopsInfo(event.target.value)}
                rows={4}
                spellCheck={false}
              />
            </label>
            <label>
              <span>Router JSON</span>
              <textarea
                className="secret-textarea"
                value={routerText}
                onChange={(event) => setRouterText(event.target.value)}
                rows={4}
                spellCheck={false}
              />
            </label>
            <div className="warning-note">
              <FileSearch size={16} aria-hidden="true" />
              <span>Build Route calls Fiber routing directly. Router send uses the router JSON and can be previewed as a dry run.</span>
            </div>
            <div className="node-actions">
              <button className="command-button" disabled={isBusy} type="button" onClick={() => run(buildRouter)}>
                <FileSearch size={16} aria-hidden="true" />
                <span>Build Route</span>
              </button>
              <button className="command-button" disabled={isBusy} type="button" onClick={() => run(() => sendPaymentWithRouter(true))}>
                <FileSearch size={16} aria-hidden="true" />
                <span>Preview Router Send</span>
              </button>
              <ConfirmActionButton
                confirmLabel="Send Router Payment"
                disabled={isBusy}
                icon={<SendHorizontal size={16} aria-hidden="true" />}
                items={[
                  { label: "Invoice", value: invoiceText ? shorten(invoiceText) : "not set" },
                  { label: "Payment hash", value: paymentHash ? shorten(paymentHash) : "not set" },
                  { label: "Router hops", value: `${parseJsonArraySafe(routerText).length} hops` },
                  { label: "Keysend", value: keysend ? "yes" : "no" },
                ]}
                label="Send Router"
                title="Confirm Router Payment Send"
                warning="This sends a payment with the supplied router through the active Fiber RPC profile."
                onConfirm={() => run(() => sendPaymentWithRouter(false), true)}
              />
            </div>
          </div>

          <h2>History</h2>
          <div className="settings-form">
            <label>
              <span>Status filter</span>
              <select value={paymentStatusFilter} onChange={(event) => setPaymentStatusFilter(event.target.value)}>
                <option value="">All</option>
                <option value="Created">Created</option>
                <option value="Inflight">Inflight</option>
                <option value="Success">Success</option>
                <option value="Failed">Failed</option>
              </select>
            </label>
          </div>
          <div className="resource-list">
            {payments.isError ? <p className="compact-meta">{formatRpcError(payments.error)}</p> : null}
            {payments.data?.length ? (
              payments.data.map((payment, index) => (
                <button
                  className="resource-card resource-card-main"
                  key={payment.payment_hash ?? index}
                  type="button"
                  onClick={() => {
                    setPaymentHash(payment.payment_hash ?? "");
                    setSelectedPayment(payment);
                    setDetails(formatJson(payment));
                  }}
                >
                  <strong>{payment.status ?? "unknown"} / {payment.payment_hash ? shorten(payment.payment_hash) : "unknown hash"}</strong>
                  <small>{payment.failed_error ? paymentFailureStatus(payment.failed_error) : `fee ${payment.fee ?? "unknown"}`}</small>
                </button>
              ))
            ) : (
              <p className="compact-meta">{payments.isFetching ? "Loading payments" : "No payments returned."}</p>
            )}
          </div>
          {selectedPayment ? (
            <PaymentTimeline payment={selectedPayment} />
          ) : (
            <p className="compact-meta payment-timeline-empty">Select a payment to inspect its lifecycle.</p>
          )}
        </div>
      </div>

      <div className="node-status">
        <strong>{isBusy ? "Working" : status}</strong>
        {details ? <pre>{details}</pre> : null}
      </div>
    </section>
  );
}

function PaymentTimeline({ payment }: { payment: PaymentResult }) {
  const steps = buildPaymentTimeline(payment);

  return (
    <div className="payment-timeline" aria-label="Payment timeline">
      {steps.map((step) => (
        <TimelineStep key={step.label} step={step} />
      ))}
    </div>
  );
}

function TimelineStep({ step }: { step: PaymentTimelineStep }) {
  return (
    <div className={`payment-timeline-step ${step.state}`}>
      <span aria-hidden="true" />
      <div>
        <strong>{step.label}</strong>
        <small>{step.detail}</small>
      </div>
    </div>
  );
}

function compactObject(input: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => {
      if (typeof value === "string") {
        return value.trim().length > 0;
      }

      return value !== undefined && value !== null;
    }),
  );
}

function stringField(value: unknown, key: string): string {
  if (value && typeof value === "object" && !Array.isArray(value) && key in value) {
    const candidate = (value as Record<string, unknown>)[key];
    return typeof candidate === "string" ? candidate : "";
  }

  return "";
}

function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function parseOptionalJsonObject(input: string): Record<string, unknown> | undefined {
  if (!input.trim()) {
    return undefined;
  }

  const parsed = JSON.parse(input);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Expected UDT type script to be a JSON object");
  }

  return parsed as Record<string, unknown>;
}

function paymentFailureStatus(error: unknown): string {
  const failure = classifyPaymentFailure(error);
  return failure.kind === "payment_failed" ? `Payment failed: ${failure.message}` : failure.message;
}

function parseJsonArray(input: string): unknown[] {
  const parsed = JSON.parse(input);
  if (!Array.isArray(parsed)) {
    throw new Error("Expected a JSON array");
  }

  return parsed;
}

function parseJsonArraySafe(input: string): unknown[] {
  try {
    return parseJsonArray(input);
  } catch {
    return [];
  }
}

function shorten(value: string): string {
  if (value.length <= 18) {
    return value;
  }

  return `${value.slice(0, 10)}...${value.slice(-6)}`;
}
