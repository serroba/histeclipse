"""Held-out partition diagnostics. Summed test work and idealised bounds are not wall forecasts."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from statistics import median

from partition_e2e import description, partition
from refresh_e2e_costs import estimates


def scenario(test: dict) -> dict:
    title = test["title"].removeprefix(test["project"] + " › ")
    file, *titles = title.split(" › ")
    if file != test["file"] or not titles:
        raise ValueError("Unexpected timing scenario title")
    return {"project": test["project"], "file": file, "titles": titles}


def evaluate(reports: list[dict], weights: dict, workers: int = 2) -> dict:
    if workers < 1:
        raise ValueError("Worker count must be positive")
    grouped: dict[str, list[dict]] = {}
    for report in reports:
        if report.get("workers", workers) != workers:
            raise ValueError("Do not mix worker counts in a timing cohort")
        if report.get("status") != "passed":
            raise ValueError("Use completed successful runs, including their retry attempts")
        grouped.setdefault(str(report["runId"]), []).append(report)
    if len(grouped) < 4:
        raise ValueError("Need four runs: each held-out run needs three training samples")
    for pair in grouped.values():
        if len(pair) != 2 or {str(r.get("partition")) for r in pair} != {"1", "2"}:
            raise ValueError("Each run needs exactly two distinct Linux partitions")
        if len({(r.get("commit"), r.get("runAttempt")) for r in pair}) != 1:
            raise ValueError("Do not mix commits or workflow attempts within a run")
    estimates(reports)  # Validate platform/schema and duplicate scenarios across each full run.
    rows = []
    for run, pair in sorted(grouped.items()):
        pair = sorted(pair, key=lambda report: int(report["partition"]))
        training = [r for r in reports if str(r["runId"]) != run]
        refreshed = estimates(training)
        tests = [t for r in pair for t in r["tests"]]
        lookup = {description(scenario(t)): t["durationMs"] / 1000 for t in tests}
        if len(lookup) != len(tests):
            raise ValueError("Duplicate scenarios in held-out run")
        variants = {}
        for name, model in [("checkedIn", weights), ("refreshed", refreshed)]:
            buckets, predicted = partition([scenario(t) for t in tests], model)
            work = [sum(lookup[description(t)] for t in bucket) for bucket in buckets]
            variants[name] = {"estimatedWorkSeconds": predicted, "heldOutWorkSeconds": work,
                              "workGapSeconds": abs(work[0] - work[1]),
                              "idealisedMaxWorkBoundSeconds": max(work) / workers}
        rows.append({"run": run, "trainingRuns": refreshed["sourceRuns"], "selected": len(tests),
                     "recordedSuiteWallSeconds": [r["wallTimeMs"] / 1000 for r in pair],
                     "retryAttempts": sum(max(0, len(t["attempts"]) - 1) for t in tests),
                     "variants": variants})
    return {"workers": workers, "runs": rows, "summary": {
        name: {"medianWorkGapSeconds": median(row["variants"][name]["workGapSeconds"] for row in rows)}
        for name in ["checkedIn", "refreshed"]}}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("reports", type=Path, nargs="+")
    parser.add_argument("--weights", type=Path, required=True)
    parser.add_argument("--workers", type=int, default=2)
    options = parser.parse_args()
    result = evaluate([json.loads(p.read_text()) for p in options.reports],
                      json.loads(options.weights.read_text()), options.workers)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
