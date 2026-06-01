import { invoke } from "@tauri-apps/api/core";
import { useQuery } from "@tanstack/react-query";
import { buildCkbActionGate, type CkbRpcHealth } from "./ckbHealth";
import type { Profile } from "./profileStore";
import { queryKeys } from "./queryKeys";

export function useCkbReadiness(profile?: Profile) {
  const ckbHealth = useQuery({
    queryKey: queryKeys.ckbHealth(profile?.id, profile?.ckbRpcEndpoint),
    queryFn: () => {
      if (!profile) {
        throw new Error("No active profile");
      }

      return invoke<CkbRpcHealth>("ckb_rpc_health", {
        endpoint: profile.ckbRpcEndpoint,
      });
    },
    enabled: Boolean(profile && profile.rpcMode === "live"),
  });

  return {
    health: ckbHealth.data,
    error: ckbHealth.error,
    isChecking: ckbHealth.isFetching,
    refetch: ckbHealth.refetch,
    gate: buildCkbActionGate(profile?.rpcMode ?? "mock", ckbHealth.data, ckbHealth.error),
  };
}
