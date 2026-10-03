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
  login: (email, password) => client.post("/auth/login", { email, password }),
  me: () => client.get("/auth/me"),
};

export default client;
