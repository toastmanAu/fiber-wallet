import { Plus, ServerCog } from "lucide-react";
import { useProfileStore } from "../../lib/profileStore";

export function OnboardingPanel() {
  const profiles = useProfileStore((state) => state.profiles);
  const activeProfileId = useProfileStore((state) => state.activeProfileId);
  const activeProfile = profiles.find((profile) => profile.id === activeProfileId);
  const sessionBiscuitToken = useProfileStore((state) => state.sessionBiscuitToken);
  const createMockProfile = useProfileStore((state) => state.createMockProfile);
  const setActiveProfile = useProfileStore((state) => state.setActiveProfile);
  const updateActiveProfile = useProfileStore((state) => state.updateActiveProfile);
  const setSessionBiscuitToken = useProfileStore((state) => state.setSessionBiscuitToken);

  return (
    <section className="setup-panel">
      <div className="section-heading">
        <div>
          <h2>Profiles</h2>
          <p>Milestone 1 stores non-secret profile metadata locally.</p>
        </div>
        <button className="icon-button" type="button" onClick={createMockProfile} aria-label="Create mock profile">
          <Plus size={18} aria-hidden="true" />
        </button>
      </div>

      <div className="profile-list">
        {profiles.map((profile) => (
          <button
            className={profile.id === activeProfileId ? "profile-row active" : "profile-row"}
            key={profile.id}
            type="button"
            onClick={() => setActiveProfile(profile.id)}
          >
            <ServerCog size={18} aria-hidden="true" />
            <span>
              <strong>{profile.name}</strong>
              <small>
                {profile.mode} / {profile.network} / PQR {profile.preferredPqrLock.toUpperCase()} /{" "}
                {profile.recoveryFormat.toUpperCase()}
              </small>
            </span>
          </button>
        ))}
      </div>

      {activeProfile ? (
        <form className="settings-form" onSubmit={(event) => event.preventDefault()}>
          <label>
            <span>RPC mode</span>
            <select
              value={activeProfile.rpcMode}
              onChange={(event) => updateActiveProfile({ rpcMode: event.target.value === "live" ? "live" : "mock" })}
            >
              <option value="mock">Mock fixtures</option>
              <option value="live">Live Fiber RPC</option>
            </select>
          </label>

          <label>
            <span>Fiber RPC endpoint</span>
            <input
              value={activeProfile.fiberRpcEndpoint}
              onChange={(event) => updateActiveProfile({ fiberRpcEndpoint: event.target.value })}
              placeholder="http://127.0.0.1:8227"
            />
          </label>

          <label>
            <span>Session Biscuit token</span>
            <input
              value={sessionBiscuitToken}
              onChange={(event) => setSessionBiscuitToken(event.target.value)}
              placeholder="Bearer token, not persisted"
              type="password"
            />
          </label>
        </form>
      ) : null}
    </section>
  );
}
