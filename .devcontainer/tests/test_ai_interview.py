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

    def test_interview_snapshot_includes_voice_and_motion_context(self):
        agent = RecruitmentAgent(api_key="fake")
        snapshot = agent.build_interview_snapshot(
            question="Tell me about yourself",
            answer="I am a software engineer with Python experience",
            result={"score": 8, "feedback": "Good answer"},
            motion_alert=14.2,
            voice_answer="I am a software engineer with Python experience",
        )

        self.assertEqual(snapshot["question"], "Tell me about yourself")
        self.assertEqual(snapshot["answer"], "I am a software engineer with Python experience")
        self.assertEqual(snapshot["voice_answer"], "I am a software engineer with Python experience")
        self.assertEqual(snapshot["motion_alert"], 14.2)

    def test_repeated_motion_detection_flags_repetitive_movement(self):
        agent = RecruitmentAgent(api_key="fake")
        detection = agent.detect_repeated_motion([8, 10, 14, 16, 15, 13])
        self.assertTrue(detection["suspicious"])
        self.assertGreaterEqual(detection["repeated_spikes"], 2)


if __name__ == "__main__":
    unittest.main()
