// Fuzzy "Hey SECU" detection: speech-to-text rarely spells "SECU" the same way twice
// (secu, seku, sexy, secure, seiko, sec you, हे सेकू ...), so we match by sound.
const NAMES = /^(secu|seku|sekyu|sekhu|sequ|sikyu|siku|seiku|sekku|sikku|सेकू|सेकु|सीकू|सेक्यू|सिक्यू|सिकु|सेक्यु|सिक्कू|सेक्कू)$/;
const GREET = /^(hey|hi|hay|hai|hello|helo|hallo|ok|okay|hei|हे|है|हाय|हेलो|हैलो|ओके)$/;
const SPLIT_HEAD = /^(se|sea|see|si|sec|sek|seek|sik|sick|siq|six|सी|से|सेक|सिक)$/;
const SPLIT_TAIL = /^(you|yu|u|q|cu|ku|coo|koo|kyu|queue|cue|क्यू|कू|यू)$/;

const skeleton = (w) => w
  .replace(/sh/g, "s").replace(/c(?=[eiy])/g, "s").replace(/ck/g, "k")
  .replace(/[cq]/g, "k").replace(/x/g, "ks").replace(/[aeiouyhw]/g, "");

const soundsLikeSecu = (w) => {
  if (NAMES.test(w)) return true;
  if (/^[\u0900-\u097F]+$/.test(w)) return /^[सश]/.test(w) && /क/.test(w);
  const s = skeleton(w);
  return w.length >= 4 && ["sk", "sks", "skr"].includes(s) && /(u|oo|o|y|ure)$/.test(w);
};

export const matchWake = (text) => {
  const words = (text || "").toLowerCase().replace(/[.,!?'"।]/g, " ").split(/\s+/).filter(Boolean);
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (NAMES.test(w)) return { at: i };
    if (/^(hey|hi|ok)/.test(w) && w.length > 4 && soundsLikeSecu(w.replace(/^(hey|hi|ok)/, ""))) return { at: i };
    if (!GREET.test(w) || i + 1 >= words.length) continue;
    const a = words[i + 1], b = words[i + 2] || "";
    if (soundsLikeSecu(a)) return { at: i };
    if (SPLIT_HEAD.test(a) && SPLIT_TAIL.test(b)) return { at: i };
  }
  return null;
};
