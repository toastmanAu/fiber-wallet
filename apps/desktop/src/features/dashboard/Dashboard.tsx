import { Activity, Cable, RadioTower, ShieldAlert, ShieldCheck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { MetricCard } from "../../components/MetricCard";
import { fiberRpc, formatRpcError } from "../../lib/fiberRpc";
import { useProfileStore } from "../../lib/profileStore";
import { queryKeys } from "../../lib/queryKeys";

export function Dashboard() {
  const activeProfile = useProfileStore((state) =>
    state.profiles.find((profile) => profile.id === state.activeProfileId),
  );
  const sessionBiscuitToken = useProfileStore((state) => state.sessionBiscuitToken);
  const nodeInfo = useQuery({
    queryKey: queryKeys.nodeInfo(activeProfile?.id, activeProfile?.rpcMode, activeProfile?.fiberRpcEndpoint),
    queryFn: () => {
      if (!activeProfile) {
        throw new Error("No active profile");
      }

      return fiberRpc("node_info", [], {
        profile: activeProfile,
        token: sessionBiscuitToken,
      });
    },
    enabled: Boolean(activeProfile),
  });

  const nodeName = getStringField(nodeInfo.data, "node_name", "offline");
  const pubkey = getStringField(nodeInfo.data, "pubkey", getStringField(nodeInfo.data, "node_id", "unknown"));
  const network = getStringField(nodeInfo.data, "chain", getStringField(nodeInfo.data, "chain_hash", "unknown"));
  const rpcMode = activeProfile?.rpcMode ?? "mock";
  const statusText = nodeInfo.isError ? formatRpcError(nodeInfo.error) : `${rpcMode} RPC`;

  return (
    <div className="dashboard-panel">
      <div className="section-heading">
        <div>
          <h2>Node State</h2>
          <p>{statusText}</p>
        </div>
      </div>

      {activeProfile?.network === "mainnet" ? (
        <div className="safety-banner danger">
          <ShieldAlert size={17} aria-hidden="true" />
          <span>Mainnet profile active in an early wallet build. Confirm backups, endpoint, and signer before sending funds.</span>
        </div>
      ) : null}

      <div className="metrics-grid">
        <MetricCard title="Node" value={nodeName} detail={`Network: ${network}`} icon={Activity} />
        <MetricCard
          title="Auth"
          value={sessionBiscuitToken ? "session token" : "none"}
          detail="Token is not persisted in this slice"
          icon={ShieldCheck}
        />
        <MetricCard title="Peers" value="0" detail="Peer RPC fixtures are ready" icon={RadioTower} />
        <MetricCard title="Pubkey" value={shorten(pubkey)} detail="From node_info" icon={Cable} />
      </div>
    </div>
  );
}

function getStringField(value: unknown, field: string, fallback: string): string {
  if (value && typeof value === "object" && !Array.isArray(value) && field in value) {
    const candidate = (value as Record<string, unknown>)[field];
    return typeof candidate === "string" ? candidate : fallback;
  }

  return fallback;
}

function shorten(value: string): string {
  if (value.length <= 14) {
    return value;
  }

  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}
