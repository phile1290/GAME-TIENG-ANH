import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  ArrowRight,
  Flame,
  Clock,
  Award,
  Volume2,
  Play,
  Pause,
  RotateCcw,
} from 'lucide-react';
import { sound, SpeechStatusSnapshot } from '../../services/soundService';

interface FeedbackModalProps {
  isCorrect: boolean;
  teamName: string;
  studentName?: string | null;
  previousHookLevel: number;
  hookLevel: number;
  hookDelta: number;
  pointsDelta: number;
  responseTimeSec: number;
  totalCorrectCount: number;
  totalTimeSec: number;
  studentCallCount: number;
  correctAnswerText: string;
  explanation: string;
  isNitroTriggered: boolean;
  questionNumber: number;
  totalQuestions: number;
  onContinue: () => void;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({
  isCorrect,
  teamName,
  studentName,
  previousHookLevel,
  hookLevel,
  hookDelta,
  pointsDelta,
  responseTimeSec,
  totalCorrectCount,
  totalTimeSec,
  correctAnswerText,
  explanation,
  isNitroTriggered,
  questionNumber,
  totalQuestions,
  onContinue,
}) => {
  const [speechStatus, setSpeechStatus] = useState<SpeechStatusSnapshot>(() =>
    sound.getSpeechStatus()
  );

  const bilingualSegments = useMemo(
    () => sound.splitIntoBilingualSegments(explanation || ''),
    [explanation]
  );

  useEffect(() => {
    return sound.subscribeSpeechState((snap) => {
      setSpeechStatus(snap);
    });
  }, []);

  // Automatically say "Giải thích" in Vietnamese and read the explanation with 100% accuracy (English in en-US, Vietnamese in vi-VN)
  useEffect(() => {
    const timer = window.setTimeout(() => {
      sound.speakExplanation(explanation);
    }, 480);
    return () => {
      window.clearTimeout(timer);
    };
  }, [explanation]);

  const isExpPlaying =
    speechStatus.state === 'playing' && speechStatus.contextKey === 'explanation';
  const isExpPaused =
    speechStatus.state === 'paused' && speechStatus.contextKey === 'explanation';

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        className={`w-full max-w-2xl rounded-3xl p-6 sm:p-7 border-2 shadow-2xl text-white space-y-4 animate-in zoom-in-95 duration-200 ${
          isCorrect
            ? 'bg-slate-900 border-emerald-400 shadow-emerald-500/20'
            : 'bg-slate-900 border-rose-400 shadow-rose-500/20'
        }`}
      >
        <div className="flex items-center gap-3.5">
          {isCorrect ? (
            <div className="w-13 h-13 rounded-2xl bg-emerald-500/20 border border-emerald-400 flex items-center justify-center text-emerald-400 shrink-0">
              <CheckCircle2 className="w-8 h-8" />
            </div>
          ) : (
            <div className="w-13 h-13 rounded-2xl bg-rose-500/20 border border-rose-400 flex items-center justify-center text-rose-400 shrink-0">
              <XCircle className="w-8 h-8" />
            </div>
          )}
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase">
              Question {questionNumber}/{totalQuestions} Result
            </div>
            <h3
              className={`text-xl sm:text-2xl font-black ${
                isCorrect ? 'text-emerald-300' : 'text-rose-300'
              }`}
            >
              {isCorrect
                ? `CORRECT! +${pointsDelta} POINTS (CLIMB +1 HOOK)`
                : `INCORRECT! ${pointsDelta} POINTS (DROP -1 HOOK)`}
            </h3>
            <div className="text-xs sm:text-sm text-amber-300 font-bold">
              {studentName ? `Student: ${studentName} (${teamName})` : teamName}
            </div>
          </div>
        </div>

        {isNitroTriggered && (
          <div className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-400 rounded-2xl p-3 flex items-center gap-2 text-amber-300 text-xs sm:text-sm font-black">
            <Flame className="w-5 h-5 text-orange-400 shrink-0" />
            <span>3 IN A ROW COMBO! SUPER SPEED BOOST UP THE ROPE!</span>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2.5 text-center">
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3">
            <div className="text-[10px] sm:text-xs text-slate-400 font-bold uppercase">
              Rope Hook Position
            </div>
            <div
              className={`text-xs sm:text-base font-black flex items-center justify-center gap-1 mt-0.5 ${
                hookDelta < 0 ? 'text-rose-400' : 'text-amber-400'
              }`}
            >
              <Award className="w-4 h-4 shrink-0" />
              <span>
                Hook {previousHookLevel} → {hookLevel}/10 ({hookDelta > 0 ? `+${hookDelta}` : hookDelta})
              </span>
            </div>
          </div>
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3">
            <div className="text-[10px] sm:text-xs text-slate-400 font-bold uppercase">
              Response Time
            </div>
            <div className="text-sm sm:text-base font-black text-sky-300 flex items-center justify-center gap-1 mt-0.5">
              <Clock className="w-4 h-4" />
              <span>{responseTimeSec}s</span>
            </div>
          </div>
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3">
            <div className="text-[10px] sm:text-xs text-slate-400 font-bold uppercase">
              Total Correct
            </div>
            <div className="text-sm sm:text-base font-black text-emerald-300 mt-0.5">
              {totalCorrectCount} ({totalTimeSec}s)
            </div>
          </div>
        </div>

        {/* Correct Answer & Bilingual Explanation Box */}
        <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 text-sm sm:text-base text-slate-200 leading-relaxed space-y-2.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <strong className="text-amber-300 flex items-center gap-1.5 text-sm sm:text-base">
              <span>💡 Explanation (Correct Answer: {correctAnswerText})</span>
            </strong>
            <div className="flex items-center gap-1.5">
              {!isExpPlaying && !isExpPaused && (
                <button
                  type="button"
                  onClick={() => sound.speakExplanation(explanation)}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs sm:text-sm flex items-center gap-1.5 shadow cursor-pointer transition-colors"
                  title="Say 'Giải thích' and read English parts in American English (en-US) and Vietnamese parts in Vietnamese (vi-VN)"
                >
                  <Volume2 className="w-4 h-4" />
                  <span>🔊 Listen to Explanation (EN / VI)</span>
                </button>
              )}

              {isExpPlaying && (
                <>
                  <button
                    type="button"
                    onClick={() => sound.pauseSpeech()}
                    className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs sm:text-sm flex items-center gap-1.5 shadow cursor-pointer transition-colors"
                    title="Pause explanation reading (Tạm dừng)"
                  >
                    <Pause className="w-4 h-4 fill-slate-950" />
                    <span>⏸ Pause (Tạm dừng)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => sound.speakExplanation(explanation)}
                    className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/15 cursor-pointer"
                    title="Restart explanation from the beginning"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </>
              )}

              {isExpPaused && (
                <>
                  <button
                    type="button"
                    onClick={() => sound.resumeSpeech('explanation')}
                    className="px-3 py-1.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black text-xs sm:text-sm flex items-center gap-1.5 shadow cursor-pointer transition-colors"
                    title="Continue reading the next part of the explanation (Tiếp tục đọc)"
                  >
                    <Play className="w-4 h-4 fill-slate-950" />
                    <span>▶ Resume (Tiếp tục đọc)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => sound.speakExplanation(explanation)}
                    className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/15 cursor-pointer"
                    title="Restart explanation from the beginning"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="text-slate-100 font-medium text-base sm:text-lg leading-relaxed">
            {bilingualSegments.length > 0 ? (
              bilingualSegments.map((seg, idx) => (
                <span
                  key={idx}
                  onClick={() => sound.speakText(seg.text, seg.lang)}
                  title={
                    seg.lang === 'en-US'
                      ? 'English segment — Click to hear in American English (en-US)'
                      : 'Vietnamese segment — Click to hear in Vietnamese (vi-VN)'
                  }
                  className={`cursor-pointer transition-colors ${
                    seg.lang === 'en-US'
                      ? 'text-sky-300 font-black hover:text-amber-300'
                      : 'text-white hover:text-amber-200'
                  }`}
                >
                  {seg.text}{' '}
                </span>
              ))
            ) : (
              <span>{explanation}</span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            sound.stopSpeech();
            onContinue();
          }}
          className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-slate-950 font-black text-sm sm:text-base flex items-center justify-center gap-2 cursor-pointer shadow-lg"
        >
          <span>
            {questionNumber >= totalQuestions
              ? 'VIEW FINAL VICTORY PODIUM'
              : 'CONTINUE TO NEXT QUESTION'}
          </span>
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
