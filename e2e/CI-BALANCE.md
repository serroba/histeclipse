# CI cost and partition investigation — 14 November 2026

## Decision

Refresh scenario costs from seven recent full PR runs. Retain the deterministic greedy
partitioner, two Linux jobs, two workers per job and all 80 acceptance executions. Do not add
runners or relax checks. Partitioning can reduce the slower job's tail; it does not remove test
work or guarantee lower runner usage.

Add per-attempt start/worker metadata and a per-job cost/gap table to the existing reports. These
are read-only diagnostics, without a new CI job, dependency or timing threshold.

## Cohorts and limits

Baseline: five successful full PR runs before #697, already using the reduced acceptance suite:
43568056843, 43567800340, 43567711313, 43566351505, 43564753343.

Recent: seven successful full PR runs after #701:
43582672874, 43582772774, 43582807773, 43583864722, 43584874570, 43585473293, 43587576141.
The Python-only dependency PR is excluded. All sampled Linux reports have zero retries; the
baseline selected 79 executions, the recent cohort 80. These are different changes, dependency
versions and hosted machines, not a controlled before/after experiment. Costs below are elapsed
job/test time, not CPU time or billing-adjusted credits. Artifact retention is limited.

## Partition finding

The old weights came from five runs predating the history split and the sheet/tree fixtures.
Three renamed cases still used the 10 s default:

| Scenario                     | Old estimate | Recent median |
| ---------------------------- | -----------: | ------------: |
| Rendered-camera Back/Forward |         10 s |        25.6 s |
| Isolated mobile sheet        |         10 s |         3.6 s |
| Tree navigation fixture      |         10 s |         6.3 s |

Other costs also drifted: desktop drag/URL 19.3 → 24.1 s, 120 Hz history playback 16.8 → 21.4 s.
The recent median observed Linux **job** gap was 33 s, despite almost equal predicted work.

A leave-one-run-out diagnostic trains refreshed medians on six runs and scores the held-out
run using its recorded durations. Median **summed test-work** gap falls from 72.3 to 7.2 s.
All seven held-out runs reduce the maximum assigned work. That is not a wall-time prediction:
test durations may change with co-location; startup, ordering and idle worker slots are not
replayed. Actual CI is the validation of the changed assignment.

| Held-out run | Old assigned work (s) | Refreshed assigned work (s) |
| ------------ | --------------------- | --------------------------- |
| 43582672874  | 328.6 / 410.2         | 369.1 / 369.8               |
| 43582772774  | 412.9 / 316.9         | 351.2 / 378.6               |
| 43582807773  | 240.4 / 320.7         | 284.1 / 276.9               |
| 43583864722  | 330.6 / 351.3         | 340.0 / 342.0               |
| 43584874570  | 334.0 / 406.4         | 372.3 / 368.1               |
| 43585473293  | 413.6 / 402.4         | 411.9 / 404.1               |
| 43587576141  | 354.2 / 405.4         | 384.3 / 375.3               |

## Runner-cost finding

Use means here so the per-phase contributions add up; this differs from the earlier median
latency comparison. Exclude report-only jobs and initial queueing.

| Job group                                  | Baseline mean seconds | Recent mean seconds |
| ------------------------------------------ | --------------------: | ------------------: |
| Both Linux acceptance jobs                 |                 426.2 |               441.0 |
| Mac GPU job                                |                 143.6 |               167.1 |
| Web checks                                 |                 160.0 |               138.6 |
| Main Python pipeline                       |                  44.8 |                58.1 |
| Plates, workflow checks, selector and gate |                  40.0 |                50.7 |
| Total                                      |                 814.6 |               855.5 |

That is roughly 13.6 → 14.3 unweighted runner-minutes on average. The new selector averages
5.3 s; the gate averages 5.3 s versus 2.6 s. Most of the observed increase is elsewhere, partly
offset by faster web checks. In particular, the GPU production-smoke step's median rises from
54 to 73 s while its component step stays at 42 s; main Python checks also take longer. This
locates the cost but does not establish why the hosted executions differ.

Across the 75 scenario keys common to both cohorts, mean summed test work rises from 568.3 to
660.0 s. The replaced/new cases together fall from 118.3 to 58.2 s, despite including an extra
focused camera check. Total mean test work therefore rises by 31.6 s. The combined Linux job
time above the idealised two-worker work bound is essentially flat (82.9 → 81.9 s); there is
no evidence here that fixture-server startup dominates the increase.

Do not claim the broader runtime regression is solved by a partition refresh. Investigate
shared app startup and GPU smoke on matched code/hardware if the higher cost persists. New
attempt timestamps and worker slot indices allow future reports to distinguish worker gaps,
restarts and slow scenarios without enabling expensive tracing for every test.

## Reproducing the partition diagnostic

Download both `timings-ci-1` and `timings-ci-2` artifacts per recent run into separate directories.
Keep old weights for comparison before refreshing:

```sh
git show 3e37fa3:.github/e2e-costs.json > /tmp/old-e2e-costs.json
python .github/scripts/evaluate_e2e_balance.py /path/to/recent/*/*/timings.json \
  --weights /tmp/old-e2e-costs.json > /tmp/balance-evaluation.json
python .github/scripts/refresh_e2e_costs.py /path/to/recent/*/*/timings.json \
  --output .github/e2e-costs.json
```

The evaluator requires complete Linux partition pairs at the same commit/workflow attempt,
rejects overlapping scenarios and mixed worker counts, and keeps recorded wall time separate
from counterfactual work bounds. Refreshed weights use successful, non-retried samples with at
least three runs per scenario; unknown scenarios retain the conservative default.
