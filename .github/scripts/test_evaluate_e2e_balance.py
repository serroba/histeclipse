import unittest
from evaluate_e2e_balance import evaluate


def reports():
    all_reports = []
    for run in range(1, 5):
        for shard, duration in [(1, 2000), (2, 10000)]:
            title = 'quick' if shard == 1 else 'slow'
            all_reports.append({'schemaVersion': 1, 'platform': 'linux', 'runId': str(run),
                'runAttempt': '1', 'commit': str(run), 'partition': str(shard), 'status': 'passed',
                'wallTimeMs': 20000 + shard * 1000, 'tests': [{'project': 'desktop', 'file': 'x.spec.ts',
                'title': 'desktop › x.spec.ts › '+title, 'outcome': 'expected', 'expectedStatus': 'passed',
                'durationMs': duration, 'attempts': [{'status': 'passed', 'durationMs': duration}]}]})
    return all_reports


class EvaluateTest(unittest.TestCase):
    def test_holds_out_entire_run_and_keeps_recorded_wall_time_separate(self):
        result = evaluate(reports(), {'costs': {}, 'defaultSeconds': 5})
        self.assertEqual(result, evaluate(list(reversed(reports())), {'costs': {}, 'defaultSeconds': 5}))
        for row in result['runs']:
            self.assertNotIn(int(row['run']), row['trainingRuns'])
            self.assertEqual(len(row['trainingRuns']), 3)
            self.assertEqual(row['recordedSuiteWallSeconds'], [21, 22])
            self.assertEqual(sum(row['variants']['refreshed']['heldOutWorkSeconds']), 12)
            self.assertEqual(row['variants']['refreshed']['idealisedMaxWorkBoundSeconds'], 5)

    def test_rejects_incomplete_overlapping_or_mixed_input(self):
        for change in ['missing', 'duplicate', 'attempt', 'platform', 'failed', 'title', 'workers']:
            data = reports()
            if change == 'missing': data.pop()
            elif change == 'duplicate': data[1]['tests'] = data[0]['tests']
            elif change == 'attempt': data[1]['runAttempt'] = '2'
            elif change == 'platform': data[1]['platform'] = 'darwin'
            elif change == 'failed': data[1]['status'] = 'failed'
            elif change == 'workers': data[1]['workers'] = 4
            elif change == 'title': data[1]['tests'][0]['title'] = 'desktop › wrong.spec.ts › slow'
            with self.subTest(change=change), self.assertRaises(ValueError):
                evaluate(data, {'costs': {}, 'defaultSeconds': 5})
        with self.assertRaises(ValueError):
            evaluate(reports(), {'costs': {}, 'defaultSeconds': 5}, workers=0)


if __name__ == '__main__':
    unittest.main()
