import { describe, it, expect } from "vitest";
import { redactSecrets } from "../redact.js";

describe("redactSecrets", () => {
  it("redacts labeled sensitive keys", () => {
    const input = { username: "alice", password: "hunter2", nested: { apiKey: "abc123" } };
    const out = redactSecrets(input) as any;
    expect(out.username).toBe("alice");
    expect(out.password).toBe("[REDACTED]");
    expect(out.nested.apiKey).toBe("[REDACTED]");
  });

  it("redacts hex-looking private keys even without a labeled key", () => {
    const key = "0x" + "a".repeat(64);
    const out = redactSecrets({ note: key }) as any;
    expect(out.note).toBe("[REDACTED]");
  });

  it("leaves ordinary strings untouched", () => {
    const out = redactSecrets({ note: "hello world" }) as any;
    expect(out.note).toBe("hello world");
  });

  it("redacts arrays of sensitive objects", () => {
    const out = redactSecrets([{ password: "x" }, { name: "ok" }]) as any;
    expect(out[0].password).toBe("[REDACTED]");
    expect(out[1].name).toBe("ok");
  });
});
