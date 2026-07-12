import unittest

from agents import RecruitmentAgent


class InterviewAgentTests(unittest.TestCase):
    def test_answer_evaluation_returns_score_and_feedback(self):
        agent = RecruitmentAgent(api_key="fake")
        result = agent.evaluate_interview_answer(
            "Tell me about your experience with Python.",
            "I have built several Python automation scripts and APIs for data processing.",
        )

        self.assertIn("score", result)
        self.assertIn("feedback", result)
        self.assertGreaterEqual(result["score"], 0)
        self.assertLessEqual(result["score"], 10)
        self.assertTrue(result["feedback"])

    def test_motion_detection_detects_change(self):
        agent = RecruitmentAgent(api_key="fake")
        first = b"first-frame"
        second = b"second-frame"
        self.assertGreater(agent.detect_motion(first, second), 0)


if __name__ == "__main__":
    unittest.main()
