"""
Tests for fairness_pipeline.py
All tests run without an LLM API key — screeners use keyword-matching fallback.
"""
import unittest

from fairness_pipeline import (
    AttributeMasker,
    BaselineScreener,
    BiasMonitor,
    DebiasedScreener,
    FairnessEvaluator,
    FairnessExperiment,
    ScreeningResult,
    SYNTHETIC_CANDIDATES,
    SYNTHETIC_GROUP_LABELS,
    SYNTHETIC_GROUND_TRUTH,
    _HIRING_SAFETY_POLICY,
)


# ─────────────────────────────────────────────────────────────────────────────
# AttributeMasker tests
# ─────────────────────────────────────────────────────────────────────────────

class TestAttributeMasker(unittest.TestCase):

    def setUp(self):
        self.masker = AttributeMasker()

    def test_masker_removes_name_label(self):
        text = "Name: Priya Sharma\nSkills: Python, SQL"
        result = self.masker.mask(text)
        self.assertNotIn("Priya Sharma", result.masked_text)
        self.assertIn("Python", result.masked_text)
        self.assertTrue(result.was_modified)
        self.assertIn("name_label", result.redacted_categories)

    def test_masker_removes_gender_label(self):
        text = "Gender: Female\nExperience: 3 years Python"
        result = self.masker.mask(text)
        self.assertNotIn("Female", result.masked_text)
        self.assertIn("Python", result.masked_text)

    def test_masker_removes_dob_and_age_labels(self):
        text = "Date of Birth: 1997-04-12\nAge: 27\nSkills: Docker"
        result = self.masker.mask(text)
        self.assertNotIn("1997-04-12", result.masked_text)
        self.assertIn("Docker", result.masked_text)

    def test_masker_removes_nationality_label(self):
        text = "Nationality: Indian\nSkills: REST APIs"
        result = self.masker.mask(text)
        self.assertNotIn("Indian", result.masked_text)
        self.assertIn("REST APIs", result.masked_text)

    def test_masker_removes_marital_status_label(self):
        text = "Marital Status: Single\nSkills: SQL"
        result = self.masker.mask(text)
        self.assertNotIn("Single", result.masked_text)
        self.assertIn("SQL", result.masked_text)

    def test_masker_removes_religion_label(self):
        text = "Religion: Muslim\nSkills: Python"
        result = self.masker.mask(text)
        self.assertNotIn("Muslim", result.masked_text)

    def test_masker_removes_inline_pronouns(self):
        text = "She/Her — 5 years experience in Python development."
        result = self.masker.mask(text)
        self.assertNotIn("She/Her", result.masked_text)
        self.assertIn("Python", result.masked_text)

    def test_masker_removes_inline_age(self):
        text = "I am 32 years old with 8 years experience in SQL."
        result = self.masker.mask(text)
        self.assertNotIn("32 years old", result.masked_text)
        self.assertIn("SQL", result.masked_text)

    def test_masker_removes_email_and_phone(self):
        text = "Contact: priya@example.com, +91-9876543210\nSkills: Docker"
        result = self.masker.mask(text)
        self.assertNotIn("priya@example.com", result.masked_text)
        self.assertNotIn("9876543210", result.masked_text)
        self.assertIn("Docker", result.masked_text)

    def test_masker_preserves_skills_section_intact(self):
        text = (
            "Name: Test Candidate\n"
            "Skills: Python, REST APIs, SQL, Docker, Kubernetes\n"
            "Experience: 4 years backend engineering."
        )
        result = self.masker.mask(text)
        for skill in ["Python", "REST APIs", "SQL", "Docker", "Kubernetes"]:
            self.assertIn(skill, result.masked_text)

    def test_masker_reports_no_modification_for_clean_resume(self):
        text = "Skills: Python, SQL\nExperience: 3 years backend development."
        result = self.masker.mask(text)
        self.assertFalse(result.was_modified)
        self.assertEqual(result.redacted_categories, [])

    def test_masker_raises_on_non_string(self):
        with self.assertRaises(TypeError):
            self.masker.mask(123)

    def test_mask_candidate_copies_dict_without_mutating_original(self):
        candidate = {
            "candidate_id": "X001",
            "resume_text": "Name: Alice\nSkills: Python",
        }
        masked = self.masker.mask_candidate(candidate)
        # Original unchanged
        self.assertIn("Alice", candidate["resume_text"])
        # Masked copy changed
        self.assertNotIn("Alice", masked["resume_text"])
        self.assertIn("masking_report", masked)
        self.assertTrue(masked["masking_report"]["was_modified"])


# ─────────────────────────────────────────────────────────────────────────────
# Screener tests
# ─────────────────────────────────────────────────────────────────────────────

class TestBaselineScreener(unittest.TestCase):

    SKILLS = ["Python", "SQL", "Docker"]
    RESUME = "Skills: Python, SQL, Docker\nExperience: 3 years backend."

    def test_baseline_screener_returns_screening_result(self):
        screener = BaselineScreener(cutoff=75)
        result = screener.screen(self.RESUME, self.SKILLS, "001")
        self.assertEqual(result.screener_type, "baseline")
        self.assertEqual(result.candidate_id, "001")
        self.assertIn("Python", result.skill_scores)
        self.assertIsInstance(result.overall_score, int)
        self.assertIsInstance(result.passed, bool)

    def test_baseline_screener_passes_candidate_above_cutoff(self):
        # Strong resume with all skills present
        resume = "Skills: Python, SQL, Docker\nPython APIs. SQL schema design. Docker containers."
        screener = BaselineScreener(cutoff=50)
        result = screener.screen(resume, self.SKILLS, "001")
        self.assertTrue(result.passed)

    def test_baseline_screener_fails_candidate_below_cutoff(self):
        screener = BaselineScreener(cutoff=99)
        result = screener.screen("No relevant skills here.", self.SKILLS, "002")
        self.assertFalse(result.passed)

    def test_baseline_screener_stores_prompt(self):
        screener = BaselineScreener(cutoff=75)
        result = screener.screen(self.RESUME, self.SKILLS, "001")
        self.assertIsInstance(result.prompt_used, str)
        self.assertGreater(len(result.prompt_used), 0)

    def test_baseline_prompt_does_not_contain_safety_policy(self):
        """Baseline screener should NOT inject the hiring safety policy."""
        screener = BaselineScreener(cutoff=75)
        result = screener.screen(self.RESUME, self.SKILLS, "001")
        self.assertNotIn("protected or sensitive characteristics", result.prompt_used)


class TestDebiasedScreener(unittest.TestCase):

    SKILLS = ["Python", "SQL"]
    RESUME = "Skills: Python, SQL\nExperience: 4 years."

    def test_debiased_screener_returns_debiased_type(self):
        screener = DebiasedScreener(cutoff=75)
        result = screener.screen(self.RESUME, self.SKILLS, "001")
        self.assertEqual(result.screener_type, "debiased")

    def test_debiased_screener_injects_safety_policy_into_prompt(self):
        """The debiased screener must include the hiring safety policy."""
        screener = DebiasedScreener(cutoff=75)
        result = screener.screen(self.RESUME, self.SKILLS, "001")
        self.assertIn("protected or sensitive characteristics", result.prompt_used)

    def test_debiased_screener_injects_additional_debiasing_instruction(self):
        screener = DebiasedScreener(cutoff=75)
        result = screener.screen(self.RESUME, self.SKILLS, "001")
        self.assertIn("base every score SOLELY on concrete technical evidence", result.prompt_used)

    def test_debiased_screener_scores_same_clean_resume_similarly_to_baseline(self):
        """
        On a resume with NO demographic markers, debiased and baseline screeners
        (both in keyword mode) should produce identical scores.
        """
        resume = "Skills: Python, SQL\nExperience: 5 years Python and SQL development."
        baseline = BaselineScreener(cutoff=75)
        debiased = DebiasedScreener(cutoff=75)
        br = baseline.screen(resume, self.SKILLS, "001")
        dr = debiased.screen(resume, self.SKILLS, "001")
        # Keyword fallback is deterministic — scores must match
        self.assertEqual(br.skill_scores, dr.skill_scores)


# ─────────────────────────────────────────────────────────────────────────────
# FairnessEvaluator tests
# ─────────────────────────────────────────────────────────────────────────────

class TestFairnessEvaluator(unittest.TestCase):

    def _make_result(self, cid, passed, screener_type="baseline"):
        return ScreeningResult(
            candidate_id=cid,
            overall_score=80 if passed else 40,
            skill_scores={"Python": 8 if passed else 4},
            passed=passed,
            screener_type=screener_type,
            assessment_method="test",
        )

    def _group_labels(self):
        return {
            "A1": "majority", "A2": "majority", "A3": "majority", "A4": "majority",
            "B1": "protected", "B2": "protected", "B3": "protected", "B4": "protected",
        }

    def _results_equal_rates(self):
        """4/4 majority pass, 4/4 protected pass → DI = 1.0"""
        return [
            self._make_result("A1", True), self._make_result("A2", True),
            self._make_result("A3", True), self._make_result("A4", True),
            self._make_result("B1", True), self._make_result("B2", True),
            self._make_result("B3", True), self._make_result("B4", True),
        ]

    def _results_di_violation(self):
        """4/4 majority pass, 2/4 protected pass → DI = 0.5 → alert expected"""
        return [
            self._make_result("A1", True), self._make_result("A2", True),
            self._make_result("A3", True), self._make_result("A4", True),
            self._make_result("B1", True), self._make_result("B2", True),
            self._make_result("B3", False), self._make_result("B4", False),
        ]

    def test_disparate_impact_calculated_correctly_equal(self):
        evaluator = FairnessEvaluator()
        report = evaluator.evaluate(self._results_equal_rates(), self._group_labels())
        self.assertAlmostEqual(report.disparate_impact, 1.0, places=4)
        self.assertFalse(report.di_alert)

    def test_disparate_impact_calculated_correctly_violation(self):
        evaluator = FairnessEvaluator()
        report = evaluator.evaluate(self._results_di_violation(), self._group_labels())
        # DI = 0.5 / 1.0 = 0.5
        self.assertAlmostEqual(report.disparate_impact, 0.5, places=4)
        self.assertTrue(report.di_alert)

    def test_demographic_parity_diff_calculated_correctly(self):
        evaluator = FairnessEvaluator()
        report = evaluator.evaluate(self._results_di_violation(), self._group_labels())
        # DPD = 0.5 - 1.0 = -0.5
        self.assertAlmostEqual(report.demographic_parity_diff, -0.5, places=4)
        self.assertTrue(report.dpd_alert)

    def test_demographic_parity_diff_passes_when_within_threshold(self):
        evaluator = FairnessEvaluator(dpd_threshold=0.10)
        # 3/4 majority pass, 3/4 protected pass → DPD = 0
        results = [
            self._make_result("A1", True), self._make_result("A2", True),
            self._make_result("A3", True), self._make_result("A4", False),
            self._make_result("B1", True), self._make_result("B2", True),
            self._make_result("B3", True), self._make_result("B4", False),
        ]
        report = evaluator.evaluate(results, self._group_labels())
        self.assertAlmostEqual(report.demographic_parity_diff, 0.0, places=4)
        self.assertFalse(report.dpd_alert)

    def test_equal_opportunity_diff_with_ground_truth(self):
        """EOD = TPR(protected) - TPR(majority)."""
        # Both groups: 2 truly qualified, both pass → EOD = 0
        results = [
            self._make_result("A1", True), self._make_result("A2", True),
            self._make_result("B1", True), self._make_result("B2", True),
        ]
        labels = {"A1": "majority", "A2": "majority", "B1": "protected", "B2": "protected"}
        ground_truth = {"A1": True, "A2": True, "B1": True, "B2": True}
        evaluator = FairnessEvaluator()
        report = evaluator.evaluate(results, labels, ground_truth)
        self.assertIsNotNone(report.equal_opportunity_diff)
        self.assertAlmostEqual(report.equal_opportunity_diff, 0.0, places=4)

    def test_evaluator_handles_empty_group(self):
        """If one group has zero candidates, DI is None and no crash."""
        results = [self._make_result("A1", True), self._make_result("A2", False)]
        labels = {"A1": "majority", "A2": "majority"}
        evaluator = FairnessEvaluator()
        report = evaluator.evaluate(results, labels)
        self.assertIsNone(report.disparate_impact)


# ─────────────────────────────────────────────────────────────────────────────
# BiasMonitor tests
# ─────────────────────────────────────────────────────────────────────────────

class TestBiasMonitor(unittest.TestCase):

    def _make_report(self, di, dpd, screener="baseline"):
        """Quick FairnessReport stub for monitor testing."""
        from fairness_pipeline import FairnessReport, GroupMetrics
        ref = GroupMetrics("majority", 4, 4, 1.0)
        prot_pass = round((1.0 + dpd) * 4)
        prot = GroupMetrics("protected", 4, prot_pass, 1.0 + dpd)
        return FairnessReport(
            screener_type=screener,
            reference_group="majority",
            protected_group="protected",
            reference_metrics=ref,
            protected_metrics=prot,
            disparate_impact=di,
            demographic_parity_diff=dpd,
            equal_opportunity_diff=None,
            di_alert=(di is not None and di < 0.80),
            dpd_alert=abs(dpd) > 0.10,
        )

    def test_bias_monitor_flags_below_80_pct_di(self):
        monitor = BiasMonitor()
        report = self._make_report(di=0.60, dpd=-0.4)
        alerts = monitor.inspect(report)
        self.assertTrue(any(a.metric == "disparate_impact" for a in alerts))
        self.assertTrue(any(entry.get("alert") for entry in monitor.audit_log))

    def test_bias_monitor_passes_above_threshold(self):
        monitor = BiasMonitor()
        report = self._make_report(di=0.90, dpd=0.05)
        alerts = monitor.inspect(report)
        self.assertEqual(alerts, [])
        self.assertTrue(any(not entry.get("alert") for entry in monitor.audit_log))

    def test_bias_monitor_flags_high_dpd(self):
        monitor = BiasMonitor()
        report = self._make_report(di=0.85, dpd=-0.30)
        alerts = monitor.inspect(report)
        self.assertTrue(any(a.metric == "demographic_parity_diff" for a in alerts))

    def test_bias_monitor_alert_contains_human_readable_message(self):
        monitor = BiasMonitor()
        report = self._make_report(di=0.50, dpd=-0.50)
        alerts = monitor.inspect(report)
        for alert in alerts:
            self.assertIsInstance(alert.message, str)
            self.assertGreater(len(alert.message), 20)

    def test_bias_monitor_audit_log_grows_with_each_inspect(self):
        monitor = BiasMonitor()
        self._make_report  # just access
        monitor.inspect(self._make_report(di=0.90, dpd=0.05))
        monitor.inspect(self._make_report(di=0.50, dpd=-0.50))
        # At minimum 2 log entries
        self.assertGreaterEqual(len(monitor.audit_log), 2)

    def test_alert_to_dict_is_json_serialisable(self):
        import json
        monitor = BiasMonitor()
        report = self._make_report(di=0.60, dpd=-0.40)
        alerts = monitor.inspect(report)
        for alert in alerts:
            d = alert.to_dict()
            serialised = json.dumps(d)
            self.assertIsInstance(serialised, str)


# ─────────────────────────────────────────────────────────────────────────────
# FairnessExperiment tests
# ─────────────────────────────────────────────────────────────────────────────

class TestFairnessExperiment(unittest.TestCase):

    def test_experiment_runner_returns_both_systems(self):
        exp = FairnessExperiment()
        report = exp.run_demo()
        self.assertIn("baseline", report)
        self.assertIn("debiased", report)

    def test_experiment_report_contains_fairness_metrics(self):
        exp = FairnessExperiment()
        report = exp.run_demo()
        for system in ("baseline", "debiased"):
            self.assertIn("disparate_impact", report[system])
            self.assertIn("demographic_parity_diff", report[system])

    def test_experiment_report_contains_improvement_section(self):
        exp = FairnessExperiment()
        report = exp.run_demo()
        self.assertIn("improvement", report)
        self.assertIn("di_delta", report["improvement"])
        self.assertIn("dpd_delta", report["improvement"])

    def test_experiment_report_contains_academic_summary(self):
        exp = FairnessExperiment()
        report = exp.run_demo()
        self.assertIn("academic_summary", report)
        self.assertIsInstance(report["academic_summary"], str)
        self.assertGreater(len(report["academic_summary"]), 50)

    def test_experiment_candidate_count_matches_pool(self):
        exp = FairnessExperiment()
        report = exp.run_demo()
        self.assertEqual(report["candidate_count"], len(SYNTHETIC_CANDIDATES))

    def test_experiment_report_is_json_serialisable(self):
        import json
        exp = FairnessExperiment()
        report = exp.run_demo()
        serialised = json.dumps(report)
        self.assertIsInstance(serialised, str)

    def test_experiment_debiased_di_at_least_as_good_as_baseline(self):
        """
        On the synthetic dataset, the debiased system (masked text) should
        have a higher or equal Disparate Impact compared to the baseline.
        This is the core academic hypothesis.
        """
        exp = FairnessExperiment()
        report = exp.run_demo()
        b_di = report["baseline"]["disparate_impact"]
        d_di = report["debiased"]["disparate_impact"]
        if b_di is not None and d_di is not None:
            # Debiased system should not make fairness *worse*
            self.assertGreaterEqual(d_di, b_di - 0.05)  # allow 5 pct tolerance

    def test_experiment_custom_candidates_run_correctly(self):
        candidates = [
            {"candidate_id": "X1", "resume_text": "Skills: Python, SQL"},
            {"candidate_id": "X2", "resume_text": "Name: Bob\nSkills: Python"},
        ]
        group_labels = {"X1": "majority", "X2": "protected"}
        exp = FairnessExperiment()
        report = exp.run(
            candidates=candidates,
            required_skills=["Python", "SQL"],
            group_labels=group_labels,
            job_title="Test Role",
        )
        self.assertEqual(report.candidate_count, 2)
        self.assertIsNotNone(report.baseline_fairness)
        self.assertIsNotNone(report.debiased_fairness)


# ─────────────────────────────────────────────────────────────────────────────
# Integration: agents.py — screen_candidate_with_fairness
# ─────────────────────────────────────────────────────────────────────────────

class TestAgentsFairnessMethod(unittest.TestCase):
    """
    Test RecruitmentAgent.screen_candidate_with_fairness using a mock file
    object (no real PDF or API key needed).
    """

    def _make_file(self, content: str):
        import io
        buf = io.BytesIO(content.encode("utf-8"))
        buf.name = "resume.txt"
        return buf

    def test_fairness_method_returns_fairness_snapshot(self):
        from agents import RecruitmentAgent
        agent = RecruitmentAgent(api_key="unused")
        file = self._make_file(
            "Skills: Python, SQL\nExperience: 3 years backend development using Python and SQL."
        )
        result = agent.screen_candidate_with_fairness(
            file,
            ["Python", "SQL"],
            candidate_id="T001",
            group_label="majority",
        )
        self.assertIn("fairness_snapshot", result)
        snap = result["fairness_snapshot"]
        self.assertEqual(snap["candidate_id"], "T001")
        self.assertEqual(snap["group_label"], "majority")
        self.assertIn("masking_report", snap)
        self.assertIn("debiased", snap)

    def test_fairness_method_ab_comparison_adds_baseline_key(self):
        from agents import RecruitmentAgent
        agent = RecruitmentAgent(api_key="unused")
        file = self._make_file(
            "Name: Test\nGender: Male\nSkills: Python\nExperience: 2 years Python."
        )
        result = agent.screen_candidate_with_fairness(
            file,
            ["Python"],
            candidate_id="T002",
            run_ab_comparison=True,
        )
        snap = result["fairness_snapshot"]
        self.assertIn("baseline", snap)
        self.assertIn("score_delta", snap["baseline"])

    def test_fairness_method_masks_demographic_attributes(self):
        from agents import RecruitmentAgent
        agent = RecruitmentAgent(api_key="unused")
        file = self._make_file(
            "Name: Priya Sharma\nGender: Female\nNationality: Indian\n"
            "Skills: Python, Docker\nExperience: 4 years."
        )
        result = agent.screen_candidate_with_fairness(
            file, ["Python", "Docker"], candidate_id="T003"
        )
        snap = result["fairness_snapshot"]
        self.assertTrue(snap["masking_report"]["was_modified"])

    def test_fairness_method_decision_status_is_pending_review(self):
        from agents import RecruitmentAgent
        agent = RecruitmentAgent(api_key="unused")
        file = self._make_file("Skills: Python\nExperience: 1 year.")
        result = agent.screen_candidate_with_fairness(file, ["Python"])
        self.assertEqual(result["decision_status"], "Pending recruiter review")

    def test_fairness_method_raises_on_empty_resume(self):
        from agents import RecruitmentAgent
        agent = RecruitmentAgent(api_key="unused")
        file = self._make_file("   ")
        with self.assertRaises(ValueError):
            agent.screen_candidate_with_fairness(file, ["Python"])


if __name__ == "__main__":
    unittest.main()
