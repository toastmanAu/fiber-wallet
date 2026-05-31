#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use reqwest::StatusCode;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{net::IpAddr, time::Duration};
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
}
