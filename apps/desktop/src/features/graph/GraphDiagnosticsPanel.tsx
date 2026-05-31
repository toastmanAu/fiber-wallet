import { invoke } from "@tauri-apps/api/core";
import { useQuery } from "@tanstack/react-query";
import { Download, Network, RefreshCcw, ScrollText } from "lucide-react";
import { useState } from "react";
import { buildDiagnosticBundle } from "../../lib/diagnostics";
import { fiberRpc, formatRpcError } from "../../lib/fiberRpc";
import { useProfileStore } from "../../lib/profileStore";
import { queryKeys } from "../../lib/queryKeys";

type GraphNode = {
  pubkey?: string;
  node_name?: string;
  addresses?: string[];
  [key: string]: unknown;
};

type GraphChannel = {
  channel_id?: string;
  node1?: string;
  node2?: string;
  capacity?: string;
  [key: string]: unknown;
};

type GraphNodesResult = {
  nodes?: GraphNode[];
};

type GraphChannelsResult = {
  channels?: GraphChannel[];
};

const gapChecks = [
  "docs/gap-checks/milestone-0.md",
  "docs/gap-checks/biscuit-auth-foundation.md",
  "docs/gap-checks/peers-channels-foundation.md",
  "docs/gap-checks/invoice-payment-foundation.md",
];

export function GraphDiagnosticsPanel() {
  const activeProfile = useProfileStore((state) =>
    state.profiles.find((profile) => profile.id === state.activeProfileId),
  );
  const sessionBiscuitToken = useProfileStore((state) => state.sessionBiscuitToken);
  const [limit, setLimit] = useState("50");
  const [diagnostics, setDiagnostics] = useState("");
  const [status, setStatus] = useState("No diagnostic bundle yet");
  const [isBusy, setIsBusy] = useState(false);

  const nodes = useQuery({
    queryKey: queryKeys.graphNodes(activeProfile?.id, activeProfile?.rpcMode, activeProfile?.fiberRpcEndpoint, limit),
    queryFn: async () => {
      if (!activeProfile) {
        throw new Error("No active profile");
      }

      const response = await fiberRpc<GraphNodesResult>("graph_nodes", { limit }, {
        profile: activeProfile,
        token: sessionBiscuitToken,
      });

      return Array.isArray(response.nodes) ? response.nodes : [];
    },
    enabled: Boolean(activeProfile),
  });

  const channels = useQuery({
    queryKey: queryKeys.graphChannels(activeProfile?.id, activeProfile?.rpcMode, activeProfile?.fiberRpcEndpoint, limit),
    queryFn: async () => {
      if (!activeProfile) {
        throw new Error("No active profile");
      }

      const response = await fiberRpc<GraphChannelsResult>("graph_channels", { limit }, {
        profile: activeProfile,
        token: sessionBiscuitToken,
      });

      return Array.isArray(response.channels) ? response.channels : [];
    },
    enabled: Boolean(activeProfile),
  });

  if (!activeProfile) {
    return (
      <section className="settings-panel">
        <h2>Graph</h2>
        <p>No active profile.</p>
      </section>
    );
  }
  const profile = activeProfile;

  async function refresh() {
    await Promise.all([nodes.refetch(), channels.refetch()]);
  }

  async function exportDiagnostics() {
    setIsBusy(true);
    setStatus("");
    try {
      const [appVersion, logs] = await Promise.all([
        invoke<string>("app_version").catch(() => "unknown"),
        profile.dataDir
          ? invoke<string>("node_read_logs", { dataDir: profile.dataDir, maxLines: 120 }).catch((error) =>
              formatRpcError(error),
            )
          : Promise.resolve("No data directory configured"),
      ]);
      const bundle = buildDiagnosticBundle({
        appVersion,
        profile,
        rpcStatus: nodes.isError ? formatRpcError(nodes.error) : "graph RPC ok",
        graph: {
          nodeCount: nodes.data?.length ?? 0,
          channelCount: channels.data?.length ?? 0,
        },
        recentLogs: logs,
        gapChecks,
      });
      setDiagnostics(bundle);
      setStatus("Diagnostic bundle generated");
    } catch (error) {
      setStatus(formatRpcError(error));
    } finally {
      setIsBusy(false);
    }
  }

  function downloadDiagnostics() {
    if (!diagnostics) {
      return;
    }

    const url = URL.createObjectURL(new Blob([diagnostics], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `fiber-wallet-diagnostics-${profile.id}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const graphNodes = nodes.data ?? [];
  const graphChannels = channels.data ?? [];

  return (
    <section className="settings-panel">
      <div className="section-heading">
        <div>
          <h2>Graph</h2>
          <p>Network graph and redacted diagnostic bundle.</p>
        </div>
        <button className="command-button" type="button" disabled={nodes.isFetching || channels.isFetching} onClick={refresh}>
          <RefreshCcw size={16} aria-hidden="true" />
          <span>{nodes.isFetching || channels.isFetching ? "Refreshing" : "Refresh"}</span>
        </button>
      </div>

      <div className="settings-form">
        <label>
          <span>Graph limit</span>
          <input value={limit} onChange={(event) => setLimit(event.target.value)} />
        </label>
      </div>

      <div className="graph-canvas" aria-label="Network graph">
        <GraphSvg nodes={graphNodes} channels={graphChannels} />
      </div>

      <div className="resource-grid">
        <div>
          <h2>Nodes</h2>
          <div className="resource-list">
            {nodes.isError ? <p className="compact-meta">{formatRpcError(nodes.error)}</p> : null}
            {graphNodes.length ? (
              graphNodes.map((node, index) => (
                <div className="resource-card" key={node.pubkey ?? index}>
                  <div>
                    <strong>{node.node_name || "unnamed node"}</strong>
                    <small>{node.pubkey ? shorten(node.pubkey) : "unknown pubkey"}</small>
                  </div>
                  <Network size={16} aria-hidden="true" />
                </div>
              ))
            ) : (
              <p className="compact-meta">{nodes.isFetching ? "Loading nodes" : "No graph nodes returned."}</p>
            )}
          </div>
        </div>

        <div>
          <h2>Channels</h2>
          <div className="resource-list">
            {channels.isError ? <p className="compact-meta">{formatRpcError(channels.error)}</p> : null}
            {graphChannels.length ? (
              graphChannels.map((channel, index) => (
                <div className="resource-card" key={channel.channel_id ?? index}>
                  <div>
                    <strong>{channel.channel_id ? shorten(channel.channel_id) : "unknown channel"}</strong>
                    <small>
                      {shorten(channel.node1 ?? "unknown")} to {shorten(channel.node2 ?? "unknown")}
                    </small>
                  </div>
                </div>
              ))
            ) : (
              <p className="compact-meta">{channels.isFetching ? "Loading channels" : "No graph channels returned."}</p>
            )}
          </div>
        </div>
      </div>

      <div className="settings-form">
        <div className="node-actions">
          <button className="command-button" type="button" disabled={isBusy} onClick={exportDiagnostics}>
            <ScrollText size={16} aria-hidden="true" />
            <span>{isBusy ? "Generating" : "Generate Diagnostics"}</span>
          </button>
          <button className="command-button" type="button" disabled={!diagnostics} onClick={downloadDiagnostics}>
            <Download size={16} aria-hidden="true" />
            <span>Download</span>
          </button>
        </div>
        <div className="node-status">
          <strong>{status}</strong>
          {diagnostics ? <pre>{diagnostics}</pre> : null}
        </div>
      </div>
    </section>
  );
}

function GraphSvg({ nodes, channels }: { nodes: GraphNode[]; channels: GraphChannel[] }) {
  const positions = nodes.map((node, index) => {
    const angle = (Math.PI * 2 * index) / Math.max(nodes.length, 1);
    return {
      node,
      x: 50 + Math.cos(angle) * 34,
      y: 50 + Math.sin(angle) * 34,
    };
  });

  return (
    <svg viewBox="0 0 100 100" role="img">
      {channels.map((channel, index) => {
        const from = positions.find((position) => position.node.pubkey === channel.node1) ?? positions[index % positions.length];
        const to = positions.find((position) => position.node.pubkey === channel.node2) ?? positions[(index + 1) % positions.length];

        if (!from || !to) {
          return null;
        }

        return <line key={channel.channel_id ?? index} x1={from.x} y1={from.y} x2={to.x} y2={to.y} />;
      })}
      {positions.map((position, index) => (
        <g key={position.node.pubkey ?? index}>
          <circle cx={position.x} cy={position.y} r="4.5" />
          <text x={position.x} y={position.y - 7}>
            {index + 1}
          </text>
        </g>
      ))}
    </svg>
  );
}

function shorten(value: string): string {
  if (value.length <= 18) {
    return value;
  }

  return `${value.slice(0, 10)}...${value.slice(-6)}`;
}
