import { invoke } from "@tauri-apps/api/core";
import { blocksLiveRpc } from "./endpointSafety";
import { mockFiberRpc } from "./mockRpc";
import type { Profile } from "./profileStore";

export type FiberRpcOptions = {
  profile: Profile;
  token?: string;
};

export type FiberRpcParams = unknown[] | Record<string, unknown>;

export type RpcClientError = {
  kind: string;
  message: string;
  status?: number;
};

export async function fiberRpc<T>(method: string, params: FiberRpcParams = [], options: FiberRpcOptions): Promise<T> {
  if (options.profile.rpcMode === "mock") {
    return mockFiberRpc(method, params) as Promise<T>;
  }

  const blocked = blocksLiveRpc(options.profile, options.token);
  if (blocked) {
    throw {
      kind: blocked.kind === "invalid" ? "invalid_endpoint" : "public_rpc_requires_auth",
      message: blocked.message,
    } satisfies RpcClientError;
  }

  return invoke<T>("rpc_call", {
    endpoint: options.profile.fiberRpcEndpoint,
    method,
    params,
    token: options.token?.trim() ? options.token.trim() : null,
  });
}

export function formatRpcError(error: unknown): string {
  if (isRpcClientError(error)) {
    if (error.kind === "auth_required") {
      return `Biscuit auth required or invalid: ${error.message}`;
    }

    if (error.kind === "permission_denied") {
      return `Biscuit token permission denied: ${error.message}`;
    }

    return `${error.kind}: ${error.message}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function isRpcClientError(error: unknown): error is RpcClientError {
  return Boolean(
    error &&
      typeof error === "object" &&
      "kind" in error &&
      "message" in error &&
      typeof (error as RpcClientError).kind === "string" &&
      typeof (error as RpcClientError).message === "string",
  );
}
