import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type ProfileMode = "managed-local" | "existing-local" | "remote";
export type FiberNetwork = "testnet" | "mainnet";
export type PqrLockAlgorithm = "mldsa" | "spincs" | "falcon";
export type RecoveryFormat = "bip39";

export type Profile = {
  id: string;
  name: string;
  mode: ProfileMode;
  network: FiberNetwork;
  preferredPqrLock: PqrLockAlgorithm;
  recoveryFormat: RecoveryFormat;
  fiberRpcEndpoint: string;
  ckbRpcEndpoint: string;
  createdAt: string;
};

type ProfileState = {
  profiles: Profile[];
  activeProfileId: string | null;
  createMockProfile: () => void;
  setActiveProfile: (id: string) => void;
};

const initialProfile: Profile = {
  id: "mock-testnet-local",
  name: "Mock Testnet Node",
  mode: "existing-local",
  network: "testnet",
  preferredPqrLock: "mldsa",
  recoveryFormat: "bip39",
  fiberRpcEndpoint: "http://127.0.0.1:8227",
  ckbRpcEndpoint: "https://testnet.ckbapp.dev/",
  createdAt: "2026-05-31T00:00:00.000Z",
};

export const useProfileStore = create<ProfileState>()(
  persist(
    (set) => ({
      profiles: [initialProfile],
      activeProfileId: initialProfile.id,
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
    }),
    {
      name: "fiber-wallet-profiles",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        profiles: state.profiles,
        activeProfileId: state.activeProfileId,
      }),
    },
  ),
);
