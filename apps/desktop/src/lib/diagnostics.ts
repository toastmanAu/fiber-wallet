import { redactSecrets } from "./redaction";
import type { Profile } from "./profileStore";

export type DiagnosticBundleInput = {
  appVersion: string;
  profile: Profile;
  rpcStatus: string;
  graph: {
    nodeCount: number;
    channelCount: number;
  };
  rpcHealth: Record<string, string>;
  configContents: string;
  recentLogs: string;
  gapChecks: string[];
};

export function buildDiagnosticBundle(input: DiagnosticBundleInput): string {
  const bundle = {
    created_at: new Date().toISOString(),
    app_version: input.appVersion,
    profile: {
      id: input.profile.id,
      name: input.profile.name,
      mode: input.profile.mode,
      network: input.profile.network,
      rpc_mode: input.profile.rpcMode,
      fiber_rpc_endpoint: input.profile.fiberRpcEndpoint,
      ckb_rpc_endpoint: input.profile.ckbRpcEndpoint,
      data_dir_set: Boolean(input.profile.dataDir),
      config_path_set: Boolean(input.profile.configPath),
      biscuit_public_key_set: Boolean(input.profile.biscuitPublicKey),
      peer_address_book_count: input.profile.peerAddressBook.length,
    },
    rpc_status: input.rpcStatus,
    rpc_health: input.rpcHealth,
    graph: input.graph,
    config_contents: input.configContents,
    recent_logs: input.recentLogs,
    gap_checks: input.gapChecks,
  };

  return redactSecrets(JSON.stringify(bundle, null, 2));
}
