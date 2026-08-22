# apps/extension

Status: **PARTIALLY IMPLEMENTED** (Phase 6)

Chrome extension (Manifest V3): project detection, task guidance, and
workflow teaching from the page context. Registers as a
`CHROME_EXTENSION`-type device (Phase 1 device registry).

## Implemented (real, unit-tested logic)

- `src/messages.ts` — fail-closed zod schema for every message crossing
  the content-script/background boundary (`OBSERVATION`, `TEACH_CONTROL`).
  Malformed or unrecognized messages are rejected, not partially trusted.
- `src/background.ts` (`ExtensionBackground.handleMessage`) — routes a
  validated `OBSERVATION` into `@airdrop-os/core`'s `BrowserEventStore`
  (same field-name redaction rules as the PC agent path — the extension
  does not invent its own), and `TEACH_CONTROL` into a
  `TeachAgentSession`.
- `src/content.ts` (`buildObservationMessage`) — pure construction of a
  correctly-shaped observation message from page-context inputs.
- `src/__tests__/*` — unit tests for all of the above, run via `pnpm test`.

## NOT_CONFIGURED in this environment

This sandbox has no display, no Chrome extension runtime, and no
reachable VPS, so the following are stubs that throw
`NotConfiguredError` rather than fabricating a working integration:

- `ExtensionBackground.registerMessageListener()` — binding
  `handleMessage` to `chrome.runtime.onMessage`.
- `ExtensionBackground.authenticateDevice()` — the `CHROME_EXTENSION`
  device-auth handshake against the VPS API's Phase 1 `/auth` and
  `/devices` endpoints, and persisting credentials via
  `chrome.storage.local`.
- `attachObservers()` in `content.ts` — attaching real DOM
  click/input/submit listeners on the page and calling
  `chrome.runtime.sendMessage`.

`manifest.json` is a real Manifest V3 skeleton (background service
worker + content script registration) but has not been loaded in an
actual Chrome instance from this sandbox.
