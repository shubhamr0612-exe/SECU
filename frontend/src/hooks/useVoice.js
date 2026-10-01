import { useCallback, useEffect, useRef, useState } from "react";

// useVoice: real browser Speech-to-Text (Web Speech API) + Text-to-Speech.
export function useVoice({ onResult, lang = "en-IN" } = {}) {
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [supported, setSupported] = useState(true);
  const [error, setError] = useState(null);
  const recognitionRef = useRef(null);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setSupported(false);
      return;
    }
    const rec = new SR();
    rec.lang = lang;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.continuous = false;

    rec.onresult = (e) => {
      const text = e.results[0][0].transcript;
      if (text && onResultRef.current) onResultRef.current(text);
    };
    rec.onerror = (e) => {
      setListening(false);
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setError("mic-permission");
      } else if (e.error === "no-speech") {
        setError("no-speech");
      } else {
        setError("stt-failed");
      }
    };
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    return () => {
      try { rec.stop(); } catch (_) {}
    };
  }, [lang]);

  const startListening = useCallback(() => {
    setError(null);
    const rec = recognitionRef.current;
    if (!rec) {
      setError("unsupported");
      return;
    }
    try {
      window.speechSynthesis?.cancel();
      setListening(true);
      rec.start();
    } catch (_) {
      // start() throws if already started; ignore.
    }
  }, []);

  const stopListening = useCallback(() => {
    try { recognitionRef.current?.stop(); } catch (_) {}
    setListening(false);
  }, []);

  const speak = useCallback((text, voiceLang = lang) => {
    return new Promise((resolve) => {
      if (!window.speechSynthesis || !text) return resolve();
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, ""));
      u.lang = voiceLang;
      u.rate = 1.03;
      u.pitch = 1.05;
      const voices = window.speechSynthesis.getVoices();
      const pref = voices.find((v) => v.lang === voiceLang) ||
        voices.find((v) => v.lang?.startsWith("en"));
      if (pref) u.voice = pref;
      u.onstart = () => setSpeaking(true);
      u.onend = () => { setSpeaking(false); resolve(); };
      u.onerror = () => { setSpeaking(false); resolve(); };
      window.speechSynthesis.speak(u);
    });
  }, [lang]);

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  }, []);

  return { listening, speaking, supported, error, startListening, stopListening, speak, stopSpeaking };
}
