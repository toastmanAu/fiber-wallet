import type { Profile } from "./profileStore";

export type EndpointSafetyKind = "invalid" | "loopback" | "private" | "public";

export type EndpointSafety = {
  kind: EndpointSafetyKind;
  message: string;
  requiresToken: boolean;
};

export function classifyRpcEndpoint(endpoint: string): EndpointSafety {
  let parsed: URL;

  try {
    parsed = new URL(endpoint);
  } catch {
    return {
      kind: "invalid",
      message: "Endpoint is not a valid URL",
      requiresToken: false,
    };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return {
      kind: "invalid",
      message: "Endpoint must use http or https",
      requiresToken: false,
    };
  }

  if (parsed.username || parsed.password) {
    return {
      kind: "invalid",
      message: "Endpoint must not include embedded credentials",
      requiresToken: false,
    };
  }

  const host = normalizeHost(parsed.hostname);

  if (isLoopbackHost(host)) {
    return {
      kind: "loopback",
      message: "Loopback RPC endpoint",
      requiresToken: false,
    };
  }

  if (isPrivateHost(host)) {
    return {
      kind: "private",
      message: "Private network RPC endpoint",
      requiresToken: false,
    };
  }

  return {
    kind: "public",
    message: "Public RPC endpoint requires Biscuit auth",
    requiresToken: true,
  };
}

export function blocksLiveRpc(profile: Profile, token?: string): EndpointSafety | null {
  if (profile.rpcMode !== "live") {
    return null;
  }

  const safety = classifyRpcEndpoint(profile.fiberRpcEndpoint);

  if (safety.kind === "invalid") {
    return safety;
  }

  if (safety.requiresToken && !token?.trim()) {
    return safety;
  }

  return null;
}

function normalizeHost(host: string): string {
  return host.toLowerCase().replace(/^\[/, "").replace(/\]$/, "");
}

function isLoopbackHost(host: string): boolean {
  return host === "localhost" || host === "::1" || host.startsWith("127.");
}

function isPrivateHost(host: string): boolean {
  if (host === "0.0.0.0") {
    return true;
  }

  const ipv4 = host.split(".").map((part) => Number(part));

  if (ipv4.length === 4 && ipv4.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)) {
    return (
      ipv4[0] === 10 ||
      (ipv4[0] === 172 && ipv4[1] >= 16 && ipv4[1] <= 31) ||
      (ipv4[0] === 192 && ipv4[1] === 168)
    );
  }

  return host.startsWith("fc") || host.startsWith("fd");
}

