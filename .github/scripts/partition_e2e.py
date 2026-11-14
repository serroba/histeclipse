"""Partition discovered acceptance tests using checked-in timing estimates and public --test-list."""
from __future__ import annotations

import argparse
import json
from pathlib import Path


def discover(report: dict) -> list[dict]:
    if report.get("errors"):
        raise ValueError("Playwright discovery failed")
    tests = []

    def walk(suites: list[dict], parents: list[str], depth: int = 0) -> None:
        for suite in suites:
            titles = parents + ([suite["title"]] if depth else [])
            for spec in suite.get("specs", []):
                for project in spec["tests"]:
                    tests.append({"project": project["projectName"], "file": spec["file"],
                                  "titles": titles + [spec["title"]]})
            walk(suite.get("suites", []), titles, depth + 1)

    walk(report["suites"], [])
    if not tests:
        raise ValueError("Refusing an empty acceptance selection")
    return tests


def description(test: dict) -> str:
    return " › ".join([f"[{test['project']}]", test["file"], *test["titles"]])


def partition(tests: list[dict], weights: dict, count: int = 2) -> tuple[list[list[dict]], list[float]]:
    buckets: list[list[dict]] = [[] for _ in range(count)]
    totals = [0.0] * count

    def cost(test: dict) -> float:
        value = weights["costs"].get(f"{test['project']}/{test['file']}", weights["defaultSeconds"])
        if not 0 < value < 3600:
            raise ValueError("Invalid timing estimate")
        return value

    # Stable greedy longest-first assignment, including new tests with a conservative default.
    for test in sorted(tests, key=lambda item: (-cost(item), description(item))):
        index = min(range(count), key=lambda shard: (totals[shard], shard))
        buckets[index].append(test)
        totals[index] += cost(test)
    return buckets, totals


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("report", type=Path)
    parser.add_argument("--shard", type=int, choices=[1, 2], required=True)
    parser.add_argument("--output", type=Path, required=True)
    options = parser.parse_args()
    weights = json.loads(Path(".github/e2e-costs.json").read_text())
    tests = discover(json.loads(options.report.read_text()))
    buckets, totals = partition(tests, weights)
    selected = buckets[options.shard - 1]
    options.output.write_text("\n".join(sorted(description(test) for test in selected)) + "\n")
    print(f"Partition {options.shard}/2: {len(selected)} of {len(tests)} executions; "
          f"summed attempt-cost estimates {totals[0]:.1f}s / {totals[1]:.1f}s (not wall time)")


if __name__ == "__main__":
    main()
