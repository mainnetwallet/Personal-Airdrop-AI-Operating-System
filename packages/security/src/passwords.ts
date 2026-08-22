import { argon2id, argon2Verify } from "hash-wasm";
import { randomBytes } from "node:crypto";

/**
 * Hash a password/secret using argon2id (memory-hard, current best
 * practice). Uses `hash-wasm` (pure WebAssembly, no native compile
 * step) rather than the `argon2` npm package's native C++ binding -
 * the native binding fails to build on Termux (libc++ template errors
 * against newer Clang on Android arm64). Same algorithm and PHC-string
 * output format either way, just a different implementation of it.
 */
export async function hashSecret(plain: string): Promise<string> {
  const salt = randomBytes(16);
  return argon2id({
    password: plain,
    salt,
    parallelism: 1,
    iterations: 3,
    memorySize: 19456, // 19 MiB - OWASP-recommended minimum for argon2id
    hashLength: 32,
    outputType: "encoded",
  });
}

export async function verifySecret(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2Verify({ password: plain, hash });
  } catch {
    return false;
  }
}
