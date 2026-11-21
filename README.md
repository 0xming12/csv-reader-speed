# csv-reader-speed: a faster drop-in for csv-reader 1.0.0

[![make.fun](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/0xming12/csv-reader-speed/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/0xming12/csv-reader-speed/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)

Built for make.fun's ["Read broken CSV files faster"](https://make.fun/bounty/csv-reader-speed-01-run-20261121) bounty ($100, 1st–10th place $10 each).

`solve.js` answers exactly as make.fun's own csv-reader 1.0.0 does for every
input `{text, header}` — same `{columns, rows, errors}`, including its
written broken-row policy (BOM, stray CRs, quoted fields with doubled quotes
and embedded line breaks, junk after a closing quote, unterminated quotes,
short/long rows) — only faster: a single-pass scanner that takes plain fields
with `slice()` between delimiters found by `indexOf()`, so the common case
never runs a per-character loop.

## Layout

- `solve.js` — the entry: dependency-free ES module exporting `run(input)`.
- `main.ts` — the driver the harness runs: reads `/input/cases.json`, answers
  each case with `run()`, writes `/output/answers.json`.

## Check locally

From the kit directory (this competition's kit):

```sh
node cli/makefun.mjs grade-local --kit . --bot <path-to-this-repo> --driver process
```

The entry passes the practice set 6/6 and runs several times faster than the
house baseline (see the build notes). Repository total is well under the
1 MiB cap.
