# Development plan and acceptance

Target submission: October 31, 2026. All dates use America/Los_Angeles.

## Delivery sequence

- October 26–27: implement room creation/join, readiness, host controls, full create/solve loop, all difficulty tiers, lives, spectators, sudden death, rematches.
- October 28: complete automated rules and server tests; publish a playable public version; verify no sign-in is required.
- October 29: test two separate devices and a six-player room; verify rejoining after refresh, host disconnection, timing, and mobile keyboards.
- October 30: fix observed issues, record a short demonstration, finalize competition description and links.
- October 31: submit before the organizer's published cutoff. Verify the organizer's exact timezone and entry requirements separately.

## Acceptance checklist

- [ ] Public URL loads with no account requirement.
- [ ] Two separate devices join one room by code.
- [ ] Six clients join; a seventh is rejected.
- [ ] Only the host can start and rematch.
- [ ] All clients see the same phase, clock deadline, and lives.
- [ ] Correct expressions progress through rounds 1–7.
- [ ] Solve phase hides targets and uses other players' valid expressions.
- [ ] Wrong and timed-out submissions deduct exactly one life.
- [ ] Late and duplicate submissions are rejected.
- [ ] Eliminated players spectate.
- [ ] Last surviving player wins; tied final eliminations trigger sudden death.
- [ ] Refresh restores the same tab's player; a disconnected host transfers.
- [ ] Rematch works in the same room.
- [ ] Phone layout and typing negative numbers work.
- [ ] GitHub contains source, migrations, setup instructions, and passing automated checks.

## Deferred scope

Custom illustrations, sound, matchmaking, accounts, persistent rankings, and elaborate animation. Minus is a lightweight CSS character so core play works without downloading art.
