#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Serialize;
use serde_json::{json, Value};

#[derive(Serialize)]
struct SecretBackendStatus {
    provider: &'static str,
    available: bool,
    stores_secrets: bool,
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

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            app_version,
            secret_backend_status,
            mock_rpc_call
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

