#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use argon2::Argon2;
use biscuit_auth::{Biscuit, KeyPair, PrivateKey, PublicKey};
use reqwest::StatusCode;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    fs::{self, File, OpenOptions},
    io::{BufRead, BufReader},
    net::{IpAddr, TcpListener},
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    str::FromStr,
    sync::Mutex,
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tauri::State;
use url::Url;

const ALLOWED_RPC_METHODS: &[&str] = &[
    "node_info",
    "connect_peer",
    "disconnect_peer",
    "list_peers",
    "open_channel",
    "open_channel_with_external_funding",
    "accept_channel",
    "list_channels",
    "update_channel",
    "shutdown_channel",
    "submit_signed_funding_tx",
    "new_invoice",
    "parse_invoice",
    "get_invoice",
    "cancel_invoice",
    "send_payment",
    "get_payment",
    "build_router",
    "send_payment_with_router",
    "list_payments",
    "graph_nodes",
    "graph_channels",
    "sign_external_funding_tx",
];

const BISCUIT_TEMPLATE_READ_ONLY: &[&str] = &[
    r#"read("node");"#,
    r#"read("peers");"#,
    r#"read("channels");"#,
    r#"read("payments");"#,
    r#"read("invoices");"#,
    r#"read("graph");"#,
];

const BISCUIT_TEMPLATE_MOBILE_PAIRING: &[&str] = &[
    r#"read("node");"#,
    r#"read("peers");"#,
    r#"read("channels");"#,
    r#"read("payments");"#,
    r#"write("invoices");"#,
];

const BISCUIT_TEMPLATE_OPERATOR: &[&str] = &[
    r#"read("node");"#,
    r#"read("peers");"#,
    r#"write("peers");"#,
    r#"read("channels");"#,
    r#"write("channels");"#,
    r#"read("payments");"#,
    r#"write("payments");"#,
    r#"read("invoices");"#,
    r#"write("invoices");"#,
    r#"read("graph");"#,
];

const BISCUIT_TEMPLATE_WATCHTOWER: &[&str] = &[r#"write("watchtower");"#];
const PINNED_CKB_VERSION: &str = "0.206.0";
const MIN_SUPPORTED_CKB_VERSION: &str = "0.206.0";

#[derive(Serialize)]
struct SecretBackendStatus {
    provider: &'static str,
    available: bool,
    stores_secrets: bool,
}

#[derive(Serialize)]
struct RpcMethodList {
    methods: &'static [&'static str],
}

#[derive(Deserialize)]
struct JsonRpcResponse {
    result: Option<Value>,
    error: Option<JsonRpcErrorBody>,
}

#[derive(Deserialize)]
struct JsonRpcErrorBody {
    code: i64,
    message: String,
}

#[derive(Debug, Serialize)]
struct RpcClientError {
    kind: &'static str,
    message: String,
    status: Option<u16>,
}

#[derive(Serialize)]
struct CkbRpcHealth {
    endpoint: String,
    tip_block_number: Option<Value>,
    status: String,
    indexer_status: String,
    indexer_tip_block_number: Option<Value>,
    indexer_tip_block_hash: Option<Value>,
    indexer_lag_blocks: Option<i64>,
    indexer_message: Option<String>,
    pool_status: String,
    tx_pool_info: Option<Value>,
    min_fee_rate: Option<Value>,
    estimated_fee_rate: Option<Value>,
    fee_rate_status: String,
    fee_rate_message: Option<String>,
    ckb_node_version: Option<String>,
    pinned_ckb_version: String,
    version_status: String,
    version_message: Option<String>,
}

#[derive(Deserialize)]
struct CkbLiveCellsInput {
    endpoint: String,
    lock_script: Value,
    limit: Option<u64>,
    after_cursor: Option<String>,
}

#[derive(Serialize)]
struct CkbLiveCellsResult {
    cell_count: usize,
    page_capacity_shannons: String,
    page_capacity_ckb: String,
    indexed_capacity_shannons: Option<String>,
    indexed_capacity_ckb: Option<String>,
    indexed_capacity_tip_block_number: Option<Value>,
    indexed_capacity_tip_block_hash: Option<Value>,
    last_cursor: Option<String>,
    objects: Vec<Value>,
}

#[derive(Debug, PartialEq, Eq)]
enum EndpointScope {
    Loopback,
    Private,
    Public,
}

#[derive(Default)]
struct NodeManager {
    processes: Mutex<HashMap<String, ManagedNode>>,
}

struct ManagedNode {
    child: Child,
    started_at_ms: u128,
    log_path: PathBuf,
}

#[derive(Deserialize)]
struct NodePreflightInput {
    profile_id: String,
    fnn_binary_path: String,
    data_dir: String,
    config_path: String,
    rpc_endpoint: String,
}

#[derive(Serialize)]
struct NodePreflightReport {
    profile_id: String,
    blockers: Vec<String>,
    warnings: Vec<String>,
    log_path: String,
}

#[derive(Deserialize)]
struct NodeStartInput {
    profile_id: String,
    fnn_binary_path: String,
    data_dir: String,
    config_path: String,
    rpc_endpoint: String,
    secret_key_password: String,
    rust_log: Option<String>,
}

#[derive(Deserialize)]
struct NodeConfigInput {
    network: String,
    ckb_rpc_endpoint: String,
    rpc_listening_addr: String,
    p2p_listening_addr: String,
    biscuit_public_key: Option<String>,
}

#[derive(Deserialize)]
struct WriteConfigInput {
    config_path: String,
    contents: String,
}

#[derive(Serialize)]
struct NodeStatus {
    profile_id: String,
    state: String,
    pid: Option<u32>,
    started_at_ms: Option<u128>,
    log_path: Option<String>,
}

#[derive(Debug, Serialize)]
struct NodeCommandError {
    kind: &'static str,
    message: String,
}

#[derive(Serialize)]
struct WalletStatus {
    key_exists: bool,
    key_path: String,
    backup_exists: bool,
    backup_path: String,
    bip39_backup_exists: bool,
    bip39_backup_path: String,
}

#[derive(Deserialize)]
struct WalletImportInput {
    data_dir: String,
    exported_key_contents: String,
    overwrite: bool,
}

#[derive(Deserialize)]
struct WalletBackupInput {
    data_dir: String,
    passphrase: String,
}

#[derive(Deserialize)]
struct WalletBip39ImportInput {
    data_dir: String,
    mnemonic: String,
    passphrase: String,
    overwrite: bool,
}

#[derive(Deserialize)]
struct BiscuitKeyVaultInput {
    data_dir: String,
    private_key: String,
    passphrase: String,
}

#[derive(Deserialize)]
struct BiscuitKeyVaultLoadInput {
    data_dir: String,
    passphrase: String,
}

#[derive(Deserialize)]
struct BiscuitKeyVaultStatusInput {
    data_dir: String,
}

#[derive(Serialize)]
struct BiscuitKeyVaultStatus {
    saved: bool,
    path: String,
}

#[derive(Serialize, Deserialize)]
struct WalletBackupEnvelope {
    version: u8,
    kdf: String,
    cipher: String,
    salt_hex: String,
    nonce_hex: String,
    ciphertext_hex: String,
}

#[derive(Debug, Serialize)]
struct WalletCommandError {
    kind: &'static str,
    message: String,
}

#[derive(Serialize)]
struct BiscuitKeypair {
    public_key: String,
    private_key: String,
}

#[derive(Serialize)]
struct BiscuitTemplate {
    id: &'static str,
    label: &'static str,
    source: String,
}

#[derive(Deserialize)]
struct BiscuitTokenInput {
    private_key: String,
    template_id: String,
    custom_source: Option<String>,
    expiry_rfc3339: String,
}

#[derive(Deserialize)]
struct BiscuitInspectInput {
    token: String,
    public_key: String,
}

#[derive(Serialize)]
struct BiscuitTokenOutput {
    public_key: String,
    token: String,
    source: String,
    revocation_ids: Vec<String>,
}

#[derive(Serialize)]
struct BiscuitInspectReport {
    public_key: String,
    source: String,
    block_count: usize,
    revocation_ids: Vec<String>,
}

#[derive(Debug, Serialize)]
struct BiscuitCommandError {
    kind: &'static str,
    message: String,
}

#[tauri::command]
fn app_version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

#[tauri::command]
fn secret_backend_status() -> SecretBackendStatus {
    SecretBackendStatus {
        provider: "stub",
        available: true,
        stores_secrets: false,
    }
}

#[tauri::command]
fn rpc_allowed_methods() -> RpcMethodList {
    RpcMethodList {
        methods: ALLOWED_RPC_METHODS,
    }
}

#[tauri::command]
async fn rpc_call(
    endpoint: String,
    method: String,
    params: Option<Value>,
    token: Option<String>,
) -> Result<Value, RpcClientError> {
    if !ALLOWED_RPC_METHODS.contains(&method.as_str()) {
        return Err(RpcClientError {
            kind: "method_not_allowed",
            message: format!("RPC method is not in the MVP allowlist: {method}"),
            status: None,
        });
    }

    let endpoint = validate_endpoint(&endpoint)?;
    let token = token.and_then(|value| {
        let trimmed = value.trim().to_string();
        (!trimmed.is_empty()).then_some(trimmed)
    });

    enforce_endpoint_auth(&endpoint, token.as_deref())?;

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|err| RpcClientError {
            kind: "client_init",
            message: err.to_string(),
            status: None,
        })?;

    let body = json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": method,
        "params": params.unwrap_or_else(|| json!([])),
    });

    let mut request = client.post(endpoint).json(&body);

    if let Some(token) = token {
        request = request.bearer_auth(token);
    }

    let response = request.send().await.map_err(map_transport_error)?;
    let status = response.status();

    if !status.is_success() {
        return Err(map_http_status(status));
    }

    let rpc_response = response
        .json::<JsonRpcResponse>()
        .await
        .map_err(|err| RpcClientError {
            kind: "malformed_response",
            message: err.to_string(),
            status: Some(status.as_u16()),
        })?;

    if let Some(error) = rpc_response.error {
        return Err(map_json_rpc_error("Fiber RPC", error, status));
    }

    rpc_response.result.ok_or_else(|| RpcClientError {
        kind: "missing_result",
        message: "Fiber RPC response did not include result or error".to_string(),
        status: Some(status.as_u16()),
    })
}

async fn ckb_rpc_call(
    client: &reqwest::Client,
    endpoint: &Url,
    method: &str,
    params: Option<Value>,
) -> Result<Value, RpcClientError> {
    let body = json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": method,
        "params": params.unwrap_or_else(|| json!([])),
    });
    let response = client
        .post(endpoint.clone())
        .json(&body)
        .send()
        .await
        .map_err(map_transport_error)?;
    let status = response.status();

    if !status.is_success() {
        return Err(map_http_status(status));
    }

    let rpc_response = response
        .json::<JsonRpcResponse>()
        .await
        .map_err(|err| RpcClientError {
            kind: "malformed_response",
            message: err.to_string(),
            status: Some(status.as_u16()),
        })?;

    if let Some(error) = rpc_response.error {
        return Err(map_json_rpc_error("CKB RPC", error, status));
    }

    rpc_response.result.ok_or_else(|| RpcClientError {
        kind: "missing_result",
        message: "CKB RPC response did not include result or error".to_string(),
        status: Some(status.as_u16()),
    })
}

fn parse_ckb_block_number(value: &Value) -> Option<i64> {
    match value {
        Value::String(hex) => {
            let trimmed = hex.strip_prefix("0x").unwrap_or(hex);
            i64::from_str_radix(trimmed, 16).ok()
        }
        Value::Number(n) => n.as_i64(),
        _ => None,
    }
}

fn compute_indexer_lag(chain_tip: &Value, indexer_tip: &Value) -> Option<i64> {
    let chain = parse_ckb_block_number(chain_tip)?;
    let indexer = parse_ckb_block_number(indexer_tip)?;
    Some(chain - indexer)
}

fn parse_ckb_capacity(value: &Value) -> Option<u128> {
    match value {
        Value::String(hex) => {
            let trimmed = hex.strip_prefix("0x").unwrap_or(hex);
            u128::from_str_radix(trimmed, 16).ok()
        }
        Value::Number(n) => n.as_u64().map(u128::from),
        _ => None,
    }
}

fn total_live_cell_capacity(objects: &[Value]) -> u128 {
    objects
        .iter()
        .filter_map(|object| object.get("output").or_else(|| object.get("cell_output")))
        .filter_map(|output| output.get("capacity"))
        .filter_map(parse_ckb_capacity)
        .sum()
}

fn format_ckb_capacity(shannons: u128) -> String {
    let whole = shannons / 100_000_000;
    let fractional = shannons % 100_000_000;

    if fractional == 0 {
        return whole.to_string();
    }

    let mut fraction = format!("{fractional:08}");
    while fraction.ends_with('0') {
        fraction.pop();
    }

    format!("{whole}.{fraction}")
}

fn validate_lock_script(script: &Value) -> Result<(), RpcClientError> {
    let Some(object) = script.as_object() else {
        return Err(RpcClientError {
            kind: "invalid_lock_script",
            message: "Lock script must be a JSON object".to_string(),
            status: None,
        });
    };

    let code_hash = object
        .get("code_hash")
        .and_then(Value::as_str)
        .unwrap_or("");
    if !is_hex_string(code_hash, Some(32)) {
        return Err(RpcClientError {
            kind: "invalid_lock_script",
            message: "Lock script code_hash must be a 32-byte 0x-prefixed hex string".to_string(),
            status: None,
        });
    }

    let hash_type = object
        .get("hash_type")
        .and_then(Value::as_str)
        .unwrap_or("");
    if !matches!(hash_type, "data" | "type" | "data1" | "data2") {
        return Err(RpcClientError {
            kind: "invalid_lock_script",
            message: "Lock script hash_type must be data, type, data1, or data2".to_string(),
            status: None,
        });
    }

    let args = object.get("args").and_then(Value::as_str).unwrap_or("");
    if !is_hex_string(args, None) {
        return Err(RpcClientError {
            kind: "invalid_lock_script",
            message: "Lock script args must be a 0x-prefixed even-length hex string".to_string(),
            status: None,
        });
    }

    Ok(())
}

fn is_hex_string(value: &str, byte_len: Option<usize>) -> bool {
    if !value.starts_with("0x") {
        return false;
    }

    let hex = &value[2..];
    if hex.len() % 2 != 0 || hex.is_empty() {
        return false;
    }

    if let Some(bytes) = byte_len {
        if hex.len() != bytes * 2 {
            return false;
        }
    }

    hex.chars().all(|ch| ch.is_ascii_hexdigit())
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
struct Semver {
    major: u64,
    minor: u64,
    patch: u64,
}

fn ckb_version_status(version: Option<&str>, pinned: &str) -> (&'static str, Option<String>) {
    let Some(version) = version else {
        return (
            "unavailable",
            Some("CKB Net module local_node_info is unavailable; node version compatibility could not be checked.".to_string()),
        );
    };

    let Some((observed, observed_semver)) = extract_semver_prefix(version) else {
        return (
            "unknown",
            Some(format!(
                "CKB node version did not start with a semantic version: {version}"
            )),
        );
    };
    let Some((_, pinned_semver)) = extract_semver_prefix(pinned) else {
        return (
            "unknown",
            Some(format!("Pinned CKB version is invalid: {pinned}")),
        );
    };

    if observed == pinned {
        ("ok", None)
    } else if observed_semver.major != pinned_semver.major || observed_semver < pinned_semver {
        (
            "unsupported",
            Some(format!(
                "CKB node reports {observed}; minimum supported version is {MIN_SUPPORTED_CKB_VERSION}."
            )),
        )
    } else if observed_semver.minor == pinned_semver.minor {
        (
            "compatible",
            Some(format!(
                "CKB node reports compatible patch version {observed}; pinned source baseline is {pinned}."
            )),
        )
    } else {
        (
            "newer_unverified",
            Some(format!(
                "CKB node reports newer unverified version {observed}; pinned source baseline is {pinned}."
            )),
        )
    }
}

fn extract_semver_prefix(value: &str) -> Option<(&str, Semver)> {
    let first = value.split_whitespace().next()?;
    let mut parts = first.split('.');
    let major = parts.next()?;
    let minor = parts.next()?;
    let patch = parts.next()?;

    if parts.next().is_some()
        || major.is_empty()
        || minor.is_empty()
        || patch.is_empty()
        || !major.chars().all(|ch| ch.is_ascii_digit())
        || !minor.chars().all(|ch| ch.is_ascii_digit())
        || !patch.chars().all(|ch| ch.is_ascii_digit())
    {
        return None;
    }

    Some((
        first,
        Semver {
            major: major.parse().ok()?,
            minor: minor.parse().ok()?,
            patch: patch.parse().ok()?,
        },
    ))
}

#[tauri::command]
async fn ckb_rpc_health(endpoint: String) -> Result<CkbRpcHealth, RpcClientError> {
    let endpoint = validate_endpoint(&endpoint)?;
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|err| RpcClientError {
            kind: "client_init",
            message: err.to_string(),
            status: None,
        })?;

    let tip_block_number = ckb_rpc_call(&client, &endpoint, "get_tip_block_number", None).await?;

    let (
        indexer_status,
        indexer_tip_block_number,
        indexer_tip_block_hash,
        indexer_lag_blocks,
        indexer_message,
    ) = match ckb_rpc_call(&client, &endpoint, "get_indexer_tip", None).await {
        Ok(Value::Object(indexer_tip)) => {
            let number = indexer_tip.get("block_number").cloned();
            let hash = indexer_tip.get("block_hash").cloned();
            let lag = number
                .as_ref()
                .and_then(|indexer| compute_indexer_lag(&tip_block_number, indexer));
            (
                "ok".to_string(),
                number,
                hash,
                lag,
                None,
            )
        }
        Ok(_) => (
            "unavailable".to_string(),
            None,
            None,
            None,
            Some("CKB indexer returned an unexpected response shape".to_string()),
        ),
        Err(err) => (
            "unavailable".to_string(),
            None,
            None,
            None,
            Some(format!(
                "CKB indexer not reachable on this endpoint ({}): {}. Wallet balance queries require the indexer module.",
                err.kind, err.message
            )),
        ),
    };

    let (
        pool_status,
        tx_pool_info,
        min_fee_rate,
        fee_rate_status,
        fee_rate_message,
    ) = match ckb_rpc_call(&client, &endpoint, "tx_pool_info", None).await {
        Ok(Value::Object(pool_info)) => {
            let min_fee_rate = pool_info.get("min_fee_rate").cloned();
            (
                "ok".to_string(),
                Some(Value::Object(pool_info)),
                min_fee_rate,
                "checking".to_string(),
                None,
            )
        }
        Ok(other) => (
            "unavailable".to_string(),
            Some(other),
            None,
            "unavailable".to_string(),
            Some("CKB Pool module returned an unexpected tx_pool_info response shape".to_string()),
        ),
        Err(err) => (
            "unavailable".to_string(),
            None,
            None,
            "unavailable".to_string(),
            Some(format!(
                "CKB Pool module is unavailable ({}): {}. Funding transaction submission and fee checks require Pool RPC.",
                err.kind, err.message
            )),
        ),
    };

    let (estimated_fee_rate, fee_rate_status, fee_rate_message) =
        match ckb_rpc_call(&client, &endpoint, "estimate_fee_rate", None).await {
            Ok(fee_rate) => (Some(fee_rate), "ok".to_string(), fee_rate_message),
            Err(err) => (
                None,
                if fee_rate_status == "unavailable" {
                    "unavailable".to_string()
                } else {
                    "fallback_to_pool_min".to_string()
                },
                Some(format!(
                    "CKB estimate_fee_rate is unavailable ({}): {}. Use tx_pool_info.min_fee_rate as a conservative floor until fee estimation is available.",
                    err.kind, err.message
                )),
            ),
        };

    let (ckb_node_version, version_status, version_message) =
        match ckb_rpc_call(&client, &endpoint, "local_node_info", None).await {
            Ok(Value::Object(node_info)) => {
                let version = node_info
                    .get("version")
                    .and_then(Value::as_str)
                    .map(ToString::to_string);
                let (status, message) = ckb_version_status(version.as_deref(), PINNED_CKB_VERSION);
                (version, status.to_string(), message)
            }
            Ok(_) => (
                None,
                "unknown".to_string(),
                Some("CKB local_node_info returned an unexpected response shape".to_string()),
            ),
            Err(err) => (
                None,
                "unavailable".to_string(),
                Some(format!(
                    "CKB Net module local_node_info is unavailable ({}): {}. Node version compatibility could not be checked.",
                    err.kind, err.message
                )),
            ),
        };

    Ok(CkbRpcHealth {
        endpoint: endpoint.to_string(),
        tip_block_number: Some(tip_block_number),
        status: "ok".to_string(),
        indexer_status,
        indexer_tip_block_number,
        indexer_tip_block_hash,
        indexer_lag_blocks,
        indexer_message,
        pool_status,
        tx_pool_info,
        min_fee_rate,
        estimated_fee_rate,
        fee_rate_status,
        fee_rate_message,
        ckb_node_version,
        pinned_ckb_version: PINNED_CKB_VERSION.to_string(),
        version_status,
        version_message,
    })
}

#[tauri::command]
async fn ckb_live_cells(input: CkbLiveCellsInput) -> Result<CkbLiveCellsResult, RpcClientError> {
    let endpoint = validate_endpoint(&input.endpoint)?;
    validate_lock_script(&input.lock_script)?;
    let limit = input.limit.unwrap_or(20).clamp(1, 100);
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|err| RpcClientError {
            kind: "client_init",
            message: err.to_string(),
            status: None,
        })?;

    let search_key = json!({
        "script": input.lock_script,
        "script_type": "lock",
        "script_search_mode": "exact",
        "with_data": false,
    });
    let capacity_search_key = search_key.clone();
    let limit = format!("0x{limit:x}");
    let params = if let Some(cursor) = input
        .after_cursor
        .filter(|cursor| !cursor.trim().is_empty())
    {
        json!([search_key, "asc", limit, cursor])
    } else {
        json!([search_key, "asc", limit])
    };
    let response = ckb_rpc_call(&client, &endpoint, "get_cells", Some(params)).await?;
    let capacity_response = ckb_rpc_call(
        &client,
        &endpoint,
        "get_cells_capacity",
        Some(json!([capacity_search_key])),
    )
    .await
    .ok();
    let objects = response
        .get("objects")
        .and_then(Value::as_array)
        .cloned()
        .ok_or_else(|| RpcClientError {
            kind: "malformed_response",
            message: "CKB get_cells response did not include an objects array".to_string(),
            status: None,
        })?;
    let page_capacity = total_live_cell_capacity(&objects);
    let indexed_capacity = capacity_response
        .as_ref()
        .and_then(|capacity| capacity.get("capacity"))
        .and_then(parse_ckb_capacity);
    let last_cursor = response
        .get("last_cursor")
        .and_then(Value::as_str)
        .map(ToString::to_string);

    Ok(CkbLiveCellsResult {
        cell_count: objects.len(),
        page_capacity_shannons: page_capacity.to_string(),
        page_capacity_ckb: format_ckb_capacity(page_capacity),
        indexed_capacity_shannons: indexed_capacity.map(|capacity| capacity.to_string()),
        indexed_capacity_ckb: indexed_capacity.map(format_ckb_capacity),
        indexed_capacity_tip_block_number: capacity_response
            .as_ref()
            .and_then(|capacity| capacity.get("block_number"))
            .cloned(),
        indexed_capacity_tip_block_hash: capacity_response
            .as_ref()
            .and_then(|capacity| capacity.get("block_hash"))
            .cloned(),
        last_cursor,
        objects,
    })
}

#[tauri::command]
fn mock_rpc_call(method: String, _params: Option<Vec<Value>>) -> Result<Value, String> {
    match method.as_str() {
        "node_info" => Ok(json!({
            "node_name": "mock-fiber-node",
            "version": "mock",
            "addresses": ["/ip4/127.0.0.1/tcp/8228"],
            "chain": "testnet",
            "node_id": "02mockpubkey"
        })),
        "list_peers" => Ok(json!([])),
        "list_channels" => Ok(json!([])),
        _ => Err(format!("mock RPC method is not implemented: {method}")),
    }
}

#[tauri::command]
fn node_preflight(input: NodePreflightInput) -> NodePreflightReport {
    build_node_preflight(input)
}

#[tauri::command]
fn node_generate_config(input: NodeConfigInput) -> Result<String, NodeCommandError> {
    generate_fiber_config(&input)
}

#[tauri::command]
fn node_write_config(input: WriteConfigInput) -> Result<(), NodeCommandError> {
    let path = Path::new(&input.config_path);

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|err| NodeCommandError {
            kind: "config_parent_create_failed",
            message: err.to_string(),
        })?;
    }

    fs::write(path, input.contents).map_err(|err| NodeCommandError {
        kind: "config_write_failed",
        message: err.to_string(),
    })
}

#[tauri::command]
fn node_start(
    input: NodeStartInput,
    state: State<'_, NodeManager>,
) -> Result<NodeStatus, NodeCommandError> {
    if input.secret_key_password.trim().is_empty() {
        return Err(NodeCommandError {
            kind: "missing_unlock_password",
            message: "FIBER_SECRET_KEY_PASSWORD is required before starting FNN".to_string(),
        });
    }

    let preflight = build_node_preflight(NodePreflightInput {
        profile_id: input.profile_id.clone(),
        fnn_binary_path: input.fnn_binary_path.clone(),
        data_dir: input.data_dir.clone(),
        config_path: input.config_path.clone(),
        rpc_endpoint: input.rpc_endpoint.clone(),
    });

    if !preflight.blockers.is_empty() {
        return Err(NodeCommandError {
            kind: "preflight_failed",
            message: preflight.blockers.join("; "),
        });
    }

    let mut processes = state.processes.lock().map_err(|_| NodeCommandError {
        kind: "node_state_lock_failed",
        message: "Node manager state lock is poisoned".to_string(),
    })?;

    if let Some(existing) = processes.get_mut(&input.profile_id) {
        if existing
            .child
            .try_wait()
            .map_err(map_process_error)?
            .is_none()
        {
            return Err(NodeCommandError {
                kind: "already_running",
                message: "FNN is already running for this profile".to_string(),
            });
        }
    }

    let log_path = node_log_path(&input.data_dir);
    let stdout = log_file(&log_path)?;
    let stderr = stdout.try_clone().map_err(|err| NodeCommandError {
        kind: "log_clone_failed",
        message: err.to_string(),
    })?;

    let mut command = Command::new(&input.fnn_binary_path);
    command
        .arg("-c")
        .arg(&input.config_path)
        .arg("-d")
        .arg(&input.data_dir)
        .env("FIBER_SECRET_KEY_PASSWORD", input.secret_key_password)
        .env(
            "RUST_LOG",
            input.rust_log.unwrap_or_else(|| "info".to_string()),
        )
        .stdin(Stdio::null())
        .stdout(Stdio::from(stdout))
        .stderr(Stdio::from(stderr));

    let child = command.spawn().map_err(|err| NodeCommandError {
        kind: "spawn_failed",
        message: err.to_string(),
    })?;

    let pid = child.id();
    let started_at_ms = now_ms();
    processes.insert(
        input.profile_id.clone(),
        ManagedNode {
            child,
            started_at_ms,
            log_path: log_path.clone(),
        },
    );

    Ok(NodeStatus {
        profile_id: input.profile_id,
        state: "running".to_string(),
        pid: Some(pid),
        started_at_ms: Some(started_at_ms),
        log_path: Some(log_path.display().to_string()),
    })
}

#[tauri::command]
fn node_stop(
    profile_id: String,
    state: State<'_, NodeManager>,
) -> Result<NodeStatus, NodeCommandError> {
    let mut processes = state.processes.lock().map_err(|_| NodeCommandError {
        kind: "node_state_lock_failed",
        message: "Node manager state lock is poisoned".to_string(),
    })?;

    let Some(mut managed) = processes.remove(&profile_id) else {
        return Ok(NodeStatus {
            profile_id,
            state: "stopped".to_string(),
            pid: None,
            started_at_ms: None,
            log_path: None,
        });
    };

    if managed
        .child
        .try_wait()
        .map_err(map_process_error)?
        .is_none()
    {
        managed.child.kill().map_err(|err| NodeCommandError {
            kind: "stop_failed",
            message: err.to_string(),
        })?;
        let _ = managed.child.wait();
    }

    Ok(NodeStatus {
        profile_id,
        state: "stopped".to_string(),
        pid: None,
        started_at_ms: Some(managed.started_at_ms),
        log_path: Some(managed.log_path.display().to_string()),
    })
}

#[tauri::command]
fn node_status(
    profile_id: String,
    state: State<'_, NodeManager>,
) -> Result<NodeStatus, NodeCommandError> {
    let mut processes = state.processes.lock().map_err(|_| NodeCommandError {
        kind: "node_state_lock_failed",
        message: "Node manager state lock is poisoned".to_string(),
    })?;

    let Some(managed) = processes.get_mut(&profile_id) else {
        return Ok(NodeStatus {
            profile_id,
            state: "stopped".to_string(),
            pid: None,
            started_at_ms: None,
            log_path: None,
        });
    };

    let pid = managed.child.id();
    let exited = managed
        .child
        .try_wait()
        .map_err(map_process_error)?
        .is_some();

    Ok(NodeStatus {
        profile_id,
        state: if exited { "exited" } else { "running" }.to_string(),
        pid: Some(pid),
        started_at_ms: Some(managed.started_at_ms),
        log_path: Some(managed.log_path.display().to_string()),
    })
}

#[tauri::command]
fn node_read_logs(data_dir: String, max_lines: Option<usize>) -> Result<String, NodeCommandError> {
    let path = node_log_path(&data_dir);
    let file = File::open(&path).map_err(|err| NodeCommandError {
        kind: "log_open_failed",
        message: err.to_string(),
    })?;
    let lines = BufReader::new(file)
        .lines()
        .map_while(Result::ok)
        .collect::<Vec<_>>();
    let keep = max_lines.unwrap_or(120).min(1_000);
    let start = lines.len().saturating_sub(keep);

    Ok(redact_log_text(&lines[start..].join("\n")))
}

#[tauri::command]
fn node_read_config(
    config_path: String,
    max_chars: Option<usize>,
) -> Result<String, NodeCommandError> {
    let path = Path::new(&config_path);
    let contents = fs::read_to_string(path).map_err(|err| NodeCommandError {
        kind: "config_read_failed",
        message: err.to_string(),
    })?;
    let keep = max_chars.unwrap_or(20_000).min(80_000);
    let truncated = contents.chars().take(keep).collect::<String>();

    Ok(redact_log_text(&truncated))
}

#[tauri::command]
fn wallet_status(data_dir: String) -> WalletStatus {
    let key_path = wallet_key_path(&data_dir);
    let backup_path = wallet_backup_path(&data_dir);
    let bip39_backup_path = wallet_bip39_backup_path(&data_dir);

    WalletStatus {
        key_exists: key_path.is_file(),
        key_path: key_path.display().to_string(),
        backup_exists: backup_path.is_file(),
        backup_path: backup_path.display().to_string(),
        bip39_backup_exists: bip39_backup_path.is_file(),
        bip39_backup_path: bip39_backup_path.display().to_string(),
    }
}

#[tauri::command]
fn wallet_import_ckb_key(input: WalletImportInput) -> Result<WalletStatus, WalletCommandError> {
    let key_path = wallet_key_path(&input.data_dir);

    if key_path.exists() && !input.overwrite {
        return Err(WalletCommandError {
            kind: "key_exists",
            message: "ckb/key already exists; enable overwrite to replace it".to_string(),
        });
    }

    let private_key = extract_private_key_line(&input.exported_key_contents)?;

    if let Some(parent) = key_path.parent() {
        fs::create_dir_all(parent).map_err(|err| WalletCommandError {
            kind: "key_parent_create_failed",
            message: err.to_string(),
        })?;
    }

    fs::write(&key_path, format!("{private_key}\n")).map_err(|err| WalletCommandError {
        kind: "key_write_failed",
        message: err.to_string(),
    })?;
    set_private_file_permissions(&key_path)?;

    Ok(wallet_status(input.data_dir))
}

#[tauri::command]
fn wallet_export_encrypted_backup(input: WalletBackupInput) -> Result<String, WalletCommandError> {
    require_passphrase(&input.passphrase)?;
    let key_path = wallet_key_path(&input.data_dir);
    let plaintext = fs::read_to_string(&key_path).map_err(|err| WalletCommandError {
        kind: "key_read_failed",
        message: err.to_string(),
    })?;
    let envelope = encrypt_key_backup(plaintext.as_bytes(), &input.passphrase)?;
    let backup_path = wallet_backup_path(&input.data_dir);

    if let Some(parent) = backup_path.parent() {
        fs::create_dir_all(parent).map_err(|err| WalletCommandError {
            kind: "backup_parent_create_failed",
            message: err.to_string(),
        })?;
    }

    fs::write(
        &backup_path,
        serde_json::to_string_pretty(&envelope).map_err(|err| WalletCommandError {
            kind: "backup_serialize_failed",
            message: err.to_string(),
        })?,
    )
    .map_err(|err| WalletCommandError {
        kind: "backup_write_failed",
        message: err.to_string(),
    })?;
    set_private_file_permissions(&backup_path)?;

    Ok(backup_path.display().to_string())
}

#[tauri::command]
fn wallet_validate_backup(input: WalletBackupInput) -> Result<bool, WalletCommandError> {
    require_passphrase(&input.passphrase)?;
    let envelope = read_backup_envelope(&input.data_dir)?;
    decrypt_key_backup(&envelope, &input.passphrase).map(|_| true)
}

#[tauri::command]
fn wallet_restore_encrypted_backup(
    input: WalletBackupInput,
    overwrite: bool,
) -> Result<WalletStatus, WalletCommandError> {
    require_passphrase(&input.passphrase)?;
    let key_path = wallet_key_path(&input.data_dir);

    if key_path.exists() && !overwrite {
        return Err(WalletCommandError {
            kind: "key_exists",
            message: "ckb/key already exists; enable overwrite to restore".to_string(),
        });
    }

    let envelope = read_backup_envelope(&input.data_dir)?;
    let plaintext = decrypt_key_backup(&envelope, &input.passphrase)?;

    if let Some(parent) = key_path.parent() {
        fs::create_dir_all(parent).map_err(|err| WalletCommandError {
            kind: "key_parent_create_failed",
            message: err.to_string(),
        })?;
    }

    fs::write(&key_path, plaintext).map_err(|err| WalletCommandError {
        kind: "key_write_failed",
        message: err.to_string(),
    })?;
    set_private_file_permissions(&key_path)?;

    Ok(wallet_status(input.data_dir))
}

#[tauri::command]
fn wallet_import_bip39_mnemonic(
    input: WalletBip39ImportInput,
) -> Result<WalletStatus, WalletCommandError> {
    require_passphrase(&input.passphrase)?;
    let mnemonic = normalize_bip39_mnemonic(&input.mnemonic)?;
    let backup_path = wallet_bip39_backup_path(&input.data_dir);

    if backup_path.exists() && !input.overwrite {
        return Err(WalletCommandError {
            kind: "bip39_backup_exists",
            message: "BIP39 encrypted backup already exists; enable overwrite to replace it"
                .to_string(),
        });
    }

    let envelope = encrypt_key_backup(mnemonic.as_bytes(), &input.passphrase)?;

    if let Some(parent) = backup_path.parent() {
        fs::create_dir_all(parent).map_err(|err| WalletCommandError {
            kind: "backup_parent_create_failed",
            message: err.to_string(),
        })?;
    }

    fs::write(
        &backup_path,
        serde_json::to_string_pretty(&envelope).map_err(|err| WalletCommandError {
            kind: "backup_serialize_failed",
            message: err.to_string(),
        })?,
    )
    .map_err(|err| WalletCommandError {
        kind: "backup_write_failed",
        message: err.to_string(),
    })?;
    set_private_file_permissions(&backup_path)?;

    Ok(wallet_status(input.data_dir))
}

#[tauri::command]
fn wallet_validate_bip39_backup(input: WalletBackupInput) -> Result<bool, WalletCommandError> {
    require_passphrase(&input.passphrase)?;
    let envelope = read_bip39_backup_envelope(&input.data_dir)?;
    let plaintext = decrypt_key_backup(&envelope, &input.passphrase)?;
    let mnemonic = String::from_utf8(plaintext).map_err(|err| WalletCommandError {
        kind: "bip39_decode_failed",
        message: err.to_string(),
    })?;
    normalize_bip39_mnemonic(&mnemonic).map(|_| true)
}

#[tauri::command]
fn biscuit_key_vault_status(input: BiscuitKeyVaultStatusInput) -> BiscuitKeyVaultStatus {
    let path = biscuit_key_vault_path(&input.data_dir);

    BiscuitKeyVaultStatus {
        saved: path.is_file(),
        path: path.display().to_string(),
    }
}

#[tauri::command]
fn biscuit_key_vault_save(
    input: BiscuitKeyVaultInput,
) -> Result<BiscuitKeyVaultStatus, WalletCommandError> {
    require_passphrase(&input.passphrase)?;
    let keypair =
        biscuit_import_private_key(input.private_key).map_err(|err| WalletCommandError {
            kind: err.kind,
            message: err.message,
        })?;
    let envelope = encrypt_key_backup(keypair.private_key.as_bytes(), &input.passphrase)?;
    let path = biscuit_key_vault_path(&input.data_dir);

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|err| WalletCommandError {
            kind: "backup_parent_create_failed",
            message: err.to_string(),
        })?;
    }

    fs::write(
        &path,
        serde_json::to_string_pretty(&envelope).map_err(|err| WalletCommandError {
            kind: "backup_serialize_failed",
            message: err.to_string(),
        })?,
    )
    .map_err(|err| WalletCommandError {
        kind: "backup_write_failed",
        message: err.to_string(),
    })?;
    set_private_file_permissions(&path)?;

    Ok(BiscuitKeyVaultStatus {
        saved: true,
        path: path.display().to_string(),
    })
}

#[tauri::command]
fn biscuit_key_vault_load(
    input: BiscuitKeyVaultLoadInput,
) -> Result<BiscuitKeypair, WalletCommandError> {
    require_passphrase(&input.passphrase)?;
    let envelope = read_biscuit_key_vault_envelope(&input.data_dir)?;
    let plaintext = decrypt_key_backup(&envelope, &input.passphrase)?;
    let private_key = String::from_utf8(plaintext).map_err(|err| WalletCommandError {
        kind: "biscuit_key_decode_failed",
        message: err.to_string(),
    })?;

    biscuit_import_private_key(private_key).map_err(|err| WalletCommandError {
        kind: err.kind,
        message: err.message,
    })
}

#[tauri::command]
fn biscuit_key_vault_clear(
    input: BiscuitKeyVaultStatusInput,
) -> Result<BiscuitKeyVaultStatus, WalletCommandError> {
    let path = biscuit_key_vault_path(&input.data_dir);

    if path.exists() {
        fs::remove_file(&path).map_err(|err| WalletCommandError {
            kind: "backup_delete_failed",
            message: err.to_string(),
        })?;
    }

    Ok(BiscuitKeyVaultStatus {
        saved: false,
        path: path.display().to_string(),
    })
}

#[tauri::command]
fn biscuit_generate_keypair() -> BiscuitKeypair {
    let keypair = KeyPair::new();

    BiscuitKeypair {
        public_key: keypair.public().to_string(),
        private_key: keypair.private().to_prefixed_string(),
    }
}

#[tauri::command]
fn biscuit_import_private_key(private_key: String) -> Result<BiscuitKeypair, BiscuitCommandError> {
    let private_key = parse_biscuit_private_key(&private_key)?;

    Ok(BiscuitKeypair {
        public_key: private_key.public().to_string(),
        private_key: private_key.to_prefixed_string(),
    })
}

#[tauri::command]
fn biscuit_templates() -> Vec<BiscuitTemplate> {
    vec![
        BiscuitTemplate {
            id: "read_only",
            label: "Read-only dashboard",
            source: biscuit_template_source("read_only", "").unwrap_or_default(),
        },
        BiscuitTemplate {
            id: "operator",
            label: "Operator",
            source: biscuit_template_source("operator", "").unwrap_or_default(),
        },
        BiscuitTemplate {
            id: "mobile_pairing",
            label: "Mobile pairing",
            source: biscuit_template_source("mobile_pairing", "").unwrap_or_default(),
        },
        BiscuitTemplate {
            id: "watchtower",
            label: "Watchtower",
            source: biscuit_template_source("watchtower", "").unwrap_or_default(),
        },
        BiscuitTemplate {
            id: "custom",
            label: "Custom",
            source: "".to_string(),
        },
    ]
}

#[tauri::command]
fn biscuit_generate_token(
    input: BiscuitTokenInput,
) -> Result<BiscuitTokenOutput, BiscuitCommandError> {
    let private_key = parse_biscuit_private_key(&input.private_key)?;
    let keypair = KeyPair::from(&private_key);
    let source = build_biscuit_source(
        &input.template_id,
        input.custom_source.as_deref().unwrap_or_default(),
        &input.expiry_rfc3339,
    )?;
    let token = Biscuit::builder()
        .code(&source)
        .map_err(|err| BiscuitCommandError {
            kind: "token_source_invalid",
            message: err.to_string(),
        })?
        .build(&keypair)
        .map_err(|err| BiscuitCommandError {
            kind: "token_build_failed",
            message: err.to_string(),
        })?;
    let token_base64 = token.to_base64().map_err(|err| BiscuitCommandError {
        kind: "token_serialize_failed",
        message: err.to_string(),
    })?;

    Ok(BiscuitTokenOutput {
        public_key: keypair.public().to_string(),
        token: token_base64,
        source,
        revocation_ids: token_revocation_ids(&token),
    })
}

#[tauri::command]
fn biscuit_inspect_token(
    input: BiscuitInspectInput,
) -> Result<BiscuitInspectReport, BiscuitCommandError> {
    let public_key = parse_biscuit_public_key(&input.public_key)?;
    let token = Biscuit::from_base64(input.token.trim(), public_key).map_err(|err| {
        BiscuitCommandError {
            kind: "token_verify_failed",
            message: err.to_string(),
        }
    })?;
    let source = token
        .print_block_source(0)
        .map_err(|err| BiscuitCommandError {
            kind: "token_inspect_failed",
            message: err.to_string(),
        })?;

    Ok(BiscuitInspectReport {
        public_key: public_key.to_string(),
        source,
        block_count: token.context().len(),
        revocation_ids: token_revocation_ids(&token),
    })
}

fn validate_endpoint(endpoint: &str) -> Result<Url, RpcClientError> {
    let parsed = Url::parse(endpoint).map_err(|err| RpcClientError {
        kind: "invalid_endpoint",
        message: err.to_string(),
        status: None,
    })?;

    match parsed.scheme() {
        "http" | "https" => {}
        _ => {
            return Err(RpcClientError {
                kind: "invalid_endpoint",
                message: "Fiber RPC endpoint must use http or https".to_string(),
                status: None,
            });
        }
    }

    if !parsed.username().is_empty() || parsed.password().is_some() {
        return Err(RpcClientError {
            kind: "invalid_endpoint",
            message: "Credentials must not be embedded in the RPC endpoint URL".to_string(),
            status: None,
        });
    }

    Ok(parsed)
}

fn enforce_endpoint_auth(endpoint: &Url, token: Option<&str>) -> Result<(), RpcClientError> {
    match classify_endpoint(endpoint)? {
        EndpointScope::Public if token.is_none() => Err(RpcClientError {
            kind: "public_rpc_requires_auth",
            message: "Public RPC endpoint requires Biscuit auth".to_string(),
            status: None,
        }),
        _ => Ok(()),
    }
}

fn classify_endpoint(endpoint: &Url) -> Result<EndpointScope, RpcClientError> {
    let host = endpoint.host_str().ok_or_else(|| RpcClientError {
        kind: "invalid_endpoint",
        message: "Fiber RPC endpoint must include a host".to_string(),
        status: None,
    })?;
    let host = host.trim_start_matches('[').trim_end_matches(']');

    if host.eq_ignore_ascii_case("localhost") {
        return Ok(EndpointScope::Loopback);
    }

    if let Ok(ip) = host.parse::<IpAddr>() {
        if ip.is_loopback() {
            return Ok(EndpointScope::Loopback);
        }

        if is_private_ip(ip) {
            return Ok(EndpointScope::Private);
        }
    }

    Ok(EndpointScope::Public)
}

fn is_private_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(ip) => {
            ip.is_private()
                || ip.is_link_local()
                || ip.is_unspecified()
                || ip.octets()[0] == 100 && (ip.octets()[1] & 0b1100_0000) == 0b0100_0000
        }
        IpAddr::V6(ip) => ip.is_unique_local() || ip.is_unicast_link_local() || ip.is_unspecified(),
    }
}

fn map_transport_error(err: reqwest::Error) -> RpcClientError {
    let kind = if err.is_timeout() {
        "timeout"
    } else if err.is_connect() {
        "connection_failed"
    } else {
        "transport_error"
    };

    RpcClientError {
        kind,
        message: err.to_string(),
        status: err.status().map(|status| status.as_u16()),
    }
}

fn map_http_status(status: StatusCode) -> RpcClientError {
    let kind = match status {
        StatusCode::UNAUTHORIZED => "auth_required",
        StatusCode::FORBIDDEN => "permission_denied",
        StatusCode::NOT_FOUND => "not_found",
        _ => "http_error",
    };

    RpcClientError {
        kind,
        message: format!("Fiber RPC returned HTTP {}", status.as_u16()),
        status: Some(status.as_u16()),
    }
}

fn map_json_rpc_error(
    service: &'static str,
    error: JsonRpcErrorBody,
    status: StatusCode,
) -> RpcClientError {
    let lower_message = error.message.to_ascii_lowercase();
    let kind = if lower_message.contains("unauthorized")
        || lower_message.contains("unauthenticated")
        || lower_message.contains("authentication")
        || lower_message.contains("missing token")
        || lower_message.contains("invalid token")
    {
        "auth_required"
    } else if lower_message.contains("permission denied") || lower_message.contains("forbidden") {
        "permission_denied"
    } else {
        "json_rpc_error"
    };

    RpcClientError {
        kind,
        message: format!("{service} error {}: {}", error.code, error.message),
        status: Some(status.as_u16()),
    }
}

fn build_node_preflight(input: NodePreflightInput) -> NodePreflightReport {
    let mut blockers = Vec::new();
    let mut warnings = Vec::new();
    let binary_path = Path::new(&input.fnn_binary_path);
    let data_dir = Path::new(&input.data_dir);
    let config_path = Path::new(&input.config_path);
    let key_path = data_dir.join("ckb").join("key");

    if !binary_path.is_file() {
        blockers.push("FNN binary path does not point to a file".to_string());
    }

    if !data_dir.is_dir() {
        blockers.push("Data directory does not exist".to_string());
    }

    if !config_path.is_file() {
        blockers.push("config.yml does not exist".to_string());
    }

    if !key_path.is_file() {
        blockers.push("Funding key is missing at ckb/key".to_string());
    }

    match parse_endpoint_host_port(&input.rpc_endpoint) {
        Ok((host, port)) => {
            if !is_port_available(&host, port) {
                blockers.push(format!("RPC port is already in use: {host}:{port}"));
            }
        }
        Err(message) => warnings.push(message),
    }

    NodePreflightReport {
        profile_id: input.profile_id,
        blockers,
        warnings,
        log_path: node_log_path(&input.data_dir).display().to_string(),
    }
}

fn generate_fiber_config(input: &NodeConfigInput) -> Result<String, NodeCommandError> {
    match input.network.as_str() {
        "testnet" | "mainnet" => {}
        _ => {
            return Err(NodeCommandError {
                kind: "invalid_network",
                message: "Network must be testnet or mainnet".to_string(),
            });
        }
    }

    let mut rpc = format!("rpc:\n  listening_addr: \"{}\"\n", input.rpc_listening_addr);
    if let Some(public_key) = input
        .biscuit_public_key
        .as_ref()
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
    {
        rpc.push_str(&format!("  biscuit_public_key: \"{}\"\n", public_key));
    }

    Ok(format!(
        "# Generated by Fiber Wallet. Review against pinned Fiber config before mainnet use.\n\
fiber:\n  listening_addr: \"{}\"\n  announce_listening_addr: false\n  announced_addrs: []\n  bootnode_addrs: []\n  chain: {}\n\
{}\n\
ckb:\n  rpc_url: \"{}\"\n  udt_whitelist: []\n\
services:\n  - fiber\n  - rpc\n  - ckb\n",
        input.p2p_listening_addr, input.network, rpc, input.ckb_rpc_endpoint
    ))
}

fn parse_endpoint_host_port(endpoint: &str) -> Result<(String, u16), String> {
    let parsed = Url::parse(endpoint)
        .map_err(|err| format!("Could not parse RPC endpoint for port check: {err}"))?;
    let host = parsed
        .host_str()
        .ok_or_else(|| "RPC endpoint has no host for port check".to_string())?
        .trim_start_matches('[')
        .trim_end_matches(']')
        .to_string();
    let port = parsed.port_or_known_default().ok_or_else(|| {
        "RPC endpoint has no explicit port and no known default for port check".to_string()
    })?;

    Ok((host, port))
}

fn is_port_available(host: &str, port: u16) -> bool {
    TcpListener::bind((host, port)).is_ok()
}

fn node_log_path(data_dir: &str) -> PathBuf {
    Path::new(data_dir).join("fiber-wallet-fnn.log")
}

fn log_file(path: &Path) -> Result<File, NodeCommandError> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|err| NodeCommandError {
            kind: "log_parent_create_failed",
            message: err.to_string(),
        })?;
    }

    OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)
        .map_err(|err| NodeCommandError {
            kind: "log_open_failed",
            message: err.to_string(),
        })
}

fn map_process_error(err: std::io::Error) -> NodeCommandError {
    NodeCommandError {
        kind: "process_status_failed",
        message: err.to_string(),
    }
}

fn now_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
}

fn redact_log_text(input: &str) -> String {
    input
        .lines()
        .map(|line| {
            if line.contains("FIBER_SECRET_KEY_PASSWORD")
                || line.to_lowercase().contains("authorization: bearer")
            {
                "[REDACTED]".to_string()
            } else {
                line.to_string()
            }
        })
        .collect::<Vec<_>>()
        .join("\n")
}

fn wallet_key_path(data_dir: &str) -> PathBuf {
    Path::new(data_dir).join("ckb").join("key")
}

fn wallet_backup_path(data_dir: &str) -> PathBuf {
    Path::new(data_dir)
        .join("ckb")
        .join("fiber-wallet-key-backup.json")
}

fn wallet_bip39_backup_path(data_dir: &str) -> PathBuf {
    Path::new(data_dir)
        .join("ckb")
        .join("fiber-wallet-bip39-backup.json")
}

fn biscuit_key_vault_path(data_dir: &str) -> PathBuf {
    Path::new(data_dir)
        .join("auth")
        .join("fiber-wallet-biscuit-key.json")
}

fn extract_private_key_line(contents: &str) -> Result<String, WalletCommandError> {
    let line = contents
        .lines()
        .map(str::trim)
        .find(|line| !line.is_empty())
        .ok_or_else(|| WalletCommandError {
            kind: "empty_key",
            message: "No private key line found".to_string(),
        })?;
    let hex = line.strip_prefix("0x").unwrap_or(line);

    if hex.len() != 64 || !hex.chars().all(|value| value.is_ascii_hexdigit()) {
        return Err(WalletCommandError {
            kind: "invalid_private_key",
            message: "Expected a 32-byte private key hex string".to_string(),
        });
    }

    Ok(line.to_string())
}

fn normalize_bip39_mnemonic(input: &str) -> Result<String, WalletCommandError> {
    let words = input
        .split_whitespace()
        .map(|word| word.trim().to_ascii_lowercase())
        .filter(|word| !word.is_empty())
        .collect::<Vec<_>>();

    if !matches!(words.len(), 12 | 15 | 18 | 21 | 24) {
        return Err(WalletCommandError {
            kind: "invalid_bip39_word_count",
            message: "BIP39 mnemonic must contain 12, 15, 18, 21, or 24 words".to_string(),
        });
    }

    if words
        .iter()
        .any(|word| !word.chars().all(|character| character.is_ascii_lowercase()))
    {
        return Err(WalletCommandError {
            kind: "invalid_bip39_word",
            message: "BIP39 mnemonic words must be alphabetic ASCII words".to_string(),
        });
    }

    Ok(words.join(" "))
}

fn require_passphrase(passphrase: &str) -> Result<(), WalletCommandError> {
    if passphrase.trim().len() < 12 {
        return Err(WalletCommandError {
            kind: "weak_passphrase",
            message: "Backup passphrase must be at least 12 characters".to_string(),
        });
    }

    Ok(())
}

fn encrypt_key_backup(
    plaintext: &[u8],
    passphrase: &str,
) -> Result<WalletBackupEnvelope, WalletCommandError> {
    let mut salt = [0u8; 16];
    let mut nonce = [0u8; 12];
    getrandom::fill(&mut salt).map_err(|err| WalletCommandError {
        kind: "random_failed",
        message: err.to_string(),
    })?;
    getrandom::fill(&mut nonce).map_err(|err| WalletCommandError {
        kind: "random_failed",
        message: err.to_string(),
    })?;

    let key = derive_backup_key(passphrase, &salt)?;
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|err| WalletCommandError {
        kind: "cipher_init_failed",
        message: err.to_string(),
    })?;
    let ciphertext = cipher
        .encrypt(Nonce::from_slice(&nonce), plaintext)
        .map_err(|err| WalletCommandError {
            kind: "backup_encrypt_failed",
            message: err.to_string(),
        })?;

    Ok(WalletBackupEnvelope {
        version: 1,
        kdf: "argon2id".to_string(),
        cipher: "aes-256-gcm".to_string(),
        salt_hex: hex_encode(&salt),
        nonce_hex: hex_encode(&nonce),
        ciphertext_hex: hex_encode(&ciphertext),
    })
}

fn decrypt_key_backup(
    envelope: &WalletBackupEnvelope,
    passphrase: &str,
) -> Result<Vec<u8>, WalletCommandError> {
    if envelope.version != 1 || envelope.kdf != "argon2id" || envelope.cipher != "aes-256-gcm" {
        return Err(WalletCommandError {
            kind: "unsupported_backup",
            message: "Unsupported backup envelope".to_string(),
        });
    }

    let salt = hex_decode(&envelope.salt_hex)?;
    let nonce = hex_decode(&envelope.nonce_hex)?;
    let ciphertext = hex_decode(&envelope.ciphertext_hex)?;
    let key = derive_backup_key(passphrase, &salt)?;
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|err| WalletCommandError {
        kind: "cipher_init_failed",
        message: err.to_string(),
    })?;

    cipher
        .decrypt(Nonce::from_slice(&nonce), ciphertext.as_ref())
        .map_err(|err| WalletCommandError {
            kind: "backup_decrypt_failed",
            message: err.to_string(),
        })
}

fn derive_backup_key(passphrase: &str, salt: &[u8]) -> Result<[u8; 32], WalletCommandError> {
    let mut key = [0u8; 32];
    Argon2::default()
        .hash_password_into(passphrase.as_bytes(), salt, &mut key)
        .map_err(|err| WalletCommandError {
            kind: "key_derivation_failed",
            message: err.to_string(),
        })?;
    Ok(key)
}

fn read_backup_envelope(data_dir: &str) -> Result<WalletBackupEnvelope, WalletCommandError> {
    let backup_path = wallet_backup_path(data_dir);
    let contents = fs::read_to_string(&backup_path).map_err(|err| WalletCommandError {
        kind: "backup_read_failed",
        message: err.to_string(),
    })?;

    serde_json::from_str(&contents).map_err(|err| WalletCommandError {
        kind: "backup_parse_failed",
        message: err.to_string(),
    })
}

fn read_bip39_backup_envelope(data_dir: &str) -> Result<WalletBackupEnvelope, WalletCommandError> {
    let backup_path = wallet_bip39_backup_path(data_dir);
    let contents = fs::read_to_string(&backup_path).map_err(|err| WalletCommandError {
        kind: "backup_read_failed",
        message: err.to_string(),
    })?;

    serde_json::from_str(&contents).map_err(|err| WalletCommandError {
        kind: "backup_parse_failed",
        message: err.to_string(),
    })
}

fn read_biscuit_key_vault_envelope(
    data_dir: &str,
) -> Result<WalletBackupEnvelope, WalletCommandError> {
    let path = biscuit_key_vault_path(data_dir);
    let contents = fs::read_to_string(&path).map_err(|err| WalletCommandError {
        kind: "backup_read_failed",
        message: err.to_string(),
    })?;

    serde_json::from_str(&contents).map_err(|err| WalletCommandError {
        kind: "backup_parse_failed",
        message: err.to_string(),
    })
}

fn hex_encode(bytes: &[u8]) -> String {
    bytes
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect::<String>()
}

fn hex_decode(input: &str) -> Result<Vec<u8>, WalletCommandError> {
    if input.len() % 2 != 0 {
        return Err(WalletCommandError {
            kind: "invalid_hex",
            message: "Hex string has odd length".to_string(),
        });
    }

    (0..input.len())
        .step_by(2)
        .map(|index| {
            u8::from_str_radix(&input[index..index + 2], 16).map_err(|err| WalletCommandError {
                kind: "invalid_hex",
                message: err.to_string(),
            })
        })
        .collect()
}

fn parse_biscuit_private_key(input: &str) -> Result<PrivateKey, BiscuitCommandError> {
    let value = input.trim();
    if value.is_empty() {
        return Err(BiscuitCommandError {
            kind: "missing_private_key",
            message: "Biscuit private key is required".to_string(),
        });
    }

    PrivateKey::from_str(value).map_err(|err| BiscuitCommandError {
        kind: "invalid_private_key",
        message: err.to_string(),
    })
}

fn parse_biscuit_public_key(input: &str) -> Result<PublicKey, BiscuitCommandError> {
    let value = input.trim();
    if value.is_empty() {
        return Err(BiscuitCommandError {
            kind: "missing_public_key",
            message: "Biscuit public key is required".to_string(),
        });
    }

    PublicKey::from_str(value).map_err(|err| BiscuitCommandError {
        kind: "invalid_public_key",
        message: err.to_string(),
    })
}

fn build_biscuit_source(
    template_id: &str,
    custom_source: &str,
    expiry_rfc3339: &str,
) -> Result<String, BiscuitCommandError> {
    let expiry = validate_biscuit_expiry(expiry_rfc3339)?;
    let mut source = biscuit_template_source(template_id, custom_source)?;
    source.push_str(&format!(r#"check if time($time), $time <= {expiry};"#));
    Ok(source)
}

fn biscuit_template_source(
    template_id: &str,
    custom_source: &str,
) -> Result<String, BiscuitCommandError> {
    let lines = match template_id {
        "read_only" => BISCUIT_TEMPLATE_READ_ONLY.join("\n"),
        "mobile_pairing" => BISCUIT_TEMPLATE_MOBILE_PAIRING.join("\n"),
        "operator" => BISCUIT_TEMPLATE_OPERATOR.join("\n"),
        "watchtower" => BISCUIT_TEMPLATE_WATCHTOWER.join("\n"),
        "custom" => {
            let source = custom_source.trim();
            if source.is_empty() {
                return Err(BiscuitCommandError {
                    kind: "empty_custom_source",
                    message: "Custom Biscuit source is empty".to_string(),
                });
            }
            source.to_string()
        }
        _ => {
            return Err(BiscuitCommandError {
                kind: "unknown_template",
                message: format!("Unknown Biscuit template: {template_id}"),
            });
        }
    };

    Ok(ensure_trailing_newline(lines))
}

fn validate_biscuit_expiry(input: &str) -> Result<String, BiscuitCommandError> {
    let value = input.trim();

    if value.len() < 20
        || !value.ends_with('Z')
        || value.chars().any(char::is_whitespace)
        || !value.contains('T')
    {
        return Err(BiscuitCommandError {
            kind: "invalid_expiry",
            message: "Expiry must be an RFC3339 UTC timestamp like 2026-06-01T00:00:00Z"
                .to_string(),
        });
    }

    Ok(value.to_string())
}

fn ensure_trailing_newline(value: String) -> String {
    if value.ends_with('\n') {
        value
    } else {
        format!("{value}\n")
    }
}

fn token_revocation_ids(token: &Biscuit) -> Vec<String> {
    token
        .revocation_identifiers()
        .iter()
        .map(|bytes| hex_encode(bytes))
        .collect()
}

#[cfg(unix)]
fn set_private_file_permissions(path: &Path) -> Result<(), WalletCommandError> {
    use std::os::unix::fs::PermissionsExt;

    fs::set_permissions(path, fs::Permissions::from_mode(0o600)).map_err(|err| WalletCommandError {
        kind: "permission_set_failed",
        message: err.to_string(),
    })
}

#[cfg(not(unix))]
fn set_private_file_permissions(_path: &Path) -> Result<(), WalletCommandError> {
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .manage(NodeManager::default())
        .invoke_handler(tauri::generate_handler![
            app_version,
            secret_backend_status,
            rpc_allowed_methods,
            rpc_call,
            ckb_rpc_health,
            ckb_live_cells,
            mock_rpc_call,
            node_preflight,
            node_generate_config,
            node_write_config,
            node_start,
            node_stop,
            node_status,
            node_read_logs,
            node_read_config,
            wallet_status,
            wallet_import_ckb_key,
            wallet_export_encrypted_backup,
            wallet_validate_backup,
            wallet_restore_encrypted_backup,
            wallet_import_bip39_mnemonic,
            wallet_validate_bip39_backup,
            biscuit_key_vault_status,
            biscuit_key_vault_save,
            biscuit_key_vault_load,
            biscuit_key_vault_clear,
            biscuit_generate_keypair,
            biscuit_import_private_key,
            biscuit_templates,
            biscuit_generate_token,
            biscuit_inspect_token
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn endpoint_validation_rejects_bad_urls() {
        assert_eq!(
            validate_endpoint("ftp://127.0.0.1:8227").unwrap_err().kind,
            "invalid_endpoint"
        );
        assert_eq!(
            validate_endpoint("http://user:pass@127.0.0.1:8227")
                .unwrap_err()
                .kind,
            "invalid_endpoint"
        );
    }

    #[test]
    fn endpoint_classification_detects_loopback_and_private() {
        let loopback = validate_endpoint("http://127.0.0.1:8227").unwrap();
        let private = validate_endpoint("http://192.168.1.10:8227").unwrap();
        let unique_local = validate_endpoint("http://[fd00::1]:8227").unwrap();

        assert_eq!(
            classify_endpoint(&loopback).unwrap(),
            EndpointScope::Loopback
        );
        assert_eq!(classify_endpoint(&private).unwrap(), EndpointScope::Private);
        assert_eq!(
            classify_endpoint(&unique_local).unwrap(),
            EndpointScope::Private
        );
    }

    #[test]
    fn endpoint_auth_blocks_public_without_token() {
        let public = validate_endpoint("https://fiber.example.com").unwrap();

        assert_eq!(
            enforce_endpoint_auth(&public, None).unwrap_err().kind,
            "public_rpc_requires_auth"
        );
        assert!(enforce_endpoint_auth(&public, Some("token")).is_ok());
    }

    #[test]
    fn endpoint_auth_allows_loopback_without_token() {
        let loopback = validate_endpoint("http://localhost:8227").unwrap();

        assert!(enforce_endpoint_auth(&loopback, None).is_ok());
    }

    #[test]
    fn ckb_health_uses_validated_http_endpoint() {
        assert!(validate_endpoint("https://testnet.ckbapp.dev/").is_ok());
        assert_eq!(
            validate_endpoint("file:///tmp/ckb.sock").unwrap_err().kind,
            "invalid_endpoint"
        );
    }

    #[test]
    fn ckb_block_number_parses_hex_and_decimal() {
        assert_eq!(parse_ckb_block_number(&json!("0x10")), Some(16));
        assert_eq!(parse_ckb_block_number(&json!("0xabcdef")), Some(11_259_375));
        assert_eq!(parse_ckb_block_number(&json!("0")), Some(0));
        assert_eq!(parse_ckb_block_number(&json!(42)), Some(42));
        assert_eq!(parse_ckb_block_number(&json!(null)), None);
        assert_eq!(parse_ckb_block_number(&json!("not-a-number")), None);
    }

    #[test]
    fn ckb_capacity_parses_and_formats_live_cells() {
        let objects = vec![
            json!({ "output": { "capacity": "0x2540be400" } }),
            json!({ "output": { "capacity": "0x5f5e100" } }),
            json!({ "output": { "capacity": null } }),
        ];

        let total = total_live_cell_capacity(&objects);

        assert_eq!(total, 10_100_000_000);
        assert_eq!(format_ckb_capacity(total), "101");
        assert_eq!(format_ckb_capacity(12_345_678_901), "123.45678901");
    }

    #[test]
    fn ckb_lock_script_validation_rejects_bad_shapes() {
        let valid = json!({
            "code_hash": format!("0x{}", "a".repeat(64)),
            "hash_type": "type",
            "args": "0x1234",
        });

        assert!(validate_lock_script(&valid).is_ok());
        assert_eq!(
            validate_lock_script(&json!("not-object")).unwrap_err().kind,
            "invalid_lock_script"
        );
        assert_eq!(
            validate_lock_script(&json!({
                "code_hash": "0x1234",
                "hash_type": "type",
                "args": "0x1234"
            }))
            .unwrap_err()
            .kind,
            "invalid_lock_script"
        );
        assert_eq!(
            validate_lock_script(&json!({
                "code_hash": format!("0x{}", "a".repeat(64)),
                "hash_type": "bad",
                "args": "0x1234"
            }))
            .unwrap_err()
            .kind,
            "invalid_lock_script"
        );
        assert_eq!(
            validate_lock_script(&json!({
                "code_hash": format!("0x{}", "a".repeat(64)),
                "hash_type": "type",
                "args": "0x123"
            }))
            .unwrap_err()
            .kind,
            "invalid_lock_script"
        );
    }

    #[test]
    fn indexer_lag_is_positive_when_indexer_trails_chain() {
        assert_eq!(
            compute_indexer_lag(&json!("0x100"), &json!("0xf0")),
            Some(16)
        );
        assert_eq!(compute_indexer_lag(&json!("0x10"), &json!("0x10")), Some(0));
        assert_eq!(compute_indexer_lag(&json!(null), &json!("0x10")), None);
    }

    #[test]
    fn indexer_lag_is_negative_when_indexer_ahead() {
        // Should never happen in practice, but the math should still surface it
        // rather than silently clamp — the UI decides how to present the anomaly.
        assert_eq!(
            compute_indexer_lag(&json!("0xf0"), &json!("0x100")),
            Some(-16)
        );
    }

    #[test]
    fn ckb_version_status_accepts_pinned_version() {
        assert_eq!(
            ckb_version_status(Some("0.206.0 (4141cea 2026-05-06)"), PINNED_CKB_VERSION),
            ("ok", None)
        );
    }

    #[test]
    fn ckb_version_status_flags_mismatches() {
        let (status, message) =
            ckb_version_status(Some("0.205.0 (abc123 2026-03-17)"), PINNED_CKB_VERSION);

        assert_eq!(status, "unsupported");
        assert!(message
            .unwrap()
            .contains("minimum supported version is 0.206.0"));
    }

    #[test]
    fn ckb_version_status_accepts_compatible_patch_versions() {
        let (status, message) =
            ckb_version_status(Some("0.206.2 (abc123 2026-06-01)"), PINNED_CKB_VERSION);

        assert_eq!(status, "compatible");
        assert!(message
            .unwrap()
            .contains("compatible patch version 0.206.2"));
    }

    #[test]
    fn ckb_version_status_warns_on_newer_unverified_minor_versions() {
        let (status, message) =
            ckb_version_status(Some("0.207.0 (abc123 2026-07-01)"), PINNED_CKB_VERSION);

        assert_eq!(status, "newer_unverified");
        assert!(message
            .unwrap()
            .contains("newer unverified version 0.207.0"));
    }

    #[test]
    fn ckb_version_status_blocks_different_major_versions() {
        let (status, message) =
            ckb_version_status(Some("1.0.0 (abc123 2027-01-01)"), PINNED_CKB_VERSION);

        assert_eq!(status, "unsupported");
        assert!(message
            .unwrap()
            .contains("minimum supported version is 0.206.0"));
    }

    #[test]
    fn ckb_version_status_handles_missing_or_malformed_versions() {
        assert_eq!(
            ckb_version_status(None, PINNED_CKB_VERSION).0,
            "unavailable"
        );
        assert_eq!(
            ckb_version_status(Some("ckb develop"), PINNED_CKB_VERSION).0,
            "unknown"
        );
    }

    #[test]
    fn json_rpc_unauthorized_maps_to_auth_required() {
        let error = map_json_rpc_error(
            "Fiber RPC",
            JsonRpcErrorBody {
                code: -32999,
                message: "Unauthorized".to_string(),
            },
            StatusCode::OK,
        );

        assert_eq!(error.kind, "auth_required");
        assert_eq!(error.status, Some(200));
        assert!(error.message.contains("Fiber RPC error -32999"));
    }

    #[test]
    fn json_rpc_permission_errors_map_to_permission_denied() {
        let error = map_json_rpc_error(
            "Fiber RPC",
            JsonRpcErrorBody {
                code: -32999,
                message: "Permission denied for method".to_string(),
            },
            StatusCode::OK,
        );

        assert_eq!(error.kind, "permission_denied");
        assert_eq!(error.status, Some(200));
    }

    #[test]
    fn generated_config_contains_required_sections() {
        let config = generate_fiber_config(&NodeConfigInput {
            network: "testnet".to_string(),
            ckb_rpc_endpoint: "https://testnet.ckbapp.dev/".to_string(),
            rpc_listening_addr: "127.0.0.1:8227".to_string(),
            p2p_listening_addr: "/ip4/127.0.0.1/tcp/8228".to_string(),
            biscuit_public_key: Some("ed25519/example".to_string()),
        })
        .unwrap();

        assert!(config.contains("chain: testnet"));
        assert!(config.contains("listening_addr: \"127.0.0.1:8227\""));
        assert!(config.contains("biscuit_public_key: \"ed25519/example\""));
        assert!(config.contains("rpc_url: \"https://testnet.ckbapp.dev/\""));
    }

    #[test]
    fn node_read_config_redacts_and_bounds_contents() {
        let path = std::env::temp_dir().join(format!("fiber-wallet-config-test-{}.yml", now_ms()));
        fs::write(
            &path,
            "rpc:\n  listening_addr: 127.0.0.1:8227\nFIBER_SECRET_KEY_PASSWORD=secret-value\n",
        )
        .unwrap();

        let contents = node_read_config(path.display().to_string(), Some(120)).unwrap();

        assert!(contents.len() <= 120);
        assert!(contents.contains("[REDACTED]"));
        assert!(!contents.contains("secret-value"));
        let _ = fs::remove_file(path);
    }

    #[test]
    fn private_key_extraction_uses_first_non_empty_line() {
        let key = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
        let extracted = extract_private_key_line(&format!("\n{key}\nchain-code")).unwrap();

        assert_eq!(extracted, key);
    }

    #[test]
    fn backup_encryption_round_trips_key_material() {
        let plaintext = b"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n";
        let passphrase = "strong backup passphrase";
        let envelope = encrypt_key_backup(plaintext, passphrase).unwrap();
        let decrypted = decrypt_key_backup(&envelope, passphrase).unwrap();

        assert_eq!(decrypted, plaintext);
        assert!(decrypt_key_backup(&envelope, "wrong backup passphrase").is_err());
    }

    #[test]
    fn bip39_import_encrypts_and_validates_backup() {
        let data_dir = std::env::temp_dir().join(format!("fiber-wallet-bip39-test-{}", now_ms()));
        let mnemonic = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
        let passphrase = "strong backup passphrase";

        let status = wallet_import_bip39_mnemonic(WalletBip39ImportInput {
            data_dir: data_dir.display().to_string(),
            mnemonic: mnemonic.to_string(),
            passphrase: passphrase.to_string(),
            overwrite: false,
        })
        .unwrap();

        assert!(status.bip39_backup_exists);
        let backup_contents = fs::read_to_string(status.bip39_backup_path).unwrap();
        assert!(!backup_contents.contains("abandon"));
        assert!(wallet_validate_bip39_backup(WalletBackupInput {
            data_dir: data_dir.display().to_string(),
            passphrase: passphrase.to_string(),
        })
        .unwrap());
        let _ = fs::remove_dir_all(data_dir);
    }

    #[test]
    fn biscuit_private_key_round_trips_to_public_key() {
        let keypair = biscuit_generate_keypair();
        let imported = biscuit_import_private_key(keypair.private_key.clone()).unwrap();

        assert_eq!(imported.public_key, keypair.public_key);
        assert_eq!(imported.private_key, keypair.private_key);
    }

    #[test]
    fn biscuit_key_vault_saves_loads_and_clears_encrypted_key() {
        let data_dir =
            std::env::temp_dir().join(format!("fiber-wallet-biscuit-vault-test-{}", now_ms()));
        let keypair = biscuit_generate_keypair();
        let passphrase = "strong biscuit passphrase";

        let saved = biscuit_key_vault_save(BiscuitKeyVaultInput {
            data_dir: data_dir.display().to_string(),
            private_key: keypair.private_key.clone(),
            passphrase: passphrase.to_string(),
        })
        .unwrap();

        assert!(saved.saved);
        let vault_contents = fs::read_to_string(&saved.path).unwrap();
        assert!(!vault_contents.contains(&keypair.private_key));

        let loaded = biscuit_key_vault_load(BiscuitKeyVaultLoadInput {
            data_dir: data_dir.display().to_string(),
            passphrase: passphrase.to_string(),
        })
        .unwrap();

        assert_eq!(loaded.public_key, keypair.public_key);
        assert_eq!(loaded.private_key, keypair.private_key);
        assert!(biscuit_key_vault_load(BiscuitKeyVaultLoadInput {
            data_dir: data_dir.display().to_string(),
            passphrase: "wrong biscuit passphrase".to_string(),
        })
        .is_err());

        let cleared = biscuit_key_vault_clear(BiscuitKeyVaultStatusInput {
            data_dir: data_dir.display().to_string(),
        })
        .unwrap();

        assert!(!cleared.saved);
        assert!(!Path::new(&cleared.path).exists());
        let _ = fs::remove_dir_all(data_dir);
    }

    #[test]
    fn biscuit_operator_source_includes_expiry_and_write_permissions() {
        let source = build_biscuit_source("operator", "", "2026-06-01T00:00:00Z").unwrap();

        assert!(source.contains(r#"write("payments");"#));
        assert!(source.contains(r#"read("graph");"#));
        assert!(source.contains("check if time($time), $time <= 2026-06-01T00:00:00Z;"));
    }

    #[test]
    fn biscuit_mobile_pairing_source_is_limited() {
        let source = build_biscuit_source("mobile_pairing", "", "2026-06-01T00:00:00Z").unwrap();

        assert!(source.contains(r#"read("node");"#));
        assert!(source.contains(r#"read("channels");"#));
        assert!(source.contains(r#"read("peers");"#));
        assert!(source.contains(r#"read("payments");"#));
        assert!(source.contains(r#"write("invoices");"#));
        assert!(!source.contains(r#"write("channels");"#));
        assert!(!source.contains(r#"write("payments");"#));
    }

    #[test]
    fn biscuit_generated_token_can_be_verified_and_inspected() {
        let keypair = biscuit_generate_keypair();
        let output = biscuit_generate_token(BiscuitTokenInput {
            private_key: keypair.private_key,
            template_id: "read_only".to_string(),
            custom_source: None,
            expiry_rfc3339: "2026-06-01T00:00:00Z".to_string(),
        })
        .unwrap();

        let report = biscuit_inspect_token(BiscuitInspectInput {
            token: output.token,
            public_key: output.public_key,
        })
        .unwrap();

        assert_eq!(report.block_count, 1);
        assert!(report.source.contains(r#"read("node");"#));
        assert_eq!(report.revocation_ids.len(), 1);
    }
}
