import json
import unittest
import os
import tempfile
from pathlib import Path
from unittest.mock import patch
from ci_scope import full, select, validate, JOBS, JOB_IDS, main


def plan(*paths):
    return select([{"filename": path} for path in paths], len(paths))


def needs(selected):
    return {"changes": {"result": "success", "outputs": {"plan": json.dumps(selected)}},
            **{JOB_IDS[job]: {"result": "success" if enabled else "skipped"}
               for job, enabled in selected.items()}}


class ScopeTest(unittest.TestCase):
    def test_docs_python_and_independent_plates(self):
        for paths, wanted in [(["README.md", "e2e/ACCEPTANCE.md"], {"docs"}),
                              (["data-pipeline/src/x.py"], {"pipeline"}),
                              (["data-pipeline/plates/uv.lock"], {"plates"}),
                              (["data-pipeline/tests/x.py", "docs/README.md"], {"pipeline", "docs"}),
                              (["data-pipeline/uv.lock", "data-pipeline/plates/pyproject.toml"], {"pipeline", "plates"})]:
            with self.subTest(paths=paths):
                selected = plan(*paths)
                self.assertEqual({job for job, enabled in selected.items() if enabled}, wanted)
                validate(needs(selected))

    def test_shared_inputs_runtime_markdown_unknown_and_incomplete_are_full(self):
        for path in ["public/skycultures/greek_almagest/description.md", "public/data/x.json",
                     "src/app.ts", "src/features/iceAges/README.md", "pnpm-lock.yaml", "package.json",
                     "vite.config.ts", ".nvmrc", ".github/workflows/ci.yml", ".github/scripts/ci_scope.py",
                     "unknown.xyz"]:
            self.assertEqual(plan("README.md", path), full(), path)
        self.assertEqual(select([], 0), full())
        self.assertEqual(select([{"filename": "README.md"}], 2), full())
        self.assertEqual(select([{"filename": "README.md"}], None), full())
        self.assertEqual(select([{"filename": "README.md", "previous_filename": "src/app.ts"}], 1), full())

    def test_main_pushes_and_api_failures_use_full_plan(self):
        for event in ['push', 'pull_request']:
            with tempfile.TemporaryDirectory() as directory:
                source = Path(directory) / 'event.json'
                output = Path(directory) / 'output'
                source.write_text(json.dumps({'pull_request': {'number': 1, 'changed_files': 1}}))
                env = {'GITHUB_EVENT_NAME': event, 'GITHUB_EVENT_PATH': str(source),
                       'GITHUB_OUTPUT': str(output), 'GITHUB_REPOSITORY': 'owner/repo', 'GH_TOKEN': 'test'}
                with patch.dict(os.environ, env), patch('ci_scope.pull_files', side_effect=RuntimeError):
                    main()
                values = dict(line.split('=', 1) for line in output.read_text().splitlines())
                self.assertEqual(json.loads(values['plan']), full())

    def test_gate_checks_every_selection_and_rejects_unexpected_skips(self):
        # Every combination: a selected job cannot silently be skipped, failed or cancelled.
        for bits in range(1, 1 << len(JOBS)):
            selected = {job: bool(bits & (1 << i)) for i, job in enumerate(JOBS)}
            validate(needs(selected))
            for job, enabled in selected.items():
                if enabled:
                    for outcome in ["skipped", "failure", "cancelled"]:
                        result = needs(selected)
                        result[JOB_IDS[job]]["result"] = outcome
                        with self.assertRaises(ValueError):
                            validate(result)

    def test_failed_selection_missing_jobs_and_malformed_plan_cannot_pass(self):
        result = needs(full())
        result["changes"]["result"] = "failure"
        with self.assertRaises(ValueError):
            validate(result)
        result = needs(full())
        del result["e2e"]
        with self.assertRaises(ValueError):
            validate(result)
        for selected in [{}, dict.fromkeys(JOBS, False), {**full(), "web": "false"}]:
            with self.assertRaises(ValueError):
                validate(needs(selected))
        result = needs(plan("README.md"))
        result["e2e"]["result"] = "cancelled"
        with self.assertRaises(ValueError):
            validate(result)


if __name__ == "__main__":
    unittest.main()
