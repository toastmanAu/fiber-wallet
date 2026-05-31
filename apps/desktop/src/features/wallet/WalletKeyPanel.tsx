import { invoke } from "@tauri-apps/api/core";
import { Download, KeyRound, RotateCcw, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { ConfirmActionButton } from "../common/ConfirmActionButton";
import { useProfileStore } from "../../lib/profileStore";

type WalletStatus = {
  key_exists: boolean;
  key_path: string;
  backup_exists: boolean;
  backup_path: string;
  bip39_backup_exists: boolean;
  bip39_backup_path: string;
};

type WalletCommandError = {
  kind: string;
  message: string;
};

export function WalletKeyPanel() {
  const activeProfile = useProfileStore((state) =>
    state.profiles.find((profile) => profile.id === state.activeProfileId),
  );
  const [exportedKeyContents, setExportedKeyContents] = useState("");
  const [bip39Mnemonic, setBip39Mnemonic] = useState("");
  const [backupPassphrase, setBackupPassphrase] = useState("");
  const [overwrite, setOverwrite] = useState(false);
  const [status, setStatus] = useState("No wallet action yet");
  const [details, setDetails] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  if (!activeProfile) {
    return (
      <section className="settings-panel">
        <h2>Wallet Key Setup</h2>
        <p>No active profile.</p>
      </section>
    );
  }

  async function run(action: () => Promise<string>) {
    setIsBusy(true);
    setDetails("");
    try {
      setStatus(await action());
    } catch (error) {
      setStatus(formatWalletError(error));
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <section className="settings-panel">
      <div className="section-heading">
        <div>
          <h2>Wallet Key Setup</h2>
          <p>Backend-only handling for FNN `ckb/key` funding material.</p>
        </div>
      </div>

      <div className="settings-form">
        <label>
          <span>CKB CLI exported key contents</span>
          <textarea
            className="secret-textarea"
            value={exportedKeyContents}
            onChange={(event) => setExportedKeyContents(event.target.value)}
            placeholder="Paste exported-key contents. Only the first private-key line is imported."
            rows={5}
            spellCheck={false}
          />
        </label>

        <label className="checkbox-row">
          <input checked={overwrite} onChange={(event) => setOverwrite(event.target.checked)} type="checkbox" />
          <span>Overwrite existing `ckb/key`</span>
        </label>

        <label>
          <span>Encrypted backup passphrase</span>
          <input
            value={backupPassphrase}
            onChange={(event) => setBackupPassphrase(event.target.value)}
            placeholder="12 characters minimum"
            type="password"
          />
        </label>

        <label>
          <span>BIP39 mnemonic import</span>
          <textarea
            className="secret-textarea"
            value={bip39Mnemonic}
            onChange={(event) => setBip39Mnemonic(event.target.value)}
            placeholder="12, 15, 18, 21, or 24 words. Stored only as an encrypted backup."
            rows={4}
            spellCheck={false}
          />
        </label>

        <div className="node-actions">
          <ConfirmActionButton
            confirmLabel="Import Key"
            disabled={isBusy}
            icon={<KeyRound size={16} aria-hidden="true" />}
            items={[
              { label: "Data directory", value: activeProfile.dataDir || "not set" },
              { label: "Overwrite", value: overwrite ? "yes" : "no" },
              { label: "Key material", value: exportedKeyContents.trim() ? "provided" : "not provided" },
            ]}
            label="Import Key"
            title="Confirm Key Import"
            warning="Import writes funding key material to ckb/key for the active profile."
            onConfirm={() =>
              run(async () => {
                const walletStatus = await invoke<WalletStatus>("wallet_import_ckb_key", {
                  input: {
                    data_dir: activeProfile.dataDir,
                    exported_key_contents: exportedKeyContents,
                    overwrite,
                  },
                });
                setExportedKeyContents("");
                setDetails(JSON.stringify(walletStatus, null, 2));
                return "Imported funding key";
              })
            }
          />

          <ConfirmActionButton
            confirmLabel="Export Backup"
            disabled={isBusy}
            icon={<Download size={16} aria-hidden="true" />}
            items={[
              { label: "Data directory", value: activeProfile.dataDir || "not set" },
              { label: "Backup path", value: "ckb/fiber-wallet-key-backup.json" },
              { label: "Passphrase", value: backupPassphrase ? "provided" : "not provided" },
            ]}
            label="Backup"
            title="Confirm Encrypted Backup"
            warning="Backup exports encrypted funding key material. Keep the passphrase separate from the backup file."
            onConfirm={() =>
              run(async () => {
                const path = await invoke<string>("wallet_export_encrypted_backup", {
                  input: {
                    data_dir: activeProfile.dataDir,
                    passphrase: backupPassphrase,
                  },
                });
                return `Exported encrypted backup: ${path}`;
              })
            }
          />

          <ConfirmActionButton
            confirmLabel="Import BIP39"
            disabled={isBusy}
            icon={<KeyRound size={16} aria-hidden="true" />}
            items={[
              { label: "Data directory", value: activeProfile.dataDir || "not set" },
              { label: "Overwrite", value: overwrite ? "yes" : "no" },
              { label: "Mnemonic", value: bip39Mnemonic.trim() ? `${bip39Mnemonic.trim().split(/\s+/).length} words` : "not provided" },
              { label: "Passphrase", value: backupPassphrase ? "provided" : "not provided" },
            ]}
            label="Import BIP39"
            title="Confirm BIP39 Import"
            warning="BIP39 recovery material is encrypted into a backup file and the plaintext phrase is cleared after import."
            onConfirm={() =>
              run(async () => {
                const walletStatus = await invoke<WalletStatus>("wallet_import_bip39_mnemonic", {
                  input: {
                    data_dir: activeProfile.dataDir,
                    mnemonic: bip39Mnemonic,
                    passphrase: backupPassphrase,
                    overwrite,
                  },
                });
                setBip39Mnemonic("");
                setDetails(JSON.stringify(walletStatus, null, 2));
                return "Imported encrypted BIP39 backup";
              })
            }
          />

          <button
            className="command-button"
            disabled={isBusy}
            type="button"
            onClick={() =>
              run(async () => {
                const valid = await invoke<boolean>("wallet_validate_backup", {
                  input: {
                    data_dir: activeProfile.dataDir,
                    passphrase: backupPassphrase,
                  },
                });
                return valid ? "Backup validated" : "Backup validation failed";
              })
            }
          >
            <ShieldCheck size={16} aria-hidden="true" />
            <span>Validate</span>
          </button>

          <button
            className="command-button"
            disabled={isBusy}
            type="button"
            onClick={() =>
              run(async () => {
                const valid = await invoke<boolean>("wallet_validate_bip39_backup", {
                  input: {
                    data_dir: activeProfile.dataDir,
                    passphrase: backupPassphrase,
                  },
                });
                return valid ? "BIP39 backup validated" : "BIP39 backup validation failed";
              })
            }
          >
            <ShieldCheck size={16} aria-hidden="true" />
            <span>Validate BIP39</span>
          </button>

          <ConfirmActionButton
            confirmLabel="Restore Backup"
            disabled={isBusy}
            icon={<RotateCcw size={16} aria-hidden="true" />}
            items={[
              { label: "Data directory", value: activeProfile.dataDir || "not set" },
              { label: "Overwrite", value: overwrite ? "yes" : "no" },
              { label: "Passphrase", value: backupPassphrase ? "provided" : "not provided" },
            ]}
            label="Restore"
            title="Confirm Backup Restore"
            warning="Restore writes funding key material back to ckb/key and can replace the current key when overwrite is enabled."
            onConfirm={() =>
              run(async () => {
                const walletStatus = await invoke<WalletStatus>("wallet_restore_encrypted_backup", {
                  input: {
                    data_dir: activeProfile.dataDir,
                    passphrase: backupPassphrase,
                  },
                  overwrite,
                });
                setDetails(JSON.stringify(walletStatus, null, 2));
                return "Restored encrypted backup";
              })
            }
          />
        </div>

        <div className="node-status">
          <strong>{isBusy ? "Working" : status}</strong>
          {details ? <pre>{details}</pre> : null}
        </div>
      </div>
    </section>
  );
}

function formatWalletError(error: unknown): string {
  if (error && typeof error === "object" && "kind" in error && "message" in error) {
    const typed = error as WalletCommandError;
    return `${typed.kind}: ${typed.message}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
