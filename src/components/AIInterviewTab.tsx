import React, { useState, useRef, useEffect } from 'react';
import { 
  Camera, 
  Mic, 
  MicOff, 
  Volume2, 
  CheckCircle2, 
  AlertTriangle, 
  Play, 
  FastForward, 
  Award, 
  RefreshCw,
  Video,
  UserCheck
} from 'lucide-react';
import { recruitmentAgent } from '../services/recruitmentAgent';
import { InterviewHistoryItem } from '../types';

interface AIInterviewTabProps {
  resumeReadinessScore?: number;
}

export const AIInterviewTab: React.FC<AIInterviewTabProps> = ({ resumeReadinessScore = 85 }) => {
  const [role, setRole] = useState("Software Engineer");
  const [currentQuestion, setCurrentQuestion] = useState<string | null>(null);
  const [answerInput, setAnswerInput] = useState<string>("");
  const [history, setHistory] = useState<InterviewHistoryItem[]>([]);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);

  // Proctored camera & motion state
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [motionScore, setMotionScore] = useState<number>(0);
  const [motionHistory, setMotionHistory] = useState<number[]>([]);
  const [cameraAlertFrame, setCameraAlertFrame] = useState<string | null>(null);
  const [liveMotionAlert, setLiveMotionAlert] = useState<number | null>(null);

  // Speech recognition & synthesis state
  const [isListening, setIsListening] = useState<boolean>(false);
  const [speechStatus, setSpeechStatus] = useState<string>("Use microphone to answer or type below.");
  const [isSpeechSupported, setIsSpeechSupported] = useState<boolean>(true);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const prevFrameDataRef = useRef<Uint8ClampedArray | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSpeechSupported(false);
      setSpeechStatus("Speech recognition is not supported in this browser. Type answers below.");
    }
  }, []);

  // Camera start / stop lifecycle
  useEffect(() => {
    let intervalId: any = null;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setIsCameraActive(true);
        setCameraError(null);

        // Frame difference motion detection loop
        intervalId = setInterval(() => {
          captureMotionFrame();
        }, 800);
      } catch (err: any) {
        setIsCameraActive(false);
        setCameraError("Camera access denied or unavailable in this environment.");
      }
    }

    startCamera();

    return () => {
      if (intervalId) clearInterval(intervalId);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  const captureMotionFrame = () => {
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

    let diff = 0;
    const prev = prevFrameDataRef.current;

    if (prev) {
      for (let i = 0; i < data.length; i += 4) {
        const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
        const prevGray = (prev[i] + prev[i + 1] + prev[i + 2]) / 3;
        diff += Math.abs(gray - prevGray);
      }
      const score = Math.min(100, Number(((diff / (data.length / 4)) * 0.4).toFixed(2)));
      setMotionScore(score);

      setMotionHistory(prevHist => {
        const nextHist = [...prevHist, score].slice(-12);
        const { suspicious, motion_score } = recruitmentAgent.detectRepeatedMotion(nextHist);
        if (suspicious) {
          setLiveMotionAlert(motion_score);
          const frameDataUrl = canvas.toDataURL('image/jpeg', 0.6);
          setCameraAlertFrame(frameDataUrl);
        }
        return nextHist;
      });
    }

    // Save copy of current grayscale buffer
    prevFrameDataRef.current = new Uint8ClampedArray(data);
  };

  // Text to Speech: Read question aloud
  const handleReadAloud = () => {
    if (!currentQuestion || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(currentQuestion);
    utterance.rate = 1.0;
    window.speechSynthesis.speak(utterance);
  };

  // Speech Recognition: Start listening
  const handleStartSpeaking = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsListening(true);
        setSpeechStatus("Listening... speak your response.");
      };

      recognition.onresult = (event: any) => {
        let current = "";
        for (let i = 0; i < event.results.length; i++) {
          current += event.results[i][0].transcript;
        }
        setAnswerInput(current.trim());
        setSpeechStatus(`Listening: "${current.trim()}"`);
      };

      recognition.onerror = (event: any) => {
        setSpeechStatus(`Speech recognition notice: ${event.error}. You can type directly.`);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
        setSpeechStatus("Speech captured. Review or edit your response below.");
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e) {
      setIsListening(false);
    }
  };

  const handleStopSpeaking = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  };

  // Interview actions
  const handleStartInterview = () => {
    const q = recruitmentAgent.generateOnlineInterviewQuestion(role);
    setCurrentQuestion(q);
    setAnswerInput("");
    setHistory([]);
    setIsCompleted(false);
    setLiveMotionAlert(null);
  };

  const handleSubmitAnswer = () => {
    if (!currentQuestion || !answerInput.trim()) return;

    const evalResult = recruitmentAgent.evaluateOnlineInterviewAnswer(currentQuestion, answerInput);
    const item: InterviewHistoryItem = {
      question: currentQuestion,
      answer: answerInput.trim(),
      result: evalResult,
      motion_alert: liveMotionAlert,
      timestamp: Date.now()
    };

    setHistory(prev => [...prev, item]);

    // Next question
    const nextQ = recruitmentAgent.generateOnlineInterviewQuestion(role);
    setCurrentQuestion(nextQ);
    setAnswerInput("");
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  };

  const handleSkipQuestion = () => {
    const nextQ = recruitmentAgent.generateOnlineInterviewQuestion(role);
    setCurrentQuestion(nextQ);
    setAnswerInput("");
    if (window.speechSynthesis) window.speechSynthesis.cancel();
  };

  const handleFinishInterview = () => {
    setIsCompleted(true);
    setCurrentQuestion(null);
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };

  // Average interview score
  const scores = history.map(h => h.result.score);
  const interviewScore = scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) : 0;
  const avgMotion = motionHistory.length > 0 ? (motionHistory.reduce((a, b) => a + b, 0) / motionHistory.length).toFixed(1) : "0.0";

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">AI Online Video & Voice Interview</h2>
          <p className="text-xs text-slate-500">
            Read questions aloud, answer with live speech recognition or typed responses, and receive real-time AI scoring.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="Target Role"
            className="text-xs px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-semibold"
          />
          {!currentQuestion ? (
            <button
              onClick={handleStartInterview}
              className="px-4 py-2 bg-[#6743ee] hover:bg-[#5637d2] text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5" />
              Start Interview
            </button>
          ) : (
            <button
              onClick={handleFinishInterview}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs"
            >
              Finish Interview
            </button>
          )}
        </div>
      </div>

      {/* Main Workspace: Left video proctor, Right metrics & chat */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Video Proctor Feed */}
        <div className="lg:col-span-7 bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                Live Proctor & Motion Feed
              </span>
            </div>
            <span className="text-[11px] text-slate-500 font-mono">
              Movement intensity: {motionScore}
            </span>
          </div>

          <div className="relative aspect-video bg-slate-950 rounded-xl overflow-hidden flex items-center justify-center border border-slate-800">
            <video
              ref={videoRef}
              playsInline
              autoPlay
              muted
              className={`w-full h-full object-cover ${!isCameraActive ? 'hidden' : ''}`}
            />
            <canvas ref={canvasRef} className="hidden" />

            {!isCameraActive && (
              <div className="text-center p-6 text-slate-400 space-y-2">
                <Camera className="w-10 h-10 mx-auto text-slate-600" />
                <p className="text-xs">{cameraError || "Requesting camera stream..."}</p>
                <span className="text-[10px] text-slate-500 block">
                  Camera feed is monitored locally in the browser for motion artifacts.
                </span>
              </div>
            )}

            {/* Live badge overlay */}
            {isCameraActive && (
              <div className="absolute top-3 left-3 bg-red-600/90 text-white px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase flex items-center gap-1 shadow-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
                PROCTOR LIVE
              </div>
            )}
          </div>

          <p className="text-[11px] text-slate-400 italic">
            Note: Optional camera motion signals are provided for recruiter supervision context and are not used to reject candidates.
          </p>

          {/* Suspicious frame alert if captured */}
          {cameraAlertFrame && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3">
              <img
                src={cameraAlertFrame}
                alt="Motion Frame"
                className="w-16 h-12 object-cover rounded border border-amber-300"
              />
              <div className="text-xs text-amber-900">
                <span className="font-bold block flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  Elevated Motion Event Sampled ({liveMotionAlert})
                </span>
                <span className="text-[11px] text-amber-700">
                  Logged for optional recruiter verification.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Right: Score Metrics & AI Interviewer Status */}
        <div className="lg:col-span-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                AI Interview Score
              </span>
              <div className="text-3xl font-black text-[#6743ee] mt-1">{interviewScore}%</div>
              <span className="text-[10px] text-slate-500 mt-1 block">{history.length} responses evaluated</span>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Resume Readiness
              </span>
              <div className="text-3xl font-black text-amber-600 mt-1">{resumeReadinessScore}%</div>
              <span className="text-[10px] text-slate-500 mt-1 block">Baseline profile benchmark</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
            <div className="font-bold text-slate-900 text-xs uppercase tracking-wider">
              AI Interviewer Console
            </div>
            <div className="p-3 bg-[#f3f0ff] rounded-xl text-xs text-[#5b43d6] leading-relaxed">
              {currentQuestion
                ? "Your interviewer is listening. Speak clearly into your microphone or type your response below."
                : "Welcome! Click 'Start Interview' whenever you are ready to begin."}
            </div>
            <div className="text-[11px] text-slate-500 flex items-center justify-between">
              <span>Target Role: <strong>{role}</strong></span>
              <span>Avg Motion: <strong>{avgMotion}</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* Question & Answer Box */}
      {currentQuestion && (
        <section className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          {/* Question banner */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-[#6d5ef5] to-[#8a72ff] text-white shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-100">
                Current Question ({history.length + 1})
              </span>
              <button
                onClick={handleReadAloud}
                className="flex items-center gap-1.5 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-semibold backdrop-blur-xs transition-colors"
              >
                <Volume2 className="w-3.5 h-3.5" />
                Read question aloud
              </button>
            </div>
            <p className="text-base font-semibold leading-snug">{currentQuestion}</p>
          </div>

          {/* Voice status bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
            <div className="flex items-center gap-2">
              {isListening ? (
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping"></span>
              ) : (
                <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span>
              )}
              <span className="text-slate-700 font-medium">{speechStatus}</span>
            </div>

            <div className="flex items-center gap-2">
              {!isListening ? (
                <button
                  onClick={handleStartSpeaking}
                  disabled={!isSpeechSupported}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#6743ee] hover:bg-[#5637d2] text-white rounded-lg text-xs font-semibold disabled:opacity-50"
                >
                  <Mic className="w-3.5 h-3.5" />
                  Start speaking
                </button>
              ) : (
                <button
                  onClick={handleStopSpeaking}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold"
                >
                  <MicOff className="w-3.5 h-3.5" />
                  Stop speaking
                </button>
              )}
            </div>
          </div>

          {/* Answer text area */}
          <div>
            <textarea
              value={answerInput}
              onChange={(e) => setAnswerInput(e.target.value)}
              placeholder="Your answer will transcribe here in real-time, or you can type directly..."
              rows={4}
              className="w-full text-xs p-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#6743ee]"
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <button
              onClick={handleSkipQuestion}
              className="flex items-center gap-1 px-4 py-2 text-slate-500 hover:text-slate-800 text-xs font-semibold"
            >
              <FastForward className="w-3.5 h-3.5" />
              Skip Question
            </button>

            <button
              onClick={handleSubmitAnswer}
              disabled={!answerInput.trim()}
              className="px-6 py-2.5 bg-[#6743ee] hover:bg-[#5637d2] text-white text-xs font-bold rounded-xl transition-all shadow-xs disabled:opacity-50"
            >
              Submit Answer
            </button>
          </div>
        </section>
      )}

      {/* Review when completed */}
      {isCompleted && (
        <section className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-[#6743ee]" />
            <h3 className="font-bold text-slate-900 text-base">Interview Complete — Recruiter Review Summary</h3>
          </div>
          <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-950 space-y-2">
            <div className="font-bold">Overall Performance: {interviewScore}%</div>
            <p>
              Candidate answered {history.length} technical & situational questions for the {role} position. Average movement intensity across session: {avgMotion}.
            </p>
          </div>
        </section>
      )}

      {/* Scored Response History */}
      {history.length > 0 && (
        <section className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
          <h3 className="font-bold text-slate-900 text-sm">
            Interview Question History ({history.length})
          </h3>

          <div className="space-y-3">
            {[...history].reverse().map((item, idx) => (
              <div key={idx} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">Q: {item.question}</span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-[#f0ebff] text-[#5b43d6]">
                    Score: {item.result.score}/10
                  </span>
                </div>
                <p className="text-slate-700 bg-white p-2.5 rounded-lg border border-slate-200">
                  <strong>A:</strong> {item.answer}
                </p>
                <div className="text-emerald-800 font-medium">
                  <strong>AI Feedback:</strong> {item.result.feedback}
                </div>
                {item.result.improvement && (
                  <div className="text-amber-800 text-[11px]">
                    <strong>Tip:</strong> {item.result.improvement}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
