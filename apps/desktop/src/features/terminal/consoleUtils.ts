import type { AllowedRpcMethod } from "../../lib/allowedRpcMethods";

const rawRpcConfirmationMethods = new Set<AllowedRpcMethod>([
  "connect_peer",
  "disconnect_peer",
  "open_channel",
  "open_channel_with_external_funding",
  "accept_channel",
  "update_channel",
  "shutdown_channel",
  "submit_signed_funding_tx",
  "new_invoice",
  "cancel_invoice",
  "send_payment",
  "send_payment_with_router",
  "sign_external_funding_tx",
]);

export function parseRpcParams(input: string): unknown[] {
  const trimmed = input.trim();

  if (!trimmed) {
    return [];
  }

  const parsed = JSON.parse(trimmed) as unknown;

  if (!Array.isArray(parsed)) {
    throw new Error("Params must be a JSON array");
  }

  return parsed;
}

export function formatJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function requiresRawRpcConfirmation(method: AllowedRpcMethod): boolean {
  return rawRpcConfirmationMethods.has(method);
}

export function shortenForConsole(value: string, maxLength = 180): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3)}...`;
}
