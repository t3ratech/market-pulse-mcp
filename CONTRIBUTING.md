# Contributing

Issues and pull requests are welcome; maintainers answer issues within three working days.

```bash
npm test                    # the whole suite — no network, no dependencies to install
npm run sync-tools:check    # tools.json matches the Market Pulse service source (monorepo checkout)
npm run verify:live         # the deployed service: protocol round-trips, tools.json == live
```

Rules that keep the package honest:

- **`src/tools.json` is generated**, never edited: `node scripts/sync-tools.mjs` (or `--live`).
  A tool's description, schema and annotations are changed at the service source, where the
  tests that hold them to the Glama rubric live.
- **A version changes in one place:** `node scripts/set-version.mjs <x.y.z>`; a test fails if any
  source disagrees.
- **No runtime dependencies.** The MCPB bundle ships no `node_modules` and a test enforces it.
- **A failing test names a missing requirement.** Do not weaken one to get green.
- **Never commit a key.** A test scans the repository for key-shaped strings.
