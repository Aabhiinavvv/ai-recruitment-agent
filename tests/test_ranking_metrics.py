import unittest

from research.evaluate_rankings import (
    evaluate_rankings,
    ndcg_at_k,
    precision_at_k,
    recall_at_k,
    reciprocal_rank,
)


class RankingMetricTests(unittest.TestCase):
    def setUp(self):
        self.rows = [
            {"job_id":"j1","candidate_id":"c1","method":"hybrid","score":0.9,"relevance":1},
            {"job_id":"j1","candidate_id":"c2","method":"hybrid","score":0.8,"relevance":0},
            {"job_id":"j1","candidate_id":"c3","method":"hybrid","score":0.7,"relevance":1},
        ]

    def test_precision_recall_and_mrr(self):
        self.assertEqual(precision_at_k(self.rows, 2), 0.5)
        self.assertEqual(recall_at_k(self.rows, self.rows, 2), 0.5)
        self.assertEqual(reciprocal_rank(self.rows), 1.0)

    def test_ndcg_is_between_zero_and_one(self):
        value = ndcg_at_k(self.rows, 2)
        self.assertGreaterEqual(value, 0.0)
        self.assertLessEqual(value, 1.0)

    def test_grouped_evaluation_reports_method(self):
        report = evaluate_rankings(self.rows, k=2)
        self.assertEqual(report["macro_by_method"]["hybrid"]["jobs_evaluated"], 1)
        self.assertEqual(report["jobs_methods"][0]["candidate_count"], 3)

    def test_invalid_input_raises(self):
        with self.assertRaises(ValueError):
            evaluate_rankings([{"job_id":"j1"}], k=5)


if __name__ == "__main__":
    unittest.main()
