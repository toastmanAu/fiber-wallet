import { describe, expect, it } from "vitest";
import { createFiberConnectUri, parseFiberConnectUri } from "./fiberConnect";

describe("FiberConnect URI", () => {
  it("round-trips the protocol payload", () => {
    const uri = createFiberConnectUri({
      rpc_url: "https://node.example.com:8231",
      auth_token: "EsQCCtkBCghja",
      cert_fingerprint: "12:34:56",
    });

    expect(uri.startsWith("fiberconnect://")).toBe(true);
    expect(parseFiberConnectUri(uri)).toEqual({
      rpc_url: "https://node.example.com:8231/",
      auth_token: "EsQCCtkBCghja",
      cert_fingerprint: "12:34:56",
    });
  });

  it("omits empty certificate fingerprints", () => {
    expect(
      parseFiberConnectUri(
        createFiberConnectUri({
          rpc_url: "http://192.168.1.100:8231",
          auth_token: "token",
          cert_fingerprint: " ",
        }),
      ),
    ).toEqual({
      rpc_url: "http://192.168.1.100:8231/",
      auth_token: "token",
    });
  });

  it("rejects unsupported endpoint schemes", () => {
    expect(() =>
      createFiberConnectUri({
        rpc_url: "file:///tmp/node.sock",
        auth_token: "token",
      }),
    ).toThrow("http or https");
  });
});
