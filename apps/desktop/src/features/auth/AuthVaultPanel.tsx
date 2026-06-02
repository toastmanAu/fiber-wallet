import { invoke } from "@tauri-apps/api/core";
import { Copy, Eye, KeyRound, QrCode, ShieldCheck, WandSparkles } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { assertMobilePairingBiscuit } from "../../lib/biscuitPolicy";
import { createFiberConnectUri } from "../../lib/fiberConnect";
import { fiberRpc, formatRpcError } from "../../lib/fiberRpc";
import { useProfileStore } from "../../lib/profileStore";
import { redactSecrets } from "../../lib/redaction";

type BiscuitKeypair = {
  public_key: string;
  private_key: string;
};

type BiscuitKeyVaultStatus = {
  saved: boolean;
  path: string;
};

type BiscuitTemplate = {
  id: string;
  label: string;
  source: string;
};

type BiscuitTokenOutput = {
  public_key: string;
  token: string;
  source: string;
  revocation_ids: string[];
};

type BiscuitInspectReport = {
  public_key: string;
  source: string;
  block_count: number;
  revocation_ids: string[];
};

type NodeInfo = {
  version?: string;
  pubkey?: string;
  peers_count?: string;
  channel_count?: string;
};

type BiscuitCommandError = {
  kind: string;
  message: string;
};

const defaultExpiry = () => new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().replace(/\.\d{3}Z$/, "Z");
const defaultMobileExpiry = () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().replace(/\.\d{3}Z$/, "Z");
const localFiberDataDir = "/home/phill/.fiber-dt";

function defaultVaultDataDir(profile: { dataDir?: string; configPath?: string } | null | undefined) {
  const dataDir = profile?.dataDir?.trim();
  if (dataDir) {
    return dataDir;
  }

  const configPath = profile?.configPath?.trim();
  const inferred = configPath?.match(/^(.*)\/data\/config\.ya?ml$/)?.[1];
  return inferred || localFiberDataDir;
}

export function AuthVaultPanel() {
  const activeProfile = useProfileStore((state) =>
    state.profiles.find((profile) => profile.id === state.activeProfileId),
  );
  const updateActiveProfile = useProfileStore((state) => state.updateActiveProfile);
  const sessionBiscuitToken = useProfileStore((state) => state.sessionBiscuitToken);
  const setSessionBiscuitToken = useProfileStore((state) => state.setSessionBiscuitToken);
  const [templates, setTemplates] = useState<BiscuitTemplate[]>([]);
  const [templateId, setTemplateId] = useState("read_only");
  const [privateKey, setPrivateKey] = useState("");
  const [publicKey, setPublicKey] = useState(activeProfile?.biscuitPublicKey ?? "");
  const [token, setToken] = useState(sessionBiscuitToken);
  const [expiry, setExpiry] = useState(defaultExpiry);
  const [mobileExpiry, setMobileExpiry] = useState(defaultMobileExpiry);
  const [pairingRpcUrl, setPairingRpcUrl] = useState(activeProfile?.fiberRpcEndpoint ?? "");
  const [certFingerprint, setCertFingerprint] = useState("");
  const [pairingUri, setPairingUri] = useState("");
  const [pairingQrDataUrl, setPairingQrDataUrl] = useState("");
  const [vaultDataDir, setVaultDataDir] = useState(defaultVaultDataDir(activeProfile));
  const [vaultPassphrase, setVaultPassphrase] = useState("");
  const [vaultStatus, setVaultStatus] = useState<BiscuitKeyVaultStatus | null>(null);
  const [customSource, setCustomSource] = useState("");
  const [status, setStatus] = useState("No auth action yet");
  const [details, setDetails] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    invoke<BiscuitTemplate[]>("biscuit_templates")
      .then((items) => {
        setTemplates(items);
        const readOnly = items.find((item) => item.id === "read_only");
        if (readOnly) {
          setCustomSource(readOnly.source);
        }
      })
      .catch((error) => setStatus(formatBiscuitError(error)));
  }, []);

  useEffect(() => {
    if (activeProfile?.biscuitPublicKey) {
      setPublicKey(activeProfile.biscuitPublicKey);
    }
    if (activeProfile?.fiberRpcEndpoint) {
      setPairingRpcUrl(activeProfile.fiberRpcEndpoint);
    }
    setVaultDataDir(defaultVaultDataDir(activeProfile));
  }, [activeProfile, activeProfile?.biscuitPublicKey, activeProfile?.fiberRpcEndpoint]);

  useEffect(() => {
    const selected = templates.find((template) => template.id === templateId);
    if (selected && selected.id !== "custom") {
      setCustomSource(selected.source);
    }
  }, [templateId, templates]);

  useEffect(() => {
    let cancelled = false;

    if (!vaultDataDir.trim()) {
      setVaultStatus(null);
      return;
    }

    invoke<BiscuitKeyVaultStatus>("biscuit_key_vault_status", {
      input: { data_dir: vaultDataDir.trim() },
    })
      .then((nextStatus) => {
        if (!cancelled) {
          setVaultStatus(nextStatus);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setVaultStatus(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [vaultDataDir]);

  useEffect(() => {
    let cancelled = false;

    if (!pairingUri) {
      setPairingQrDataUrl("");
      return;
    }

    QRCode.toDataURL(pairingUri, {
      errorCorrectionLevel: "M",
      margin: 2,
      scale: 5,
      type: "image/png",
    })
      .then((dataUrl) => {
        if (!cancelled) {
          setPairingQrDataUrl(dataUrl);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setPairingQrDataUrl("");
          setStatus(formatBiscuitError(error));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [pairingUri]);

  if (!activeProfile) {
    return (
      <section className="settings-panel">
        <h2>Biscuit Auth Vault</h2>
        <p>No active profile.</p>
      </section>
    );
  }

  async function run(action: () => Promise<string>) {
    setIsBusy(true);
    setDetails("");
    try {
      setStatus(redactSecrets(await action()));
    } catch (error) {
      setStatus(formatBiscuitError(error));
    } finally {
      setIsBusy(false);
    }
  }

  async function loadSavedBiscuitKey() {
    if (!vaultDataDir.trim()) {
      throw new Error("Node data dir is required to load a saved Biscuit key");
    }
    const keypair = await invoke<BiscuitKeypair>("biscuit_key_vault_load", {
      input: {
        data_dir: vaultDataDir.trim(),
        passphrase: vaultPassphrase,
      },
    });
    setPrivateKey(keypair.private_key);
    setPublicKey(keypair.public_key);
    updateActiveProfile({ biscuitPublicKey: keypair.public_key });
    return keypair;
  }

  return (
    <section className="settings-panel">
      <div className="section-heading">
        <div>
          <h2>Biscuit Auth Vault</h2>
          <p>Session token handling and node RPC public-key setup.</p>
        </div>
      </div>

      <div className="settings-form">
        <div className="settings-row">
          <label>
            <span>Template</span>
            <select value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Expiry UTC</span>
            <input value={expiry} onChange={(event) => setExpiry(event.target.value)} placeholder="2026-06-01T00:00:00Z" />
          </label>
        </div>

        <label>
          <span>Biscuit private key</span>
          <textarea
            className="secret-textarea"
            value={privateKey}
            onChange={(event) => setPrivateKey(event.target.value)}
            placeholder="ed25519-private/..."
            rows={3}
            spellCheck={false}
          />
        </label>

        <label>
          <span>Biscuit public key</span>
          <input
            value={publicKey}
            onChange={(event) => {
              setPublicKey(event.target.value);
              updateActiveProfile({ biscuitPublicKey: event.target.value });
            }}
            placeholder="ed25519/..."
          />
        </label>

        <label>
          <span>Token source</span>
          <textarea
            className="secret-textarea"
            value={customSource}
            onChange={(event) => {
              setCustomSource(event.target.value);
              setTemplateId("custom");
            }}
            rows={8}
            spellCheck={false}
          />
        </label>

        <label>
          <span>Biscuit token</span>
          <textarea
            className="secret-textarea"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="Paste or generate a token"
            rows={5}
            spellCheck={false}
          />
        </label>

        <div className="pairing-panel">
          <div className="section-heading compact">
            <div>
              <h2>Saved Signing Key</h2>
              <p>Encrypted local storage for the Biscuit private key.</p>
            </div>
          </div>

          <div className="settings-row">
            <label>
              <span>Vault data dir</span>
              <input
                value={vaultDataDir}
                onChange={(event) => setVaultDataDir(event.target.value)}
                placeholder="/home/phill/.fiber-dt"
              />
            </label>

            <label>
              <span>Vault passphrase</span>
              <input
                value={vaultPassphrase}
                onChange={(event) => setVaultPassphrase(event.target.value)}
                placeholder="12+ characters"
                type="password"
              />
            </label>

            <label>
              <span>Vault status</span>
              <input readOnly value={vaultStatus?.saved ? "Saved" : "Not saved"} />
            </label>
          </div>

          <div className="node-actions">
            <button
              className="command-button"
              disabled={isBusy || !vaultDataDir.trim()}
              type="button"
              onClick={() =>
                run(async () => {
                  const nextStatus = await invoke<BiscuitKeyVaultStatus>("biscuit_key_vault_save", {
                    input: {
                      data_dir: vaultDataDir.trim(),
                      private_key: privateKey,
                      passphrase: vaultPassphrase,
                    },
                  });
                  setVaultStatus(nextStatus);
                  return "Saved encrypted Biscuit key";
                })
              }
            >
              <ShieldCheck size={16} aria-hidden="true" />
              <span>Save Key</span>
            </button>

            <button
              className="command-button"
              disabled={isBusy || !vaultDataDir.trim()}
              type="button"
              onClick={() =>
                run(async () => {
                  await loadSavedBiscuitKey();
                  return "Loaded saved Biscuit key";
                })
              }
            >
              <KeyRound size={16} aria-hidden="true" />
              <span>Load Key</span>
            </button>

            <button
              className="command-button"
              disabled={isBusy || !vaultDataDir.trim()}
              type="button"
              onClick={() =>
                run(async () => {
                  const nextStatus = await invoke<BiscuitKeyVaultStatus>("biscuit_key_vault_clear", {
                    input: { data_dir: vaultDataDir.trim() },
                  });
                  setVaultStatus(nextStatus);
                  return "Cleared saved Biscuit key";
                })
              }
            >
              <Copy size={16} aria-hidden="true" />
              <span>Clear Saved Key</span>
            </button>
          </div>
        </div>

        <div className="node-actions">
          <button
            className="command-button"
            disabled={isBusy}
            type="button"
            onClick={() =>
              run(async () => {
                const keypair = await invoke<BiscuitKeypair>("biscuit_generate_keypair");
                setPrivateKey(keypair.private_key);
                setPublicKey(keypair.public_key);
                updateActiveProfile({ biscuitPublicKey: keypair.public_key });
                return "Generated Biscuit keypair";
              })
            }
          >
            <KeyRound size={16} aria-hidden="true" />
            <span>Generate Keys</span>
          </button>

          <button
            className="command-button"
            disabled={isBusy}
            type="button"
            onClick={() =>
              run(async () => {
                const keypair = await invoke<BiscuitKeypair>("biscuit_import_private_key", { privateKey });
                setPrivateKey(keypair.private_key);
                setPublicKey(keypair.public_key);
                updateActiveProfile({ biscuitPublicKey: keypair.public_key });
                return "Imported Biscuit private key";
              })
            }
          >
            <ShieldCheck size={16} aria-hidden="true" />
            <span>Import Key</span>
          </button>

          <button
            className="command-button"
            disabled={isBusy}
            type="button"
            onClick={() =>
              run(async () => {
                const output = await invoke<BiscuitTokenOutput>("biscuit_generate_token", {
                  input: {
                    private_key: privateKey,
                    template_id: templateId,
                    custom_source: customSource,
                    expiry_rfc3339: expiry,
                  },
                });
                setPublicKey(output.public_key);
                setToken(output.token);
                updateActiveProfile({ biscuitPublicKey: output.public_key });
                setDetails(formatTokenDetails(output.source, output.revocation_ids));
                return "Generated Biscuit token";
              })
            }
          >
            <WandSparkles size={16} aria-hidden="true" />
            <span>Generate Token</span>
          </button>

          <button
            className="command-button"
            disabled={isBusy}
            type="button"
            onClick={() =>
              run(async () => {
                const report = await invoke<BiscuitInspectReport>("biscuit_inspect_token", {
                  input: {
                    token,
                    public_key: publicKey,
                  },
                });
                setDetails(formatInspectReport(report));
                return "Token verified";
              })
            }
          >
            <Eye size={16} aria-hidden="true" />
            <span>Inspect</span>
          </button>

          <button
            className="command-button"
            disabled={isBusy}
            type="button"
            onClick={() =>
              run(async () => {
                setSessionBiscuitToken(token.trim());
                return "Applied session token";
              })
            }
          >
            <ShieldCheck size={16} aria-hidden="true" />
            <span>Use Session</span>
          </button>
        </div>

        <div className="pairing-panel">
          <div className="section-heading compact">
            <div>
              <h2>Pair Mobile Wallet</h2>
              <p>FiberConnect QR for companion app authentication.</p>
            </div>
          </div>

          <div className="settings-row">
            <label>
              <span>Pairing RPC URL</span>
              <input value={pairingRpcUrl} onChange={(event) => setPairingRpcUrl(event.target.value)} />
            </label>

            <label>
              <span>Mobile token expiry UTC</span>
              <input value={mobileExpiry} onChange={(event) => setMobileExpiry(event.target.value)} />
            </label>
          </div>

          <label>
            <span>TLS certificate fingerprint</span>
            <input
              value={certFingerprint}
              onChange={(event) => setCertFingerprint(event.target.value)}
              placeholder="optional SHA-256 fingerprint for self-signed TLS"
            />
          </label>

          <div className="node-actions">
            <button
              className="command-button"
              disabled={isBusy}
              type="button"
              onClick={() =>
                run(async () => {
                  setPairingUri("");
                  const signingKey = privateKey.trim()
                    ? privateKey
                    : (await loadSavedBiscuitKey()).private_key;
                  const output = await invoke<BiscuitTokenOutput>("biscuit_generate_token", {
                    input: {
                      private_key: signingKey,
                      template_id: "mobile_pairing",
                      custom_source: null,
                      expiry_rfc3339: mobileExpiry,
                    },
                  });
                  const report = await invoke<BiscuitInspectReport>("biscuit_inspect_token", {
                    input: {
                      token: output.token,
                      public_key: output.public_key,
                    },
                  });
                  assertMobilePairingBiscuit(report, mobileExpiry);
                  const uri = createFiberConnectUri({
                    rpc_url: pairingRpcUrl,
                    auth_token: output.token,
                    cert_fingerprint: certFingerprint,
                  });
                  setPublicKey(output.public_key);
                  updateActiveProfile({ biscuitPublicKey: output.public_key });
                  setToken(output.token);
                  setPairingUri(uri);
                  try {
                    const nodeInfo = await fiberRpc<NodeInfo>("node_info", [], {
                      profile: {
                        ...activeProfile,
                        rpcMode: "live",
                        fiberRpcEndpoint: pairingRpcUrl,
                      },
                      token: output.token,
                    });
                    setDetails(formatPairingDetails(output.source, output.revocation_ids, nodeInfo));
                    return "Generated and verified mobile pairing QR";
                  } catch (error) {
                    setDetails(
                      `${formatTokenDetails(output.source, output.revocation_ids)}\n\nPairing verification failed: ${formatRpcError(
                        error,
                      )}`,
                    );
                    return "Generated mobile pairing QR; verification failed";
                  }
                })
              }
            >
              <QrCode size={16} aria-hidden="true" />
              <span>Generate Pairing QR</span>
            </button>

            <button
              className="command-button"
              disabled={!pairingUri}
              type="button"
              onClick={() =>
                run(async () => {
                  await navigator.clipboard.writeText(pairingUri);
                  return "Copied FiberConnect link";
                })
              }
            >
              <Copy size={16} aria-hidden="true" />
              <span>Copy Link</span>
            </button>
          </div>

          {pairingQrDataUrl ? (
            <div className="pairing-output">
              <img alt="FiberConnect pairing QR code" src={pairingQrDataUrl} />
              <textarea className="secret-textarea" readOnly rows={4} value={pairingUri} />
            </div>
          ) : null}
        </div>

        <div className="node-status">
          <strong>{isBusy ? "Working" : status}</strong>
          {details ? <pre>{details}</pre> : null}
        </div>
      </div>
    </section>
  );
}

function formatTokenDetails(source: string, revocationIds: string[]): string {
  return JSON.stringify(
    {
      source,
      revocation_ids: revocationIds,
    },
    null,
    2,
  );
}

function formatPairingDetails(source: string, revocationIds: string[], nodeInfo: NodeInfo): string {
  return JSON.stringify(
    {
      pairing_verified: true,
      node_info: {
        version: nodeInfo.version ?? "unknown",
        pubkey: nodeInfo.pubkey ?? "unknown",
        peers_count: nodeInfo.peers_count ?? "unknown",
        channel_count: nodeInfo.channel_count ?? "unknown",
      },
      source,
      revocation_ids: revocationIds,
    },
    null,
    2,
  );
}

function formatInspectReport(report: BiscuitInspectReport): string {
  return JSON.stringify(
    {
      public_key: report.public_key,
      block_count: report.block_count,
      source: report.source,
      revocation_ids: report.revocation_ids,
    },
    null,
    2,
  );
}

function formatBiscuitError(error: unknown): string {
  if (error && typeof error === "object" && "kind" in error && "message" in error) {
    const typed = error as BiscuitCommandError;
    return `${typed.kind}: ${typed.message}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
