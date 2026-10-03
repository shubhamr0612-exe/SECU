import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api";
import { useVoice } from "../hooks/useVoice";
import HackerAvatar3D from "../components/HackerAvatar3D";
import { stateLabel, stateColor } from "../components/Avatar";
import { VoiceVisualizer } from "../components/VoiceVisualizer";
import { CameraView } from "../components/CameraView";
import { SelfieModal } from "../components/SelfieModal";
import { LeadForm } from "../components/LeadForm";
import { QuizModal } from "../components/QuizModal";
import { CoursesModal } from "../components/CoursesModal";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Mic, MicOff, Send, BookOpen, Trophy, PhoneCall, RotateCcw, Lock,
  Volume2, VolumeX, Camera, CameraOff, Eye, Sparkles, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

const WELCOME = "Hey! Welcome to eSecurityIn! I'm SECU. How's your day going?";

export default function Reception() {
  const [messages, setMessages] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [typed, setTyped] = useState("");
  const [lang, setLang] = useState("en-IN");
  const [muted, setMuted] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [started, setStarted] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [showLead, setShowLead] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [showCourses, setShowCourses] = useState(false);
  const [showSelfie, setShowSelfie] = useState(false);

  const scrollRef = useRef(null);
  const mutedRef = useRef(muted); mutedRef.current = muted;
  const captureRef = useRef(null);
  const busyRef = useRef(false);

  const speakOut = useCallback(async (text) => {
    if (mutedRef.current) return;
    await voice.speak(text, lang);
  }, [lang]); // eslint-disable-line

  const handleUserText = useCallback(async (text) => {
    if (!text?.trim() || busyRef.current) return;
    busyRef.current = true;
    setMessages((m) => [...m, { role: "user", message: text }]);
    setThinking(true);
    try {
      const r = await api.chat(text, sessionId, lang);
      setSessionId(r.data.session_id);
      setMessages((m) => [...m, { role: "assistant", message: r.data.reply }]);
      setThinking(false);
      await speakOut(r.data.reply);
      if (r.data.state === "LEAD_CAPTURE") setTimeout(() => setShowLead(true), 500);
      if (r.data.state === "QUIZ") setTimeout(() => setShowQuiz(true), 500);
    } catch (e) {
      setThinking(false);
      const msg = "Oops! Something went wrong. Please try again. 😅";
      setMessages((m) => [...m, { role: "assistant", message: msg }]);
      toast.error("Connection issue. Please try again.");
    } finally {
      busyRef.current = false;
    }
  }, [sessionId, lang, speakOut]);

  const voice = useVoice({ lang, onUtterance: handleUserText });

  // Camera reaction (consented): SECU reacts to a single live frame.
  const reactToCamera = useCallback(async () => {
    if (busyRef.current) return;
    const img = captureRef.current && captureRef.current();
    if (!img) return;
    busyRef.current = true;
    setThinking(true);
    try {
      const r = await api.observe(img);
      setThinking(false);
      if (r.data.comment) {
        setMessages((m) => [...m, { role: "assistant", message: r.data.comment }]);
        await speakOut(r.data.comment);
      }
    } catch (e) {
      setThinking(false);
    } finally {
      busyRef.current = false;
    }
  }, [speakOut]);

  // Periodic friendly camera reactions while camera is on.
  useEffect(() => {
    if (!cameraOn) return;
    const first = setTimeout(reactToCamera, 2800);
    const interval = setInterval(() => {
      if (!voice.speaking && !thinking) reactToCamera();
    }, 32000);
    return () => { clearTimeout(first); clearInterval(interval); };
  }, [cameraOn]); // eslint-disable-line

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  useEffect(() => {
    if (voice.error === "mic-permission") {
      toast.error("Microphone blocked. Please allow mic access or type below.");
    }
  }, [voice.error]);

  const displayState = voice.speaking ? "SPEAKING"
    : thinking ? "THINKING"
    : voice.listening ? "LISTENING" : "IDLE";

  const begin = async () => {
    setStarted(true);
    setMessages([{ role: "assistant", message: WELCOME }]);
    if (voice.supported) voice.startAuto();
    await speakOut(WELCOME);
  };

  const toggleMic = () => {
    if (!started) { begin(); return; }
    if (voice.autoMode) { voice.stopAuto(); toast.info("Hands-free paused."); }
    else { voice.startAuto(); toast.success("Hands-free on — just talk!"); }
  };

  const resetSession = () => {
    voice.stopSpeaking();
    setMessages([]); setSessionId(null); setStarted(false); setThinking(false);
    voice.stopAuto();
    toast.success("New conversation started.");
  };

  const sendTyped = (e) => {
    e.preventDefault();
    if (!typed.trim()) return;
    if (!started) setStarted(true);
    const t = typed; setTyped("");
    handleUserText(t);
  };

  const toggleCamera = () => {
    if (cameraOn) { setCameraOn(false); captureRef.current = null; }
    else {
      setCameraOn(true);
      toast.info("Camera on — SECU can see you now. Tap again to turn off. 👀");
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg glass flex items-center justify-center glow-cyan">
            <span className="font-heading font-black text-[#00F0FF]">eS</span>
          </div>
          <div>
            <p className="font-heading font-bold leading-tight">eSecurityIn</p>
            <p className="text-xs text-muted-foreground">AI Reception · v2</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" data-testid="language-toggle-button"
                  onClick={() => setLang((l) => (l === "en-IN" ? "hi-IN" : "en-IN"))}>
            {lang === "en-IN" ? "EN" : "HI"}
          </Button>
          <Button variant="outline" size="icon" data-testid="mute-toggle-button"
                  onClick={() => { setMuted((m) => !m); voice.stopSpeaking(); }}>
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </Button>
          <Link to="/login">
            <Button variant="outline" size="icon" data-testid="admin-link-button"><Lock size={18} /></Button>
          </Link>
        </div>
      </header>

      <main className="flex-1 grid lg:grid-cols-[1fr_420px] gap-6 p-5 max-w-7xl mx-auto w-full">
        {/* avatar panel */}
        <section className="glass rounded-2xl p-6 flex flex-col items-center justify-center text-center relative overflow-hidden">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: stateColor(displayState) }} />
            <span data-testid="avatar-status-badge" className="text-xs font-mono uppercase tracking-widest"
                  style={{ color: stateColor(displayState) }}>
              {stateLabel(displayState)}
            </span>
            {voice.autoMode && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">
                ● LIVE
              </span>
            )}
          </div>

          <HackerAvatar3D state={displayState} />

          <h1 className="font-heading text-4xl sm:text-5xl font-extrabold -mt-2">SECU</h1>
          <p className="text-muted-foreground mt-1">eSecurityIn AI Buddy</p>

          {!started && <p className="text-lg mt-3 animate-float">"Hey! Come talk to me 👋"</p>}

          <div className="mt-4 w-full max-w-sm">
            <VoiceVisualizer active={displayState === "LISTENING" || displayState === "SPEAKING"} color={stateColor(displayState)} />
          </div>

          {/* camera preview */}
          {cameraOn && (
            <div className="mt-4 w-48" data-testid="camera-preview">
              <CameraView
                active={cameraOn}
                onReady={(cap) => { captureRef.current = cap; }}
                onError={() => { toast.error("Couldn't access camera. Please allow permission."); setCameraOn(false); }}
              />
              <p className="text-[10px] text-muted-foreground mt-1">SECU sees you · frames not stored</p>
            </div>
          )}

          <button
            data-testid="kiosk-mic-button"
            onClick={toggleMic}
            className="mt-5 relative w-24 h-24 rounded-full flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
            style={{
              background: "radial-gradient(circle at 35% 30%, #1A2438, #0B0F17)",
              border: `2px solid ${stateColor(displayState)}`,
              boxShadow: `0 0 36px ${stateColor(displayState)}66`,
            }}
          >
            {voice.autoMode ? <Mic size={34} color={stateColor(displayState)} /> : <MicOff size={34} color={stateColor(displayState)} />}
          </button>
          <p className="text-sm font-semibold mt-3 tracking-wide">
            {!started ? "START TALKING" : voice.autoMode ? "Listening hands-free · tap to pause" : "Tap to resume hands-free"}
          </p>

          {!voice.supported && (
            <p className="text-xs text-amber-400 mt-2 flex items-center gap-1">
              <AlertTriangle size={14} /> Voice not supported here — type below instead.
            </p>
          )}
        </section>

        {/* conversation panel */}
        <section className="glass rounded-2xl flex flex-col h-[70vh] lg:h-auto">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="font-heading font-semibold">Conversation</span>
            <Button variant="ghost" size="sm" onClick={resetSession} data-testid="reset-session-button">
              <RotateCcw size={16} className="mr-1" /> New
            </Button>
          </div>

          <div ref={scrollRef} data-testid="conversation-transcript-container"
               className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px]">
            {messages.length === 0 && (
              <p className="text-center text-muted-foreground text-sm mt-10">
                Tap START TALKING and just speak — SECU listens hands-free.
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"} animate-rise`}>
                <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed
                  ${m.role === "user" ? "bg-[#00F0FF] text-[#06121a] rounded-br-sm font-medium" : "bg-secondary rounded-bl-sm"}`}>
                  {m.message}
                </div>
              </div>
            ))}
            {thinking && (
              <div className="flex justify-start"><div className="bg-secondary px-4 py-2.5 rounded-2xl rounded-bl-sm text-sm">
                <span className="inline-flex gap-1">
                  <span className="w-1.5 h-1.5 bg-[#00F0FF] rounded-full animate-bounce" />
                  <span className="w-1.5 h-1.5 bg-[#00F0FF] rounded-full animate-bounce [animation-delay:.15s]" />
                  <span className="w-1.5 h-1.5 bg-[#00F0FF] rounded-full animate-bounce [animation-delay:.3s]" />
                </span>
              </div></div>
            )}
          </div>

          <form onSubmit={sendTyped} className="p-3 border-t border-border flex gap-2">
            <Input data-testid="text-input" value={typed} onChange={(e) => setTyped(e.target.value)}
                   placeholder="Type to SECU (fallback)..." className="flex-1" />
            <Button type="submit" size="icon" data-testid="send-text-button"><Send size={18} /></Button>
          </form>
        </section>
      </main>

      {/* quick actions dock */}
      <footer className="px-5 pb-6">
        <div className="max-w-7xl mx-auto grid grid-cols-2 sm:grid-cols-5 gap-3">
          <Button variant="outline" className="h-14 text-base" data-testid="quick-action-courses-button"
                  onClick={() => setShowCourses(true)}>
            <BookOpen className="mr-2" size={20} /> Courses
          </Button>
          <Button variant="outline" className="h-14 text-base" data-testid="quick-action-quiz-button"
                  onClick={() => setShowQuiz(true)}>
            <Trophy className="mr-2" size={20} /> Quiz
          </Button>
          <Button variant="outline" className="h-14 text-base" data-testid="camera-toggle-button"
                  onClick={toggleCamera}>
            {cameraOn ? <CameraOff className="mr-2" size={20} /> : <Camera className="mr-2" size={20} />}
            {cameraOn ? "Camera Off" : "Camera"}
          </Button>
          <Button variant="outline" className="h-14 text-base" data-testid="selfie-button"
                  onClick={() => {
                    if (!cameraOn) { toast.info("Turn on the camera first 😊"); return; }
                    setShowSelfie(true);
                  }}>
            <Sparkles className="mr-2" size={20} /> Selfie
          </Button>
          <Button variant="outline" className="h-14 text-base col-span-2 sm:col-span-1" data-testid="quick-action-lead-button"
                  onClick={() => setShowLead(true)}>
            <PhoneCall className="mr-2" size={20} /> Callback
          </Button>
        </div>
        {cameraOn && (
          <div className="max-w-7xl mx-auto mt-3 flex justify-center">
            <Button variant="ghost" size="sm" onClick={reactToCamera} data-testid="camera-react-button">
              <Eye size={16} className="mr-1" /> Ask SECU what it sees
            </Button>
          </div>
        )}
      </footer>

      <LeadForm open={showLead} onOpenChange={setShowLead} sessionId={sessionId} />
      <QuizModal open={showQuiz} onOpenChange={setShowQuiz} onComplete={() => toast.success("Quiz complete! 🎉")} />
      <CoursesModal open={showCourses} onOpenChange={setShowCourses} onAsk={(q) => handleUserText(q)} />
      <SelfieModal open={showSelfie} onOpenChange={setShowSelfie} capture={() => captureRef.current && captureRef.current()} />
    </div>
  );
}
