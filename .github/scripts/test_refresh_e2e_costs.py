import unittest
from refresh_e2e_costs import estimates


def report(run, ms, flaky=False):
    return {"schemaVersion": 1, "platform": "linux", "runId": str(run), "tests": [{
        "project": "desktop", "title": "desktop › smoke.spec.ts › context › works",
        "outcome": "flaky" if flaky else "expected", "expectedStatus": "passed",
        "attempts": ([{"status": "timedOut", "durationMs": 30000}] if flaky else [])
        + [{"status": "passed", "durationMs": ms}]}]}


class RefreshTest(unittest.TestCase):
    def test_median_ignores_retries_and_preserves_nested_scenario(self):
        result = estimates([report(1, 1000), report(2, 2000), report(3, 9000), report(4, 80000, True)])
        self.assertEqual(result["scenarioCosts"], {"[desktop] › smoke.spec.ts › context › works": 2})
        self.assertEqual(result["sourceRuns"], [4, 3, 2, 1])

    def test_rejects_duplicate_reports_non_linux_and_insufficient_samples(self):
        with self.assertRaisesRegex(ValueError, "Duplicate"):
            estimates([report(1, 1000), report(1, 1000)])
        with self.assertRaisesRegex(ValueError, "Not enough"):
            estimates([report(1, 1000)])
        wrong = report(1, 1000)
        wrong["platform"] = "darwin"
        with self.assertRaisesRegex(ValueError, "Linux"):
            estimates([wrong])


if __name__ == "__main__":
    unittest.main()
