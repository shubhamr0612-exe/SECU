import { useEffect, useState } from "react";
import { api } from "../services/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";
import { CheckCircle2, XCircle, Trophy, Loader2 } from "lucide-react";

export const QuizModal = ({ open, onOpenChange, onComplete }) => {
  const [questions, setQuestions] = useState([]);
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [selected, setSelected] = useState(null);
  const [result, setResult] = useState(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setLoading(true);
      setIdx(0); setScore(0); setSelected(null); setResult(null); setDone(false);
      api.getQuiz().then((r) => setQuestions(r.data.questions)).finally(() => setLoading(false));
    }
  }, [open]);

  const q = questions[idx];

  const choose = async (optionIndex) => {
    if (result) return;
    setSelected(optionIndex);
    const r = await api.answerQuiz(q.id, optionIndex);
    setResult(r.data);
    if (r.data.correct) setScore((s) => s + 1);
  };

  const next = () => {
    if (idx + 1 >= questions.length) {
      setDone(true);
      onComplete?.(score + (result?.correct ? 0 : 0));
    } else {
      setIdx((i) => i + 1);
      setSelected(null);
      setResult(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass max-w-lg" data-testid="quiz-dialog">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl flex items-center gap-2">
            <Trophy className="text-[#00F0FF]" /> Cyber Quiz
          </DialogTitle>
        </DialogHeader>

        {loading && <div className="py-12 flex justify-center"><Loader2 className="animate-spin" /></div>}

        {!loading && !done && q && (
          <div className="space-y-4" data-testid="quiz-question">
            <Progress value={((idx) / questions.length) * 100} className="h-1.5" />
            <p className="text-xs text-muted-foreground font-mono">Question {idx + 1} / {questions.length}</p>
            <p className="text-lg font-medium leading-relaxed">{q.question}</p>
            <div className="space-y-2">
              {q.options.map((opt, i) => {
                const isSel = selected === i;
                const isCorrect = result && i === result.correct_index;
                const isWrong = result && isSel && !result.correct;
                return (
                  <button
                    key={`${q.id}-${i}`}
                    data-testid="quiz-option-button"
                    onClick={() => choose(i)}
                    disabled={!!result}
                    className={`w-full text-left p-3 rounded-lg border transition-colors flex items-center justify-between
                      ${isCorrect ? "border-emerald-400 bg-emerald-500/10" :
                        isWrong ? "border-red-400 bg-red-500/10" :
                        "border-border hover:border-[#00F0FF] hover:bg-white/5"}`}
                  >
                    <span>{opt}</span>
                    {isCorrect && <CheckCircle2 size={18} className="text-emerald-400" />}
                    {isWrong && <XCircle size={18} className="text-red-400" />}
                  </button>
                );
              })}
            </div>
            {result && (
              <Button onClick={next} data-testid="quiz-next-button" className="w-full h-11">
                {idx + 1 >= questions.length ? "See score" : "Next question"}
              </Button>
            )}
          </div>
        )}

        {done && (
          <div className="text-center py-8 animate-rise" data-testid="quiz-result">
            <Trophy size={56} className="mx-auto text-[#F59E0B]" />
            <p className="text-3xl font-heading font-bold mt-4">You scored {score}/{questions.length}! 🔥</p>
            <p className="text-muted-foreground mt-2">
              {score >= 4 ? "Impressive! You've got a security mindset." : "Nice try! Our courses can level you up."}
            </p>
            <Button onClick={() => onOpenChange(false)} className="mt-6 h-11 px-8">Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
