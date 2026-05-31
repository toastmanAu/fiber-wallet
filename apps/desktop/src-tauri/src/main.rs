#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use reqwest::StatusCode;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::time::Duration;
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

#[derive(Serialize)]
struct RpcClientError {
    kind: &'static str,
    message: String,
    status: Option<u16>,
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

    if let Some(token) = token.filter(|value| !value.trim().is_empty()) {
        request = request.bearer_auth(token.trim());
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

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            app_version,
            secret_backend_status,
            rpc_allowed_methods,
            rpc_call,
            mock_rpc_call
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
