import { SendHorizontal } from "lucide-react";
import { useState } from "react";
import { ConfirmActionButton } from "../common/ConfirmActionButton";
import { allowedRpcMethods, type AllowedRpcMethod } from "../../lib/allowedRpcMethods";
import { fiberRpc, formatRpcError } from "../../lib/fiberRpc";
import { useProfileStore } from "../../lib/profileStore";
import { redactSecrets } from "../../lib/redaction";
import { formatJson, parseRpcParams, requiresRawRpcConfirmation, shortenForConsole, validateRpcParams } from "./consoleUtils";

export function JsonRpcConsole() {
  const activeProfile = useProfileStore((state) =>
    state.profiles.find((profile) => profile.id === state.activeProfileId),
  );
  const sessionBiscuitToken = useProfileStore((state) => state.sessionBiscuitToken);
  const [method, setMethod] = useState<AllowedRpcMethod>("node_info");
  const [paramsText, setParamsText] = useState("[]");
  const [output, setOutput] = useState("");
  const [isPending, setIsPending] = useState(false);
  const needsConfirmation = requiresRawRpcConfirmation(method);

  async function submit() {
    if (!activeProfile) {
      setOutput("No active profile");
      return;
    }

    setIsPending(true);
    setOutput("");

    try {
      const params = parseRpcParams(paramsText);
      validateRpcParams(method, params);
      const response = await fiberRpc(method, params, {
        profile: activeProfile,
        token: sessionBiscuitToken,
      });
      setOutput(redactSecrets(formatJson(response)));
    } catch (error) {
      setOutput(redactSecrets(formatRpcError(error)));
    } finally {
      setIsPending(false);
    }
  }

  return (
    <section className="console-panel">
      <div className="section-heading">
        <div>
          <h2>Raw RPC Console</h2>
          <p>MVP allowlist only. Params must be a JSON array.</p>
        </div>
        {needsConfirmation ? (
          <ConfirmActionButton
            confirmLabel="Send Raw RPC"
            disabled={isPending}
            icon={<SendHorizontal size={16} aria-hidden="true" />}
            items={[
              { label: "Method", value: method },
              { label: "Profile", value: activeProfile ? `${activeProfile.name} / ${activeProfile.rpcMode}` : "No profile" },
              { label: "Params", value: shortenForConsole(paramsText.trim() || "[]") },
            ]}
            label={isPending ? "Sending" : "Send"}
            title="Confirm Raw RPC Write"
            warning="This raw RPC method can change node, channel, invoice, payment, or signing state."
            onConfirm={submit}
          />
        ) : (
          <button className="command-button" type="button" onClick={submit} disabled={isPending}>
            <SendHorizontal size={16} aria-hidden="true" />
            <span>{isPending ? "Sending" : "Send"}</span>
          </button>
        )}
      </div>

      <div className="console-grid">
        <label>
          <span>Method</span>
          <select value={method} onChange={(event) => setMethod(event.target.value as AllowedRpcMethod)}>
            {allowedRpcMethods.map((rpcMethod) => (
              <option key={rpcMethod} value={rpcMethod}>
                {rpcMethod}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Profile</span>
          <input readOnly value={activeProfile ? `${activeProfile.name} / ${activeProfile.rpcMode}` : "No profile"} />
        </label>
      </div>

      <label className="console-field">
        <span>Params</span>
        <textarea
          value={paramsText}
          onChange={(event) => setParamsText(event.target.value)}
          spellCheck={false}
          rows={8}
        />
      </label>

      <label className="console-field">
        <span>Response</span>
        <pre className="console-output">{output || "No response yet"}</pre>
      </label>
    </section>
  );
}
