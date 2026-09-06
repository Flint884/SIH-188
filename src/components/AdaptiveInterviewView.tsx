import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Clock,
  ArrowRight,
  RefreshCw,
  Send,
  Building2,
  MapPin,
  Calendar,
  Home,
  User,
  Info,
  ChevronDown,
  ChevronUp,
  FileText,
  AlertOctagon,
  Radio,
  Activity,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { InterviewState, InterviewInconsistency } from '../types.ts';

interface AdaptiveInterviewViewProps {
  interviewState: InterviewState;
  onUpdateState: (newState: InterviewState) => void;
  onProceedToRiskDecision: () => void;
  token: string;
}

export const AdaptiveInterviewView: React.FC<AdaptiveInterviewViewProps> = ({
  interviewState,
  onUpdateState,
  onProceedToRiskDecision,
  token,
}) => {
  const [inputText, setInputText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [hasMicPermission, setHasMicPermission] = useState<boolean>(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [isSpeakingQuestion, setIsSpeakingQuestion] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [showHistory, setShowHistory] = useState(true);

  const recognitionRef = useRef<any>(null);
  const keepListeningRef = useRef(false);
  const finalTranscriptRef = useRef('');
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Stop all audio hardware tracks and listeners safely
  const stopAudioCapture = (userInitiated = true) => {
    keepListeningRef.current = !userInitiated && keepListeningRef.current;
    setIsListening(false);
    setAudioLevel(0);

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch (e) {}
      recognitionRef.current = null;
    }

    if (audioContextRef.current) {
      try {
        if (audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close();
        }
      } catch (e) {}
      audioContextRef.current = null;
    }

    if (mediaStreamRef.current) {
      try {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      } catch (e) {}
      mediaStreamRef.current = null;
    }
  };

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      stopAudioCapture();
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Text-To-Speech for AI Questions
  const handleSpeakQuestion = () => {
    if (!window.speechSynthesis || !interviewState.currentQuestion) return;

    if (isSpeakingQuestion) {
      window.speechSynthesis.cancel();
      setIsSpeakingQuestion(false);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(interviewState.currentQuestion);
    utterance.lang = 'en-US';
    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    utterance.onstart = () => setIsSpeakingQuestion(true);
    utterance.onend = () => setIsSpeakingQuestion(false);
    utterance.onerror = () => setIsSpeakingQuestion(false);

    window.speechSynthesis.speak(utterance);
  };

  // High-reliability microphone activation with direct hardware stream & audio meter
  const handleStartListening = async () => {
    setSpeechError(null);
    setVoiceTranscript('');
    setInputText('');
    finalTranscriptRef.current = '';
    keepListeningRef.current = true;

    // 1. Explicitly acquire user microphone stream to ensure hardware permission
    let stream: MediaStream | null = null;
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Microphone audio capture is not supported by your browser.');
      }
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      setHasMicPermission(true);
    } catch (err: any) {
      console.warn('Microphone getUserMedia error:', err);
      keepListeningRef.current = false;
      const isNotAllowed = err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError';
      setSpeechError(
        isNotAllowed
          ? 'Microphone access denied. Please allow microphone permission in your browser address bar.'
          : `Microphone device error: ${err.message || 'Unable to access audio input.'}`
      );
      return;
    }

    // 2. Set up Web Audio API Analyser for real-time live volume & wave feedback
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx && stream) {
        const audioCtx = new AudioCtx();
        if (audioCtx.state === 'suspended') {
          await audioCtx.resume();
        }
        audioContextRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        analyser.smoothingTimeConstant = 0.5;
        source.connect(analyser);
        analyserRef.current = analyser;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const updateAudioMeter = () => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          // Scale avg (0 to 128) to 0-100%
          const pct = Math.min(100, Math.round((avg / 80) * 100));
          setAudioLevel(pct);
          animFrameRef.current = requestAnimationFrame(updateAudioMeter);
        };
        updateAudioMeter();
      }
    } catch (audioErr) {
      console.warn('Audio analyser setup error:', audioErr);
    }

    // 3. Start Web Speech Recognition
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        if (recognitionRef.current) {
          try {
            recognitionRef.current.abort();
          } catch (e) {}
        }
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
          setIsListening(true);
          setSpeechError(null);
        };

        recognition.onresult = (event: any) => {
          let interim = '';
          let final = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              final += event.results[i][0].transcript;
            } else {
              interim += event.results[i][0].transcript;
            }
          }
          if (final) {
            finalTranscriptRef.current = `${finalTranscriptRef.current} ${final}`.trim();
          }
          const captured = `${finalTranscriptRef.current} ${interim}`.trim();
          if (captured) {
            setVoiceTranscript(captured);
            setInputText(captured);
          }
        };

        recognition.onerror = (event: any) => {
          console.warn('Speech recognition error:', event.error);
          if (event.error === 'no-speech') {
            // Keep listening, do not abort
            return;
          }
          if (event.error === 'not-allowed') {
            keepListeningRef.current = false;
            setSpeechError('Microphone permission blocked. Please check browser permissions.');
          } else if (event.error === 'network') {
            setSpeechError(
              'Microphone is actively capturing sound (audio meter active). Note: Sandboxed iframe may limit cloud speech server. You can also type or use quick answers below.'
            );
          } else {
            setSpeechError(`Speech recognition notice: ${event.error}. Feel free to type.`);
          }
        };

        recognition.onend = () => {
          // Some browsers end recognition after a pause even with continuous mode.
          if (keepListeningRef.current && mediaStreamRef.current) {
            window.setTimeout(() => {
              if (!keepListeningRef.current || !mediaStreamRef.current) return;
              try {
                recognition.start();
              } catch (restartErr) {
                console.warn('Speech recognition restart failed:', restartErr);
              }
            }, 150);
          } else {
            setIsListening(false);
          }
        };

        recognitionRef.current = recognition;
        recognition.start();
        setIsListening(true);
      } catch (recErr: any) {
        console.warn('Speech recognition start failed:', recErr);
        setIsListening(Boolean(mediaStreamRef.current));
        setSpeechError('Microphone is active, but speech recognition could not start. You can type your answer below.');
      }
    } else {
      setIsListening(Boolean(mediaStreamRef.current));
      setSpeechSupported(false);
      setSpeechError(
        'Speech recognition is not supported in this browser. Microphone audio level is active, and you can type below.'
      );
    }
  };

  const handleStopListening = () => {
    keepListeningRef.current = false;
    stopAudioCapture(true);
  };

  // Submit Answer to Adaptive AI Backend
  const handleSubmitAnswer = async (answerTextToSend?: string) => {
    const text = (answerTextToSend !== undefined ? answerTextToSend : inputText).trim();
    if (!text || isSubmitting || !token) return;

    setIsSubmitting(true);
    keepListeningRef.current = false;
    stopAudioCapture(true);
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeakingQuestion(false);
    }

    try {
      const res = await fetch('/api/verification/interview/answer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentState: interviewState,
          answerText: text,
          caseContext: {
            caseId: interviewState.caseId,
            visaType: interviewState.visaType,
            nationality: interviewState.nationality,
            origin: interviewState.origin,
            destination: interviewState.destination,
          },
        }),
      });

      const data = await res.json();
      if (res.ok && data.interviewState) {
        onUpdateState(data.interviewState);
        setInputText('');
        setVoiceTranscript('');
      } else {
        setSpeechError(data.error || 'Failed to submit response.');
      }
    } catch (err: any) {
      setSpeechError(err.message || 'Network error while submitting answer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isCompleted =
    interviewState.status === 'COMPLETED_SUFFICIENT_INFO' ||
    interviewState.status === 'COMPLETED_MAX_REACHED' ||
    interviewState.status === 'REVIEW_REQUIRED';

  const unresolvedInconsistencies = interviewState.potentialInconsistencies.filter(
    (i) => !i.resolved
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* 1. CASE CONTEXT BAR */}
      <div className="bg-[#0D1525] border border-cyan-900/60 rounded-xl p-4 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-cyan-900/40 text-xs font-mono">
          {(interviewState.caseId || interviewState.travelType) && (
            <div className="flex items-center gap-3">
              {interviewState.caseId && (
                <span className="px-2.5 py-1 rounded bg-cyan-950 border border-cyan-700 text-cyan-300 font-bold tracking-wider">
                  {interviewState.caseId}
                </span>
              )}
              {interviewState.travelType && (
                <>
                  <span className="text-slate-400">TRAVEL TYPE:</span>
                  <span className="font-bold text-white uppercase">{interviewState.travelType}</span>
                </>
              )}
            </div>
          )}

          {(interviewState.origin || interviewState.destination) && (
            <div className="flex items-center gap-4 text-slate-300">
              {interviewState.origin && (
                <div>
                  <span className="text-slate-400">ORIGIN:</span>{' '}
                  <span className="font-bold text-white">{interviewState.origin}</span>
                </div>
              )}
              {interviewState.origin && interviewState.destination && <div className="text-cyan-500">➔</div>}
              {interviewState.destination && (
                <div>
                  <span className="text-slate-400">DESTINATION:</span>{' '}
                  <span className="font-bold text-white">{interviewState.destination}</span>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded bg-slate-900 border border-slate-700 text-slate-300 text-[11px]">
              🌐 Language: <strong className="text-emerald-400">English</strong>
            </span>
          </div>
        </div>

        {(interviewState.nationality || interviewState.visaType || interviewState.visaConditions) && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 text-xs font-mono">
            {interviewState.nationality && (
              <div className="p-2 rounded bg-[#090D15] border border-slate-800">
                <span className="text-slate-500 text-[10px] block uppercase">Nationality</span>
                <span className="font-bold text-slate-200">{interviewState.nationality}</span>
              </div>
            )}
            {interviewState.visaType && (
              <div className="p-2 rounded bg-[#090D15] border border-slate-800">
                <span className="text-slate-500 text-[10px] block uppercase">Visa Category</span>
                <span className="font-bold text-cyan-300">{interviewState.visaType}</span>
              </div>
            )}
            {interviewState.visaConditions && (
              <div className="p-2 rounded bg-[#090D15] border border-slate-800">
                <span className="text-slate-500 text-[10px] block uppercase">Visa Conditions</span>
                <span className="text-amber-300 text-[11px] truncate block" title={interviewState.visaConditions}>
                  {interviewState.visaConditions}
                </span>
              </div>
            )}
            <div className="p-2 rounded bg-[#090D15] border border-slate-800">
              <span className="text-slate-500 text-[10px] block uppercase">Interview Status</span>
              <span className="font-bold text-emerald-400">{interviewState.status.replaceAll('_', ' ')}</span>
            </div>
          </div>
        )}
      </div>

      {/* 2. DYNAMIC QUESTION PROGRESS BAR */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-full bg-cyan-950 border border-cyan-500 flex items-center justify-center text-cyan-300 text-xs font-mono font-bold">
              {Math.min(interviewState.questionCount, 5)}
            </div>
            <h4 className="text-sm font-bold text-white font-mono uppercase tracking-wide">
              Question {Math.min(interviewState.questionCount, 5)} of 5
            </h4>
            {isCompleted && (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-950 border border-emerald-600 text-emerald-300">
                INTERVIEW CONCLUDED
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-400 font-mono">
            ℹ 5 targeted adaptive questions. Interview concludes early once purpose, stay, and hotel facts are verified.
          </p>
        </div>

        {/* 5-segment progress bar */}
        <div className="grid grid-cols-5 gap-2 h-2.5 bg-slate-950 p-0.5 rounded-full border border-slate-800">
          {Array.from({ length: 5 }).map((_, idx) => {
            const qNum = idx + 1;
            const isAnswered = qNum < interviewState.questionCount || isCompleted;
            const isCurrent = qNum === interviewState.questionCount && !isCompleted;
            return (
              <div
                key={qNum}
                title={`Question ${qNum} of 5`}
                className={`h-full rounded-full transition-all ${
                  isCurrent
                    ? 'bg-cyan-400 animate-pulse ring-2 ring-cyan-500/40'
                    : isAnswered
                    ? 'bg-emerald-500'
                    : 'bg-slate-800'
                }`}
              />
            );
          })}
        </div>
      </div>

      {/* 3. INTERVIEW MAIN STAGE: AI QUESTION & PASSENGER INPUT */}
      {!isCompleted ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Question & Voice/Text Response Area */}
          <div className="lg:col-span-2 space-y-6">
            {/* AI Question Box */}
            <div className="bg-gradient-to-br from-[#0B1528] to-[#0A101C] border-2 border-cyan-500/40 rounded-xl p-6 shadow-2xl relative overflow-hidden">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-cyan-950/80 border border-cyan-600 text-cyan-400">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-400">
                    AI Immigration Assistant
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleSpeakQuestion}
                  title="Read question aloud (Audio TTS)"
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono flex items-center gap-1.5 transition-all cursor-pointer ${
                    isSpeakingQuestion
                      ? 'bg-cyan-600 text-white animate-pulse'
                      : 'bg-slate-800 hover:bg-slate-700 text-cyan-300'
                  }`}
                >
                  {isSpeakingQuestion ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                  <span>{isSpeakingQuestion ? 'STOP AUDIO' : 'PLAY AUDIO'}</span>
                </button>
              </div>

              <div className="my-4">
                <p className="text-lg md:text-xl font-medium text-white leading-relaxed font-sans">
                  "{interviewState.currentQuestion}"
                </p>
              </div>

              {interviewState.currentQuestion.toLowerCase().includes('clarif') && (
                <div className="mt-3 p-2.5 rounded bg-amber-950/60 border border-amber-600 text-amber-200 text-xs font-mono flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                  <span>
                    <strong>Priority Clarification:</strong> Resolving potential information discrepancy
                    before continuing.
                  </span>
                </div>
              )}
            </div>

            {/* Passenger Response Terminal */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <h4 className="text-xs font-bold text-slate-300 font-mono uppercase tracking-wider flex items-center gap-2">
                  <span>Passenger Response Terminal</span>
                  {isListening && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-red-950 text-red-400 border border-red-800 animate-pulse flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-ping" />
                      <span>MIC RECORDING AUDIO</span>
                    </span>
                  )}
                </h4>
                <span className="text-[11px] font-mono text-slate-500">
                  Microphone or Keyboard Input
                </span>
              </div>

              {/* Voice Interaction Interface with Live Visualizer */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 space-y-3">
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <button
                    type="button"
                    onClick={isListening ? handleStopListening : handleStartListening}
                    disabled={isSubmitting}
                    className={`h-16 w-16 rounded-full flex items-center justify-center transition-all cursor-pointer shrink-0 shadow-lg ${
                      isListening
                        ? 'bg-red-600 text-white ring-4 ring-red-500/40 animate-pulse'
                        : 'bg-cyan-600 hover:bg-cyan-500 text-white ring-4 ring-cyan-500/20'
                    }`}
                    title={isListening ? 'Click to stop listening' : 'Click to speak using microphone'}
                  >
                    {isListening ? <MicOff className="h-7 w-7" /> : <Mic className="h-7 w-7" />}
                  </button>

                  <div className="flex-1 text-center sm:text-left space-y-1">
                    <div className="text-xs font-mono font-bold text-slate-200 flex items-center justify-center sm:justify-start gap-2">
                      <span>
                        {isListening
                          ? 'Microphone active — speak clearly into your mic now...'
                          : voiceTranscript
                          ? 'Voice transcript captured. Confirm or edit below.'
                          : 'Click microphone to answer aloud, or type your response below.'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {isListening
                        ? 'Capturing audio in real-time. Click "Done Speaking" or wait when finished.'
                        : 'Hardware microphone and speech recognition enabled.'}
                    </div>
                  </div>

                  {isListening && (
                    <button
                      type="button"
                      onClick={handleStopListening}
                      className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs font-mono tracking-wider cursor-pointer shadow-md transition-colors"
                    >
                      ✓ Done Speaking
                    </button>
                  )}
                </div>

                {/* Real-time Audio Level & Waveform Meter */}
                {isListening && (
                  <div className="pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex items-center gap-1.5 text-[10px] font-mono font-bold text-cyan-300 shrink-0">
                      <Activity className="h-3.5 w-3.5 text-cyan-400 animate-pulse" />
                      <span>MIC LEVEL: {audioLevel}%</span>
                    </div>
                    <div className="flex-1 h-2 bg-slate-900 rounded-full overflow-hidden border border-cyan-900/60">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 via-cyan-400 to-amber-400 transition-all duration-75"
                        style={{ width: `${Math.max(6, Math.min(100, audioLevel))}%` }}
                      />
                    </div>
                    {/* Live Equalizer Sound Wave Bars */}
                    <div className="flex items-center gap-1 h-5 shrink-0 justify-center">
                      {[0.5, 1.2, 0.8, 1.5, 0.9, 1.3, 0.6].map((multiplier, barIdx) => {
                        const barHeight = Math.max(3, Math.min(20, Math.round((audioLevel / 100) * 20 * multiplier)));
                        return (
                          <div
                            key={barIdx}
                            className="w-1 bg-cyan-400 rounded-full transition-all duration-75"
                            style={{ height: `${barHeight}px` }}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Speech Error Banner */}
              {speechError && (
                <div className="p-3 rounded-lg bg-amber-950/60 border border-amber-800 text-amber-200 text-xs font-mono flex items-center justify-between">
                  <span>{speechError}</span>
                  <button
                    type="button"
                    onClick={() => setSpeechError(null)}
                    className="text-amber-400 hover:text-amber-200 font-bold ml-2"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Text Area & Submit Controls */}
              <div className="space-y-3">
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmitAnswer();
                    }
                  }}
                  disabled={isSubmitting}
                  placeholder="Passenger response (speak using microphone or type response here)..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 placeholder:text-slate-600 font-sans"
                />

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {voiceTranscript && (
                      <button
                        type="button"
                        onClick={() => {
                          setVoiceTranscript('');
                          setInputText('');
                          handleStartListening();
                        }}
                        className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono flex items-center gap-1.5 cursor-pointer"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        <span>RECORD AGAIN</span>
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSubmitAnswer()}
                    disabled={isSubmitting || !inputText.trim()}
                    className={`px-6 py-2.5 rounded-lg text-xs font-mono font-bold tracking-wider flex items-center gap-2 cursor-pointer shadow-lg transition-all ${
                      isSubmitting || !inputText.trim()
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/50'
                    }`}
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>ANALYZING WITH GEMINI...</span>
                      </>
                    ) : (
                      <>
                        <span>CONFIRM & SUBMIT ANSWER</span>
                        <Send className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>

            </div>
          </div>

          {/* Right Col: Structured Facts Intelligence Panel (Officer Facing) */}
          <div className="space-y-4">
            <div className="bg-[#0E131F] border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-cyan-400" />
                  <h4 className="text-xs font-bold text-white font-mono uppercase tracking-wider">
                    Extracted Intelligence
                  </h4>
                </div>
                <span className="text-[10px] font-mono text-cyan-400 font-bold">LIVE STATE</span>
              </div>

              {/* Extracted Facts List */}
              <div className="space-y-2.5 text-xs font-mono">
                <div className="p-2.5 rounded-lg bg-[#090D15] border border-slate-800 flex items-start gap-2">
                  <Building2 className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <span className="text-[10px] text-slate-400 block uppercase">Declared Purpose</span>
                    <span className="font-bold text-white">
                      {interviewState.detectedPurpose || 'Awaiting passenger declaration...'}
                    </span>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-[#090D15] border border-slate-800 flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <span className="text-[10px] text-slate-400 block uppercase">Destination City</span>
                    <span className="font-bold text-white">
                      {interviewState.destinationCities.length > 0
                        ? interviewState.destinationCities.join(', ')
                        : 'Awaiting destination city...'}
                    </span>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-[#090D15] border border-slate-800 flex items-start gap-2">
                  <Calendar className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <span className="text-[10px] text-slate-400 block uppercase">Expected Stay Duration</span>
                    <span className="font-bold text-white">
                      {interviewState.expectedStay || 'Awaiting duration...'}
                    </span>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-[#090D15] border border-slate-800 flex items-start gap-2">
                  <Home className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <span className="text-[10px] text-slate-400 block uppercase">Accommodation</span>
                    <span className="font-bold text-white">
                      {interviewState.accommodation || 'Awaiting hotel / residence...'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Potential Inconsistencies Card */}
              <div className="pt-2 border-t border-slate-800">
                <span className="text-[10px] font-mono text-slate-400 uppercase font-bold block mb-2">
                  Potential Inconsistencies
                </span>
                {unresolvedInconsistencies.length === 0 ? (
                  <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-xs font-mono flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>No significant inconsistencies detected.</span>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {unresolvedInconsistencies.map((inc, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-lg bg-amber-950/70 border border-amber-600 text-amber-200 text-xs font-mono space-y-1"
                      >
                        <div className="flex items-center justify-between font-bold">
                          <span>⚠ {inc.field}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-900 border border-amber-500">
                            {inc.severity}
                          </span>
                        </div>
                        <p className="text-[11px] text-amber-300">{inc.issue}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Officer Early Completion Option */}
              <div className="pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={onProceedToRiskDecision}
                  className="w-full px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <span>OFFICER BYPASS & PROCEED TO CLEARANCE</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* 4. COMPLETED INTERVIEW SCREEN */
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-slate-900 border border-slate-800 rounded-xl p-8 shadow-2xl space-y-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div
                className={`h-12 w-12 rounded-xl flex items-center justify-center text-white shadow-lg ${
                  interviewState.status === 'REVIEW_REQUIRED' ||
                  interviewState.consistencyRating === 'POTENTIAL_MISMATCH'
                    ? 'bg-amber-600'
                    : 'bg-emerald-600'
                }`}
              >
                {interviewState.status === 'REVIEW_REQUIRED' ? (
                  <AlertOctagon className="h-6 w-6" />
                ) : (
                  <CheckCircle2 className="h-6 w-6" />
                )}
              </div>
              <div>
                <h3 className="text-xl font-bold text-white uppercase font-sans">
                  Pre-Screening Interview Completed
                </h3>
                <p className="text-xs text-slate-400 font-mono">
                  Concluded in {interviewState.questionsAsked.length} question(s) •{' '}
                  {interviewState.status === 'COMPLETED_SUFFICIENT_INFO'
                    ? 'Sufficient travel information confirmed early'
                    : interviewState.status === 'COMPLETED_MAX_REACHED'
                    ? '15 Questions Completed'
                    : 'Referred to Secondary Officer Review'}
                </p>
              </div>
            </div>

            <div className="text-right font-mono">
              <span
                className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                  interviewState.recommendation === 'NO_SIGNIFICANT_INCONSISTENCIES'
                    ? 'bg-emerald-950 border border-emerald-500 text-emerald-300'
                    : 'bg-amber-950 border border-amber-500 text-amber-300'
                }`}
              >
                {interviewState.recommendation === 'NO_SIGNIFICANT_INCONSISTENCIES'
                  ? '✓ NO SIGNIFICANT INCONSISTENCIES'
                  : '⚠ ADDITIONAL OFFICER REVIEW REQUIRED'}
              </span>
            </div>
          </div>

          {/* Intelligence Synthesis Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-mono">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-slate-500 text-[10px] uppercase block">Travel Purpose</span>
              <span className="font-bold text-white text-sm">
                {interviewState.detectedPurpose || 'General Tourism / Travel'}
              </span>
            </div>
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-slate-500 text-[10px] uppercase block">Destinations</span>
              <span className="font-bold text-white text-sm">
                {interviewState.destinationCities.join(', ') || interviewState.destination}
              </span>
            </div>
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-slate-500 text-[10px] uppercase block">Stay Duration</span>
              <span className="font-bold text-white text-sm">
                {interviewState.expectedStay || 'Standard entry duration'}
              </span>
            </div>
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-slate-500 text-[10px] uppercase block">Accommodation</span>
              <span className="font-bold text-white text-sm">
                {interviewState.accommodation || 'Commercial / Hotel'}
              </span>
            </div>
          </div>

          {/* AI Executive Summary */}
          {interviewState.finalSummary && (
            <div className="p-4 rounded-xl bg-[#090D15] border border-cyan-900/60 text-slate-200 text-xs font-mono space-y-1.5">
              <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider block">
                Executive Synthesis Verdict:
              </span>
              <p className="leading-relaxed text-slate-300">{interviewState.finalSummary}</p>
            </div>
          )}

          {/* Officer Decisions */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setShowHistory(!showHistory)}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono flex items-center gap-2 cursor-pointer"
            >
              <FileText className="h-4 w-4" />
              <span>{showHistory ? 'HIDE Q&A TRANSCRIPT' : 'VIEW FULL Q&A TRANSCRIPT'}</span>
            </button>

            <button
              type="button"
              onClick={onProceedToRiskDecision}
              className="px-8 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs font-mono tracking-wider flex items-center gap-2 cursor-pointer shadow-xl shadow-emerald-950/60 transition-all"
            >
              <span>PROCEED TO RISK ASSESSMENT & FINAL VERDICT</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}

      {/* 5. INTERVIEW TRANSCRIPT AUDIT LOG (Collapsible) */}
      {interviewState.questionsAsked.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
          <button
            type="button"
            onClick={() => setShowHistory(!showHistory)}
            className="w-full p-4 flex items-center justify-between text-xs font-mono text-slate-300 hover:bg-slate-800/50 cursor-pointer transition-colors"
          >
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-cyan-400" />
              <span className="font-bold text-white uppercase">
                Interview Transcript Log ({interviewState.questionsAsked.length} question(s))
              </span>
            </div>
            {showHistory ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {showHistory && (
            <div className="p-4 border-t border-slate-800 space-y-4 max-h-96 overflow-y-auto font-mono text-xs">
              {interviewState.questionsAsked.map((qa, index) => (
                <div
                  key={index}
                  className={`p-3.5 rounded-lg border ${
                    qa.inconsistencyDetected
                      ? 'bg-amber-950/40 border-amber-800/80'
                      : 'bg-slate-950 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1.5">
                    <span className="font-bold text-cyan-400">Q{qa.questionNumber}:</span>
                    <span>{new Date(qa.timestamp).toLocaleTimeString()}</span>
                  </div>

                  <p className="text-white font-medium mb-2 font-sans text-sm">
                    "{qa.question}"
                  </p>

                  <div className="pl-3 border-l-2 border-slate-700 text-slate-300 font-sans text-sm">
                    <span className="text-[10px] font-mono text-slate-500 block uppercase">
                      Passenger Answer:
                    </span>
                    "{qa.answer}"
                  </div>

                  {qa.inconsistencyDetected && qa.inconsistencyDetail && (
                    <div className="mt-2 text-[11px] text-amber-300 font-mono">
                      ⚠ {qa.inconsistencyDetail}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
