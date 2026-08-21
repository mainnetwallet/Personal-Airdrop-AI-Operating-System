# Personal Airdrop AI Operating System V12 — 10 Phase Build Prompts

Use these prompts sequentially.

1. Give `PHASE-1.md` to Claude.
2. Let Claude inspect, implement, test, and write its phase handoff.
3. After Phase 1 is actually finished, give `PHASE-2.md`.
4. Continue in order through Phase 10.
5. Do not skip phases.
6. The repository + `docs/phases/CURRENT_STATE.md` are the continuity source of truth.
7. If a phase reports NOT_CONFIGURED/BLOCKED/FAILED, the next phase must understand that state and must not fabricate completion.

Recommended order:
PHASE-1 → PHASE-2 → PHASE-3 → PHASE-4 → PHASE-5 →
PHASE-6 → PHASE-7 → PHASE-8 → PHASE-9 → PHASE-10

The prompts intentionally keep Phase 1–10 boundaries explicit so Claude
can continue from real repository state instead of relying on chat memory.
