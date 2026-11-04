import { useCallback, useEffect, useRef, useState } from "react";
import { matchWake } from "./wakeWord";

// Hands-free continuous voice. STT via browser Web Speech API. TTS tries a
// server-side voice (ttsFetcher -> audio Blob); falls back to browser speech.
// The mic auto-pauses while SECU speaks and resumes afterwards.

// Indian voices only: hi-IN for Hindi; en-IN for English (hi-IN as a fallback accent).
const NAME_PREF = /neerja|swara|heera|kalpana|lekha|veena|aditi|google|female/i;
const MALE = /\b(ravi|prabhat|madhur|hemant|rishi|male)\b/i;
export const pickIndianVoice = (voices, lang) => {
  const byLang = (l) => voices.filter((v) => (v.lang || "").replace("_", "-").toLowerCase() === l);
  const order = lang === "hi-IN" ? ["hi-in", "en-in"] : ["en-in", "hi-in"];
  for (const l of order) {
    const list = byLang(l);
    if (list.length) return list.find((v) => NAME_PREF.test(v.name) && !MALE.test(v.name)) || list.find((v) => !MALE.test(v.name)) || list[0];
  }
  return voices.find((v) => /india|hindi/i.test(v.name)) || null;
};

export function useVoice({ onUtterance, onWake, lang = "en-IN", ttsFetcher } = {}) {
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [supported, setSupported] = useState(true);
  const [autoMode, setAutoMode] = useState(false);
  const [wakeMode, setWakeMode] = useState(false);
  const [voiceLabel, setVoiceLabel] = useState("");
  const [lastHeard, setLastHeard] = useState("");
  const [error, setError] = useState(null);

  const recRef = useRef(null);
  const autoRef = useRef(false);
  const wakeRef = useRef(false);
  const onWakeRef = useRef(onWake); onWakeRef.current = onWake;
  const voicesRef = useRef([]);
  const speakingRef = useRef(false);
  const finalRef = useRef("");
  const silenceRef = useRef(null);
  const audioRef = useRef(null);
  const onUttRef = useRef(onUtterance); onUttRef.current = onUtterance;
  const ttsRef = useRef(ttsFetcher); ttsRef.current = ttsFetcher;
  const langRef = useRef(lang); langRef.current = lang;

  useEffect(() => {
    if (!window.speechSynthesis) return;
    const load = () => {
      voicesRef.current = window.speechSynthesis.getVoices();
      const v = pickIndianVoice(voicesRef.current, lang);
      setVoiceLabel(v ? `${v.name} (${v.lang})` : "");
    };
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, [lang]);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setSupported(false); return; }
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = lang;
    rec.maxAlternatives = 3;

    rec.onstart = () => setListening(true);
    rec.onresult = (e) => {
      if (speakingRef.current) return;
      if (wakeRef.current && !autoRef.current) {
        const alts = ["", "", ""];
        for (let i = e.resultIndex; i < e.results.length; i++) {
          for (let j = 0; j < Math.min(3, e.results[i].length); j++) alts[j] += " " + e.results[i][j].transcript;
        }
        setLastHeard(alts[0].trim());
        if (alts.some((a) => a && matchWake(a))) {
          autoRef.current = true; setAutoMode(true); finalRef.current = "";
          if (onWakeRef.current) onWakeRef.current();
        }
        return;
      }
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
        wakeRef.current = false; setWakeMode(false);
      } else if (e.error !== "no-speech" && e.error !== "aborted") {
        setError(e.error);
      }
    };
    rec.onend = () => {
      setListening(false);
      if ((autoRef.current || wakeRef.current) && !speakingRef.current) {
        try { rec.start(); } catch (_) { setTimeout(() => { try { rec.start(); } catch (x) {} }, 350); }
      }
    };
    recRef.current = rec;
    if (wakeRef.current || autoRef.current) { try { rec.start(); } catch (_) {} }
    return () => { rec.onend = null; try { rec.stop(); } catch (_) {} };
  }, [lang]);

  const resumeMic = () => {
    if (autoRef.current || wakeRef.current) {
      try { recRef.current.start(); } catch (_) { setTimeout(() => { try { recRef.current.start(); } catch (x) {} }, 350); }
    }
  };

  const browserSpeak = (text) => new Promise((resolve) => {
    if (!window.speechSynthesis) return resolve();
    window.speechSynthesis.cancel();
    const clean = text.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/gu, "");
    const u = new SpeechSynthesisUtterance(clean);
    const voices = voicesRef.current.length ? voicesRef.current : window.speechSynthesis.getVoices();
    const pref = pickIndianVoice(voices, langRef.current);
    u.lang = pref ? pref.lang : langRef.current; u.rate = 1.0; u.pitch = 1.0;
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

  // Stops active conversation; if wake mode is on, the mic keeps listening for "Hey SECU".
  const stopAuto = useCallback(() => {
    autoRef.current = false; setAutoMode(false);
    finalRef.current = "";
    try { recRef.current && recRef.current.stop(); } catch (_) {}
    setListening(false);
  }, []);

  const startWake = useCallback(() => {
    if (!recRef.current) return false;
    setError(null);
    wakeRef.current = true; setWakeMode(true);
    try { recRef.current.start(); } catch (_) {}
    return true;
  }, []);

  const stopWake = useCallback(() => {
    wakeRef.current = false; setWakeMode(false);
    if (!autoRef.current) { try { recRef.current && recRef.current.stop(); } catch (_) {} }
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

  return { listening, speaking, supported, autoMode, wakeMode, voiceLabel, lastHeard, error,
           startAuto, stopAuto, startWake, stopWake, speak, stopSpeaking };
}
