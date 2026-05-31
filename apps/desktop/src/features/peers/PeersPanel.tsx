import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Cable, Plus, RadioTower, Save, Trash2, Unplug } from "lucide-react";
import { useState } from "react";
import { fiberRpc, formatRpcError } from "../../lib/fiberRpc";
import { type PeerAddressBookEntry, useProfileStore } from "../../lib/profileStore";
import { queryKeys } from "../../lib/queryKeys";

type PeerInfo = {
  pubkey?: string;
  address?: string;
  [key: string]: unknown;
};

type ListPeersResult = {
  peers?: PeerInfo[];
};

const relayShortcuts = [
  {
    id: "fiber-testnet-public-bottle",
    label: "testnet bottle",
    pubkey: "02b6d4e3ab86a2ca2fad6fae0ecb2e1e559e0b911939872a90abdda6d20302be71",
  },
  {
    id: "fiber-testnet-public-bracer",
    label: "testnet bracer",
    pubkey: "0291a6576bd5a94bd74b27080a48340875338fff9f6d6361fe6b8db8d0d1912fcc",
  },
];

export function PeersPanel() {
  const activeProfile = useProfileStore((state) =>
    state.profiles.find((profile) => profile.id === state.activeProfileId),
  );
  const updateActiveProfile = useProfileStore((state) => state.updateActiveProfile);
  const sessionBiscuitToken = useProfileStore((state) => state.sessionBiscuitToken);
  const queryClient = useQueryClient();
  const [label, setLabel] = useState("");
  const [address, setAddress] = useState("");
  const [pubkey, setPubkey] = useState("");
  const [savePeer, setSavePeer] = useState(true);
  const [status, setStatus] = useState("No peer action yet");
  const [isBusy, setIsBusy] = useState(false);

  const peers = useQuery({
    queryKey: queryKeys.peers(activeProfile?.id, activeProfile?.rpcMode, activeProfile?.fiberRpcEndpoint),
    queryFn: async () => {
      if (!activeProfile) {
        throw new Error("No active profile");
      }

      const response = await fiberRpc<ListPeersResult | PeerInfo[]>("list_peers", [], {
        profile: activeProfile,
        token: sessionBiscuitToken,
      });

      return normalizePeers(response);
    },
    enabled: Boolean(activeProfile),
  });

  if (!activeProfile) {
    return (
      <section className="settings-panel">
        <h2>Peers</h2>
        <p>No active profile.</p>
      </section>
    );
  }
  const profile = activeProfile;

  async function run(action: () => Promise<string>) {
    setIsBusy(true);
    setStatus("");
    try {
      setStatus(await action());
      await queryClient.invalidateQueries({ queryKey: queryKeys.peersRoot() });
    } catch (error) {
      setStatus(formatRpcError(error));
    } finally {
      setIsBusy(false);
    }
  }

  function upsertAddressBook(entry: PeerAddressBookEntry) {
    const existing = profile.peerAddressBook.filter((item) => item.id !== entry.id);
    updateActiveProfile({ peerAddressBook: [...existing, entry] });
  }

  function removeAddressBook(id: string) {
    updateActiveProfile({
      peerAddressBook: profile.peerAddressBook.filter((item) => item.id !== id),
    });
  }

  function loadAddressBook(entry: PeerAddressBookEntry) {
    setLabel(entry.label);
    setAddress(entry.address);
    setPubkey(entry.pubkey);
  }

  async function connect(input: { address?: string; pubkey?: string; save?: boolean }) {
    await fiberRpc("connect_peer", compactObject(input), {
      profile,
      token: sessionBiscuitToken,
    });
  }

  async function disconnect(peerPubkey: string) {
    await fiberRpc("disconnect_peer", { pubkey: peerPubkey }, {
      profile,
      token: sessionBiscuitToken,
    });
  }

  return (
    <section className="settings-panel">
      <div className="section-heading">
        <div>
          <h2>Peers</h2>
          <p>Connected peers, public-node shortcuts, and saved peer targets.</p>
        </div>
        <button className="command-button" type="button" disabled={peers.isFetching} onClick={() => peers.refetch()}>
          <RadioTower size={16} aria-hidden="true" />
          <span>{peers.isFetching ? "Refreshing" : "Refresh"}</span>
        </button>
      </div>

      <div className="resource-grid">
        <div>
          <h2>Connect</h2>
          <div className="settings-form">
            <label>
              <span>Label</span>
              <input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="relay or peer name" />
            </label>
            <label>
              <span>Multiaddr</span>
              <input
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder="/ip4/1.2.3.4/tcp/8228/p2p/..."
              />
            </label>
            <label>
              <span>Pubkey</span>
              <input value={pubkey} onChange={(event) => setPubkey(event.target.value)} placeholder="02..." />
            </label>
            <label className="checkbox-row">
              <input checked={savePeer} onChange={(event) => setSavePeer(event.target.checked)} type="checkbox" />
              <span>Ask FNN to save peer address</span>
            </label>
            <div className="node-actions">
              <button
                className="command-button"
                disabled={isBusy}
                type="button"
                onClick={() =>
                  run(async () => {
                    await connect({ address, pubkey, save: savePeer });
                    return "Peer connect requested";
                  })
                }
              >
                <Cable size={16} aria-hidden="true" />
                <span>Connect</span>
              </button>
              <button
                className="command-button"
                disabled={isBusy}
                type="button"
                onClick={() => {
                  const entry = {
                    id: stablePeerId(label, address, pubkey),
                    label: label.trim() || "saved peer",
                    address: address.trim(),
                    pubkey: pubkey.trim(),
                  };
                  upsertAddressBook(entry);
                  setStatus("Saved peer target");
                }}
              >
                <Save size={16} aria-hidden="true" />
                <span>Save</span>
              </button>
            </div>
          </div>

          <div className="resource-list">
            <h2>Public shortcuts</h2>
            {relayShortcuts.map((relay) => (
              <div className="resource-card" key={relay.id}>
                <div>
                  <strong>{relay.label}</strong>
                  <small>{shorten(relay.pubkey)}</small>
                </div>
                <button
                  className="command-button"
                  disabled={isBusy}
                  type="button"
                  onClick={() =>
                    run(async () => {
                      await connect({ pubkey: relay.pubkey, save: true });
                      return `Connect requested: ${relay.label}`;
                    })
                  }
                >
                  <Cable size={16} aria-hidden="true" />
                  <span>Connect</span>
                </button>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2>Address Book</h2>
          <div className="resource-list">
            {profile.peerAddressBook.length ? (
              profile.peerAddressBook.map((entry) => (
                <div className="resource-card" key={entry.id}>
                  <button className="resource-card-main" type="button" onClick={() => loadAddressBook(entry)}>
                    <strong>{entry.label}</strong>
                    <small>{entry.pubkey ? shorten(entry.pubkey) : entry.address || "empty target"}</small>
                  </button>
                  <button className="icon-button" type="button" onClick={() => removeAddressBook(entry.id)} aria-label="Remove peer">
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
              ))
            ) : (
              <p className="compact-meta">No saved peers.</p>
            )}
          </div>

          <h2>Connected Peers</h2>
          <div className="resource-list">
            {peers.isError ? <p className="compact-meta">{formatRpcError(peers.error)}</p> : null}
            {peers.data?.length ? (
              peers.data.map((peer, index) => {
                const peerPubkey = peer.pubkey ?? "";
                return (
                  <div className="resource-card" key={peerPubkey || index}>
                    <div>
                      <strong>{peerPubkey ? shorten(peerPubkey) : "unknown pubkey"}</strong>
                      <small>{peer.address ?? "no address returned"}</small>
                    </div>
                    {peerPubkey ? (
                      <button
                        className="command-button"
                        disabled={isBusy}
                        type="button"
                        onClick={() =>
                          run(async () => {
                            await disconnect(peerPubkey);
                            return "Peer disconnect requested";
                          })
                        }
                      >
                        <Unplug size={16} aria-hidden="true" />
                        <span>Disconnect</span>
                      </button>
                    ) : null}
                  </div>
                );
              })
            ) : (
              <p className="compact-meta">{peers.isFetching ? "Loading peers" : "No connected peers."}</p>
            )}
          </div>
        </div>
      </div>

      <div className="node-status">
        <strong>{isBusy ? "Working" : status}</strong>
      </div>
    </section>
  );
}

function normalizePeers(response: ListPeersResult | PeerInfo[]): PeerInfo[] {
  if (Array.isArray(response)) {
    return response;
  }

  return Array.isArray(response.peers) ? response.peers : [];
}

function compactObject(input: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => {
      if (typeof value === "string") {
        return value.trim().length > 0;
      }

      return value !== undefined && value !== null;
    }),
  );
}

function stablePeerId(label: string, address: string, pubkey: string): string {
  return `${label || address || pubkey || "peer"}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48) || `peer-${Date.now()}`;
}

function shorten(value: string): string {
  if (value.length <= 18) {
    return value;
  }

  return `${value.slice(0, 10)}...${value.slice(-6)}`;
}
