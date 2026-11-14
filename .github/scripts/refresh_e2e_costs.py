"""Refresh scenario estimates from downloaded Linux timing artifacts, without learning retries."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from statistics import median


def estimates(reports: list[dict], minimum: int = 3) -> dict:
    samples: dict[str, dict[str, float]] = {}
    runs: set[str] = set()
    seen: set[tuple[str, str]] = set()
    for report in reports:
        if report.get("schemaVersion") != 1 or report.get("platform") != "linux":
            raise ValueError("Expected Linux timingReporter schema 1 artifacts")
        run = str(report["runId"])
        runs.add(run)
        for test in report["tests"]:
            project = test["project"]
            title = test["title"].removeprefix(f"{project} › ")
            key = f"[{project}] › {title}"
            if (run, key) in seen:
                raise ValueError("Duplicate scenario in a run: provide each partition once")
            seen.add((run, key))
            attempts = test["attempts"]
            if (test["outcome"] != "expected" or test["expectedStatus"] != "passed"
                    or len(attempts) != 1 or attempts[0]["status"] != "passed"):
                continue
            samples.setdefault(key, {})[run] = attempts[0]["durationMs"] / 1000
    costs = {key: round(median(values.values()), 1) for key, values in sorted(samples.items())
             if len(values) >= minimum}
    if not costs:
        raise ValueError("Not enough successful first-attempt samples")
    return {"schemaVersion": 2, "sourceRuns": sorted(map(int, runs), reverse=True),
            "estimator": "median of successful, non-retried attempts by scenario; unseen scenarios use defaultSeconds",
            "defaultSeconds": 10, "scenarioCosts": costs}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("reports", type=Path, nargs="+")
    parser.add_argument("--output", type=Path, required=True)
    options = parser.parse_args()
    result = estimates([json.loads(path.read_text()) for path in options.reports])
    options.output.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n")


if __name__ == "__main__":
    main()
