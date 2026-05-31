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

export function validateRpcParams(method: AllowedRpcMethod, params: unknown[]): void {
  const input = firstObject(params);

  switch (method) {
    case "connect_peer":
      requireOne(input, ["address", "pubkey"], method);
      return;
    case "disconnect_peer":
      requireFields(input, ["pubkey"], method);
      return;
    case "open_channel":
      requireFields(input, ["pubkey", "funding_amount"], method);
      return;
    case "open_channel_with_external_funding":
      requireFields(input, ["pubkey", "funding_amount", "shutdown_script", "funding_lock_script"], method);
      return;
    case "accept_channel":
      requireFields(input, ["temporary_channel_id", "funding_amount"], method);
      return;
    case "update_channel":
    case "shutdown_channel":
      requireFields(input, ["channel_id"], method);
      return;
    case "submit_signed_funding_tx":
      requireFields(input, ["channel_id", "signed_funding_tx"], method);
      return;
    case "new_invoice":
      requireFields(input, ["amount", "currency"], method);
      return;
    case "parse_invoice":
      requireFields(input, ["invoice"], method);
      return;
    case "get_invoice":
    case "cancel_invoice":
    case "get_payment":
      requireFields(input, ["payment_hash"], method);
      return;
    case "send_payment":
      requireOne(input, ["invoice", "target_pubkey", "payment_hash"], method);
      return;
    case "build_router":
      requireFields(input, ["hops_info"], method);
      requireArray(input, "hops_info", method);
      return;
    case "send_payment_with_router":
      requireFields(input, ["router"], method);
      requireArray(input, "router", method);
      return;
    case "list_channels":
    case "list_payments":
    case "graph_nodes":
    case "graph_channels":
      if (params.length > 0) {
        firstObject(params);
      }
      return;
    case "sign_external_funding_tx":
      requireFields(input, ["unsigned_funding_tx", "private_key"], method);
      return;
    case "node_info":
    case "list_peers":
      return;
  }
}

export function shortenForConsole(value: string, maxLength = 180): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3)}...`;
}

function firstObject(params: unknown[]): Record<string, unknown> {
  if (params.length === 0) {
    return {};
  }

  const first = params[0];
  if (!first || typeof first !== "object" || Array.isArray(first)) {
    throw new Error("Params for this method must be a JSON object as the first array item");
  }

  return first as Record<string, unknown>;
}

function requireFields(input: Record<string, unknown>, fields: string[], method: string): void {
  const missing = fields.filter((field) => isBlank(input[field]));
  if (missing.length) {
    throw new Error(`${method} requires: ${missing.join(", ")}`);
  }
}

function requireOne(input: Record<string, unknown>, fields: string[], method: string): void {
  if (fields.every((field) => isBlank(input[field]))) {
    throw new Error(`${method} requires one of: ${fields.join(", ")}`);
  }
}

function requireArray(input: Record<string, unknown>, field: string, method: string): void {
  if (!Array.isArray(input[field])) {
    throw new Error(`${method}.${field} must be a JSON array`);
  }
}

function isBlank(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === "string" && !value.trim());
}
