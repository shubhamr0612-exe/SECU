import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api";
import { useVoice } from "../hooks/useVoice";
import { Avatar, stateLabel, stateColor } from "../components/Avatar";
import { VoiceVisualizer } from "../components/VoiceVisualizer";
import { LeadForm } from "../components/LeadForm";
import { QuizModal } from "../components/QuizModal";
import { CoursesModal } from "../components/CoursesModal";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Mic, Send, BookOpen, Trophy, PhoneCall, RotateCcw, Lock, Volume2, VolumeX, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const WELCOME = "Hey! Welcome to eSecurityIn! I'm SECU. How's your day going?";

export default function Reception() {
  const [uiState, setUiState] = useState("IDLE"); // IDLE|LISTENING|THINKING|SPEAKING|ERROR
  const [messages, setMessages] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [typed, setTyped] = useState("");
  const [lang, setLang] = useState("en-IN");
  const [muted, setMuted] = useState(false);
  const [showLead, setShowLead] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [showCourses, setShowCourses] = useState(false);
  const [started, setStarted] = useState(false);
  const scrollRef = useRef(null);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  const speakOut = useCallback(async (text) => {
    if (mutedRef.current) return;
    setUiState("SPEAKING");
    await voice.speak(text, lang);
    setUiState("IDLE");
  }, [lang]); // eslint-disable-line

  const handleUserText = useCallback(async (text) => {
    if (!text?.trim()) return;
    setMessages((m) => [...m, { role: "user", message: text }]);
    setUiState("THINKING");
    try {
      const r = await api.chat(text, sessionId, lang);
      setSessionId(r.data.session_id);
      setMessages((m) => [...m, { role: "assistant", message: r.data.reply }]);
      await speakOut(r.data.reply);
      if (r.data.state === "LEAD_CAPTURE") setTimeout(() => setShowLead(true), 600);
      if (r.data.state === "QUIZ") setTimeout(() => setShowQuiz(true), 600);
    } catch (e) {
      setUiState("ERROR");
      const msg = "Oops! Something went wrong. Please try again. 😅";
      setMessages((m) => [...m, { role: "assistant", message: msg }]);
      toast.error("Connection issue. Please try again.");
      setTimeout(() => setUiState("IDLE"), 1500);
    }
  }, [sessionId, lang, speakOut]);

  const voice = useVoice({
    lang,
    onResult: (text) => { setUiState("THINKING"); handleUserText(text); },
  });

  useEffect(() => {
    if (voice.listening) setUiState("LISTENING");
  }, [voice.listening]);

  useEffect(() => {
    if (voice.error === "mic-permission") {
      toast.error("Microphone blocked. Please allow mic access or type below.");
      setUiState("IDLE");
    } else if (voice.error === "no-speech") {
      toast.info("Didn't catch that. Try again or type below.");
      setUiState("IDLE");
    } else if (voice.error === "stt-failed" || voice.error === "unsupported") {
      setUiState("IDLE");
    }
  }, [voice.error]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const begin = async () => {
    setStarted(true);
    setMessages([{ role: "assistant", message: WELCOME }]);
    await speakOut(WELCOME);
  };

  const micClick = () => {
    if (!started) { begin(); return; }
    if (voice.listening) { voice.stopListening(); setUiState("IDLE"); return; }
    if (!voice.supported) { toast.error("Voice not supported in this browser. Please type below."); return; }
    voice.stopSpeaking();
    voice.startListening();
  };

  const resetSession = () => {
    voice.stopSpeaking(); voice.stopListening();
    setMessages([]); setSessionId(null); setStarted(false); setUiState("IDLE");
    toast.success("New conversation started.");
  };

  const sendTyped = (e) => {
    e.preventDefault();
    if (!typed.trim()) return;
    if (!started) setStarted(true);
    const t = typed; setTyped("");
    handleUserText(t);
  };

  const displayState = uiState === "ERROR" ? "IDLE" : uiState;

  return (
    <div className="min-h-screen flex flex-col">
      {/* header */}
      <header className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg glass flex items-center justify-center glow-cyan">
            <span className="font-heading font-black text-[#00F0FF]">eS</span>
          </div>
          <div>
            <p className="font-heading font-bold leading-tight">eSecurityIn</p>
            <p className="text-xs text-muted-foreground">AI Reception</p>
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
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: stateColor(displayState) }} />
            <span data-testid="avatar-status-badge" className="text-xs font-mono uppercase tracking-widest"
                  style={{ color: stateColor(displayState) }}>
              {uiState === "ERROR" ? "Oops! Try again?" : stateLabel(displayState)}
            </span>
          </div>

          <Avatar state={displayState} />

          <h1 className="font-heading text-4xl sm:text-5xl font-extrabold mt-4">
            SECU
          </h1>
          <p className="text-muted-foreground mt-1">eSecurityIn AI Buddy</p>

          {!started && (
            <p className="text-lg mt-4 animate-float">"Hey! Come talk to me 👋"</p>
          )}

          <div className="mt-5 w-full max-w-sm">
            <VoiceVisualizer active={uiState === "LISTENING" || uiState === "SPEAKING"} color={stateColor(displayState)} />
          </div>

          <button
            data-testid="kiosk-mic-button"
            onClick={micClick}
            className="mt-6 relative w-24 h-24 rounded-full flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
            style={{
              background: `radial-gradient(circle at 35% 30%, #1A2438, #0B0F17)`,
              border: `2px solid ${stateColor(displayState)}`,
              boxShadow: `0 0 36px ${stateColor(displayState)}66`,
            }}
          >
            <Mic size={34} color={stateColor(displayState)} />
          </button>
          <p className="text-sm font-semibold mt-3 tracking-wide">
            {!started ? "START TALKING" : voice.listening ? "Tap to stop" : "Tap to talk"}
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
                Tap the mic or type to start chatting with SECU.
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"} animate-rise`}>
                <div className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed
                  ${m.role === "user"
                    ? "bg-[#00F0FF] text-[#06121a] rounded-br-sm font-medium"
                    : "bg-secondary rounded-bl-sm"}`}>
                  {m.message}
                </div>
              </div>
            ))}
            {uiState === "THINKING" && (
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
                   placeholder="Type to SECU (dev/fallback)..." className="flex-1" />
            <Button type="submit" size="icon" data-testid="send-text-button"><Send size={18} /></Button>
          </form>
        </section>
      </main>

      {/* quick actions dock */}
      <footer className="px-5 pb-6">
        <div className="max-w-7xl mx-auto grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Button variant="outline" className="h-14 text-base" data-testid="quick-action-courses-button"
                  onClick={() => setShowCourses(true)}>
            <BookOpen className="mr-2" size={20} /> Courses
          </Button>
          <Button variant="outline" className="h-14 text-base" data-testid="quick-action-quiz-button"
                  onClick={() => setShowQuiz(true)}>
            <Trophy className="mr-2" size={20} /> Quiz
          </Button>
          <Button variant="outline" className="h-14 text-base col-span-2 sm:col-span-1" data-testid="quick-action-lead-button"
                  onClick={() => setShowLead(true)}>
            <PhoneCall className="mr-2" size={20} /> Request Callback
          </Button>
        </div>
      </footer>

      <LeadForm open={showLead} onOpenChange={setShowLead} sessionId={sessionId} />
      <QuizModal open={showQuiz} onOpenChange={setShowQuiz}
                 onComplete={(s) => toast.success(`Quiz complete! 🎉`)} />
      <CoursesModal open={showCourses} onOpenChange={setShowCourses} onAsk={(q) => handleUserText(q)} />
    </div>
  );
}
