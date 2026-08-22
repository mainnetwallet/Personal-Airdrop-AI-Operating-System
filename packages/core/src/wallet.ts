/**
 * Wallet metadata store. Metadata only — address/label/chains/status.
 * No keys, seed phrases, or signing capability live here or anywhere
 * in this codebase.
 */
import { randomUUID } from "node:crypto";
import type { Wallet, WalletLabel, WalletStatus } from "@airdrop-os/types";

export class UnknownWalletError extends Error {
  constructor(walletId: string) {
    super(`Unknown walletId: ${walletId}`);
    this.name = "UnknownWalletError";
  }
}

export class DuplicateWalletAddressError extends Error {
  constructor(address: string) {
    super(`Wallet address already registered: ${address}`);
    this.name = "DuplicateWalletAddressError";
  }
}

export interface RegisterWalletInput {
  address: string;
  label: WalletLabel;
  chains?: string[];
}

export class WalletStore {
  private readonly wallets = new Map<string, Wallet>();
  private readonly addressIndex = new Map<string, string>();

  register(input: RegisterWalletInput): Wallet {
    if (this.addressIndex.has(input.address)) {
      throw new DuplicateWalletAddressError(input.address);
    }
    const wallet: Wallet = {
      walletId: randomUUID(),
      address: input.address,
      label: input.label,
      chains: input.chains ?? [],
      status: "ACTIVE",
      createdAt: new Date().toISOString(),
    };
    this.wallets.set(wallet.walletId, wallet);
    this.addressIndex.set(wallet.address, wallet.walletId);
    return wallet;
  }

  get(walletId: string): Wallet {
    const wallet = this.wallets.get(walletId);
    if (!wallet) throw new UnknownWalletError(walletId);
    return wallet;
  }

  getByAddress(address: string): Wallet | undefined {
    const id = this.addressIndex.get(address);
    return id ? this.wallets.get(id) : undefined;
  }

  setStatus(walletId: string, status: WalletStatus): Wallet {
    const wallet = this.get(walletId);
    wallet.status = status;
    return wallet;
  }

  listByLabel(label: WalletLabel): Wallet[] {
    return [...this.wallets.values()].filter((w) => w.label === label);
  }
}
