"""Contract tests for the cohort and the distinction between latency, queue and cost."""
import unittest
from ci_metrics import GPU_JOB, measure, percentile


def job(name, start="2026-11-14T00:00:10Z", end="2026-11-14T00:02:10Z", conclusion="success"):
    return {"name": name, "started_at": start, "completed_at": end, "conclusion": conclusion}


class MetricsTest(unittest.TestCase):
    def setUp(self):
        self.run = {"id": 123, "created_at": "2026-11-14T00:00:00Z", "run_attempt": 2}
        self.jobs = [job("End-to-end (balanced acceptance, 1/2)"),
                     job("End-to-end (balanced acceptance, 2/2)"), job(GPU_JOB),
                     job("CI OK", "2026-11-14T00:02:10Z", "2026-11-14T00:02:12Z")]

    def test_parallel_work_and_reporter_do_not_become_wall_time(self):
        row = measure(self.run, self.jobs + [job("CI metrics", end=None)])
        self.assertEqual(row["wall"], 122)
        self.assertEqual(row["queue"], 10)
        self.assertEqual(row["browser_minutes"], 6)
        self.assertAlmostEqual(row["runner_minutes"], 6 + 2 / 60)
        self.assertEqual(row["attempt"], 2)

    def test_failed_incomplete_and_old_matrices_do_not_enter_cohort(self):
        self.assertIsNone(measure(self.run, [job("CI OK")]))
        self.assertIsNone(measure(self.run, self.jobs[:-1]))
        self.assertIsNone(measure(self.run, self.jobs[:-1] + [job("CI OK", conclusion="failure")]))
        self.assertIsNone(measure(self.run, self.jobs + [job("Still running", end=None)]))

    def test_selective_runs_with_skipped_browsers_do_not_enter_full_suite_cohort(self):
        selective = [job(GPU_JOB, conclusion="skipped"),
                     job("End-to-end (balanced acceptance, 2/2)", conclusion="skipped"),
                     job("CI OK")]
        self.assertIsNone(measure(self.run, selective))

    def test_nearest_rank_small_and_full_samples(self):
        self.assertIsNone(percentile([], 0.95))
        self.assertEqual(percentile([100, 300, 200], 0.95), 300)
        self.assertEqual(percentile(list(range(1, 21)), 0.95), 19)


if __name__ == "__main__":
    unittest.main()
