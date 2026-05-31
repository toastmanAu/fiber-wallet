import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type ProfileMode = "managed-local" | "existing-local" | "remote";
export type FiberNetwork = "testnet" | "mainnet";
export type PqrLockAlgorithm = "mldsa" | "spincs" | "falcon";
export type RecoveryFormat = "bip39";
export type RpcMode = "mock" | "live";

export type PeerAddressBookEntry = {
  id: string;
  label: string;
  address: string;
  pubkey: string;
};

export type Profile = {
  id: string;
  name: string;
  mode: ProfileMode;
  network: FiberNetwork;
  rpcMode: RpcMode;
  preferredPqrLock: PqrLockAlgorithm;
  recoveryFormat: RecoveryFormat;
  fiberRpcEndpoint: string;
  ckbRpcEndpoint: string;
  fnnBinaryPath: string;
  dataDir: string;
  configPath: string;
  p2pListeningAddr: string;
  rpcListeningAddr: string;
  biscuitPublicKey: string;
  peerAddressBook: PeerAddressBookEntry[];
  createdAt: string;
};

type ProfileState = {
  profiles: Profile[];
  activeProfileId: string | null;
  sessionBiscuitToken: string;
  createMockProfile: () => void;
  setActiveProfile: (id: string) => void;
  updateActiveProfile: (
    updates: Partial<
      Pick<
        Profile,
        | "rpcMode"
        | "fiberRpcEndpoint"
        | "ckbRpcEndpoint"
        | "fnnBinaryPath"
        | "dataDir"
        | "configPath"
        | "p2pListeningAddr"
        | "rpcListeningAddr"
        | "biscuitPublicKey"
        | "peerAddressBook"
      >
    >,
  ) => void;
  setSessionBiscuitToken: (token: string) => void;
};

const initialProfile: Profile = {
  id: "mock-testnet-local",
  name: "Mock Testnet Node",
  mode: "existing-local",
  network: "testnet",
  rpcMode: "mock",
  preferredPqrLock: "mldsa",
  recoveryFormat: "bip39",
  fiberRpcEndpoint: "http://127.0.0.1:8227",
  ckbRpcEndpoint: "https://testnet.ckbapp.dev/",
  fnnBinaryPath: "",
  dataDir: "",
  configPath: "",
  p2pListeningAddr: "/ip4/127.0.0.1/tcp/8228",
  rpcListeningAddr: "127.0.0.1:8227",
  biscuitPublicKey: "",
  peerAddressBook: [],
  createdAt: "2026-05-31T00:00:00.000Z",
};

function withProfileDefaults(profile: Partial<Profile>): Profile {
  return {
    ...initialProfile,
    ...profile,
    rpcMode: profile.rpcMode ?? "mock",
    preferredPqrLock: profile.preferredPqrLock ?? "mldsa",
    recoveryFormat: profile.recoveryFormat ?? "bip39",
    fnnBinaryPath: profile.fnnBinaryPath ?? "",
    dataDir: profile.dataDir ?? "",
    configPath: profile.configPath ?? "",
    p2pListeningAddr: profile.p2pListeningAddr ?? "/ip4/127.0.0.1/tcp/8228",
    rpcListeningAddr: profile.rpcListeningAddr ?? "127.0.0.1:8227",
    biscuitPublicKey: profile.biscuitPublicKey ?? "",
    peerAddressBook: Array.isArray(profile.peerAddressBook) ? profile.peerAddressBook : [],
  };
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
      profiles: [initialProfile],
      activeProfileId: initialProfile.id,
      sessionBiscuitToken: "",
      createMockProfile: () =>
        set((state) => {
          const nextIndex = state.profiles.length + 1;
          const profile: Profile = {
            ...initialProfile,
            id: `mock-testnet-local-${nextIndex}`,
            name: `Mock Testnet Node ${nextIndex}`,
            createdAt: new Date().toISOString(),
          };

          return {
            profiles: [...state.profiles, profile],
            activeProfileId: profile.id,
          };
        }),
      setActiveProfile: (id) =>
        set((state) => ({
          activeProfileId: state.profiles.some((profile) => profile.id === id) ? id : state.activeProfileId,
        })),
      updateActiveProfile: (updates) =>
        set((state) => ({
          profiles: state.profiles.map((profile) =>
            profile.id === state.activeProfileId ? { ...profile, ...updates } : profile,
          ),
        })),
      setSessionBiscuitToken: (token) => set({ sessionBiscuitToken: token }),
    }),
    {
      name: "fiber-wallet-profiles",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      migrate: (persisted) => {
        if (!persisted || typeof persisted !== "object") {
          return {
            profiles: [initialProfile],
            activeProfileId: initialProfile.id,
            sessionBiscuitToken: "",
          };
        }

        const state = persisted as Partial<ProfileState>;
        const profiles = Array.isArray(state.profiles)
          ? state.profiles.map((profile) => withProfileDefaults(profile))
          : [initialProfile];

        return {
          profiles,
          activeProfileId: state.activeProfileId ?? profiles[0]?.id ?? initialProfile.id,
          sessionBiscuitToken: "",
        };
      },
      partialize: (state) => ({
        profiles: state.profiles,
        activeProfileId: state.activeProfileId,
      }),
    },
  ),
);
