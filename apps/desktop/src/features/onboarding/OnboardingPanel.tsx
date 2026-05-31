import { Plus, ServerCog } from "lucide-react";
import { useProfileStore } from "../../lib/profileStore";

export function OnboardingPanel() {
  const profiles = useProfileStore((state) => state.profiles);
  const activeProfileId = useProfileStore((state) => state.activeProfileId);
  const createMockProfile = useProfileStore((state) => state.createMockProfile);
  const setActiveProfile = useProfileStore((state) => state.setActiveProfile);

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
    </section>
  );
}
