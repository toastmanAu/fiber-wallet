import { Activity, Cable, RadioTower, ShieldCheck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { MetricCard } from "../../components/MetricCard";
import { mockFiberRpc } from "../../lib/mockRpc";
import { queryKeys } from "../../lib/queryKeys";

export function Dashboard() {
  const nodeInfo = useQuery({
    queryKey: queryKeys.nodeInfo(),
    queryFn: () => mockFiberRpc("node_info"),
  });

  const nodeName = getStringField(nodeInfo.data, "node_name", "offline");
  const network = getStringField(nodeInfo.data, "chain", "unknown");

  return (
    <div className="dashboard-panel">
      <div className="section-heading">
        <div>
          <h2>Node State</h2>
          <p>Mocked local-first view for the Milestone 1 shell.</p>
        </div>
      </div>

      <div className="metrics-grid">
        <MetricCard title="Node" value={nodeName} detail={`Network: ${network}`} icon={Activity} />
        <MetricCard title="Auth" value="stub" detail="Secret backend does not store secrets yet" icon={ShieldCheck} />
        <MetricCard title="Peers" value="0" detail="Peer RPC fixtures are ready" icon={RadioTower} />
        <MetricCard title="Channels" value="0" detail="Channel RPC fixtures are ready" icon={Cable} />
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
