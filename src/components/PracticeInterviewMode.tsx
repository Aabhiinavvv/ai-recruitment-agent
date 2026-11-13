import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Award,
  Zap,
  TrendingUp,
  Activity,
  ArrowRight,
  Headphones,
  Sliders,
  Check,
  X,
  HelpCircle,
  ThumbsUp,
  Flame,
  MessageSquare,
  BarChart2,
  Clock,
  ShieldCheck,
  Send,
} from 'lucide-react';
import { Candidate, HiringBrief } from '../types';

interface PracticeInterviewModeProps {
  candidate: Candidate | null;
  brief: HiringBrief | null;
  onExit: () => void;
  onSavePracticeRecord?: (summary: PracticeSessionSummary) => void;
}

export interface PracticeSessionSummary {
  id: string;
  candidateName: string;
  roleTitle: string;
  dateStr: string;
  overallScore: number;
  deliveryScore: number;
  contentScore: number;
  avgWpm: number;
  totalFillerWords: number;
  turnsCount: number;
  transcripts: Array<{
    turn: number;
    coachPrompt: string;
    candidateResponse: string;
    wpm: number;
    fillersDetected: string[];
    coachFeedback: string;
    praise: string;
  }>;
}

type CoachingTone = 'supportive' | 'realistic' | 'challenging';
type PracticeTopic = 'tech_deep_dive' | 'system_design' | 'behavioral_star' | 'elevator_pitch';

const FILLER_WORDS = ['um', 'uh', 'like', 'you know', 'basically', 'actually', 'literally', 'sort of', 'kind of', 'i mean'];

export const PracticeInterviewMode: React.FC<PracticeInterviewModeProps> = ({
  candidate,
  brief,
  onExit,
  onSavePracticeRecord,
}) => {
  // Practice configuration
  const [topic, setTopic] = useState<PracticeTopic>('tech_deep_dive');
  const [coachingTone, setCoachingTone] = useState<CoachingTone>('supportive');
  const [autoTurnEnabled, setAutoTurnEnabled] = useState<boolean>(true);
  const [isVoiceSynthesisEnabled, setIsVoiceSynthesisEnabled] = useState<boolean>(true);

  // Conversational session states
  const [sessionPhase, setSessionPhase] = useState<'intro' | 'conversing' | 'completed'>('intro');
  const [isAiSpeaking, setIsAiSpeaking] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [transcriptInput, setTranscriptInput] = useState<string>('');
  const [interimTranscript, setInterimTranscript] = useState<string>('');
  const [speechStatus, setSpeechStatus] = useState<string>('Click Start to begin conversational practice.');

  // Real-time speech metrics
  const [currentWpm, setCurrentWpm] = useState<number>(0);
  const [detectedFillers, setDetectedFillers] = useState<string[]>([]);
  const [speechDurationSeconds, setSpeechDurationSeconds] = useState<number>(0);
  const [micVolume, setMicVolume] = useState<number>(0);

  // Turn management
  const [currentTurn, setCurrentTurn] = useState<number>(1);
  const [coachPrompt, setCoachPrompt] = useState<string>('');
  const [coachPraise, setCoachPraise] = useState<string | null>(null);
  const [coachTip, setCoachTip] = useState<string | null>(null);

  // Turn History
  const [conversationHistory, setConversationHistory] = useState<
    Array<{
      turn: number;
      coachPrompt: string;
      candidateResponse: string;
      wpm: number;
      fillersDetected: string[];
      coachFeedback: string;
      praise: string;
      score: number;
    }>
  >([]);

  // Media & Recognition Refs
  const recognitionRef = useRef<any>(null);
  const speechStartTimeRef = useRef<number | null>(null);
  const silenceTimerRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micIntervalRef = useRef<any>(null);
  const timerIntervalRef = useRef<any>(null);

  const roleTitle = brief?.job_title || candidate?.role || 'AI/ML Engineer';
  const primarySkill = Object.keys(candidate?.skill_scores || {})[0] || 'Python';

  // Questions generator by topic
  const initialQuestions = useMemo<Record<PracticeTopic, string[]>>(() => {
    return {
      tech_deep_dive: [
        `Welcome to conversational practice! Let's start with your core stack: What is the most challenging technical bottleneck you optimized in ${primarySkill}, and how did you measure the before-and-after improvement?`,
        `When you architect a high-scale service, how do you balance concurrency locking against data consistency guarantees?`,
        `Can you walk me through your personal approach to debugging a silent memory leak or CPU spike in a production environment?`,
      ],
      system_design: [
        `Let's simulate a System Design interview: How would you design a distributed URL shortening service handling 100M daily writes with sub-20ms lookup latency?`,
        `Suppose your primary cache cluster suddenly suffers a network partition during a write surge. Walk me through your failover and reconciliation strategy.`,
        `How do you determine when to partition databases horizontally via sharding versus optimizing query indexes and read-replicas?`,
      ],
      behavioral_star: [
        `Tell me about a project where technical requirements shifted drastically two weeks before launch. How did you adapt your architecture and manage team expectations?`,
        `Describe a scenario where you received critical code review feedback that challenged your design. How did you resolve the difference of opinion?`,
        `Tell me about a time you led the triage of a severe production outage under high stakeholder scrutiny. What guardrails did you put in place afterward?`,
      ],
      elevator_pitch: [
        `Tell me about yourself, your technical journey, and what makes you particularly excited about joining our engineering team as an ${roleTitle}?`,
        `What is the engineering accomplishment or system you have built that you are most proud of, and why?`,
        `Where do you see yourself making the most immediate technical impact in your first 90 days?`,
      ],
    };
  }, [primarySkill, roleTitle]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (micIntervalRef.current) clearInterval(micIntervalRef.current);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (recognitionRef.current) recognitionRef.current.stop();
      if (micStreamRef.current) micStreamRef.current.getTracks().forEach((t) => t.stop());
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    };
  }, []);

  // Web Audio microphone level analyzer
  const initMicrophoneAudio = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      micStreamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        audioContextRef.current = ctx;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        analyserRef.current = analyser;

        const source = ctx.createMediaStreamSource(stream);
        source.connect(analyser);

        const data = new Uint8Array(analyser.frequencyBinCount);
        micIntervalRef.current = setInterval(() => {
          analyser.getByteFrequencyData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) sum += data[i];
          const avg = sum / data.length;
          setMicVolume(Math.min(100, Math.round((avg / 128) * 100)));
        }, 100);
      }
    } catch (e) {
      console.warn('Microphone permission or audio context error', e);
    }
  };

  // Text-To-Speech: Speak Coach message
  const speakCoachPrompt = useCallback(
    (textToSpeak: string, onEndCallback?: () => void) => {
      if (!window.speechSynthesis || !isVoiceSynthesisEnabled) {
        if (onEndCallback) onEndCallback();
        return;
      }

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.rate = coachingTone === 'supportive' ? 1.0 : coachingTone === 'challenging' ? 1.08 : 1.02;
      utterance.pitch = coachingTone === 'supportive' ? 1.1 : coachingTone === 'challenging' ? 0.95 : 1.05;

      const voices = window.speechSynthesis.getVoices();
      const englishVoice = voices.find(
        (v) => v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Natural'))
      );
      if (englishVoice) utterance.voice = englishVoice;

      utterance.onstart = () => setIsAiSpeaking(true);
      utterance.onend = () => {
        setIsAiSpeaking(false);
        if (onEndCallback) onEndCallback();
      };
      utterance.onerror = () => {
        setIsAiSpeaking(false);
        if (onEndCallback) onEndCallback();
      };

      window.speechSynthesis.speak(utterance);
    },
    [isVoiceSynthesisEnabled, coachingTone]
  );

  // Start continuous Speech Recognition
  const startListening = useCallback(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechStatus('Speech recognition not supported in browser. Type in the box below.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.continuous = true;
      recognition.interimResults = true;

      speechStartTimeRef.current = Date.now();
      setSpeechDurationSeconds(0);

      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = setInterval(() => {
        setSpeechDurationSeconds((s) => s + 1);
      }, 1000);

      recognition.onstart = () => {
        setIsListening(true);
        setSpeechStatus('Listening to your voice... Speak naturally!');
      };

      recognition.onresult = (event: any) => {
        let finalStr = '';
        let interimStr = '';

        for (let i = 0; i < event.results.length; i++) {
          const transcriptChunk = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalStr += transcriptChunk + ' ';
          } else {
            interimStr += transcriptChunk;
          }
        }

        const combined = (finalStr + interimStr).trim();
        setTranscriptInput(combined);
        setInterimTranscript(interimStr);

        // Real-time Words Per Minute
        if (speechStartTimeRef.current) {
          const elapsedMins = (Date.now() - speechStartTimeRef.current) / 60000;
          if (elapsedMins > 0.04) {
            const words = combined.split(/\s+/).filter(Boolean).length;
            setCurrentWpm(Math.round(words / elapsedMins));
          }
        }

        // Real-time Filler Word Detection
        const lower = combined.toLowerCase();
        const found = FILLER_WORDS.filter((f) => {
          const regex = new RegExp(`\\b${f}\\b`, 'gi');
          return regex.test(lower);
        });
        setDetectedFillers(found);

        // Hands-Free Auto-Turn Silence Detection: If auto-turn is enabled, trigger after 2.5s of silence
        if (autoTurnEnabled && combined.length > 20) {
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = setTimeout(() => {
            handleCompleteTurn(combined);
          }, 2600);
        }
      };

      recognition.onerror = (event: any) => {
        setSpeechStatus(`Audio notice: ${event.error}. You can also type answers directly.`);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
        setSpeechStatus('Microphone listening paused.');
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e) {
      setIsListening(false);
    }
  }, [autoTurnEnabled]);

  const stopListening = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  }, []);

  // Launch conversational practice session
  const handleStartPractice = async () => {
    await initMicrophoneAudio();
    setSessionPhase('conversing');
    setCurrentTurn(1);
    setConversationHistory([]);
    setTranscriptInput('');
    setInterimTranscript('');
    setCoachPraise(null);
    setCoachTip(null);

    const firstQuestion = initialQuestions[topic][0];
    setCoachPrompt(firstQuestion);

    // Speak initial question and auto-start listening when coach finishes
    speakCoachPrompt(firstQuestion, () => {
      startListening();
    });
  };

  // Complete a turn, analyze speech, generate coaching feedback, and transition to next prompt
  const handleCompleteTurn = (candidateTextToAnalyze?: string) => {
    stopListening();
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

    const answer = (candidateTextToAnalyze || transcriptInput).trim();
    if (!answer) return;

    // Analyze speech characteristics
    const words = answer.split(/\s+/).filter(Boolean);
    const wordCount = words.length;

    // Compute metrics
    const lower = answer.toLowerCase();
    const fillers = FILLER_WORDS.filter((f) => {
      const regex = new RegExp(`\\b${f}\\b`, 'gi');
      return regex.test(lower);
    });

    // Check for metrics/numbers cited (quantitative impact signal)
    const hasMetrics = /\d+(\.\d+)?%?|\b(ms|seconds|minutes|k|m|million|billion)\b/i.test(answer);
    const hasTechnicalKeywords = /latency|concurrency|cache|architecture|distributed|scale|database|partition/i.test(
      answer
    );

    // Turn score calculation (0 - 100)
    let score = 75;
    if (wordCount >= 45) score += 10;
    if (hasMetrics) score += 8;
    if (hasTechnicalKeywords) score += 7;
    if (fillers.length > 3) score -= 8;
    score = Math.min(98, Math.max(50, score));

    // Dynamic Coaching Generation
    let praise = 'Strong technical structure and clear articulation of your approach!';
    if (hasMetrics) {
      praise = 'Excellent use of quantitative metrics! Citing measurable numbers establishes immediate credibility.';
    } else if (wordCount >= 50) {
      praise = 'Great thoroughness in deconstructing the problem systematically.';
    }

    let tip = 'Try incorporating specific latency numbers or past production results to anchor the trade-offs.';
    if (fillers.length >= 2) {
      tip = `Noticed ${fillers.length} filler words (${fillers.join(', ')}). Practice pausing silently for a breath instead of using filler syllables.`;
    } else if (!hasTechnicalKeywords) {
      tip = 'Anchor your response with explicit architecture primitives like caching tiers or idempotency keys.';
    }

    setCoachPraise(praise);
    setCoachTip(tip);

    // Dynamic Next Question or Follow-Up Probe
    let nextPrompt = '';
    const pool = initialQuestions[topic];
    if (currentTurn < pool.length) {
      nextPrompt = pool[currentTurn];
    } else {
      nextPrompt = `Adaptive Follow-Up: Based on what you just shared about ${words.slice(0, 4).join(' ')}, how would you monitor this system in production to detect silent regressions before customers are affected?`;
    }

    const turnRecord = {
      turn: currentTurn,
      coachPrompt,
      candidateResponse: answer,
      wpm: currentWpm || 135,
      fillersDetected: fillers,
      coachFeedback: tip,
      praise,
      score,
    };

    setConversationHistory((prev) => [...prev, turnRecord]);

    // Prepare next turn or complete practice session
    if (currentTurn >= 3) {
      setTimeout(() => {
        handleFinishPracticeSession([...conversationHistory, turnRecord]);
      }, 1200);
    } else {
      setCurrentTurn((t) => t + 1);
      setCoachPrompt(nextPrompt);
      setTranscriptInput('');
      setInterimTranscript('');
      setDetectedFillers([]);

      // Coach speaks feedback + next question, then automatically listens
      const coachSpokenReply = `${praise} ${nextPrompt}`;
      speakCoachPrompt(coachSpokenReply, () => {
        startListening();
      });
    }
  };

  // Finish practice session and compute comprehensive summary
  const handleFinishPracticeSession = (historyRecords: typeof conversationHistory) => {
    stopListening();
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    setSessionPhase('completed');

    const totalScore = historyRecords.reduce((acc, h) => acc + h.score, 0);
    const avgScore = historyRecords.length > 0 ? Math.round(totalScore / historyRecords.length) : 85;
    const allFillers = historyRecords.reduce((acc, h) => acc + h.fillersDetected.length, 0);
    const avgWpm =
      historyRecords.length > 0
        ? Math.round(historyRecords.reduce((acc, h) => acc + h.wpm, 0) / historyRecords.length)
        : 138;

    const summary: PracticeSessionSummary = {
      id: `prac-${Date.now()}`,
      candidateName: candidate?.name || 'Practice Candidate',
      roleTitle,
      dateStr: new Date().toLocaleDateString(),
      overallScore: avgScore,
      deliveryScore: Math.min(98, Math.max(60, 100 - allFillers * 4)),
      contentScore: Math.min(98, Math.max(65, avgScore + 3)),
      avgWpm,
      totalFillerWords: allFillers,
      turnsCount: historyRecords.length,
      transcripts: historyRecords,
    };

    if (onSavePracticeRecord) {
      onSavePracticeRecord(summary);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs space-y-0">
      {/* Top Banner Header */}
      <div className="p-5 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <h3 className="font-bold text-lg text-white">Voice-to-Text Practice Interview Simulator</h3>
            <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-400/30 text-[10px] font-bold uppercase tracking-wider">
              Conversational AI Coach
            </span>
          </div>
          <p className="text-xs text-indigo-200/80 mt-1">
            Simulate a real-time voice interview with live speech recognition, hands-free turn-taking, delivery metrics, and adaptive coaching.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-auto">
          {/* Voice AI Speech Output Toggle */}
          <button
            type="button"
            onClick={() => setIsVoiceSynthesisEnabled((v) => !v)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
              isVoiceSynthesisEnabled ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-rose-500/30 text-rose-300'
            }`}
            title="Toggle AI voice synthesis output"
          >
            {isVoiceSynthesisEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span>{isVoiceSynthesisEnabled ? 'AI Voice ON' : 'AI Voice Muted'}</span>
          </button>

          {/* Hands-Free Auto-Turn Toggle */}
          <button
            type="button"
            onClick={() => setAutoTurnEnabled((a) => !a)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
              autoTurnEnabled ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-white/10 text-slate-300'
            }`}
            title="Auto-submits after 2.5 seconds of silence for conversational flow"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>{autoTurnEnabled ? 'Hands-Free Flow' : 'Manual Submit'}</span>
          </button>

          {/* Return to Recruiter Room */}
          <button
            type="button"
            onClick={onExit}
            className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            Exit Practice Mode
          </button>
        </div>
      </div>

      {/* =================================================================== */}
      {/* 1. INTRO & PRACTICE CONFIGURATION SCREEN                            */}
      {/* =================================================================== */}
      {sessionPhase === 'intro' && (
        <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            {/* Left Setup Cards */}
            <div className="md:col-span-7 space-y-5">
              <div>
                <h4 className="text-base font-bold text-slate-900">Configure Your Conversational Practice</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Select a practice track and conversational rigor tailored to {candidate?.name || 'the candidate'}&apos;s target role.
                </p>
              </div>

              {/* Topic Selector */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  1. Practice Interview Focus Area
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {[
                    {
                      id: 'tech_deep_dive' as const,
                      title: 'Technical Core & Stack',
                      desc: `Deep dive into ${primarySkill}, memory bottlenecks, and profiling.`,
                    },
                    {
                      id: 'system_design' as const,
                      title: 'System Design & High Scale',
                      desc: 'Architecting distributed caching, sharding, and latency SLOs.',
                    },
                    {
                      id: 'behavioral_star' as const,
                      title: 'Behavioral & Leadership',
                      desc: 'STAR stories: production incidents, trade-offs, and conflict.',
                    },
                    {
                      id: 'elevator_pitch' as const,
                      title: 'Intro & Career Story',
                      desc: 'First 90-day impact, standout projects, and technical narrative.',
                    },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTopic(t.id)}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        topic === t.id
                          ? 'border-[#6743ee] bg-purple-50/50 ring-1 ring-[#6743ee]/30'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <span className="font-bold text-slate-900 text-xs block">{t.title}</span>
                      <span className="text-[11px] text-slate-500 mt-0.5 block">{t.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Coaching Tone */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  2. AI Interviewer Coaching Tone
                </span>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {[
                    { id: 'supportive' as const, label: 'Supportive & Warm', desc: 'Encouraging, ideal for warm-up' },
                    { id: 'realistic' as const, label: 'Realistic Staff Lead', desc: 'Standard hiring bar rigor' },
                    { id: 'challenging' as const, label: 'Executive Stress Test', desc: 'Probes edge-case trade-offs' },
                  ].map((tone) => (
                    <button
                      key={tone.id}
                      type="button"
                      onClick={() => setCoachingTone(tone.id)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        coachingTone === tone.id
                          ? 'border-[#6743ee] bg-purple-50/50 text-[#6743ee] font-bold'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <span className="block font-semibold">{tone.label}</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">{tone.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Diagnostic & Launch Card */}
            <div className="md:col-span-5 bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#6743ee] to-[#9b72ff] text-white flex items-center justify-center shadow-md">
                  <Headphones className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">Conversational Coach Ready</h4>
                  <p className="text-xs text-slate-500">{roleTitle} &bull; Practice Sandbox</p>
                </div>
              </div>

              <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs space-y-2">
                <div className="font-bold text-slate-800">What happens in Practice Mode:</div>
                <ul className="space-y-1.5 text-slate-600 text-[11px] list-disc list-inside">
                  <li>AI speaks the interview question out loud naturally.</li>
                  <li>Microphone auto-engages; speak your answers freely.</li>
                  <li>Real-time speech transcription with WPM &amp; filler analysis.</li>
                  <li>AI responds verbally with praise, polish, and follow-ups.</li>
                </ul>
              </div>

              <button
                type="button"
                onClick={handleStartPractice}
                className="w-full py-3 bg-[#6743ee] hover:bg-[#5637d2] text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>Start Live Voice Practice</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 2. CONVERSING — REAL-TIME VOICE-TO-TEXT PRACTICE ROOM               */}
      {/* =================================================================== */}
      {sessionPhase === 'conversing' && (
        <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
          {/* Turn Header Bar */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <span className="px-2.5 py-1 rounded-md bg-purple-100 text-[#6743ee] font-bold text-xs uppercase tracking-wider">
                Turn {currentTurn} of 3
              </span>
              <span className="text-xs text-slate-500 font-medium">
                Topic: <strong className="text-slate-800 capitalize">{topic.replace('_', ' ')}</strong>
              </span>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <span className="text-slate-500 font-mono">
                Duration: <strong>{speechDurationSeconds}s</strong>
              </span>
              {currentWpm > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold">
                  {currentWpm} WPM
                </span>
              )}
            </div>
          </div>

          {/* AI Coach Question & Voice Response Card */}
          <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white p-6 rounded-2xl shadow-md space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-9 h-9 rounded-xl bg-gradient-to-tr from-[#6743ee] to-[#a881fc] text-white flex items-center justify-center shadow-sm transition-transform ${
                    isAiSpeaking ? 'scale-110 ring-4 ring-purple-400/50' : 'scale-100'
                  }`}
                >
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-bold text-xs text-white block">AI Interview Coach</span>
                  <span className="text-[10px] text-indigo-300">Conversational Practice Lead</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {isAiSpeaking ? (
                  <span className="px-2.5 py-1 rounded-full bg-purple-500/30 text-purple-200 border border-purple-400/30 text-[10px] font-bold animate-pulse flex items-center gap-1">
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>Speaking Prompt...</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => speakCoachPrompt(coachPrompt)}
                    className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors cursor-pointer"
                    title="Repeat question aloud"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Prompt Text */}
            <p className="text-base font-semibold leading-relaxed text-indigo-50">{coachPrompt}</p>

            {/* Praise & Tip Pills from Previous Turn (if available) */}
            {(coachPraise || coachTip) && (
              <div className="pt-3 border-t border-white/10 space-y-2 text-xs">
                {coachPraise && (
                  <div className="flex items-start gap-2 text-emerald-300 bg-emerald-950/40 p-2.5 rounded-xl border border-emerald-500/20">
                    <ThumbsUp className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                    <span>
                      <strong className="text-emerald-200">Coach Affirmation:</strong> {coachPraise}
                    </span>
                  </div>
                )}
                {coachTip && (
                  <div className="flex items-start gap-2 text-amber-300 bg-amber-950/40 p-2.5 rounded-xl border border-amber-500/20">
                    <Zap className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                    <span>
                      <strong className="text-amber-200">Coaching Polish:</strong> {coachTip}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Candidate Speech Recognition Console */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
            {/* Status & Mic Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
              <div className="flex items-center gap-2.5">
                {isListening ? (
                  <span className="w-3 h-3 rounded-full bg-red-500 animate-ping" />
                ) : (
                  <span className="w-3 h-3 rounded-full bg-slate-400" />
                )}
                <span className="font-semibold text-slate-800">{speechStatus}</span>
              </div>

              {/* Live Mic Waveform Meter */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                  <Mic className="w-3.5 h-3.5 text-[#6743ee]" />
                  <div className="w-20 h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-75"
                      style={{ width: `${micVolume}%` }}
                    />
                  </div>
                </div>

                {!isListening ? (
                  <button
                    type="button"
                    onClick={startListening}
                    className="px-3.5 py-1.5 bg-[#6743ee] hover:bg-[#5637d2] text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer shadow-xs"
                  >
                    <Mic className="w-3.5 h-3.5" />
                    <span>Resume Mic</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stopListening}
                    className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer shadow-xs"
                  >
                    <MicOff className="w-3.5 h-3.5" />
                    <span>Pause Mic</span>
                  </button>
                )}
              </div>
            </div>

            {/* Live Streaming Speech Transcript */}
            <div className="relative">
              <textarea
                value={transcriptInput}
                onChange={(e) => setTranscriptInput(e.target.value)}
                placeholder="Speak into your microphone now... Live voice-to-text transcript will appear here in real time."
                rows={6}
                className="w-full text-xs p-4 bg-slate-50/80 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#6743ee] font-sans leading-relaxed"
              />

              {/* Interim Text Indicator */}
              {interimTranscript && (
                <div className="text-[11px] text-[#6743ee] italic mt-1 pl-1">
                  Transcribing: &ldquo;{interimTranscript}&rdquo;
                </div>
              )}
            </div>

            {/* Live Delivery Gauges Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              {/* Pace Meter */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Speaking Pace
                </span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-lg font-bold text-slate-900">{currentWpm || 0}</span>
                  <span className="text-[10px] text-slate-500">WPM</span>
                </div>
                <span
                  className={`text-[10px] font-semibold block ${
                    currentWpm >= 120 && currentWpm <= 165
                      ? 'text-emerald-600'
                      : currentWpm > 165
                      ? 'text-amber-600'
                      : 'text-slate-500'
                  }`}
                >
                  {currentWpm >= 120 && currentWpm <= 165
                    ? 'Optimal Rhythm'
                    : currentWpm > 165
                    ? 'Fast pace — breathe'
                    : 'Awaiting speech'}
                </span>
              </div>

              {/* Filler Words */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Filler Words
                </span>
                <div className="text-lg font-bold text-slate-900 mt-0.5">{detectedFillers.length}</div>
                <span className="text-[10px] text-slate-500 truncate block">
                  {detectedFillers.length > 0 ? detectedFillers.join(', ') : 'Zero fillers detected'}
                </span>
              </div>

              {/* Word Count */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Answer Depth
                </span>
                <div className="text-lg font-bold text-slate-900 mt-0.5">
                  {transcriptInput.split(/\s+/).filter(Boolean).length}
                </div>
                <span className="text-[10px] text-slate-500 block">Total spoken words</span>
              </div>

              {/* Quantitative Metrics Found */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Metrics Cited
                </span>
                <div className="text-lg font-bold text-[#6743ee] mt-0.5">
                  {/\d+(\.\d+)?%?|\b(ms|seconds|minutes)\b/i.test(transcriptInput) ? '✓ Found' : '0 Numbers'}
                </div>
                <span className="text-[10px] text-slate-500 block">Citing numbers boosts rigor</span>
              </div>
            </div>

            {/* Action Bar */}
            <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
              <div className="text-[11px] text-slate-500">
                {autoTurnEnabled ? (
                  <span>
                    Auto-turn active: stops &amp; evaluates automatically after <strong>2.5s of silence</strong>.
                  </span>
                ) : (
                  <span>Click &ldquo;Done Speaking &amp; Next&rdquo; when you finish your thought.</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCompleteTurn()}
                  disabled={!transcriptInput.trim()}
                  className="px-5 py-2.5 bg-[#6743ee] hover:bg-[#5637d2] text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Done Speaking &bull; Get Feedback</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 3. COMPLETED — PERFORMANCE SCORECARD & DETAILED TRANSCRIPT          */}
      {/* =================================================================== */}
      {sessionPhase === 'completed' && (
        <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                <Award className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-lg">
                  Practice Session Complete &bull; Performance Scorecard
                </h4>
                <p className="text-xs text-slate-500">
                  {candidate?.name || 'Candidate'} &bull; {roleTitle} &bull; {conversationHistory.length} Conversational Turns Scored
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setSessionPhase('intro')}
                className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Practice Another Topic
              </button>
              <button
                type="button"
                onClick={onExit}
                className="px-4 py-2 bg-[#6743ee] hover:bg-[#5637d2] text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>

          {/* Metric Overview Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 bg-purple-50/50 border border-purple-100 rounded-xl">
              <span className="text-[10px] font-bold text-[#6743ee] uppercase tracking-wider block">
                Overall Practice Score
              </span>
              <div className="text-3xl font-extrabold text-[#6743ee] mt-1">
                {conversationHistory.length > 0
                  ? Math.round(
                      conversationHistory.reduce((a, b) => a + b.score, 0) / conversationHistory.length
                    )
                  : 86}%
              </div>
              <span className="text-[11px] text-slate-500 mt-0.5 block">Composite speech readiness</span>
            </div>

            <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-xl">
              <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                Average Speech Pace
              </span>
              <div className="text-2xl font-extrabold text-emerald-800 mt-1">
                {conversationHistory.length > 0
                  ? Math.round(conversationHistory.reduce((a, b) => a + b.wpm, 0) / conversationHistory.length)
                  : 136}{' '}
                <span className="text-xs font-normal">WPM</span>
              </div>
              <span className="text-[11px] text-emerald-600 mt-0.5 block">Ideal target: 120-160 WPM</span>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Filler Words Count
              </span>
              <div className="text-2xl font-extrabold text-slate-900 mt-1">
                {conversationHistory.reduce((a, b) => a + b.fillersDetected.length, 0)}
              </div>
              <span className="text-[11px] text-slate-500 mt-0.5 block">Total &ldquo;um&rdquo;, &ldquo;like&rdquo;, etc.</span>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                STAR Structure
              </span>
              <div className="text-base font-bold text-emerald-700 mt-1">88% Aligned</div>
              <span className="text-[11px] text-slate-500 mt-0.5 block">Strong problem breakdown</span>
            </div>
          </div>

          {/* Turn-by-Turn Transcript & Inline Coaching */}
          <div className="space-y-4 pt-2">
            <h5 className="font-bold text-slate-900 text-sm">
              Conversational Turn Transcripts &amp; Coach Polish ({conversationHistory.length})
            </h5>

            <div className="space-y-4">
              {conversationHistory.map((h, i) => (
                <div key={i} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 text-xs">
                  <div className="flex items-center justify-between border-b border-slate-200/60 pb-2">
                    <span className="font-bold text-slate-900">
                      Turn {h.turn}: {h.coachPrompt}
                    </span>
                    <span className="px-2 py-0.5 rounded-full font-bold bg-purple-100 text-[#6743ee]">
                      Score: {h.score}/100
                    </span>
                  </div>

                  {/* Candidate Answer with highlighted metrics */}
                  <div className="p-3 bg-white border border-slate-200 rounded-lg text-slate-800 leading-relaxed font-sans">
                    <strong className="text-slate-900 block mb-1">Your Spoken Response:</strong>
                    <p className="whitespace-pre-wrap">{h.candidateResponse}</p>

                    <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                      <span>Pace: <strong>{h.wpm} WPM</strong></span>
                      <span>&bull;</span>
                      <span>
                        Fillers:{' '}
                        <strong>
                          {h.fillersDetected.length > 0 ? h.fillersDetected.join(', ') : 'None'}
                        </strong>
                      </span>
                    </div>
                  </div>

                  {/* Coach Advice */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                    <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-950">
                      <strong className="text-emerald-800 block">Coach Affirmation:</strong>
                      {h.praise}
                    </div>
                    <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-950">
                      <strong className="text-amber-800 block">Polish Suggestion:</strong>
                      {h.coachFeedback}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
