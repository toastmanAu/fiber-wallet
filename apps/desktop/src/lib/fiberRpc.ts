import { invoke } from "@tauri-apps/api/core";

export async function fiberRpc<T>(method: string, params: unknown[] = []): Promise<T> {
  return invoke<T>("mock_rpc_call", { method, params });
}

