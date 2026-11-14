# CI budget and measurement

Target: required PR checks in about five minutes, with fewer total runner-minutes and no added
retry dependence. Queueing is reported separately. A green run is evidence of the current change,
not a statistically established long-term p95.

## Observed before and after

| Measure                                    |   Original sample |                  First shortened matrix |
| ------------------------------------------ | ----------------: | --------------------------------------: |
| Workflow elapsed (including initial queue) |           13m 33s |                                  5m 01s |
| Linux browser jobs                         |                 4 |                                       2 |
| Linux scheduled executions                 |               538 |                                      78 |
| Required Mac checks                        | 24 long scenarios | 5 production smoke + 5 component probes |
| Browser runner-minutes, unweighted         |              55.4 |                                    12.3 |
| Longest Linux browser job                  |           13m 26s |                                  4m 55s |
| Mac GPU job                                |            6m 47s |                                  3m 41s |

Sources: [original run](https://github.com/serroba/histeclipse/actions/runs/43528173605) and
[first complete shortened run](https://github.com/serroba/histeclipse/actions/runs/43540292593).
The latter passed all 78 Linux and all 10 Mac checks without a flaky/retry summary. This is one
sample, not a claim that the retry rate or p95 is now established. The 88 browser executions are
6.4x fewer than the original 562 scheduled executions; browser runner-time fell about 78%.

## Balance work, not just test counts

The first shortened run assigned 39 executions to each Linux shard but took 3m 43s versus
4m 55s: file order left more expensive desktop and mobile checks together. CI now discovers the
current acceptance tests and partitions them using `.github/scripts/partition_e2e.py`, with
versioned per-project/file estimates in `.github/e2e-costs.json`. Assignment is deterministic,
longest-first, and new tests receive a default cost rather than disappearing. Two workers per
runner remain; no extra runners are needed.

The script uses Playwright's public `--test-list` interface. It never combines that selection
with native `--shard` (which would partition again and omit tests). Unit tests and actual
Playwright discovery verify that the two selections are disjoint and their union is all 78
executions. Timing estimates are summed attempt costs, not predicted wall time. Refresh the
estimates when reports show sustained imbalance; do not encode timings in application code.

## Keep measuring

The read-only **CI metrics** job runs after **CI OK**, outside its required gate. It reports:

- Required-check span, initial queue and unweighted browser/all-required runner-minutes.
- A rolling nearest-rank p95 over comparable successful PR runs in the last 20 runs.
- Run attempts and links; test-level retries and flaky outcomes remain in each timing artifact.

The cohort requires the balanced acceptance job names and the new GPU job, so it does not mix
the old full-matrix latency into the new p95. Samples under 20 are explicitly preliminary.
Unsuccessful runs are excluded from the percentile, not from operational review. Inspect them
and the retry artifacts before claiming a stable improvement. Mac minutes here are elapsed
job time, not billing multipliers.

Existing `@live` post-deploy checks remain focused on hosting/caching/release behaviour. Broader
regression suites still run nightly/on demand during migration; not every extended E2E has
been replaced. Follow [ACCEPTANCE.md](ACCEPTANCE.md) when adding coverage so the required suite
does not grow by another complete desktop/mobile cross-product.
