import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const client = axios.create({ baseURL: API });

client.interceptors.request.use((config) => {
  const token = localStorage.getItem("secu_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const api = {
  health: () => client.get("/health"),
  chat: (message, session_id, language) =>
    client.post("/chat", { message, session_id, language }),
  createLead: (payload) => client.post("/leads", payload),
  getLeads: () => client.get("/leads"),
  updateLeadStatus: (id, status) => client.patch(`/leads/${id}`, { status }),
  getQuiz: () => client.get("/quiz"),
  answerQuiz: (question_id, answer_index) =>
    client.post("/quiz/answer", { question_id, answer_index }),
  analytics: () => client.get("/analytics"),
  observe: (image_base64) => client.post("/vision/observe", { image_base64 }),
  gesture: (image_base64) => client.post("/vision/gesture", { image_base64 }),
  getKnowledge: () => client.get("/knowledge"),
  saveKnowledge: (payload) => client.put("/knowledge", payload),
  getPublicKnowledge: () => client.get("/knowledge/public"),
  getVoices: () => client.get("/voice/voices"),
  synthesize: (text, voice, speed) =>
    client.post("/voice/synthesize", { text, voice, speed }, { responseType: "blob" }),
  uploadSelfie: (image_base64, on_wall = true) =>
    client.post("/selfie/upload", { image_base64, on_wall }),
  getRecentSelfies: () => client.get("/selfies/recent"),
  login: (email, password) => client.post("/auth/login", { email, password }),
  me: () => client.get("/auth/me"),
};

export default client;
