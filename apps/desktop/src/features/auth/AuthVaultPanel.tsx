import { invoke } from "@tauri-apps/api/core";
import { Eye, KeyRound, ShieldCheck, WandSparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useProfileStore } from "../../lib/profileStore";
import { redactSecrets } from "../../lib/redaction";

type BiscuitKeypair = {
  public_key: string;
  private_key: string;
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

type BiscuitCommandError = {
  kind: string;
  message: string;
};

const defaultExpiry = () => new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().replace(/\.\d{3}Z$/, "Z");

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
  }, [activeProfile?.biscuitPublicKey]);

  useEffect(() => {
    const selected = templates.find((template) => template.id === templateId);
    if (selected && selected.id !== "custom") {
      setCustomSource(selected.source);
    }
  }, [templateId, templates]);

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
