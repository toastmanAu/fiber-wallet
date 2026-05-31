#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

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
    "accept_channel",
    "list_channels",
    "update_channel",
    "shutdown_channel",
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
];

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
        return Err(RpcClientError {
            kind: "json_rpc_error",
            message: format!("Fiber RPC error {}: {}", error.code, error.message),
            status: Some(status.as_u16()),
        });
    }

    rpc_response.result.ok_or_else(|| RpcClientError {
        kind: "missing_result",
        message: "Fiber RPC response did not include result or error".to_string(),
        status: Some(status.as_u16()),
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
fn node_start(input: NodeStartInput, state: State<'_, NodeManager>) -> Result<NodeStatus, NodeCommandError> {
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
        if existing.child.try_wait().map_err(map_process_error)?.is_none() {
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
        .env("RUST_LOG", input.rust_log.unwrap_or_else(|| "info".to_string()))
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
fn node_stop(profile_id: String, state: State<'_, NodeManager>) -> Result<NodeStatus, NodeCommandError> {
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

    if managed.child.try_wait().map_err(map_process_error)?.is_none() {
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
fn node_status(profile_id: String, state: State<'_, NodeManager>) -> Result<NodeStatus, NodeCommandError> {
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
    let exited = managed.child.try_wait().map_err(map_process_error)?.is_some();

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
        IpAddr::V6(ip) => {
            ip.is_unique_local()
                || ip.is_unicast_link_local()
                || ip.is_unspecified()
        }
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
    let parsed = Url::parse(endpoint).map_err(|err| format!("Could not parse RPC endpoint for port check: {err}"))?;
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
            if line.contains("FIBER_SECRET_KEY_PASSWORD") || line.to_lowercase().contains("authorization: bearer") {
                "[REDACTED]".to_string()
            } else {
                line.to_string()
            }
        })
        .collect::<Vec<_>>()
        .join("\n")
}

fn main() {
    tauri::Builder::default()
        .manage(NodeManager::default())
        .invoke_handler(tauri::generate_handler![
            app_version,
            secret_backend_status,
            rpc_allowed_methods,
            rpc_call,
            mock_rpc_call,
            node_preflight,
            node_generate_config,
            node_write_config,
            node_start,
            node_stop,
            node_status,
            node_read_logs
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn endpoint_validation_rejects_bad_urls() {
        assert_eq!(validate_endpoint("ftp://127.0.0.1:8227").unwrap_err().kind, "invalid_endpoint");
        assert_eq!(
            validate_endpoint("http://user:pass@127.0.0.1:8227").unwrap_err().kind,
            "invalid_endpoint"
        );
    }

    #[test]
    fn endpoint_classification_detects_loopback_and_private() {
        let loopback = validate_endpoint("http://127.0.0.1:8227").unwrap();
        let private = validate_endpoint("http://192.168.1.10:8227").unwrap();
        let unique_local = validate_endpoint("http://[fd00::1]:8227").unwrap();

        assert_eq!(classify_endpoint(&loopback).unwrap(), EndpointScope::Loopback);
        assert_eq!(classify_endpoint(&private).unwrap(), EndpointScope::Private);
        assert_eq!(classify_endpoint(&unique_local).unwrap(), EndpointScope::Private);
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
}
