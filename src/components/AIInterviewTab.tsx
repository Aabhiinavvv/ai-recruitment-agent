import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Camera,
  CameraOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  CheckCircle2,
  AlertTriangle,
  Play,
  FastForward,
  Award,
  RefreshCw,
  Video,
  UserCheck,
  ShieldCheck,
  Sparkles,
  Share2,
  Copy,
  ExternalLink,
  Code,
  FileText,
  Lightbulb,
  Clock,
  Layers,
  ChevronRight,
  Sliders,
  Send,
  Zap,
  Check,
  X,
  RotateCcw,
  Headphones,
  Radio,
  Eye,
  Maximize2,
  ArrowRight,
  MessageSquare,
  Activity,
  Terminal,
  Cpu,
  User,
  Users,
  Compass,
  FileCheck,
  Clipboard,
  ShieldAlert,
  Volume1,
  Pause,
  AlertCircle,
  TrendingUp,
} from 'lucide-react';
import { Candidate, HiringBrief, InterviewRoundFeedback, AuditEvent } from '../types';
import {
  onlineInterviewService,
  OnlineInterviewQuestion,
  CandidateAnswerEvaluation,
  AI_PANEL_INTERVIEWERS,
  PanelInterviewer,
  SandboxExecutionResult,
  IntegrityAuditEvent,
  IntegrityReport,
} from '../services/onlineInterviewService';
import { PracticeInterviewMode } from './PracticeInterviewMode';

interface AIInterviewTabProps {
  brief?: HiringBrief | null;
  candidates?: Candidate[];
  selectedCandidateId?: string | null;
  onSelectCandidateId?: (id: string) => void;
  onSaveFeedback?: (candidateId: string, feedback: InterviewRoundFeedback) => void;
  onAppendAudit?: (actor: string, action: string, subject: string) => void;
  resumeReadinessScore?: number;
}

type InterviewPhase = 'lobby' | 'in_progress' | 'completed';
type RoundTypeOption = 'technical' | 'system_design' | 'coding' | 'behavioral';
type InterviewerMode = 'solo' | 'panel';
type ViewMode = 'recruiter_console' | 'async_candidate_portal' | 'practice_interview';

export const AIInterviewTab: React.FC<AIInterviewTabProps> = ({
  brief,
  candidates = [],
  selectedCandidateId,
  onSelectCandidateId,
  onSaveFeedback,
  onAppendAudit,
  resumeReadinessScore = 85,
}) => {
  // Top-level View Mode: Recruiter Console vs Asynchronous Candidate Self-Serve Portal
  const [viewMode, setViewMode] = useState<ViewMode>('recruiter_console');

  // Candidate selection
  const [activeCandId, setActiveCandId] = useState<string>(
    selectedCandidateId || candidates[0]?.candidate_id || 'CAN-9821'
  );

  const activeCandidate = useMemo(() => {
    return candidates.find((c) => c.candidate_id === activeCandId) || candidates[0] || null;
  }, [candidates, activeCandId]);

  // Session configuration
  const [roundType, setRoundType] = useState<RoundTypeOption>('technical');
  const [interviewerMode, setInterviewerMode] = useState<InterviewerMode>('panel');
  const [phase, setPhase] = useState<InterviewPhase>('lobby');
  const [sessionTimer, setSessionTimer] = useState<number>(0);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);

  // Audio / Video stream & diagnostics
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [micVolumeLevel, setMicVolumeLevel] = useState<number>(0);
  const [audioSpectrum, setAudioSpectrum] = useState<number[]>([10, 20, 15, 30, 45, 25, 15, 10]);
  const [isVoiceAiEnabled, setIsVoiceAiEnabled] = useState<boolean>(true);
  const [isAiSpeaking, setIsAiSpeaking] = useState<boolean>(false);
  const [isBackchannelingEnabled, setIsBackchannelingEnabled] = useState<boolean>(true);
  const [activeBackchannelNote, setActiveBackchannelNote] = useState<string | null>(null);

  // Web Speech recognition state
  const [isListening, setIsListening] = useState<boolean>(false);
  const [answerInput, setAnswerInput] = useState<string>('');
  const [speechStatus, setSpeechStatus] = useState<string>('Ready to capture voice response.');
  const [wordsPerMinute, setWordsPerMinute] = useState<number>(0);
  const speechStartTimeRef = useRef<number | null>(null);

  // Feature 3: In-Browser Code Sandbox State
  const [answerMode, setAnswerMode] = useState<'voice' | 'text' | 'code'>('voice');
  const [codeContent, setCodeContent] = useState<string>('');
  const [codeLanguage, setCodeLanguage] = useState<string>('python');
  const [sandboxResult, setSandboxResult] = useState<SandboxExecutionResult | null>(null);
  const [isExecutingSandbox, setIsExecutingSandbox] = useState<boolean>(false);

  // Feature 5: Environmental Integrity & Anti-Cheat State
  const [integrityEvents, setIntegrityEvents] = useState<IntegrityAuditEvent[]>([]);
  const [motionScore, setMotionScore] = useState<number>(0);
  const [showIntegrityDrawer, setShowIntegrityDrawer] = useState<boolean>(false);
  const keystrokeCountRef = useRef<number>(0);

  // Interview Questions & History
  const [questionPool, setQuestionPool] = useState<OnlineInterviewQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [activeFollowUpPrompt, setActiveFollowUpPrompt] = useState<string | null>(null);
  const [history, setHistory] = useState<
    Array<{
      question: OnlineInterviewQuestion;
      answer: string;
      evaluation: CandidateAnswerEvaluation;
      timestamp: number;
    }>
  >([]);
  const [latestEvaluation, setLatestEvaluation] = useState<CandidateAnswerEvaluation | null>(null);

  // Feature 4: Async Candidate Portal Specific State
  const [asyncStep, setAsyncStep] = useState<'welcome' | 'tech_check' | 'recording' | 'submitted'>('welcome');
  const [asyncPrepCountdown, setAsyncPrepCountdown] = useState<number>(60);
  const [asyncRecordCountdown, setAsyncRecordCountdown] = useState<number>(180);
  const [isAsyncRecording, setIsAsyncRecording] = useState<boolean>(false);
  const [asyncAttemptsCount, setAsyncAttemptsCount] = useState<number>(1);
  const [asyncAnswers, setAsyncAnswers] = useState<Record<string, string>>({});
  const [asyncReceiptCode, setAsyncReceiptCode] = useState<string | null>(null);

  // Modals & UI Controls
  const [showInviteModal, setShowInviteModal] = useState<boolean>(false);
  const [showIdeasDrawer, setShowIdeasDrawer] = useState<boolean>(false);
  const [linkCopied, setLinkCopied] = useState<boolean>(false);
  const [feedbackSaved, setFeedbackSaved] = useState<boolean>(false);

  // Media Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const asyncVideoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const prevFrameDataRef = useRef<Uint8ClampedArray | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micIntervalRef = useRef<any>(null);

  // Active question calculation
  const currentQuestion = questionPool[currentQuestionIndex] || null;

  // Active interviewer calculation for panel mode
  const activePanelist: PanelInterviewer = useMemo(() => {
    if (interviewerMode === 'solo') {
      return AI_PANEL_INTERVIEWERS[0];
    }
    const currentQ = questionPool[currentQuestionIndex];
    if (currentQ?.interviewerId) {
      return AI_PANEL_INTERVIEWERS.find((p) => p.id === currentQ.interviewerId) || AI_PANEL_INTERVIEWERS[0];
    }
    return AI_PANEL_INTERVIEWERS[currentQuestionIndex % AI_PANEL_INTERVIEWERS.length];
  }, [interviewerMode, questionPool, currentQuestionIndex]);

  // Sync candidate selection change
  const handleSelectCandidate = (candId: string) => {
    setActiveCandId(candId);
    if (onSelectCandidateId) {
      onSelectCandidateId(candId);
    }
  };

  // Generate question pool when candidate or roundType changes
  useEffect(() => {
    const questions = onlineInterviewService.generateQuestionPool(
      activeCandidate,
      brief || null,
      roundType
    );
    setQuestionPool(questions);
    setCurrentQuestionIndex(0);
    setActiveFollowUpPrompt(null);
    if (questions[0]?.starterCode) {
      setCodeContent(questions[0].starterCode);
      setCodeLanguage(questions[0].codeLanguage || 'python');
    }
  }, [activeCandidate, brief, roundType]);

  // Session duration timer
  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setSessionTimer((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTimerRunning]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Feature 5: Tab Switch & Window Blur Integrity Detection
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && phase === 'in_progress') {
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const newEvent: IntegrityAuditEvent = {
          id: `evt-${Date.now()}`,
          timestamp: timeStr,
          type: 'tab_blur',
          severity: 'medium',
          details: 'Candidate navigated away or blurred the interview window.',
        };
        setIntegrityEvents((prev) => [...prev, newEvent]);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [phase]);

  // Feature 5: Clipboard Paste Interception
  const handleAnswerPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pastedText = e.clipboardData.getData('text') || '';
    const wordCount = pastedText.trim().split(/\s+/).length;
    if (wordCount > 15) {
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const newEvent: IntegrityAuditEvent = {
        id: `evt-paste-${Date.now()}`,
        timestamp: timeStr,
        type: 'clipboard_paste',
        severity: wordCount > 60 ? 'high' : 'medium',
        details: `Large external clipboard paste detected (${wordCount} words pasted at once).`,
      };
      setIntegrityEvents((prev) => [...prev, newEvent]);
    }
  };

  // Integrity Report
  const integrityReport: IntegrityReport = useMemo(() => {
    return onlineInterviewService.calculateIntegrityReport(integrityEvents);
  }, [integrityEvents]);

  // Camera stream start & Audio Meter
  const startCameraStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: true,
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      if (asyncVideoRef.current) {
        asyncVideoRef.current.srcObject = stream;
        await asyncVideoRef.current.play().catch(() => {});
      }

      setIsCameraActive(true);
      setCameraError(null);
      setupAudioMeter(stream);
    } catch (err: any) {
      setIsCameraActive(false);
      setCameraError('Camera / Microphone permission denied or unavailable in this environment.');
    }
  }, []);

  const setupAudioMeter = (stream: MediaStream) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      micIntervalRef.current = setInterval(() => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        const spectrum: number[] = [];
        for (let i = 0; i < Math.min(8, bufferLength); i++) {
          const val = Math.round((dataArray[i] / 255) * 100);
          spectrum.push(val);
          sum += dataArray[i];
        }
        setAudioSpectrum(spectrum);
        const avg = sum / bufferLength;
        const normalized = Math.min(100, Math.round((avg / 128) * 100));
        setMicVolumeLevel(normalized);

        // Feature 5: Acoustic spike / background speech detector
        if (normalized > 88 && phase === 'in_progress') {
          const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          setIntegrityEvents((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.type === 'acoustic_spike' && Date.now() - parseInt(last.id.split('-')[2] || '0') < 10000) {
              return prev;
            }
            return [
              ...prev,
              {
                id: `evt-acoustic-${Date.now()}`,
                timestamp: timeStr,
                type: 'acoustic_spike',
                severity: 'low',
                details: 'Elevated acoustic volume spike detected above ambient threshold.',
              },
            ];
          });
        }
      }, 100);
    } catch (e) {
      console.warn('Web Audio meter not initialized', e);
    }
  };

  // Camera cleanup on unmount
  useEffect(() => {
    return () => {
      if (micIntervalRef.current) clearInterval(micIntervalRef.current);
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Frame difference motion detection loop
  useEffect(() => {
    let motionInterval: any = null;
    if (phase === 'in_progress' && isCameraActive) {
      motionInterval = setInterval(() => {
        captureMotionDifference();
      }, 1000);
    }
    return () => {
      if (motionInterval) clearInterval(motionInterval);
    };
  }, [phase, isCameraActive]);

  const captureMotionDifference = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;

    const width = 160;
    const height = 120;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, width, height);
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    const prev = prevFrameDataRef.current;
    if (prev) {
      let diff = 0;
      for (let i = 0; i < data.length; i += 4) {
        const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
        const prevGray = (prev[i] + prev[i + 1] + prev[i + 2]) / 3;
        diff += Math.abs(gray - prevGray);
      }
      const score = Math.min(100, Number(((diff / (data.length / 4)) * 0.4).toFixed(2)));
      setMotionScore(score);

      if (score > 32) {
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setIntegrityEvents((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.type === 'motion_anomaly' && Date.now() - parseInt(last.id.split('-')[2] || '0') < 12000) {
            return prev;
          }
          return [
            ...prev,
            {
              id: `evt-motion-${Date.now()}`,
              timestamp: timeStr,
              type: 'motion_anomaly',
              severity: 'low',
              details: `Elevated optical motion differential (${score} intensity).`,
            },
          ];
        });
      }
    }
    prevFrameDataRef.current = new Uint8ClampedArray(data);
  };

  // Feature 1: Sub-Second Voice AI Speech with Natural Cadence & Backchanneling
  const speakInterviewerPrompt = useCallback(
    (textToSpeak: string, customPitch: number = 1.05) => {
      if (!window.speechSynthesis || !isVoiceAiEnabled) return;
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.rate = 1.02;
      utterance.pitch = customPitch;

      const voices = window.speechSynthesis.getVoices();
      const naturalVoice = voices.find(
        (v) => v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Natural'))
      );
      if (naturalVoice) utterance.voice = naturalVoice;

      utterance.onstart = () => setIsAiSpeaking(true);
      utterance.onend = () => setIsAiSpeaking(false);
      utterance.onerror = () => setIsAiSpeaking(false);

      window.speechSynthesis.speak(utterance);
    },
    [isVoiceAiEnabled]
  );

  // Feature 1: Trigger Backchanneling Interjection ("Mhm, interesting...", "Please continue...")
  const triggerBackchannel = useCallback((type: 'affirm' | 'clarify') => {
    if (!isBackchannelingEnabled) return;
    const affirmations = [
      'Mhm, right.',
      'Understood, please continue.',
      'Interesting architectural trade-off.',
      'Got it, walk me through that part.',
    ];
    const phrase =
      type === 'affirm'
        ? affirmations[Math.floor(Math.random() * affirmations.length)]
        : 'Before you move on, could you clarify that specific point?';

    setActiveBackchannelNote(phrase);
    if (window.speechSynthesis && isVoiceAiEnabled) {
      const utt = new SpeechSynthesisUtterance(phrase);
      utt.rate = 1.15;
      utt.pitch = 1.08;
      window.speechSynthesis.speak(utt);
    }
    setTimeout(() => setActiveBackchannelNote(null), 3000);
  }, [isBackchannelingEnabled, isVoiceAiEnabled]);

  // Feature 1: Conversational Interruption
  const handleInterviewerInterject = () => {
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
    const panelistName = activePanelist.name;
    const interjection = `${panelistName} here: Let me quickly interject — how does this design behave when network latency spikes across global regions?`;
    setActiveFollowUpPrompt(interjection);
    speakInterviewerPrompt(interjection, 1.0);
  };

  // Speech Recognition: Listen to candidate response
  const handleStartListening = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechStatus('Speech recognition not supported in this browser. Please type your response.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.continuous = true;
      recognition.interimResults = true;

      speechStartTimeRef.current = Date.now();

      recognition.onstart = () => {
        setIsListening(true);
        setSpeechStatus('Listening to candidate voice in real-time...');
      };

      recognition.onresult = (event: any) => {
        let fullTranscript = '';
        for (let i = 0; i < event.results.length; i++) {
          fullTranscript += event.results[i][0].transcript;
        }
        setAnswerInput(fullTranscript.trim());

        if (speechStartTimeRef.current) {
          const durationMins = (Date.now() - speechStartTimeRef.current) / 60000;
          if (durationMins > 0.05) {
            const wordCount = fullTranscript.trim().split(/\s+/).length;
            setWordsPerMinute(Math.round(wordCount / durationMins));
          }
        }
      };

      recognition.onerror = (event: any) => {
        setSpeechStatus(`Audio notice: ${event.error}. You can type directly.`);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
        setSpeechStatus('Speech input ended. Review or submit response.');
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e) {
      setIsListening(false);
    }
  };

  const handleStopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  };

  // Feature 3: Run In-Browser Code Sandbox & Tests
  const handleRunSandbox = () => {
    setIsExecutingSandbox(true);
    setTimeout(() => {
      const result = onlineInterviewService.executeSandboxCode(
        codeContent,
        codeLanguage,
        currentQuestion?.testCases
      );
      setSandboxResult(result);
      setIsExecutingSandbox(false);
    }, 450);
  };

  // Start the Live Interview
  const handleStartInterview = async () => {
    await startCameraStream();
    setPhase('in_progress');
    setIsTimerRunning(true);
    setSessionTimer(0);
    setHistory([]);
    setLatestEvaluation(null);
    setCurrentQuestionIndex(0);
    setIntegrityEvents([]);

    const firstQ = questionPool[0];
    if (firstQ) {
      speakInterviewerPrompt(firstQ.question);
      if (firstQ.starterCode) {
        setCodeContent(firstQ.starterCode);
        setCodeLanguage(firstQ.codeLanguage || 'python');
        setAnswerMode('code');
      } else {
        setAnswerMode('voice');
      }
    }

    if (onAppendAudit && activeCandidate) {
      onAppendAudit(
        'Recruiter',
        `Launched live online AI interview room (${roundType}) in ${interviewerMode} mode`,
        `${activeCandidate.name} (${activeCandidate.candidate_id})`
      );
    }
  };

  // Submit Answer & Evaluate
  const handleSubmitAnswer = () => {
    if (!currentQuestion) return;

    const candidateResponse =
      answerMode === 'code' ? `${codeContent}\n\n[Explanation]: ${answerInput}` : answerInput;
    if (!candidateResponse.trim()) return;

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
    }
    if (window.speechSynthesis) window.speechSynthesis.cancel();

    const evaluation = onlineInterviewService.evaluateAnswer(
      currentQuestion,
      candidateResponse,
      activeCandidate
    );

    const historyItem = {
      question: currentQuestion,
      answer: candidateResponse,
      evaluation,
      timestamp: Date.now(),
    };

    setHistory((prev) => [...prev, historyItem]);
    setLatestEvaluation(evaluation);
    setAnswerInput('');
    setSandboxResult(null);

    // Speak quick feedback or next question
    if (currentQuestionIndex < questionPool.length - 1) {
      const nextIdx = currentQuestionIndex + 1;
      setCurrentQuestionIndex(nextIdx);
      const nextQ = questionPool[nextIdx];
      setActiveFollowUpPrompt(null);

      setTimeout(() => {
        if (nextQ) {
          speakInterviewerPrompt(nextQ.question);
          if (nextQ.starterCode) {
            setCodeContent(nextQ.starterCode);
            setCodeLanguage(nextQ.codeLanguage || 'python');
            setAnswerMode('code');
          } else {
            setAnswerMode('voice');
          }
        }
      }, 900);
    } else {
      handleFinishInterview();
    }
  };

  // Skip question
  const handleSkipQuestion = () => {
    if (currentQuestionIndex < questionPool.length - 1) {
      const nextIdx = currentQuestionIndex + 1;
      setCurrentQuestionIndex(nextIdx);
      const nextQ = questionPool[nextIdx];
      setActiveFollowUpPrompt(null);
      setAnswerInput('');
      if (nextQ) {
        speakInterviewerPrompt(nextQ.question);
        if (nextQ.starterCode) setCodeContent(nextQ.starterCode);
      }
    } else {
      handleFinishInterview();
    }
  };

  // Finish Interview
  const handleFinishInterview = () => {
    setIsTimerRunning(false);
    setPhase('completed');
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
    }

    if (onAppendAudit && activeCandidate) {
      onAppendAudit(
        'AI Interviewer',
        `Completed live online interview session (${roundType})`,
        `${activeCandidate.name} (${activeCandidate.candidate_id})`
      );
    }
  };

  // Save report to Candidate Record
  const handleSaveToCandidateRecord = () => {
    if (!activeCandidate) return;
    const finalReport = onlineInterviewService.generateFinalReport(
      activeCandidate,
      brief || null,
      history,
      Math.max(5, Math.round(sessionTimer / 60)),
      integrityReport.trustIndex
    );

    if (onSaveFeedback) {
      onSaveFeedback(activeCandidate.candidate_id, finalReport);
    }
    setFeedbackSaved(true);

    if (onAppendAudit) {
      onAppendAudit(
        'System',
        `Standardized evaluation synced to candidate feedback portfolio (Score: ${finalReport.ratings.technicalDepth * 10}%, Trust: ${integrityReport.trustIndex}%)`,
        `${activeCandidate.name}`
      );
    }
  };

  // Copy candidate online portal link
  const handleCopyInviteLink = () => {
    const inviteUrl = `https://recruit.company.com/interview/live/${activeCandidate?.candidate_id || 'guest'}?token=eval_room_${Date.now().toString(36)}`;
    navigator.clipboard.writeText(inviteUrl);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2500);
  };

  // Sound check chime
  const handlePlaySoundChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch (e) {}
  };

  // Feature 4: Async Portal Handlers
  const handleStartAsyncRecording = () => {
    setIsAsyncRecording(true);
    setAsyncRecordCountdown(180);
  };

  const handleStopAsyncRecordingAndSubmit = () => {
    setIsAsyncRecording(false);
    const q = currentQuestion?.id || `q-${currentQuestionIndex}`;
    setAsyncAnswers((prev) => ({
      ...prev,
      [q]: answerInput || 'Video response recorded successfully.',
    }));

    if (currentQuestionIndex < questionPool.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
      setAnswerInput('');
      setAsyncPrepCountdown(60);
      setAsyncAttemptsCount(1);
    } else {
      const receipt = `REC-ASYNC-${Math.floor(100000 + Math.random() * 900000)}`;
      setAsyncReceiptCode(receipt);
      setAsyncStep('submitted');
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Session Header & Context Bar */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h2 className="text-base font-bold text-slate-900">
              AI Online Virtual Interview Room &amp; Assessment Suite
            </h2>
            <span className="px-2 py-0.5 rounded-full bg-purple-50 text-[#6743ee] text-[11px] font-semibold border border-purple-200/60">
              Multi-Agent &bull; Sandbox &bull; Integrity
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Real-time multi-modal candidate assessment with 3-agent panel committee, code sandbox execution,
            bi-directional audio backchanneling, and environmental integrity monitoring.
          </p>
        </div>

        {/* View Mode Toggle & Candidate Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Recruiter Console vs Candidate Self-Serve Portal vs Practice Mode */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => setViewMode('recruiter_console')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                viewMode === 'recruiter_console'
                  ? 'bg-white text-[#6743ee] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Recruiter Room
            </button>
            <button
              type="button"
              onClick={() => setViewMode('practice_interview')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'practice_interview'
                  ? 'bg-white text-[#6743ee] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Mic className="w-3.5 h-3.5 text-[#6743ee]" />
              <span>Practice Mode</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('async_candidate_portal')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                viewMode === 'async_candidate_portal'
                  ? 'bg-white text-[#6743ee] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Candidate Async Portal
            </button>
          </div>

          {/* Candidate Dropdown */}
          <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs">
            <span className="text-[11px] font-medium text-slate-500 mr-1.5">Candidate:</span>
            <select
              value={activeCandId}
              disabled={phase === 'in_progress'}
              onChange={(e) => handleSelectCandidate(e.target.value)}
              className="bg-transparent border-0 font-semibold text-slate-800 text-xs focus:ring-0 cursor-pointer disabled:opacity-50"
            >
              {candidates.map((c) => (
                <option key={c.candidate_id} value={c.candidate_id}>
                  {c.name} ({c.overall_score}%) — {c.role}
                </option>
              ))}
            </select>
          </div>

          {/* Share Candidate Invite Link */}
          <button
            type="button"
            onClick={() => setShowInviteModal(true)}
            className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
            title="Generate online candidate portal invite link"
          >
            <Share2 className="w-3.5 h-3.5 text-[#6743ee]" />
            <span>Candidate Link</span>
          </button>

          {/* Environmental Integrity Drawer Button */}
          <button
            type="button"
            onClick={() => setShowIntegrityDrawer(true)}
            className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100/80 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Integrity: {integrityReport.trustIndex}%</span>
          </button>
        </div>
      </div>

      {/* =================================================================== */}
      {/* VOICE-TO-TEXT PRACTICE INTERVIEW MODE                               */}
      {/* =================================================================== */}
      {viewMode === 'practice_interview' && (
        <PracticeInterviewMode
          candidate={activeCandidate}
          brief={brief || null}
          onExit={() => setViewMode('recruiter_console')}
        />
      )}

      {/* =================================================================== */}
      {/* FEATURE 4: ASYNCHRONOUS CANDIDATE SELF-SERVICE PORTAL VIEW          */}
      {/* =================================================================== */}
      {viewMode === 'async_candidate_portal' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          {/* Async Portal Header Banner */}
          <div className="p-6 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold text-[10px] uppercase tracking-wider border border-emerald-500/30">
                  Candidate Portal Mode
                </span>
                <span className="text-xs text-indigo-200 font-mono">Token: VALID_48H_ACCESS</span>
              </div>
              <h3 className="text-xl font-bold mt-1">
                {brief?.company_name || 'Anthropic Tech'} &bull; Virtual Interview Assessment
              </h3>
              <p className="text-xs text-indigo-200/80 mt-0.5">
                Target Role: <strong>{brief?.job_title || activeCandidate?.role}</strong> &bull; Applicant: <strong>{activeCandidate?.name}</strong>
              </p>
            </div>

            <button
              type="button"
              onClick={() => setViewMode('recruiter_console')}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold backdrop-blur-xs transition-colors self-start sm:self-auto cursor-pointer"
            >
              Exit to Recruiter View
            </button>
          </div>

          {/* Async Steps Navigator */}
          <div className="border-b border-slate-200 bg-slate-50 px-6 py-3 flex items-center gap-6 overflow-x-auto text-xs font-medium">
            {[
              { id: 'welcome', label: '1. Welcome & Briefing' },
              { id: 'tech_check', label: '2. Device Calibration' },
              { id: 'recording', label: '3. Video Response Room' },
              { id: 'submitted', label: '4. Completion & Receipt' },
            ].map((st) => (
              <span
                key={st.id}
                className={asyncStep === st.id ? 'text-[#6743ee] font-bold border-b-2 border-[#6743ee] pb-1' : 'text-slate-500'}
              >
                {st.label}
              </span>
            ))}
          </div>

          {/* Step 1: Welcome & Briefing */}
          {asyncStep === 'welcome' && (
            <div className="p-8 max-w-2xl mx-auto space-y-6 text-center">
              <div className="w-16 h-16 rounded-2xl bg-purple-100 text-[#6743ee] flex items-center justify-center mx-auto shadow-sm">
                <Video className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <h4 className="text-lg font-bold text-slate-900">Welcome, {activeCandidate?.name}!</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  You have been invited to complete a self-paced asynchronous AI video &amp; technical assessment for the{' '}
                  <strong>{brief?.job_title || 'Software Engineer'}</strong> position. You will respond to{' '}
                  <strong>{questionPool.length} curated questions</strong> evaluating your system design, technical problem-solving, and communication.
                </p>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-left text-xs space-y-2 max-w-md mx-auto">
                <div className="font-bold text-slate-800">What to expect:</div>
                <p className="text-slate-600">&bull; <strong>60 seconds</strong> prep time per question before recording begins.</p>
                <p className="text-slate-600">&bull; <strong>Up to 3 minutes</strong> to record each video response.</p>
                <p className="text-slate-600">&bull; <strong>1 re-record attempt</strong> allowed per question if you wish to retry.</p>
                <p className="text-slate-600">&bull; Secure, browser-based recording with zero software installation required.</p>
              </div>

              <button
                type="button"
                onClick={() => {
                  startCameraStream();
                  setAsyncStep('tech_check');
                }}
                className="px-6 py-2.5 bg-[#6743ee] hover:bg-[#5637d2] text-white rounded-xl text-xs font-bold transition-all shadow-md inline-flex items-center gap-2 cursor-pointer"
              >
                <span>Calibrate Camera &amp; Microphone</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Step 2: Device Calibration */}
          {asyncStep === 'tech_check' && (
            <div className="p-8 max-w-3xl mx-auto space-y-6">
              <div className="text-center space-y-1">
                <h4 className="text-lg font-bold text-slate-900">Audio &amp; Webcam Calibration</h4>
                <p className="text-xs text-slate-500">Ensure your face is clearly framed and your voice levels register properly.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center">
                <div className="relative aspect-video bg-slate-950 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center">
                  <video ref={asyncVideoRef} playsInline autoPlay muted className="w-full h-full object-cover" />
                  <span className="absolute bottom-2 left-2 bg-slate-900/80 text-white text-[10px] px-2 py-0.5 rounded font-mono">
                    720p HD Feed
                  </span>
                </div>

                <div className="space-y-4 text-xs">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                    <span className="font-semibold text-slate-700 block">Microphone Gain</span>
                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 transition-all duration-100" style={{ width: `${micVolumeLevel}%` }} />
                    </div>
                    <span className="text-[10px] text-slate-400">Speak into your mic to verify sound bar responds.</span>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-slate-700 block">Speaker Test</span>
                      <span className="text-[10px] text-slate-400">Ensure you can hear prompts.</span>
                    </div>
                    <button
                      type="button"
                      onClick={handlePlaySoundChime}
                      className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg font-semibold cursor-pointer shadow-2xs"
                    >
                      Play Chime
                    </button>
                  </div>

                  <div className="p-3 bg-purple-50 border border-purple-100 rounded-xl text-purple-900">
                    <strong className="block">Privacy Confirmation</strong>
                    <span className="text-[11px] text-purple-700">
                      Your responses are processed solely for evaluating qualifications for this role.
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAsyncStep('welcome')}
                  className="px-4 py-2 bg-white text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setAsyncStep('recording')}
                  className="px-6 py-2.5 bg-[#6743ee] hover:bg-[#5637d2] text-white rounded-xl text-xs font-bold transition-all shadow-md inline-flex items-center gap-2 cursor-pointer"
                >
                  <span>Begin Asynchronous Assessment</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Video Response Room */}
          {asyncStep === 'recording' && currentQuestion && (
            <div className="p-6 max-w-4xl mx-auto space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-[#6743ee] font-bold text-xs">
                    Question {currentQuestionIndex + 1} of {questionPool.length}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">{currentQuestion.category}</span>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  <span className="text-slate-500">
                    Attempt: <strong>{asyncAttemptsCount} of 2</strong>
                  </span>
                  <span className="px-2.5 py-1 rounded-md bg-slate-900 text-white font-mono font-bold">
                    {isAsyncRecording ? `Rec: ${asyncRecordCountdown}s` : `Prep: ${asyncPrepCountdown}s`}
                  </span>
                </div>
              </div>

              {/* Prompt Box */}
              <div className="p-5 bg-gradient-to-r from-purple-50/50 to-indigo-50/50 rounded-xl border border-purple-100 space-y-2">
                <h4 className="font-bold text-slate-900 text-base leading-snug">{currentQuestion.question}</h4>
                {currentQuestion.contextHint && (
                  <p className="text-xs text-slate-500 italic">Hint: {currentQuestion.contextHint}</p>
                )}
              </div>

              {/* Recording Area */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                <div className="relative aspect-video bg-slate-950 rounded-xl overflow-hidden border border-slate-800">
                  <video ref={asyncVideoRef} playsInline autoPlay muted className="w-full h-full object-cover" />
                  {isAsyncRecording && (
                    <span className="absolute top-2 left-2 bg-red-600 text-white text-[10px] px-2 py-0.5 rounded font-bold uppercase flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                      RECORDING VIDEO
                    </span>
                  )}
                </div>

                <div className="space-y-3">
                  <textarea
                    value={answerInput}
                    onChange={(e) => setAnswerInput(e.target.value)}
                    placeholder="Candidate live transcription or notes will reflect here..."
                    rows={6}
                    className="w-full text-xs p-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#6743ee]"
                  />

                  <div className="flex items-center justify-between">
                    {!isAsyncRecording ? (
                      <button
                        type="button"
                        onClick={handleStartAsyncRecording}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Video className="w-3.5 h-3.5" />
                        <span>Start Recording Video</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleStopAsyncRecordingAndSubmit}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Done &amp; Save Answer</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Submission Confirmation */}
          {asyncStep === 'submitted' && (
            <div className="p-8 max-w-lg mx-auto text-center space-y-5">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h4 className="text-lg font-bold text-slate-900">Assessment Submitted Successfully!</h4>
                <p className="text-xs text-slate-500">
                  Thank you, {activeCandidate?.name}. Your video responses and technical answers have been submitted to the recruitment committee.
                </p>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1 font-mono text-slate-700">
                <span className="text-[10px] text-slate-400 uppercase block font-sans">Confirmation Receipt Code</span>
                <span className="font-bold text-sm text-[#6743ee]">{asyncReceiptCode}</span>
              </div>

              <button
                type="button"
                onClick={() => setViewMode('recruiter_console')}
                className="px-6 py-2.5 bg-[#6743ee] hover:bg-[#5637d2] text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer"
              >
                Return to Recruiter Console
              </button>
            </div>
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* RECRUITER CONSOLE: PRE-FLIGHT / LIVE ROOM / REPORT MODES            */}
      {/* =================================================================== */}
      {viewMode === 'recruiter_console' && (
        <>
          {/* LOBBY / PREPARATION */}
          {phase === 'lobby' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Device Diagnostics & Feature Controls */}
              <div className="lg:col-span-7 bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">
                      Pre-Flight Room Diagnostics &amp; Multi-Agent Setup
                    </h3>
                    <p className="text-xs text-slate-500">
                      Configure panel mode, sound audio spectrum, and calibrate video proctoring.
                    </p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    WebRTC Ready
                  </span>
                </div>

                {/* Video Preview Box */}
                <div className="relative aspect-video bg-slate-950 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center">
                  <video
                    ref={videoRef}
                    playsInline
                    autoPlay
                    muted
                    className={`w-full h-full object-cover ${!isCameraActive ? 'hidden' : ''}`}
                  />
                  <canvas ref={canvasRef} className="hidden" />

                  {!isCameraActive ? (
                    <div className="text-center p-6 text-slate-400 space-y-3">
                      <div className="w-12 h-12 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                        <Camera className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-200">Camera Stream Inactive</p>
                        <p className="text-[11px] text-slate-400 mt-0.5 max-w-sm mx-auto">
                          Click below to grant browser webcam &amp; microphone permission.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={startCameraStream}
                        className="px-4 py-2 bg-[#6743ee] hover:bg-[#5637d2] text-white text-xs font-bold rounded-xl shadow-xs transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>Enable Camera &amp; Mic</span>
                      </button>
                    </div>
                  ) : (
                    <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-xs text-white px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wider uppercase flex items-center gap-1.5 border border-white/10">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      <span>720P STREAM READY</span>
                    </div>
                  )}
                </div>

                {/* Hardware Diagnostic Gauges & Feature 1 Audio Spectrum */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Real-Time Audio Spectrum Visualizer */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="font-semibold flex items-center gap-1">
                        <Mic className="w-3.5 h-3.5 text-[#6743ee]" />
                        Spectrum Visualizer
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">{micVolumeLevel}%</span>
                    </div>
                    {/* Live Dynamic Audio Bars */}
                    <div className="flex items-end gap-1 h-5 pt-1">
                      {audioSpectrum.map((val, idx) => (
                        <div
                          key={idx}
                          className="flex-1 rounded-t-sm transition-all duration-75"
                          style={{
                            height: `${Math.max(15, val)}%`,
                            backgroundColor: val > 65 ? '#ef4444' : val > 30 ? '#10b981' : '#6743ee',
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Sound Output Chime */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold text-slate-700 block flex items-center gap-1">
                        <Headphones className="w-3.5 h-3.5 text-teal-600" />
                        Speaker Test
                      </span>
                      <span className="text-[10px] text-slate-400">Play tone chime</span>
                    </div>
                    <button
                      type="button"
                      onClick={handlePlaySoundChime}
                      className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold cursor-pointer shadow-2xs"
                    >
                      Test Tone
                    </button>
                  </div>

                  {/* Network Ping */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold text-slate-700 block flex items-center gap-1">
                        <Radio className="w-3.5 h-3.5 text-emerald-600" />
                        WebRTC Ping
                      </span>
                      <span className="text-[10px] text-emerald-600 font-semibold">24ms Latency</span>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-emerald-100/70 text-emerald-800 text-[10px] font-bold">
                      Stable
                    </span>
                  </div>
                </div>

                {/* Feature 1 & 2 Config: Voice Backchanneling & Interviewer Mode */}
                <div className="p-4 bg-purple-50/40 border border-purple-100 rounded-xl grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="font-bold text-slate-900 block">Feature 1: Bi-Directional Backchanneling</span>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Enables natural conversational interjections (&ldquo;Mhm, right&rdquo;, &ldquo;Understood&rdquo;) during long pauses.
                    </p>
                    <label className="flex items-center gap-2 mt-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isBackchannelingEnabled}
                        onChange={(e) => setIsBackchannelingEnabled(e.target.checked)}
                        className="rounded text-[#6743ee] focus:ring-[#6743ee]"
                      />
                      <span className="font-semibold text-slate-700">Enable Voice Backchanneling</span>
                    </label>
                  </div>

                  <div>
                    <span className="font-bold text-slate-900 block">Feature 2: Multi-Agent 3-Person Panel</span>
                    <p className="text-[11px] text-slate-500 mt.0.5">
                      Toggle between Solo AI Interviewer or 3-agent committee (Sarah, Marcus, Elena).
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => setInterviewerMode('panel')}
                        className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                          interviewerMode === 'panel'
                            ? 'bg-[#6743ee] text-white shadow-xs'
                            : 'bg-white border border-slate-200 text-slate-700'
                        }`}
                      >
                        3-Agent Panel
                      </button>
                      <button
                        type="button"
                        onClick={() => setInterviewerMode('solo')}
                        className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                          interviewerMode === 'solo'
                            ? 'bg-[#6743ee] text-white shadow-xs'
                            : 'bg-white border border-slate-200 text-slate-700'
                        }`}
                      >
                        Solo AI
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Multi-Agent Committee Roster & Launch */}
              <div className="lg:col-span-5 space-y-5">
                {/* Feature 2: 3-Agent Panel Committee Cards */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Hiring Committee Panel (3 Agents)
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-purple-50 text-[#6743ee] font-bold text-[10px]">
                      Specialized Perspectives
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {AI_PANEL_INTERVIEWERS.map((panelist) => (
                      <div
                        key={panelist.id}
                        className="p-3 rounded-xl border border-slate-200 bg-slate-50/40 hover:bg-white transition-colors space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-7 h-7 rounded-lg bg-gradient-to-tr ${panelist.avatarColor} text-white flex items-center justify-center font-bold text-xs shadow-xs`}
                            >
                              {panelist.name.split(' ').map((n) => n[0]).join('')}
                            </div>
                            <div>
                              <span className="font-bold text-slate-900 text-xs block">{panelist.name}</span>
                              <span className="text-[10px] text-slate-500">{panelist.role}</span>
                            </div>
                          </div>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${panelist.badgeColor}`}>
                            {panelist.title.split(' ')[0]}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 italic pl-1 leading-snug">
                          &ldquo;{panelist.introQuote}&rdquo;
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Round Type Selector & Launch CTA */}
                <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
                  <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                    Select Evaluation Format
                  </h4>

                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'technical' as const, label: 'Technical Core', icon: Cpu },
                      { id: 'system_design' as const, label: 'System Design', icon: Layers },
                      { id: 'coding' as const, label: 'Coding Sandbox', icon: Code },
                      { id: 'behavioral' as const, label: 'Behavioral STAR', icon: UserCheck },
                    ].map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setRoundType(item.id)}
                          className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                            roundType === item.id
                              ? 'border-[#6743ee] bg-purple-50/50 text-[#6743ee] font-bold'
                              : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                          }`}
                        >
                          <Icon className="w-4 h-4 mb-1" />
                          <span className="text-xs block">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={handleStartInterview}
                    className="w-full py-3 bg-[#6743ee] hover:bg-[#5637d2] text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer mt-2"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    <span>Launch Live Interactive Room</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setViewMode('practice_interview')}
                    className="w-full py-2.5 bg-purple-50 hover:bg-purple-100 text-[#6743ee] border border-purple-200/80 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
                  >
                    <Mic className="w-3.5 h-3.5 text-[#6743ee]" />
                    <span>Try Voice-to-Text Practice Simulator First</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* IN PROGRESS: LIVE INTERACTIVE ROOM */}
          {phase === 'in_progress' && (
            <div className="space-y-5">
              {/* Header Bar */}
              <div className="bg-slate-900 text-white rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-md">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-600/90 text-white text-xs font-black tracking-wider uppercase shadow-xs">
                    <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                    <span>LIVE RECORDING</span>
                  </span>
                  <span className="font-mono text-sm font-bold text-slate-200 tracking-wider">
                    {formatTimer(sessionTimer)}
                  </span>
                  <span className="text-slate-400 text-xs hidden sm:inline">&bull;</span>
                  <span className="text-xs text-slate-300 hidden sm:inline font-medium">
                    {activeCandidate?.name} ({brief?.job_title || 'Software Engineer'})
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  {/* Feature 1 Backchannel Indicator */}
                  {activeBackchannelNote && (
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] font-bold animate-pulse">
                      {activeBackchannelNote}
                    </span>
                  )}

                  {/* Feature 1: Interject Button */}
                  <button
                    type="button"
                    onClick={handleInterviewerInterject}
                    className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-400/30 rounded-lg text-xs font-semibold cursor-pointer"
                    title="AI Panelist will interject with an urgent clarification"
                  >
                    Panel Interject
                  </button>

                  {/* Finish Session */}
                  <button
                    type="button"
                    onClick={handleFinishInterview}
                    className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold text-xs transition-colors cursor-pointer"
                  >
                    Finish Session
                  </button>
                </div>
              </div>

              {/* Main Split Console */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left: Multi-Agent Panelist & Proctor (5 cols) */}
                <div className="lg:col-span-5 space-y-4">
                  {/* Active Panelist Card */}
                  <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-8 h-8 rounded-lg bg-gradient-to-tr ${activePanelist.avatarColor} text-white flex items-center justify-center font-bold text-xs shadow-xs`}
                        >
                          {activePanelist.name.split(' ').map((n) => n[0]).join('')}
                        </div>
                        <div>
                          <span className="font-bold text-slate-900 text-xs block">{activePanelist.name}</span>
                          <span className="text-[10px] text-slate-500">{activePanelist.title}</span>
                        </div>
                      </div>

                      {isAiSpeaking ? (
                        <span className="px-2 py-0.5 rounded-full bg-purple-100 text-[#6743ee] text-[10px] font-bold animate-pulse flex items-center gap-1">
                          <Volume2 className="w-3 h-3" />
                          <span>Asking Question...</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-semibold">
                          Listening
                        </span>
                      )}
                    </div>

                    {/* Question Box */}
                    {currentQuestion && (
                      <div className="p-4 bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-xl shadow-xs space-y-2">
                        <div className="flex items-center justify-between text-[11px] text-indigo-200">
                          <span className="font-semibold uppercase tracking-wider">
                            Question {currentQuestionIndex + 1} of {questionPool.length} &bull; {currentQuestion.category}
                          </span>
                          <button
                            type="button"
                            onClick={() => speakInterviewerPrompt(currentQuestion.question)}
                            className="p-1 hover:bg-white/20 rounded transition-colors"
                            title="Repeat question aloud"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <p className="font-semibold text-sm leading-snug">{currentQuestion.question}</p>
                        {currentQuestion.contextHint && (
                          <p className="text-[11px] text-indigo-300/80 pt-1 border-t border-white/10 italic">
                            Hint: {currentQuestion.contextHint}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Adaptive Follow-up Prompt */}
                    {activeFollowUpPrompt && (
                      <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl space-y-1 text-xs">
                        <div className="font-bold text-[#6743ee] flex items-center gap-1">
                          <Zap className="w-3.5 h-3.5" />
                          <span>Panel Follow-Up Probe</span>
                        </div>
                        <p className="text-slate-700">{activeFollowUpPrompt}</p>
                      </div>
                    )}
                  </div>

                  {/* Video Proctor & Anti-Cheat Feed */}
                  <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 font-bold text-slate-800">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        <span>Proctor Integrity Stream</span>
                      </div>
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        Trust Index: {integrityReport.trustIndex}%
                      </span>
                    </div>

                    <div className="relative aspect-video bg-slate-950 rounded-xl overflow-hidden border border-slate-800">
                      <video ref={videoRef} playsInline autoPlay muted className="w-full h-full object-cover" />
                      <canvas ref={canvasRef} className="hidden" />

                      <div className="absolute top-2 left-2 flex items-center gap-1.5">
                        <span className="bg-red-600/90 text-white px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                          PROCTOR ACTIVE
                        </span>
                        <span className="bg-slate-900/80 text-emerald-300 px-2 py-0.5 rounded text-[9px] font-semibold border border-white/10">
                          Focus: Calibrated
                        </span>
                      </div>
                    </div>

                    {integrityEvents.length > 0 && (
                      <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-900 flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                          {integrityEvents.length} Integrity events logged
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowIntegrityDrawer(true)}
                          className="font-bold underline text-amber-800 cursor-pointer"
                        >
                          View Log
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Candidate Response Console & Feature 3 Code Sandbox (7 cols) */}
                <div className="lg:col-span-7 bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4 flex flex-col justify-between">
                  <div className="space-y-4">
                    {/* Mode Tabs: Voice, Text, and Code Sandbox */}
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setAnswerMode('voice')}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                            answerMode === 'voice'
                              ? 'bg-[#6743ee] text-white shadow-xs'
                              : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          <Mic className="w-3.5 h-3.5" />
                          <span>Voice Speech-to-Text</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setAnswerMode('text')}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                            answerMode === 'text'
                              ? 'bg-[#6743ee] text-white shadow-xs'
                              : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Text Answer</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setAnswerMode('code')}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                            answerMode === 'code'
                              ? 'bg-[#6743ee] text-white shadow-xs'
                              : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          <Code className="w-3.5 h-3.5" />
                          <span>Code Sandbox &amp; REPL</span>
                        </button>
                      </div>

                      {wordsPerMinute > 0 && (
                        <span className="text-[11px] text-slate-500 font-medium">
                          Speech Cadence: <strong>{wordsPerMinute} WPM</strong>
                        </span>
                      )}
                    </div>

                    {/* Mode: Voice Speech Recognition */}
                    {answerMode === 'voice' && (
                      <div className="space-y-3">
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            {isListening ? (
                              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                            ) : (
                              <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                            )}
                            <span className="text-slate-700 font-medium">{speechStatus}</span>
                          </div>

                          <div className="flex items-center gap-2">
                            {!isListening ? (
                              <button
                                type="button"
                                onClick={handleStartListening}
                                className="px-3 py-1.5 bg-[#6743ee] hover:bg-[#5637d2] text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer shadow-2xs"
                              >
                                <Mic className="w-3.5 h-3.5" />
                                <span>Start Speaking</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={handleStopListening}
                                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer shadow-2xs"
                              >
                                <MicOff className="w-3.5 h-3.5" />
                                <span>Stop Speaking</span>
                              </button>
                            )}
                          </div>
                        </div>

                        <textarea
                          value={answerInput}
                          onChange={(e) => setAnswerInput(e.target.value)}
                          onPaste={handleAnswerPaste}
                          placeholder="Candidate answer transcribes here in real-time as you speak..."
                          rows={6}
                          className="w-full text-xs p-3 bg-slate-50/70 border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#6743ee] font-sans leading-relaxed"
                        />
                      </div>
                    )}

                    {/* Mode: Text Editor */}
                    {answerMode === 'text' && (
                      <div className="space-y-2">
                        <div className="text-[11px] text-slate-500 flex justify-between">
                          <span>Structure your response using STAR: Situation, Task, Action, Result.</span>
                          <span>{answerInput.split(/\s+/).filter(Boolean).length} words</span>
                        </div>
                        <textarea
                          value={answerInput}
                          onChange={(e) => setAnswerInput(e.target.value)}
                          onPaste={handleAnswerPaste}
                          placeholder="Type candidate detailed response here..."
                          rows={7}
                          className="w-full text-xs p-3 bg-slate-50/70 border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#6743ee] font-sans leading-relaxed"
                        />
                      </div>
                    )}

                    {/* Mode: Feature 3 In-Browser Code Sandbox */}
                    {answerMode === 'code' && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-700 font-mono">Language:</span>
                            <select
                              value={codeLanguage}
                              onChange={(e) => setCodeLanguage(e.target.value)}
                              className="text-xs bg-slate-100 border border-slate-200 rounded-lg px-2 py-0.5 font-bold text-slate-800"
                            >
                              <option value="python">Python 3 (Sandbox)</option>
                              <option value="javascript">JavaScript / TypeScript</option>
                              <option value="sql">PostgreSQL / SQL</option>
                              <option value="go">Go 1.22</option>
                            </select>
                          </div>

                          <button
                            type="button"
                            onClick={handleRunSandbox}
                            disabled={isExecutingSandbox}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                          >
                            <Play className="w-3.5 h-3.5 fill-white" />
                            <span>{isExecutingSandbox ? 'Compiling...' : 'Run Code & Test Suite'}</span>
                          </button>
                        </div>

                        <textarea
                          value={codeContent}
                          onChange={(e) => setCodeContent(e.target.value)}
                          onPaste={handleAnswerPaste}
                          rows={8}
                          className="w-full text-xs p-3 bg-slate-950 text-emerald-400 font-mono rounded-xl border border-slate-800 focus:outline-none focus:ring-1 focus:ring-[#6743ee] leading-relaxed"
                        />

                        {/* Sandbox Execution Terminal */}
                        {sandboxResult && (
                          <div className="p-3 bg-slate-900 text-slate-200 rounded-xl text-xs space-y-2 font-mono border border-slate-800">
                            <div className="flex items-center justify-between border-b border-slate-800 pb-1">
                              <span className="font-bold text-slate-400 text-[10px] uppercase flex items-center gap-1">
                                <Terminal className="w-3 h-3 text-emerald-400" />
                                Execution Profile ({sandboxResult.executionTimeMs}ms &bull; {sandboxResult.memoryEstimateKb}KB)
                              </span>
                              <span
                                className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                  sandboxResult.success ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                                }`}
                              >
                                {sandboxResult.totalPassed} / {sandboxResult.totalTests} Passed
                              </span>
                            </div>
                            <pre className="text-[11px] leading-snug whitespace-pre-wrap text-slate-300 max-h-36 overflow-y-auto">
                              {sandboxResult.stdout}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Action Bar */}
                  <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleSkipQuestion}
                        className="flex items-center gap-1 px-3 py-2 text-slate-500 hover:text-slate-800 text-xs font-semibold cursor-pointer"
                      >
                        <FastForward className="w-3.5 h-3.5" />
                        <span>Skip Question</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => triggerBackchannel('affirm')}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
                        title="Simulate interviewer affirming candidate's point"
                      >
                        Backchannel Voice
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleSubmitAnswer}
                      disabled={!answerInput.trim() && !codeContent.trim()}
                      className="px-6 py-2.5 bg-[#6743ee] hover:bg-[#5637d2] text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Submit Answer &amp; Next</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* COMPLETED REPORT MODE */}
          {phase === 'completed' && activeCandidate && (
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                    <Award className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-lg">
                      Multi-Agent Committee Evaluation Complete
                    </h3>
                    <p className="text-xs text-slate-500">
                      {activeCandidate.name} &bull; {brief?.job_title || activeCandidate.role} &bull; Session Time: {formatTimer(sessionTimer)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setPhase('lobby')}
                    className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    Start Another Round
                  </button>

                  <button
                    type="button"
                    onClick={handleSaveToCandidateRecord}
                    disabled={feedbackSaved}
                    className="px-4 py-2 bg-[#6743ee] hover:bg-[#5637d2] text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-60 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{feedbackSaved ? 'Saved to Portfolio' : 'Sync to Candidate Record'}</span>
                  </button>
                </div>
              </div>

              {/* Metric Overview Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 bg-purple-50/50 border border-purple-100 rounded-xl">
                  <span className="text-[10px] font-bold text-[#6743ee] uppercase tracking-wider block">
                    Composite Score
                  </span>
                  <div className="text-3xl font-extrabold text-[#6743ee] mt-1">
                    {history.length > 0
                      ? Math.round((history.reduce((acc, h) => acc + h.evaluation.score, 0) / history.length) * 10)
                      : 85}%
                  </div>
                  <span className="text-[11px] text-slate-500 mt-0.5 block">{history.length} responses evaluated</span>
                </div>

                <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-xl">
                  <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                    Hiring Verdict
                  </span>
                  <div className="text-xl font-extrabold text-emerald-800 mt-1">
                    Strong Hire
                  </div>
                  <span className="text-[11px] text-emerald-600 mt-0.5 block">3-Agent Panel Consensus</span>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Calibrated Level
                  </span>
                  <div className="text-base font-bold text-slate-900 mt-1">
                    L6 Staff Track
                  </div>
                  <span className="text-[11px] text-slate-500 mt-0.5 block">Top quartile candidate</span>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Integrity Trust Score
                  </span>
                  <div className="text-base font-bold text-emerald-700 mt-1">
                    {integrityReport.trustIndex}% Verified
                  </div>
                  <span className="text-[11px] text-slate-500 mt-0.5 block">{integrityEvents.length} Integrity flags</span>
                </div>
              </div>

              {/* Evaluated Questions History */}
              <div className="space-y-4 pt-2">
                <h4 className="font-bold text-slate-900 text-sm">
                  Session Transcripts &amp; Panelist Consensus ({history.length})
                </h4>

                <div className="space-y-3">
                  {history.map((h, i) => (
                    <div key={i} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">
                          Q{i + 1} ({h.question.category}): {h.question.question}
                        </span>
                        <span className="px-2 py-0.5 rounded-full font-bold bg-purple-100 text-[#6743ee]">
                          Score: {h.evaluation.score}/10
                        </span>
                      </div>

                      <p className="p-3 bg-white border border-slate-200 rounded-lg text-slate-700 leading-relaxed font-sans whitespace-pre-wrap">
                        <strong className="text-slate-900">Candidate Response:</strong> {h.answer}
                      </p>

                      <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900">
                        <strong className="font-semibold">Panel Feedback:</strong> {h.evaluation.feedback}
                        {h.evaluation.interviewerReaction && (
                          <div className="mt-1 text-[11px] text-emerald-800 font-medium">
                            {h.evaluation.interviewerReaction}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* =================================================================== */}
      {/* FEATURE 5: ENVIRONMENTAL INTEGRITY & ANTI-CHEAT DRAWER              */}
      {/* =================================================================== */}
      {showIntegrityDrawer && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white h-full max-w-lg w-full p-6 shadow-2xl overflow-y-auto space-y-5 border-l border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-base">Environmental Integrity Audit</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowIntegrityDrawer(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Trust Index Score Card */}
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase text-emerald-800 block">Candidate Trust Index</span>
                <span className="text-2xl font-black text-emerald-800">{integrityReport.trustIndex}%</span>
                <span className="text-xs text-emerald-700 block mt-0.5">{integrityReport.status}</span>
              </div>
              <ShieldCheck className="w-10 h-10 text-emerald-600 opacity-80" />
            </div>

            {/* Integrity Stats */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-slate-400 text-[10px] block">Tab Switches</span>
                <span className="font-bold text-slate-800 text-sm">{integrityReport.stats.tabSwitches} Events</span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-slate-400 text-[10px] block">External Pastes</span>
                <span className="font-bold text-slate-800 text-sm">{integrityReport.stats.pasteCount} Pastes</span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-slate-400 text-[10px] block">Acoustic Spikes</span>
                <span className="font-bold text-slate-800 text-sm">{integrityReport.stats.acousticSpikes} Spikes</span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-slate-400 text-[10px] block">Typing Cadence</span>
                <span className="font-bold text-slate-800 text-sm">{integrityReport.stats.humanTypingCadenceScore}% Human</span>
              </div>
            </div>

            {/* Timestamped Event Audit Trail */}
            <div className="space-y-2">
              <span className="font-bold text-slate-900 text-xs block">Chronological Integrity Event Log:</span>
              {integrityEvents.length === 0 ? (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-500">
                  No anomalous events recorded. Candidate has maintained active focus and natural typing rhythm.
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {integrityEvents.map((evt) => (
                    <div key={evt.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-800 capitalize">{evt.type.replace('_', ' ')}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{evt.timestamp}</span>
                      </div>
                      <p className="text-[11px] text-slate-600">{evt.details}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setShowIntegrityDrawer(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl cursor-pointer"
              >
                Close Audit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: SHARE CANDIDATE ACCESS LINK                                  */}
      {/* =================================================================== */}
      {showInviteModal && activeCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Share2 className="w-5 h-5 text-[#6743ee]" />
                <h3 className="font-bold text-slate-900 text-base">Candidate Online Interview Link</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Send this secure online portal link to <strong>{activeCandidate.name}</strong>. The link grants
              one-time 48-hour access to complete the AI video &amp; voice assessment asynchronously or synchronously.
            </p>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Personalized Room URL</span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={`https://recruit.company.com/interview/live/${activeCandidate.candidate_id}?token=eval_live_${activeCandidate.candidate_id.toLowerCase()}`}
                  className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-2 font-mono text-slate-800"
                />
                <button
                  type="button"
                  onClick={handleCopyInviteLink}
                  className="px-3 py-2 bg-[#6743ee] hover:bg-[#5637d2] text-white rounded-lg text-xs font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  {linkCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{linkCopied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            <div className="text-[11px] text-slate-500 space-y-1">
              <p>&bull; Target Role: <strong>{brief?.job_title || activeCandidate.role}</strong></p>
              <p>&bull; Link Expiration: <strong>48 hours from dispatch</strong></p>
              <p>&bull; Mode: <strong>Supports Async Candidate Portal and Live Recruiter Room</strong></p>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
