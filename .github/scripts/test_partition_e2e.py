import unittest
from partition_e2e import description, discover, partition


class PartitionTest(unittest.TestCase):
    def setUp(self):
        self.weights = {"costs": {"desktop/slow.spec.ts": 30}, "defaultSeconds": 10}
        self.tests = [{"project": "desktop", "file": file, "titles": [name]}
                      for file, name in [("slow.spec.ts", "slow"), ("a.spec.ts", "a"),
                                         ("b.spec.ts", "b"), ("c.spec.ts", "c")]]

    def test_balanced_complete_disjoint_and_order_independent(self):
        buckets, totals = partition(self.tests, self.weights)
        self.assertEqual(totals, [30, 30])
        keys = [description(test) for bucket in buckets for test in bucket]
        self.assertEqual(len(keys), len(set(keys)))
        self.assertEqual(set(keys), {description(test) for test in self.tests})
        self.assertEqual(buckets, partition(list(reversed(self.tests)), self.weights)[0])

    def test_scenarios_in_one_file_have_separate_costs_and_new_tests_keep_default(self):
        tests = [{"project": "desktop", "file": "smoke.spec.ts", "titles": [name]}
                 for name in ["slow", "quick", "new"]]
        weights = {"scenarioCosts": {description(tests[0]): 30, description(tests[1]): 2},
                   "defaultSeconds": 10}
        buckets, totals = partition(tests, weights)
        self.assertEqual(totals, [30, 12])
        self.assertEqual(len(buckets[1]), 2)

    def test_project_and_nested_titles_survive_discovery(self):
        report = {"suites": [{"title": "a.spec.ts", "file": "a.spec.ts", "suites": [
            {"title": "context", "file": "a.spec.ts", "specs": [{"file": "a.spec.ts", "title": "works",
              "tests": [{"projectName": "desktop"}, {"projectName": "mobile"}]}]}]}]}
        tests = discover(report)
        self.assertEqual(description(tests[0]), "[desktop] › a.spec.ts › context › works")
        self.assertEqual(description(tests[1]), "[mobile] › a.spec.ts › context › works")

    def test_bad_or_empty_discovery_fails_and_new_tests_keep_default_weight(self):
        for report in [{"suites": []}, {"errors": ["load failure"], "suites": []}]:
            with self.assertRaises(ValueError):
                discover(report)
        buckets, totals = partition(self.tests[1:], self.weights)
        self.assertEqual(sum(totals), 30)
        self.assertEqual(sum(map(len, buckets)), 3)


if __name__ == "__main__":
    unittest.main()
