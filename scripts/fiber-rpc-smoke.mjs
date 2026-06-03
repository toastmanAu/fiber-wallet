const endpoint = process.env.FIBER_RPC_ENDPOINT ?? process.argv[2] ?? "http://127.0.0.1:8227";
const token = process.env.FIBER_BISCUIT_TOKEN ?? "";
const timeoutMs = Number(process.env.FIBER_RPC_TIMEOUT_MS ?? "15000");

const probes = [{ method: "node_info", required: true }];
const startedAt = new Date().toISOString();
const results = [];

for (const probe of probes) {
  results.push(await callFiberRpc(probe));
}

const requiredFailures = results.filter((result) => {
  if (!result.required) {
    return false;
  }

  if (result.status === "ok") {
    return false;
  }

  return token.trim() || result.status !== "auth_required";
});

const summary = {
  endpoint,
  started_at: startedAt,
  completed_at: new Date().toISOString(),
  token_supplied: Boolean(token.trim()),
  status: summarizeStatus(results, requiredFailures),
  results,
};

console.log(JSON.stringify(summary, null, 2));
process.exitCode = requiredFailures.length ? 1 : 0;

async function callFiberRpc({ method, required }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers = {
      "content-type": "application/json",
    };

    if (token.trim()) {
      headers.authorization = `Bearer ${token.trim()}`;
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: method,
        method,
        params: [],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        method,
        required,
        status: classifyHttpStatus(response.status),
        http_status: response.status,
        message: response.statusText,
      };
    }

    const payload = await response.json();
    if (payload.error) {
      return {
        method,
        required,
        status: classifyRpcError(payload.error),
        error: payload.error,
      };
    }

    return {
      method,
      required,
      status: "ok",
      result_summary: summarizeResult(method, payload.result),
    };
  } catch (error) {
    return {
      method,
      required,
      status: error?.name === "AbortError" ? "timeout" : "transport_error",
      message: error instanceof Error ? error.message : String(error),
      cause: error?.cause instanceof Error ? error.cause.message : undefined,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function summarizeStatus(results, requiredFailures) {
  if (requiredFailures.length) {
    return "failed";
  }

  if (results.some((result) => result.status === "auth_required")) {
    return "auth_required";
  }

  return "ok";
}

function classifyHttpStatus(status) {
  if (status === 401) {
    return "auth_required";
  }

  if (status === 403) {
    return "permission_denied";
  }

  return "http_error";
}

function classifyRpcError(error) {
  const message = String(error?.message ?? "").toLowerCase();

  if (
    message.includes("unauthorized") ||
    message.includes("unauthenticated") ||
    message.includes("authentication") ||
    message.includes("missing token") ||
    message.includes("invalid token")
  ) {
    return "auth_required";
  }

  if (message.includes("permission denied") || message.includes("forbidden")) {
    return "permission_denied";
  }

  return "rpc_error";
}

function summarizeResult(method, result) {
  if (method === "node_info") {
    return {
      version: result?.version ?? null,
      node_name: result?.node_name ?? null,
      pubkey: result?.pubkey ? `${result.pubkey.slice(0, 12)}...${result.pubkey.slice(-8)}` : null,
      peers_count: result?.peers_count ?? null,
      channel_count: result?.channel_count ?? null,
    };
  }

  return result;
}
