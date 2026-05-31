import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const refs = {
  fiber: "references/fiber",
  ccc: "references/ccc",
  joyid: "references/joyid-sdk-js",
  ckb: "references/ckb",
};

const mvpMethods = new Set([
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
]);

function path(relative) {
  return join(root, relative);
}

function read(relative) {
  return readFileSync(path(relative), "utf8");
}

function gitInfo(refPath) {
  const abs = path(refPath);
  const config = readFileSync(join(abs, ".git/config"), "utf8");
  const head = readFileSync(join(abs, ".git/HEAD"), "utf8").trim();
  const remote = config.match(/\[remote "origin"\][\s\S]*?\n\s*url = ([^\n]+)/)?.[1] ?? "unknown";

  if (!head.startsWith("ref: ")) {
    return { remote, commit: head, branch: "detached" };
  }

  const ref = head.slice(5);
  const branch = ref.replace("refs/heads/", "");
  const commit = readFileSync(join(abs, ".git", ref), "utf8").trim();

  return {
    remote,
    commit,
    branch,
  };
}

function packageVersion(packagePath) {
  const pkg = JSON.parse(read(packagePath));
  return `${pkg.name}@${pkg.version}`;
}

function parseRpcMethods() {
  const source = read("references/fiber/crates/fiber-lib/src/rpc/README.md");
  const lines = source.split("\n");
  const methods = [];
  let currentModule = "Unknown";
  let current = null;
  let section = null;

  for (const line of lines) {
    const moduleMatch = line.match(/^### Module `([^`]+)`/);
    if (moduleMatch) {
      currentModule = moduleMatch[1];
      continue;
    }

    const methodMatch = line.match(/^#### Method `([^`]+)`/);
    if (methodMatch) {
      current = {
        module: currentModule,
        method: methodMatch[1],
        params: [],
        returns: [],
      };
      methods.push(current);
      section = null;
      continue;
    }

    if (!current) continue;

    if (line.startsWith("##### Params")) {
      section = "params";
      continue;
    }

    if (line.startsWith("##### Returns")) {
      section = "returns";
      continue;
    }

    if (line.startsWith("#### ") || line.startsWith("### ")) {
      section = null;
      continue;
    }

    if ((section === "params" || section === "returns") && line.startsWith("* `")) {
      current[section].push(cleanMarkdown(line));
    }
  }

  return methods;
}

function parsePermissions() {
  const source = read("references/fiber/crates/fiber-lib/src/rpc/biscuit.rs");
  const permissions = [];

  for (const match of source.matchAll(/b\.rule\(\s*"([^"]+)"\s*,\s*r#"(.*?)"#\s*,?\s*\)/gs)) {
    permissions.push({
      method: match[1],
      rule: match[2].replace(/\s+/g, " ").trim(),
      contextRequired: false,
    });
  }

  for (const match of source.matchAll(/b\.with_rule\(\s*"([^"]+)"\s*,\s*AuthRule::new\(r#"(.*?)"#\)\.with_require_rpc_context\(true\)\s*,?\s*\)/gs)) {
    permissions.push({
      method: match[1],
      rule: match[2].replace(/\s+/g, " ").trim(),
      contextRequired: true,
    });
  }

  return permissions.sort((a, b) => a.method.localeCompare(b.method));
}

function cleanMarkdown(line) {
  return line
    .replace(/<em>|<\/em>/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function topLevelKeys(configPath) {
  return read(configPath)
    .split("\n")
    .map((line) => line.match(/^([a-zA-Z][\w-]*):/)?.[1])
    .filter(Boolean);
}

function writeManifest(git) {
  const desktopPkg = JSON.parse(read("apps/desktop/package.json"));
  const rootPkg = JSON.parse(read("package.json"));
  const cargoToml = read("apps/desktop/src-tauri/Cargo.toml");
  const tauriVersion = desktopPkg.dependencies["@tauri-apps/api"];
  const tauriCliVersion = desktopPkg.devDependencies["@tauri-apps/cli"];

  writeFileSync(
    path("docs/references/manifest.md"),
    `# Reference Manifest

Generated: 2026-05-31

## Knowledge Graph

No knowledge graph tools, MCP resources, or local graph files were exposed in this session. Milestone 0 generated docs from pinned local source checkouts under \`references/\`.

## Pinned Source References

| Source | Remote | Branch | Commit | Local Path |
| --- | --- | --- | --- | --- |
| Fiber | ${git.fiber.remote} | ${git.fiber.branch} | \`${git.fiber.commit}\` | \`references/fiber\` |
| CCC | ${git.ccc.remote} | ${git.ccc.branch} | \`${git.ccc.commit}\` | \`references/ccc\` |
| JoyID SDK JS | ${git.joyid.remote} | ${git.joyid.branch} | \`${git.joyid.commit}\` | \`references/joyid-sdk-js\` |
| CKB | ${git.ckb.remote} | ${git.ckb.branch} | \`${git.ckb.commit}\` | \`references/ckb\` |

## Local Toolchain Baseline

| Tool | Version |
| --- | --- |
| Node | \`${process.version}\` |
| npm | \`captured in package-lock.json / verify with npm --version\` |
| rustc | \`verify with rustc --version\` |
| cargo | \`verify with cargo --version\` |

## App Package Baseline

- ${rootPkg.name}@${rootPkg.version}
- ${packageVersion("apps/desktop/package.json")}
- Tauri API: \`${tauriVersion}\`
- Tauri CLI: \`${tauriCliVersion}\`
- React: \`${desktopPkg.dependencies.react}\`
- Vite: \`${desktopPkg.devDependencies.vite}\`

## Rust Baseline

\`\`\`toml
${cargoToml}
\`\`\`

## Source Files Used

- \`references/fiber/README.md\`
- \`references/fiber/crates/fiber-lib/src/rpc/README.md\`
- \`references/fiber/crates/fiber-lib/src/rpc/biscuit.rs\`
- \`references/fiber/docs/biscuit-auth.md\`
- \`references/fiber/docs/public-nodes.md\`
- \`references/fiber/config/testnet/config.yml\`
- \`references/fiber/config/mainnet/config.yml\`
- \`references/fiber/crates/fiber-types/src/config.rs\`
- \`references/fiber/crates/fiber-lib/src/config.rs\`
- \`references/fiber/crates/fiber-lib/src/ckb/config.rs\`
`,
  );
}

function writeRpcMethodMap(methods, permissions) {
  const permissionByMethod = new Map(permissions.map((permission) => [permission.method, permission]));
  const rows = methods
    .map((method) => {
      const permission = permissionByMethod.get(method.method);
      return `| ${method.mvp ? "MVP" : "Post-MVP"} | ${method.module} | \`${method.method}\` | ${permission ? `\`${permission.rule}\`` : "not found"} | ${method.params.join("<br>") || "none"} | ${method.returns.join("<br>") || "none"} |`;
    })
    .join("\n");

  writeFileSync(
    path("docs/rpc-method-map.md"),
    `# Fiber RPC Method Map

Generated from \`references/fiber/crates/fiber-lib/src/rpc/README.md\`.

| Scope | Module | Method | Biscuit Rule | Params | Returns |
| --- | --- | --- | --- | --- | --- |
${rows}
`,
  );
}

function writePermissionMap(permissions) {
  const rows = permissions
    .map((permission) => `| \`${permission.method}\` | \`${permission.rule}\` | ${permission.contextRequired ? "yes" : "no"} |`)
    .join("\n");

  writeFileSync(
    path("docs/rpc-permission-map.md"),
    `# Fiber RPC Permission Map

Generated from \`references/fiber/crates/fiber-lib/src/rpc/biscuit.rs\`.

Fiber Biscuit permissions are method-specific. A write permission does not imply the matching read permission.

| Method | Rule | Requires RPC Context |
| --- | --- | --- |
${rows}

## Token Template Inputs

Read-only dashboard:

\`\`\`biscuit
read("node");
read("peers");
read("channels");
read("payments");
read("invoices");
read("graph");
check if time($time), $time <= <expiry>;
\`\`\`

Operator:

\`\`\`biscuit
read("node");
read("peers");
write("peers");
read("channels");
write("channels");
read("payments");
write("payments");
read("invoices");
write("invoices");
read("graph");
check if time($time), $time <= <expiry>;
\`\`\`

Watchtower:

\`\`\`biscuit
write("watchtower");
check if time($time), $time <= <expiry>;
\`\`\`
`,
  );
}

function writeConfigSchema() {
  const testnetKeys = topLevelKeys("references/fiber/config/testnet/config.yml");
  const mainnetKeys = topLevelKeys("references/fiber/config/mainnet/config.yml");

  writeFileSync(
    path("docs/config-schema.md"),
    `# Fiber Config Schema Notes

Generated from pinned Fiber config sources.

## Source Files

- \`references/fiber/config/testnet/config.yml\`
- \`references/fiber/config/mainnet/config.yml\`
- \`references/fiber/crates/fiber-types/src/config.rs\`
- \`references/fiber/crates/fiber-lib/src/config.rs\`
- \`references/fiber/crates/fiber-lib/src/ckb/config.rs\`

## Observed Top-Level Sections

Testnet config:

${testnetKeys.map((key) => `- \`${key}\``).join("\n")}

Mainnet config:

${mainnetKeys.map((key) => `- \`${key}\``).join("\n")}

## Source-Backed Startup Requirements

- FNN uses a data directory passed with \`fnn -d\`.
- FNN uses a config file passed with \`fnn -c\`.
- Built-in wallet funding key material is stored at \`ckb/key\` under the node data directory.
- \`FIBER_SECRET_KEY_PASSWORD\` must be set before starting FNN so the wallet private key file can be encrypted/decrypted.
- \`RUST_LOG\` can configure log verbosity.
- Biscuit RPC public key can be configured under the \`rpc\` section as \`biscuit_public_key\`.
- If \`biscuit_public_key\` is unset, RPC does not require authentication.
- Fiber refuses to start on a public IP address if authentication is not enabled.

## App Implications

- Managed local profiles must model config path, data dir, RPC bind address, RPC port, CKB RPC endpoint, FNN binary path, and unlock state.
- Public/non-loopback RPC bind must be blocked unless Biscuit auth is configured.
- Config editing should use schema-backed forms rather than arbitrary text editing for MVP.
- Node start should fail before spawning if key/password/config/data-dir prerequisites are missing.
`,
  );
}

function writeGapCheck(methods, permissions) {
  const methodNames = new Set(methods.map((method) => method.method));
  const permissionNames = new Set(permissions.map((permission) => permission.method));
  const missingMethods = [...mvpMethods].filter((method) => !methodNames.has(method));
  const missingPermissions = [...mvpMethods].filter((method) => !permissionNames.has(method));
  const extraPermissionMethods = [...permissionNames].filter((method) => !methodNames.has(method));

  writeFileSync(
    path("docs/gap-checks/milestone-0.md"),
    `# Milestone 0 Gap Check

Generated: 2026-05-31

## Knowledge Graph Availability

No knowledge graph tools, MCP resources, or local graph files were exposed in this session. Gap checking used the pinned local source corpus in \`references/\`.

## Source Coverage

- Fiber RPC README parsed: yes.
- Fiber Biscuit authorization source parsed: yes.
- Fiber testnet/mainnet config files found: ${existsSync(path("references/fiber/config/testnet/config.yml")) && existsSync(path("references/fiber/config/mainnet/config.yml")) ? "yes" : "no"}.
- CCC reference pinned: yes.
- JoyID SDK reference pinned: yes.
- CKB reference pinned: yes.

## MVP RPC Method Coverage

- MVP methods planned: ${mvpMethods.size}
- RPC methods parsed from Fiber docs: ${methods.length}
- Missing MVP methods in Fiber RPC docs: ${missingMethods.length ? missingMethods.map((method) => `\`${method}\``).join(", ") : "none"}
- Missing MVP permissions in Biscuit source: ${missingPermissions.length ? missingPermissions.map((method) => `\`${method}\``).join(", ") : "none"}

## Source Mismatches

- Biscuit source contains permission methods not present in generated RPC README: ${extraPermissionMethods.length ? extraPermissionMethods.map((method) => `\`${method}\``).join(", ") : "none"}.
- \`subscribe_store_changes\` is present in Biscuit permissions but not in the generated RPC README. Treat it as unsupported in the UI until source docs confirm the method surface.

## Security Requirements Confirmed

- Public RPC without Biscuit auth must be blocked because Fiber refuses unauthenticated public bind.
- \`FIBER_SECRET_KEY_PASSWORD\` is mandatory for local FNN startup with built-in wallet key material.
- CKB CLI exported key files must be reduced to the first private-key line for FNN and the exported source file should be removed after extraction.
- Node upgrades are risky while channels are open; UI must keep the close/backup warnings from the project plan.

## Open Gaps Before Live Wallet Work

- PQR lock script support for ML-DSA, SPHINCS+, and Falcon still needs verification against CKB/Fiber lock script sources.
- BIP39 derivation path, entropy strength, PQR lock binding, and encrypted backup format are still unspecified.
- Tauri sidecar binary packaging remains scaffold-only; no \`fnn\` binary is bundled.
- RPC method parameter validation is documented but not generated as TypeScript/Rust schemas yet.
- Live Fiber RPC tests require a pinned FNN binary or build pipeline.
`,
  );
}

const git = Object.fromEntries(Object.entries(refs).map(([name, refPath]) => [name, gitInfo(refPath)]));
const permissions = parsePermissions();
const methods = parseRpcMethods().map((method) => ({
  ...method,
  mvp: mvpMethods.has(method.method),
}));

writeManifest(git);
writeRpcMethodMap(methods, permissions);
writePermissionMap(permissions);
writeConfigSchema();
writeGapCheck(methods, permissions);

console.log(`Generated ${methods.length} RPC methods and ${permissions.length} permission rules.`);
