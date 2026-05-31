import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Cable, RefreshCcw, ShieldAlert, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { ConfirmActionButton } from "../common/ConfirmActionButton";
import { fiberRpc, formatRpcError } from "../../lib/fiberRpc";
import { useProfileStore } from "../../lib/profileStore";
import { queryKeys } from "../../lib/queryKeys";

type ChannelInfo = {
  channel_id?: string;
  peer_pubkey?: string;
  state?: string;
  funding_amount?: string;
  public?: boolean;
  [key: string]: unknown;
};

type ListChannelsResult = {
  channels?: ChannelInfo[];
};

const publicNodeMinFunding = 49_900_000_000n;

export function ChannelsPanel() {
  const activeProfile = useProfileStore((state) =>
    state.profiles.find((profile) => profile.id === state.activeProfileId),
  );
  const sessionBiscuitToken = useProfileStore((state) => state.sessionBiscuitToken);
  const queryClient = useQueryClient();
  const [filterPubkey, setFilterPubkey] = useState("");
  const [includeClosed, setIncludeClosed] = useState(false);
  const [onlyPending, setOnlyPending] = useState(false);
  const [openPubkey, setOpenPubkey] = useState("");
  const [fundingAmount, setFundingAmount] = useState("49900000000");
  const [publicChannel, setPublicChannel] = useState(true);
  const [oneWay, setOneWay] = useState(false);
  const [shutdownChannelId, setShutdownChannelId] = useState("");
  const [shutdownConfirm, setShutdownConfirm] = useState("");
  const [forceShutdown, setForceShutdown] = useState(false);
  const [status, setStatus] = useState("No channel action yet");
  const [isBusy, setIsBusy] = useState(false);
  const filterKey = useMemo(
    () => JSON.stringify({ filterPubkey, includeClosed, onlyPending }),
    [filterPubkey, includeClosed, onlyPending],
  );

  const channels = useQuery({
    queryKey: queryKeys.channels(
      activeProfile?.id,
      activeProfile?.rpcMode,
      activeProfile?.fiberRpcEndpoint,
      filterKey,
    ),
    queryFn: async () => {
      if (!activeProfile) {
        throw new Error("No active profile");
      }

      const response = await fiberRpc<ListChannelsResult | ChannelInfo[]>("list_channels", listParams(), {
        profile: activeProfile,
        token: sessionBiscuitToken,
      });

      return normalizeChannels(response);
    },
    enabled: Boolean(activeProfile),
  });

  if (!activeProfile) {
    return (
      <section className="settings-panel">
        <h2>Channels</h2>
        <p>No active profile.</p>
      </section>
    );
  }

  async function run(action: () => Promise<string>) {
    setIsBusy(true);
    setStatus("");
    try {
      setStatus(await action());
      await queryClient.invalidateQueries({ queryKey: queryKeys.channelsRoot() });
    } catch (error) {
      setStatus(formatRpcError(error));
    } finally {
      setIsBusy(false);
    }
  }

  function listParams() {
    return compactObject({
      pubkey: filterPubkey,
      include_closed: includeClosed ? true : undefined,
      only_pending: onlyPending ? true : undefined,
    });
  }

  const fundingWarning = fundingWarningText(fundingAmount);

  return (
    <section className="settings-panel">
      <div className="section-heading">
        <div>
          <h2>Channels</h2>
          <p>Channel list, opening draft, and shutdown confirmation.</p>
        </div>
        <button className="command-button" type="button" disabled={channels.isFetching} onClick={() => channels.refetch()}>
          <RefreshCcw size={16} aria-hidden="true" />
          <span>{channels.isFetching ? "Refreshing" : "Refresh"}</span>
        </button>
      </div>

      <div className="resource-grid">
        <div>
          <h2>Open Channel</h2>
          <div className="settings-form">
            <label>
              <span>Peer pubkey</span>
              <input value={openPubkey} onChange={(event) => setOpenPubkey(event.target.value)} placeholder="02..." />
            </label>
            <label>
              <span>Funding amount shannons</span>
              <input value={fundingAmount} onChange={(event) => setFundingAmount(event.target.value)} placeholder="49900000000" />
            </label>
            <div className="settings-row">
              <label className="checkbox-row">
                <input checked={publicChannel} onChange={(event) => setPublicChannel(event.target.checked)} type="checkbox" />
                <span>Public channel</span>
              </label>
              <label className="checkbox-row">
                <input checked={oneWay} onChange={(event) => setOneWay(event.target.checked)} type="checkbox" />
                <span>One-way channel</span>
              </label>
            </div>
            <div className={fundingWarning ? "warning-note danger" : "warning-note"}>
              <ShieldAlert size={16} aria-hidden="true" />
              <span>
                {fundingWarning ||
                  "Public testnet nodes currently advertise >= 499 CKB auto-accept funding; fee and reserved-capacity checks still need live balance data."}
              </span>
            </div>
            <ConfirmActionButton
              confirmLabel="Open Channel"
              disabled={isBusy}
              icon={<Cable size={16} aria-hidden="true" />}
              items={[
                { label: "Peer pubkey", value: openPubkey },
                { label: "Funding amount", value: fundingAmount },
                { label: "Visibility", value: publicChannel ? "public" : "private" },
                { label: "Direction", value: oneWay ? "one-way" : "standard" },
              ]}
              label="Open Channel"
              title="Confirm Channel Open"
              warning="Opening a channel commits funding through the active Fiber RPC profile."
              onConfirm={() =>
                run(async () => {
                  await fiberRpc(
                    "open_channel",
                    compactObject({
                      pubkey: openPubkey,
                      funding_amount: fundingAmount,
                      public: publicChannel,
                      one_way: oneWay,
                    }),
                    {
                      profile: activeProfile,
                      token: sessionBiscuitToken,
                    },
                  );
                  return "Open channel requested";
                })
              }
            />
          </div>

          <h2>Shutdown</h2>
          <div className="settings-form">
            <label>
              <span>Channel ID</span>
              <input
                value={shutdownChannelId}
                onChange={(event) => setShutdownChannelId(event.target.value)}
                placeholder="0x..."
              />
            </label>
            <label>
              <span>Confirm by typing shutdown</span>
              <input value={shutdownConfirm} onChange={(event) => setShutdownConfirm(event.target.value)} placeholder="shutdown" />
            </label>
            <label className="checkbox-row">
              <input checked={forceShutdown} onChange={(event) => setForceShutdown(event.target.checked)} type="checkbox" />
              <span>Force close</span>
            </label>
            <ConfirmActionButton
              confirmLabel="Shutdown"
              disabled={isBusy || shutdownConfirm !== "shutdown"}
              icon={<XCircle size={16} aria-hidden="true" />}
              items={[
                { label: "Channel ID", value: shutdownChannelId },
                { label: "Close mode", value: forceShutdown ? "force close" : "cooperative close" },
              ]}
              label="Shutdown"
              title="Confirm Channel Shutdown"
              warning="Shutdown changes channel state through the active Fiber RPC profile."
              onConfirm={() =>
                run(async () => {
                  await fiberRpc(
                    "shutdown_channel",
                    compactObject({
                      channel_id: shutdownChannelId,
                      force: forceShutdown,
                    }),
                    {
                      profile: activeProfile,
                      token: sessionBiscuitToken,
                    },
                  );
                  return "Shutdown requested";
                })
              }
            />
          </div>
        </div>

        <div>
          <h2>List Filters</h2>
          <div className="settings-form">
            <label>
              <span>Peer pubkey</span>
              <input value={filterPubkey} onChange={(event) => setFilterPubkey(event.target.value)} placeholder="optional" />
            </label>
            <div className="settings-row">
              <label className="checkbox-row">
                <input
                  checked={includeClosed}
                  onChange={(event) => {
                    setIncludeClosed(event.target.checked);
                    if (event.target.checked) {
                      setOnlyPending(false);
                    }
                  }}
                  type="checkbox"
                />
                <span>Include closed</span>
              </label>
              <label className="checkbox-row">
                <input
                  checked={onlyPending}
                  onChange={(event) => {
                    setOnlyPending(event.target.checked);
                    if (event.target.checked) {
                      setIncludeClosed(false);
                    }
                  }}
                  type="checkbox"
                />
                <span>Only pending</span>
              </label>
            </div>
          </div>

          <h2>Channels</h2>
          <div className="resource-list">
            {channels.isError ? <p className="compact-meta">{formatRpcError(channels.error)}</p> : null}
            {channels.data?.length ? (
              channels.data.map((channel, index) => (
                <button
                  className="resource-card resource-card-main"
                  key={channel.channel_id ?? index}
                  type="button"
                  onClick={() => setShutdownChannelId(channel.channel_id ?? "")}
                >
                  <strong>{channel.channel_id ? shorten(channel.channel_id) : "unknown channel"}</strong>
                  <small>
                    {(channel.state as string | undefined) ?? "unknown state"} / {channel.peer_pubkey ? shorten(channel.peer_pubkey) : "unknown peer"}
                  </small>
                  <small>{channel.funding_amount ? `${channel.funding_amount} shannons` : "funding not returned"}</small>
                </button>
              ))
            ) : (
              <p className="compact-meta">{channels.isFetching ? "Loading channels" : "No channels returned."}</p>
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

function normalizeChannels(response: ListChannelsResult | ChannelInfo[]): ChannelInfo[] {
  if (Array.isArray(response)) {
    return response;
  }

  return Array.isArray(response.channels) ? response.channels : [];
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

function fundingWarningText(value: string): string {
  try {
    const amount = BigInt(value || "0");
    if (amount < publicNodeMinFunding) {
      return "Funding is below the public testnet auto-accept baseline of 49,900,000,000 shannons.";
    }
  } catch {
    return "Funding amount must be an integer string in shannons.";
  }

  return "";
}

function shorten(value: string): string {
  if (value.length <= 18) {
    return value;
  }

  return `${value.slice(0, 10)}...${value.slice(-6)}`;
}
