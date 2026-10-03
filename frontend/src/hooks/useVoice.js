import { useCallback, useEffect, useRef, useState } from "react";

// Hands-free continuous voice. STT via browser Web Speech API. TTS tries a
// server-side voice (ttsFetcher -> audio Blob); falls back to browser speech.
// The mic auto-pauses while SECU speaks and resumes afterwards.
export function useVoice({ onUtterance, lang = "en-IN", ttsFetcher } = {}) {
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [supported, setSupported] = useState(true);
  const [autoMode, setAutoMode] = useState(false);
  const [error, setError] = useState(null);

  const recRef = useRef(null);
  const autoRef = useRef(false);
  const speakingRef = useRef(false);
  const finalRef = useRef("");
  const silenceRef = useRef(null);
  const audioRef = useRef(null);
  const onUttRef = useRef(onUtterance); onUttRef.current = onUtterance;
  const ttsRef = useRef(ttsFetcher); ttsRef.current = ttsFetcher;
  const langRef = useRef(lang); langRef.current = lang;

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setSupported(false); return; }
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = lang;

    rec.onstart = () => setListening(true);
    rec.onresult = (e) => {
      if (speakingRef.current) return;
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalRef.current += " " + r[0].transcript;
      }
      if (silenceRef.current) clearTimeout(silenceRef.current);
      silenceRef.current = setTimeout(() => {
        const text = finalRef.current.trim();
        finalRef.current = "";
        if (text && !speakingRef.current && onUttRef.current) onUttRef.current(text);
      }, 1200);
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setError("mic-permission"); autoRef.current = false; setAutoMode(false);
      } else if (e.error !== "no-speech" && e.error !== "aborted") {
        setError(e.error);
      }
    };
    rec.onend = () => {
      setListening(false);
      if (autoRef.current && !speakingRef.current) {
        try { rec.start(); } catch (_) { setTimeout(() => { try { rec.start(); } catch (x) {} }, 350); }
      }
    };
    recRef.current = rec;
    return () => { autoRef.current = false; try { rec.stop(); } catch (_) {} };
  }, [lang]);

  const resumeMic = () => {
    if (autoRef.current) {
      try { recRef.current.start(); } catch (_) { setTimeout(() => { try { recRef.current.start(); } catch (x) {} }, 350); }
    }
  };

  const browserSpeak = (text) => new Promise((resolve) => {
    if (!window.speechSynthesis) return resolve();
    window.speechSynthesis.cancel();
    const clean = text.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/gu, "");
    const u = new SpeechSynthesisUtterance(clean);
    u.lang = langRef.current; u.rate = 1.04; u.pitch = 1.05;
    const voices = window.speechSynthesis.getVoices();
    const pref = voices.find((v) => v.lang === langRef.current) || voices.find((v) => v.lang && v.lang.startsWith("en"));
    if (pref) u.voice = pref;
    u.onstart = () => setSpeaking(true);
    u.onend = resolve; u.onerror = resolve;
    window.speechSynthesis.speak(u);
  });

  const startAuto = useCallback(() => {
    setError(null);
    if (!recRef.current) { setError("unsupported"); return; }
    autoRef.current = true; setAutoMode(true);
    try { recRef.current.start(); } catch (_) {}
  }, []);

  const stopAuto = useCallback(() => {
    autoRef.current = false; setAutoMode(false);
    try { recRef.current.stop(); } catch (_) {}
    setListening(false);
  }, []);

  const speak = useCallback(async (text) => {
    if (!text) return;
    // Gate the mic immediately, but DON'T flip the visual "speaking" state yet —
    // it must only turn on when audio actually starts, else the avatar's mouth
    // moves before any sound (server TTS has fetch latency).
    speakingRef.current = true;
    try { recRef.current && recRef.current.stop(); } catch (_) {}

    let played = false;
    if (ttsRef.current) {
      try {
        const blob = await ttsRef.current(text);
        if (blob) {
          const url = URL.createObjectURL(blob);
          await new Promise((resolve) => {
            const a = new Audio(url); audioRef.current = a;
            a.onplay = () => setSpeaking(true); // mouth moves only once sound starts
            a.onended = () => { URL.revokeObjectURL(url); resolve(); };
            a.onerror = () => { URL.revokeObjectURL(url); resolve(); };
            a.play().catch((e) => { console.error("tts playback failed", e); resolve(); });
          });
          played = true;
        }
      } catch (e) { console.error("tts fetch failed", e); }
    }
    if (!played) await browserSpeak(text);

    audioRef.current = null;
    speakingRef.current = false; setSpeaking(false);
    finalRef.current = "";
    resumeMic();
  }, []);

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis && window.speechSynthesis.cancel();
    if (audioRef.current) { try { audioRef.current.pause(); } catch (_) {} audioRef.current = null; }
    speakingRef.current = false; setSpeaking(false);
  }, []);

  return { listening, speaking, supported, autoMode, error, startAuto, stopAuto, speak, stopSpeaking };
}
