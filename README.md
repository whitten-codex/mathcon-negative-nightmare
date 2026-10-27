# MathCon: Negative Nightmare

A simultaneous multiplayer math survival game for 2–6 players. Create expressions equal to secret negative targets, then solve your opponents' expressions. No accounts or passwords.

## Play

1. Enter a name and create a room, choosing 1, 2, or 3 starting lives.
2. Share the invite link or six-character code with friends on other devices.
3. Everyone can mark ready. The host starts once at least two players are connected.
4. Create an expression in 30 seconds, then solve an opponent's expression in 30 seconds.
5. Wrong answers and missed deadlines cost one life. Eliminated players spectate.
6. The last survivor wins. Simultaneous final eliminations trigger sudden death for those tied players only. The host can start a rematch in the same room.

## Rules

- Rounds 1–3: two integers, subtraction.
- Rounds 4–6: two signed integers, addition.
- Round 7 onward: three signed integers, subtraction then addition.
- Integer range begins at −20…20 and expands by 10 every three rounds, capped at 999. Targets are always negative.
- Each phase lasts up to 30 seconds, ending early when all surviving players submit. Results appear for five seconds between phases.
- One submission per player per phase. A malformed input can be corrected before submission; a mathematically incorrect submitted expression costs a life.
- A valid opponent expression is assigned whenever possible. Minus supplies a replacement if none is available for that player. You never solve your own expression.
- The scoreboard updates about once a second. Temporary disconnections retain the session; timers continue. The host role transfers after 45 seconds away. Refreshing in the same tab restores the session.
- Rooms expire 24 hours after creation. Closing a tab does not pause a match. Leaving explicitly forfeits.

## Technical approach

React with Vinext for a responsive website, a same-origin server API on Cloudflare Workers, and Cloudflare D1 for shared room state. Frequent polling keeps 2–6 clients synchronized without an additional socket service. All answer checking and phase deadlines run on the server. Compare-and-swap database writes prevent simultaneous requests from overwriting each other. A player's secret session token is hashed in storage, and only that player's permitted information is returned.

This is a competition MVP for small rooms, not a load-tested large public service. Avoid sharing room codes beyond intended participants. Browser storage contains a per-tab game session, not an account. Player names and room state expire after 24 hours and are removed when a later room is created.

## Develop

Use Node.js 22.13 or newer (Node 24 recommended), Git, and npm.

```sh
npm run install:ci
npm run db:generate  # only after a schema change; the initial migration is committed
npm run dev
```

For a fresh local database, apply the committed migration before playing. Build once and use the generated local Wrangler config:

```sh
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 migrations apply DB --local --config dist/server/wrangler.json --persist-to .wrangler/state
npm run dev
```

See `DEVELOPMENT.md` for the delivery plan and acceptance checklist. The Sites platform provisions D1, applies committed migrations, and deploys the Worker. GitHub stores the full source and runs tests; GitHub Pages alone cannot host the shared game server.

## Test

```sh
node --test tests/*.test.mjs
npx tsc --noEmit
npm run build
```

Before competition submission, play at least one match on two real devices, one six-player match, and test mobile negative-number entry. Automated checks cannot replace those device checks.

## Source and hosting

GitHub: https://github.com/whitten-codex/mathcon-negative-nightmare

The tracked `.openai/hosting.json` identifies the managed Sites project and D1 binding. It contains no credentials. Local runtime files, environment variables, dependencies, and build artifacts are ignored. Source changes on GitHub do not automatically publish to Sites; publish a tested source version through the Sites workflow.


