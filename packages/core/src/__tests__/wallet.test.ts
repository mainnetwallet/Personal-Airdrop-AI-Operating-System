import { describe, it, expect } from "vitest";
import { WalletStore, DuplicateWalletAddressError, UnknownWalletError } from "../wallet.js";

describe("WalletStore", () => {
  it("registers a wallet with metadata only", () => {
    const store = new WalletStore();
    const wallet = store.register({ address: "0xABC", label: "MAIN", chains: ["ethereum", "base"] });
    expect(wallet.status).toBe("ACTIVE");
    expect(store.get(wallet.walletId)).toEqual(wallet);
  });

  it("rejects a duplicate address", () => {
    const store = new WalletStore();
    store.register({ address: "0xABC", label: "MAIN" });
    expect(() => store.register({ address: "0xABC", label: "RESEARCH" })).toThrow(DuplicateWalletAddressError);
  });

  it("throws on unknown walletId", () => {
    const store = new WalletStore();
    expect(() => store.get("nope")).toThrow(UnknownWalletError);
  });

  it("setStatus() updates status; listByLabel() filters", () => {
    const store = new WalletStore();
    const wallet = store.register({ address: "0xABC", label: "EXPERIMENTAL" });
    store.setStatus(wallet.walletId, "COMPROMISED");
    expect(store.get(wallet.walletId).status).toBe("COMPROMISED");
    expect(store.listByLabel("EXPERIMENTAL")).toHaveLength(1);
    expect(store.listByLabel("MAIN")).toHaveLength(0);
  });
});
