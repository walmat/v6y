# Bluesky field test

How v6y was measured against a real app (bluesky-social/social-app at commit `b404fd2`, Expo 58, RN 0.88), without a device, through the app's own Jest setup.

- `REPORT.md`, `REPORT-v2.md`: the two measured passes (precision 51% → 96%) with per-finding verdicts.
- `LOOP-LOG.md`: the four attribution iterations that followed.
- `harness.patch`: everything added to the Bluesky clone (about 700 lines: a fake XRPC backend, mocks, two Jest suites that render the real `<App/>` and capture 56 screens). Apply with `git apply` inside a shallow clone of `bluesky-social/social-app` at `b404fd2`, then `pnpm install`, `pnpm intl:compile`, and run `V6Y=1 NODE_ENV=test V6Y_RESULTS=../results pnpm exec jest -c jest.v6y.config.js --forceExit` (add `V6Y_DS=1` for the designSystem configuration). The harness resolves `@v6y/*` to a sibling checkout of this repo at `../../v6y/packages/*` (see `jest.v6y.config.js` in the patch); build v6y first.
- `classify.py`, `attr.py`, `dups.py`, `aggregate.py`, `detail.py`, `diffkeys.py`, `outer.py`, `summarize.py`, `tree.py`: the scoring scripts. `RES=results python3 classify.py` prints precision using the verdicts from the reports; `python3 attr.py results` prints how many issues land on app files.
