const endpoint = process.env.CKB_RPC_ENDPOINT ?? process.argv[2] ?? "https://testnet.ckbapp.dev/";
const timeoutMs = Number(process.env.CKB_RPC_TIMEOUT_MS ?? "15000");

const probes = [
  { method: "get_tip_block_number", required: true },
  { method: "get_indexer_tip", required: false },
  { method: "tx_pool_info", required: false },
  { method: "estimate_fee_rate", required: false },
  { method: "local_node_info", required: false },
];

const startedAt = new Date().toISOString();
const results = [];

for (const probe of probes) {
  results.push(await callCkbRpc(probe));
}

const requiredFailures = results.filter((result) => result.required && result.status !== "ok");
const summary = {
  endpoint,
  started_at: startedAt,
  completed_at: new Date().toISOString(),
  status: requiredFailures.length ? "failed" : "ok",
  results,
};

console.log(JSON.stringify(summary, null, 2));
process.exitCode = requiredFailures.length ? 1 : 0;

async function callCkbRpc({ method, required }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
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
        status: "http_error",
        http_status: response.status,
        message: response.statusText,
      };
    }

    const payload = await response.json();
    if (payload.error) {
      return {
        method,
        required,
        status: "rpc_error",
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
    };
  } finally {
    clearTimeout(timeout);
  }
}

function summarizeResult(method, result) {
  if (method === "get_tip_block_number") {
    return { tip_block_number: result };
  }

  if (method === "get_indexer_tip") {
    return {
      block_number: result?.block_number ?? null,
      block_hash: result?.block_hash ?? null,
    };
  }

  if (method === "tx_pool_info") {
    return {
      tip_number: result?.tip_number ?? null,
      min_fee_rate: result?.min_fee_rate ?? null,
      pending: result?.pending ?? null,
      proposed: result?.proposed ?? null,
      verify_queue_size: result?.verify_queue_size ?? null,
    };
  }

  if (method === "estimate_fee_rate") {
    return { estimated_fee_rate: result };
  }

  if (method === "local_node_info") {
    return {
      version: result?.version ?? null,
      active: result?.active ?? null,
      connections: result?.connections ?? null,
    };
  }

  return result;
}
