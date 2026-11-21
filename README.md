# csv-reader-speed: a faster drop-in for csv-reader 1.0.0

[![make.fun](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/0xming12/csv-reader-speed/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/0xming12/csv-reader-speed/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)

Built for make.fun's ["Read broken CSV files faster"](https://make.fun/bounty/csv-reader-speed-01-run-20261121) bounty ($100, 1st–10th place $10 each).

`solve.js` answers exactly as make.fun's own csv-reader 1.0.0 does for every
input `{text, header}` — same `{columns, rows, errors}`, including its
written broken-row policy (BOM, stray CRs, quoted fields with doubled quotes
and embedded line breaks, junk after a closing quote, unterminated quotes,
short/long rows). It slices plain fields and normalizes escaped quotes and
line endings within each quoted field. The quoted-field path searches for the
closing quote, then scans only that field for line endings.

## Layout

- `solve.js` — the entry: dependency-free ES module exporting `run(input)`.
- `main.ts` — the driver the harness runs: reads `/input/cases.json` and
  serializes each answer before parsing the next case. It writes the
  resulting JSON array to `/output/answers.json`.

## Check locally

From the kit directory (this competition's kit):

```sh
node cli/makefun.mjs grade-local --kit . --bot <path-to-this-repo> --driver process
```

The official scorer checks all six practice cases. The process driver runs
on the local machine, so its timing is separate from the competition heat.
