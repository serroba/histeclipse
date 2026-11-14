"""Read-only CI latency and runner-time summary; never executes downloaded artifacts."""
from __future__ import annotations

import json
from html import escape
import math
import os
from datetime import datetime
from pathlib import Path
from urllib.request import Request, urlopen

GPU_JOB = "GPU on macOS (production smoke and scene components)"


def seconds(start: str, end: str) -> float:
    return max(0, (datetime.fromisoformat(end) - datetime.fromisoformat(start)).total_seconds())


def measure(run: dict, jobs: list[dict]) -> dict | None:
    """Compare only the bounded matrix, with its required aggregate successful."""
    names = {job["name"] for job in jobs}
    if GPU_JOB not in names or not any("balanced acceptance, 2/2" in name for name in names):
        return None
    aggregate = next((job for job in jobs if job["name"] == "CI OK"), None)
    if aggregate is None or aggregate["conclusion"] != "success":
        return None
    required = [job for job in jobs if job["name"] not in {"CI metrics", "Folders touched (report only)"}]
    # Selective PRs are a different cohort: skipped browser jobs must not look like fast runs.
    if any(job.get("conclusion") != "success" for job in required
           if "balanced acceptance" in job["name"] or job["name"] == GPU_JOB):
        return None
    if any(not job.get("completed_at") for job in required):
        return None
    first = min(job["started_at"] for job in required)
    browsers = [job for job in required if "balanced acceptance" in job["name"] or job["name"] == GPU_JOB]
    acceptance = [job for job in browsers if "balanced acceptance" in job["name"]]
    if len(acceptance) != 2:
        return None
    acceptance_times = [seconds(job["started_at"], job["completed_at"]) for job in acceptance]
    return {
        "id": run["id"],
        "wall": seconds(first, aggregate["completed_at"]),
        "queue": seconds(run["created_at"], first),
        "browser_minutes": sum(seconds(job["started_at"], job["completed_at"]) for job in browsers) / 60,
        "runner_minutes": sum(seconds(job["started_at"], job["completed_at"]) for job in required) / 60,
        "attempt": run.get("run_attempt", 1),
        "acceptance_gap": abs(acceptance_times[0] - acceptance_times[1]),
        "job_seconds": {job["name"]: seconds(job["started_at"], job["completed_at"])
                        for job in required if job["conclusion"] == "success"},
    }


def percentile(values: list[float], fraction: float) -> float | None:
    if not values:
        return None
    return sorted(values)[max(0, math.ceil(len(values) * fraction) - 1)]


def main() -> None:
    repo = os.environ["GITHUB_REPOSITORY"]
    current = int(os.environ["GITHUB_RUN_ID"])
    token = os.environ["GH_TOKEN"]

    def get(path: str) -> dict:
        request = Request(f"https://api.github.com/repos/{repo}/{path}", headers={
            "Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        })
        with urlopen(request, timeout=20) as response:
            return json.load(response)

    run = get(f"actions/runs/{current}")
    sample = measure(run, get(f"actions/runs/{current}/jobs?per_page=100")["jobs"])
    recent = get("actions/workflows/ci.yml/runs?event=pull_request&per_page=20")["workflow_runs"]
    rows = []
    for previous in recent:
        if previous["id"] == current or previous["status"] != "completed" or previous["conclusion"] != "success":
            continue
        row = measure(previous, get(f"actions/runs/{previous['id']}/jobs?per_page=100")["jobs"])
        if row is not None:
            rows.append(row)
    if sample is not None and run["event"] == "pull_request":
        rows.insert(0, sample)
    p95 = percentile([row["wall"] for row in rows], 0.95)
    lines = ["## CI budget", "", "Target: required checks around **300 s**, queue time reported separately.", ""]
    if sample is not None:
        lines += [f"This run: **{sample['wall']:.0f} s** required span; **{sample['queue']:.0f} s** initial queue; "
                  f"**{sample['browser_minutes']:.1f}** browser runner-minutes.", ""]
    else:
        lines += ["This run is incomplete, unsuccessful, selective, or uses the older matrix; excluded from the latency cohort.", ""]
    if sample is not None:
        lines += [f"Linux acceptance job gap: **{sample['acceptance_gap']:.0f} s** (setup, suite and cleanup included).", "",
                  "| Required job | Seconds |", "| --- | ---: |"]
        for name, duration in sorted(sample["job_seconds"].items()):
            label = escape(name).replace("|", "&#124;").replace("`", "&#96;")
            lines.append(f"| {label} | {duration:.0f} |")
        lines.append("")
    lines += [f"Comparable successful PR runs in the last 20: **{len(rows)}**. " +
              (f"Nearest-rank p95: **{p95:.0f} s**." if p95 is not None else "No p95 yet."), "",
              "A sample under 20 is preliminary; do not claim long-term p95 from one green run.",
              "Failed runs are excluded from this percentile; inspect their results too. Test retries/flaky outcomes remain in the per-job timing artifacts.", "",
              "| Run | Required span (s) | Initial queue (s) | Browser runner-minutes | All required runner-minutes | Run attempt |",
              "| --- | ---: | ---: | ---: | ---: | ---: |"]
    for row in rows:
        lines.append(f"| [{row['id']}](https://github.com/{repo}/actions/runs/{row['id']}) | {row['wall']:.0f} | "
                     f"{row['queue']:.0f} | {row['browser_minutes']:.1f} | {row['runner_minutes']:.1f} | {row['attempt']} |")
    lines += ["", "Runner-minutes are unweighted elapsed job time, not platform billing credits. The reporting job is outside the required CI gate.", ""]
    with Path(os.environ["GITHUB_STEP_SUMMARY"]).open("a") as summary:
        summary.write("\n".join(lines))


if __name__ == "__main__":
    main()
