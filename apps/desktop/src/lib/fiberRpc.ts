import { invoke } from "@tauri-apps/api/core";
import { mockFiberRpc } from "./mockRpc";
import type { Profile } from "./profileStore";

export type FiberRpcOptions = {
  profile: Profile;
  token?: string;
};

export type RpcClientError = {
  kind: string;
  message: string;
  status?: number;
};

export async function fiberRpc<T>(method: string, params: unknown[] = [], options: FiberRpcOptions): Promise<T> {
  if (options.profile.rpcMode === "mock") {
    return mockFiberRpc(method) as Promise<T>;
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
