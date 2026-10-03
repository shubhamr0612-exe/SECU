import { useCallback, useEffect, useRef, useState } from "react";

// Hands-free continuous voice: auto-listens, pauses the mic while SECU speaks,
// then resumes. Emits an utterance after a short silence. Browser Web Speech API.
export function useVoice({ onUtterance, lang = "en-IN" } = {}) {
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
  const onUttRef = useRef(onUtterance);
  onUttRef.current = onUtterance;
  const langRef = useRef(lang);
  langRef.current = lang;

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setSupported(false); return; }
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = lang;

    rec.onstart = () => setListening(true);
    rec.onresult = (e) => {
      if (speakingRef.current) return; // ignore SECU's own voice
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
        try { rec.start(); } catch (_) {
          setTimeout(() => { try { rec.start(); } catch (e) {} }, 350);
        }
      }
    };
    recRef.current = rec;
    return () => { autoRef.current = false; try { rec.stop(); } catch (_) {} };
  }, [lang]);

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

  const speak = useCallback((text) => {
    return new Promise((resolve) => {
      if (!window.speechSynthesis || !text) return resolve();
      speakingRef.current = true; setSpeaking(true);
      try { recRef.current && recRef.current.stop(); } catch (_) {}
      window.speechSynthesis.cancel();
      const clean = text.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/gu, "");
      const u = new SpeechSynthesisUtterance(clean);
      u.lang = langRef.current; u.rate = 1.04; u.pitch = 1.05;
      const voices = window.speechSynthesis.getVoices();
      const pref = voices.find((v) => v.lang === langRef.current) ||
        voices.find((v) => v.lang && v.lang.startsWith("en"));
      if (pref) u.voice = pref;
      const done = () => {
        speakingRef.current = false; setSpeaking(false);
        finalRef.current = "";
        if (autoRef.current) {
          try { recRef.current.start(); } catch (_) {
            setTimeout(() => { try { recRef.current.start(); } catch (e) {} }, 350);
          }
        }
        resolve();
      };
      u.onend = done; u.onerror = done;
      window.speechSynthesis.speak(u);
    });
  }, []);

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis && window.speechSynthesis.cancel();
    speakingRef.current = false; setSpeaking(false);
  }, []);

  return { listening, speaking, supported, autoMode, error, startAuto, stopAuto, speak, stopSpeaking };
}
