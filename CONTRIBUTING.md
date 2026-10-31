# Contributing to MarketLens

Thanks for taking the time to contribute. MarketLens is a small, deliberately
boring codebase: a static React app that reads **public, read-only** exchange
APIs in your browser. Please keep it that way.

## Ground rules

1. **No fabricated data.** Never add placeholder, mock or "demo" market values to
   shipping code paths. If data cannot be fetched, show the failure.
2. **No trading surface.** No order placement, no withdrawals, no API-key input,
   no account linking. This is a viewer.
3. **No backend.** Everything must keep working as a static bundle on a CDN.
4. **Bilingual by default.** Every user-facing string goes into
   `src/lib/i18n.ts` and must exist in both `en` and `zh` (the TypeScript
   dictionary enforces parity).
5. **Honest status.** Anything that is stale, degraded or rate-limited must say so
   in the UI.

## Local workflow

```bash
npm install
npm run dev          # http://localhost:5173
```

Useful checks before opening a PR:

```bash
npm run lint         # ESLint (flat config, typescript-eslint)
npm run typecheck    # tsc --noEmit
npm test             # Vitest unit + component tests
npm run build        # production bundle

npm run preview -- --port 4517 --host 127.0.0.1
npx playwright test --project=desktop --project=mobile   # deterministic E2E
E2E_PROXY=http://127.0.0.1:7890 npx playwright test --project=live  # real APIs
```

`E2E_PROXY` is optional and only needed when your machine can only reach the
exchanges through an HTTP proxy.

## Adding an exchange

1. Add an adapter in `src/data/` implementing `MarketAdapter` (`src/data/base.ts`).
   Reuse `toTicker`, `normaliseCandles`, `parseLevels` and `pickBookDepth`.
2. Verify the payloads against the exchange's official documentation and real
   responses — do not code from blog posts or guessed field names.
3. Register it in `src/data/index.ts` and add a label in `LABELS`.
4. Add unit tests with a captured (trimmed) payload fixture in `src/test/fixtures.ts`.
5. Update the data-source table in `README.md` **and** `README.zh-CN.md`.
6. If the venue supports ticker websockets, add a `StreamConfig` entry in
   `src/data/liveTicker.ts`.

## Conventions

- TypeScript strict mode, no `any` in app code.
- Numbers render through `src/lib/format.ts` so prices, percentages and big
  volumes stay locale-aware.
- Sort/filter/compare logic belongs in `src/lib/selectors.ts` (pure, unit tested).
- Panels must survive failure independently — never let one adapter break a view.
- Keep Tailwind classes token-based (`bg-panel`, `text-muted`, `border-line`) so
  both themes keep working.

## Commit style

Conventional-ish prefixes: `feat:`, `fix:`, `test:`, `docs:`, `chore:`, `perf:`.
Describe user-visible behaviour in the body when it is not obvious.

## Reporting bugs

Please include the venue, market, browser, and whether the issue reproduces with
polling (pause the stream by blocking `wss://` connections). Never paste API keys
— MarketLens does not use them, and any key in an issue is a leaked key.

## License

By contributing you agree that your work is released under the MIT License.
