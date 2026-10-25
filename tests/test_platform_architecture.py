import unittest

from platform_architecture import PLATFORM_FLOW, PLATFORM_LAYERS


class PlatformArchitectureTests(unittest.TestCase):
    def test_platform_has_the_four_layers_in_requested_order(self):
        self.assertEqual(
            [layer["name"] for layer in PLATFORM_LAYERS],
            [
                "Agent Workforce",
                "Company Memory",
                "Reasoning Engine",
                "Execution Engine",
            ],
        )
        self.assertEqual([layer["number"] for layer in PLATFORM_LAYERS], [1, 2, 3, 4])

    def test_platform_flow_requires_human_approval_before_execution(self):
        self.assertEqual(
            PLATFORM_FLOW,
            (
                "Recruiter request",
                "Agent Workforce",
                "Company Memory",
                "Reasoning Engine",
                "Recruiter approval",
                "Execution Engine",
                "Audit event and workflow result",
            ),
        )
        self.assertLess(
            PLATFORM_FLOW.index("Recruiter approval"),
            PLATFORM_FLOW.index("Execution Engine"),
        )

    def test_each_layer_documents_modules_and_a_boundary(self):
        for layer in PLATFORM_LAYERS:
            with self.subTest(layer=layer["name"]):
                self.assertTrue(layer["modules"])
                self.assertTrue(layer["purpose"])
                self.assertTrue(layer["boundary"])


if __name__ == "__main__":
    unittest.main()
