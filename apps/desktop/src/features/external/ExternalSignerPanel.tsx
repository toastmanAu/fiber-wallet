import { useQueryClient } from "@tanstack/react-query";
import { Cable, FileCheck2, FileSignature, SendHorizontal, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { ConfirmActionButton } from "../common/ConfirmActionButton";
import {
  compareFundingTxStructure,
  formatJson,
  fundingTxStructureFingerprint,
  parseJsonObject,
} from "../../lib/externalFunding";
import { fiberRpc, formatRpcError } from "../../lib/fiberRpc";
import { useProfileStore } from "../../lib/profileStore";
import { queryKeys } from "../../lib/queryKeys";

type ExternalFundingResult = {
  channel_id?: string;
  unsigned_funding_tx?: Record<string, unknown>;
};

type DevSignResult = {
  signed_funding_tx?: Record<string, unknown>;
};

const defaultScript = formatJson({
  code_hash: "0x0000000000000000000000000000000000000000000000000000000000000000",
  hash_type: "type",
  args: "0x",
});

export function ExternalSignerPanel() {
  const activeProfile = useProfileStore((state) =>
    state.profiles.find((profile) => profile.id === state.activeProfileId),
  );
  const sessionBiscuitToken = useProfileStore((state) => state.sessionBiscuitToken);
  const queryClient = useQueryClient();
  const [signerKind, setSignerKind] = useState("ccc");
  const [signerAddress, setSignerAddress] = useState("");
  const [signerLockScript, setSignerLockScript] = useState(defaultScript);
  const [shutdownScript, setShutdownScript] = useState(defaultScript);
  const [peerPubkey, setPeerPubkey] = useState("");
  const [fundingAmount, setFundingAmount] = useState("49900000000");
  const [publicChannel, setPublicChannel] = useState(true);
  const [channelId, setChannelId] = useState("");
  const [unsignedTxText, setUnsignedTxText] = useState("");
  const [signedTxText, setSignedTxText] = useState("");
  const [devPrivateKey, setDevPrivateKey] = useState("");
  const [status, setStatus] = useState("No external signer action yet");
  const [details, setDetails] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  if (!activeProfile) {
    return (
      <section className="settings-panel">
        <h2>External Signer</h2>
        <p>No active profile.</p>
      </section>
    );
  }
  const profile = activeProfile;

  async function run(action: () => Promise<string>, refreshChannels = false) {
    setIsBusy(true);
    setStatus("");
    try {
      setStatus(await action());
      if (refreshChannels) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.channelsRoot() });
      }
    } catch (error) {
      setStatus(formatRpcError(error));
    } finally {
      setIsBusy(false);
    }
  }

  const structureReport =
    unsignedTxText.trim() && signedTxText.trim()
      ? safeCompare(unsignedTxText, signedTxText)
      : null;

  return (
    <section className="settings-panel">
      <div className="section-heading">
        <div>
          <h2>External Signer</h2>
          <p>Externally funded channel workflow with internal-wallet separation.</p>
        </div>
      </div>

      <div className="signer-split">
        <div className="wallet-boundary internal">
          <strong>FNN internal wallet</strong>
          <span>Node key and CKB funding key remain with the local FNN profile.</span>
        </div>
        <div className="wallet-boundary external">
          <strong>External signer funds</strong>
          <span>CCC/JoyID signer controls the funding cells and only signs returned funding transaction witnesses.</span>
        </div>
      </div>

      <div className="resource-grid">
        <div>
          <h2>Signer Source</h2>
          <div className="settings-form">
            <label>
              <span>Signer path</span>
              <select value={signerKind} onChange={(event) => setSignerKind(event.target.value)}>
                <option value="ccc">CCC signer</option>
                <option value="joyid">JoyID via CCC</option>
                <option value="dev-rpc">Dev RPC signer</option>
                <option value="manual">Manual signed JSON</option>
              </select>
            </label>
            <label>
              <span>External signer address</span>
              <input value={signerAddress} onChange={(event) => setSignerAddress(event.target.value)} placeholder="ckt1..." />
            </label>
            <label>
              <span>Funding lock script JSON</span>
              <textarea
                className="secret-textarea"
                value={signerLockScript}
                onChange={(event) => setSignerLockScript(event.target.value)}
                rows={6}
                spellCheck={false}
              />
            </label>
            <label>
              <span>Shutdown script JSON</span>
              <textarea
                className="secret-textarea"
                value={shutdownScript}
                onChange={(event) => setShutdownScript(event.target.value)}
                rows={6}
                spellCheck={false}
              />
            </label>
          </div>

          <h2>Open External Funding</h2>
          <div className="settings-form">
            <label>
              <span>Peer pubkey</span>
              <input value={peerPubkey} onChange={(event) => setPeerPubkey(event.target.value)} placeholder="02..." />
            </label>
            <label>
              <span>Funding amount shannons</span>
              <input value={fundingAmount} onChange={(event) => setFundingAmount(event.target.value)} />
            </label>
            <label className="checkbox-row">
              <input checked={publicChannel} onChange={(event) => setPublicChannel(event.target.checked)} type="checkbox" />
              <span>Public channel</span>
            </label>
            <div className="warning-note">
              <ShieldAlert size={16} aria-hidden="true" />
              <span>Fiber requires the signed transaction to preserve inputs, outputs, outputs_data, and cell_deps exactly.</span>
            </div>
            <ConfirmActionButton
              confirmLabel="Open External"
              disabled={isBusy}
              icon={<Cable size={16} aria-hidden="true" />}
              items={[
                { label: "Peer pubkey", value: peerPubkey },
                { label: "Funding amount", value: fundingAmount },
                { label: "Signer path", value: signerKind },
                { label: "Signer address", value: signerAddress || "not set" },
                { label: "Visibility", value: publicChannel ? "public" : "private" },
              ]}
              label="Open External"
              title="Confirm External Funding"
              warning="This creates an externally funded channel draft through the active Fiber RPC profile."
              onConfirm={() =>
                run(async () => {
                  const result = await fiberRpc<ExternalFundingResult>(
                    "open_channel_with_external_funding",
                    {
                      pubkey: peerPubkey,
                      funding_amount: fundingAmount,
                      public: publicChannel,
                      shutdown_script: parseJsonObject(shutdownScript),
                      funding_lock_script: parseJsonObject(signerLockScript),
                    },
                    {
                      profile,
                      token: sessionBiscuitToken,
                    },
                  );
                  setChannelId(result.channel_id ?? "");
                  setUnsignedTxText(formatJson(result.unsigned_funding_tx ?? {}));
                  setSignedTxText("");
                  setDetails(formatJson({
                    channel_id: result.channel_id,
                    signer_kind: signerKind,
                    signer_address: signerAddress,
                    structure_fingerprint: fundingTxStructureFingerprint(result.unsigned_funding_tx),
                  }));
                  return "Unsigned external funding transaction received";
                })
              }
            />
          </div>
        </div>

        <div>
          <h2>Sign and Submit</h2>
          <div className="settings-form">
            <label>
              <span>Channel ID</span>
              <input value={channelId} onChange={(event) => setChannelId(event.target.value)} placeholder="0x..." />
            </label>
            <label>
              <span>Unsigned funding transaction</span>
              <textarea
                className="secret-textarea"
                value={unsignedTxText}
                onChange={(event) => setUnsignedTxText(event.target.value)}
                rows={7}
                spellCheck={false}
              />
            </label>
            <label>
              <span>Signed funding transaction</span>
              <textarea
                className="secret-textarea"
                value={signedTxText}
                onChange={(event) => setSignedTxText(event.target.value)}
                rows={7}
                spellCheck={false}
              />
            </label>
            <label>
              <span>Dev signer private key</span>
              <input
                value={devPrivateKey}
                onChange={(event) => setDevPrivateKey(event.target.value)}
                placeholder="debug fnn only, not for release nodes"
                type="password"
              />
            </label>
            <div className={structureReport?.unchanged === false ? "warning-note danger" : "warning-note"}>
              <FileCheck2 size={16} aria-hidden="true" />
              <span>{structureStatusText(structureReport)}</span>
            </div>
            <div className="node-actions">
              <button
                className="command-button"
                disabled={isBusy || !unsignedTxText.trim()}
                type="button"
                onClick={() =>
                  run(async () => {
                    const unsigned_funding_tx = parseJsonObject(unsignedTxText);
                    if (signerKind === "dev-rpc") {
                      const result = await fiberRpc<DevSignResult>(
                        "sign_external_funding_tx",
                        {
                          unsigned_funding_tx,
                          private_key: devPrivateKey,
                        },
                        {
                          profile,
                          token: sessionBiscuitToken,
                        },
                      );
                      setSignedTxText(formatJson(result.signed_funding_tx ?? {}));
                      return "Dev RPC signed funding transaction";
                    }

                    setDetails(formatJson({
                      signer_kind: signerKind,
                      ccc_reference: "Use CCC/JoyID signer to sign this transaction and paste the witness-only signed JSON.",
                      unsigned_funding_tx,
                    }));
                    return "Prepared external signer payload";
                  })
                }
              >
                <FileSignature size={16} aria-hidden="true" />
                <span>{signerKind === "dev-rpc" ? "Dev Sign" : "Prepare Sign"}</span>
              </button>
              <ConfirmActionButton
                confirmLabel="Submit Signed"
                disabled={isBusy || !structureReport?.unchanged}
                icon={<SendHorizontal size={16} aria-hidden="true" />}
                items={[
                  { label: "Channel ID", value: channelId },
                  { label: "Signer path", value: signerKind },
                  { label: "Structure check", value: structureReport?.unchanged ? "passed" : "not passed" },
                ]}
                label="Submit Signed"
                title="Confirm Signed Funding Submit"
                warning="This submits the signed funding transaction through the active Fiber RPC profile."
                onConfirm={() =>
                  run(async () => {
                    const signed_funding_tx = parseJsonObject(signedTxText);
                    const result = await fiberRpc(
                      "submit_signed_funding_tx",
                      {
                        channel_id: channelId,
                        signed_funding_tx,
                      },
                      {
                        profile,
                        token: sessionBiscuitToken,
                      },
                    );
                    setDetails(formatJson(result));
                    return "Signed external funding transaction submitted";
                  }, true)
                }
              />
            </div>
          </div>

          <div className="node-status">
            <strong>{isBusy ? "Working" : status}</strong>
            {details ? <pre>{details}</pre> : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function safeCompare(unsignedTxText: string, signedTxText: string) {
  try {
    return compareFundingTxStructure(parseJsonObject(unsignedTxText), parseJsonObject(signedTxText));
  } catch {
    return {
      unchanged: false,
      changedKeys: ["invalid_json"],
      unsignedFingerprint: "",
      signedFingerprint: "",
    };
  }
}

function structureStatusText(report: ReturnType<typeof safeCompare> | null): string {
  if (!report) {
    return "Paste a signed transaction to verify that only witnesses changed.";
  }

  if (report.unchanged) {
    return "Funding transaction structure is unchanged; witnesses-only signing check passed.";
  }

  return `Structure changed: ${report.changedKeys.join(", ")}`;
}
