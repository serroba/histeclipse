"""Conservative PR job selection; unknown or incomplete changes run the full suite."""
from __future__ import annotations

import json
import os
from pathlib import Path
import sys
from urllib.request import Request, urlopen

JOBS = ("web", "e2e", "gpu", "pipeline", "plates", "workflows", "docs")
JOB_IDS = {"gpu": "e2e-macos-gpu", **{job: job for job in JOBS if job != "gpu"}}


def full() -> dict[str, bool]:
    return {job: job != "docs" for job in JOBS}


def documentation(path: str) -> bool:
    # public/ contains runtime sky-culture Markdown; never classify it as documentation.
    return path.endswith(".md") and ("/" not in path or path.startswith(("docs/", "e2e/")))


def select(files: list[dict], expected: int | None) -> dict[str, bool]:
    if not files or len(files) != expected:
        return full()
    plan = dict.fromkeys(JOBS, False)
    for file in files:
        # Renames affect both the old and new subsystem, including a runtime file renamed to docs.
        for path in [file["filename"], *([file["previous_filename"]] if "previous_filename" in file else [])]:
            if documentation(path):
                plan["docs"] = True
            elif path.startswith("data-pipeline/"):
                # Other assets (e.g. JSON fixtures) also need repository-wide formatting checks.
                if not (path.endswith((".py", ".pyi", ".toml", ".lock", ".ini", ".cfg"))
                        or Path(path).name == ".python-version"):
                    return full()
                plan["plates" if path.startswith("data-pipeline/plates/") else "pipeline"] = True
            else:
                return full()
    return plan


def validate(needs: dict) -> None:
    if needs.get("changes", {}).get("result") != "success":
        raise ValueError("Change selection failed: CI cannot pass")
    plan = json.loads(needs["changes"]["outputs"]["plan"])
    if set(plan) != set(JOBS) or any(type(value) is not bool for value in plan.values()):
        raise ValueError("Incomplete or invalid job plan")
    if not any(plan.values()):
        raise ValueError("Empty job plan")
    for job, selected in plan.items():
        result = needs.get(JOB_IDS[job], {}).get("result")
        if selected and result != "success":
            raise ValueError(f"Selected job {job} did not succeed: {result}")
        if not selected and result not in ("success", "skipped"):
            raise ValueError(f"Unselected job {job} failed, was cancelled, or is missing: {result}")


def pull_files(repo: str, number: int, token: str) -> list[dict]:
    files = []
    for page in range(1, 31):
        request = Request(f"https://api.github.com/repos/{repo}/pulls/{number}/files?per_page=100&page={page}",
                          headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"})
        with urlopen(request, timeout=20) as response:
            batch = json.load(response)
        files.extend(batch)
        if len(batch) < 100:
            break
    return files


def main() -> None:
    if "--gate" in sys.argv:
        validate(json.loads(os.environ["NEEDS"]))
        return
    event = json.loads(Path(os.environ["GITHUB_EVENT_PATH"]).read_text())
    plan = full()  # Main pushes (and unknown event types) retain the complete integration check.
    if os.environ["GITHUB_EVENT_NAME"] == "pull_request":
        try:
            pr = event["pull_request"]
            files = pull_files(os.environ["GITHUB_REPOSITORY"], int(pr["number"]), os.environ["GH_TOKEN"])
            plan = select(files, pr.get("changed_files"))
        except Exception as error:
            print(f"Change list unavailable ({type(error).__name__}); running all jobs")
    with Path(os.environ["GITHUB_OUTPUT"]).open("a") as output:
        for job, selected in plan.items():
            output.write(f"{job}={json.dumps(selected)}\n")
        output.write(f"plan={json.dumps(plan, separators=(',', ':'))}\n")
    print("Selected:", ", ".join(job for job, selected in plan.items() if selected))


if __name__ == "__main__":
    main()
