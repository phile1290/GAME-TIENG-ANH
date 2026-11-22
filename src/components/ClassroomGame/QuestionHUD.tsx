import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Question, Racer } from '../../types';
import { sound, SpeechStatusSnapshot } from '../../services/soundService';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  Clock,
  Image as ImageIcon,
  Flame,
} from 'lucide-react';
import {
  QuestionVisualIllustration,
  OptionVisualIllustration,
  resolveVisualDisplayMode,
} from './QuestionVisualIllustration';

interface QuestionHUDProps {
  question: Question;
  activeRacer?: Racer;
  selectedStudentName?: string | null;
  studentCallCount?: number;
  lessonTitle?: string;
  questionNumber: number;
  totalQuestions: number;
  onAnswer: (optionIndex: number, elapsedSeconds: number) => void;
  combo?: number;
}

const OPTION_LABELS = ['A', 'B', 'C', 'D'];
const OPTION_COLORS = [
  {
    badge: 'bg-amber-400 text-slate-950',
  },
  {
    badge: 'bg-sky-400 text-slate-950',
  },
  {
    badge: 'bg-emerald-400 text-slate-950',
  },
  {
    badge: 'bg-fuchsia-400 text-slate-950',
  },
];

export const QuestionHUD: React.FC<QuestionHUDProps> = ({
  question,
  activeRacer,
  selectedStudentName,
  studentCallCount = 1,
  lessonTitle = 'PRIMARY ENGLISH',
  questionNumber,
  totalQuestions,
  onAnswer,
  combo = 0,
}) => {
  const [timeLeft, setTimeLeft] = useState<number>(60);
  const [isAnswering, setIsAnswering] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [manualDisplayModeOverride, setManualDisplayModeOverride] = useState<
    'question_image' | 'options_image' | null
  >(null);
  const [speechStatus, setSpeechStatus] = useState<SpeechStatusSnapshot>(() =>
    sound.getSpeechStatus()
  );

  // Track exact active (unpaused) response time in milliseconds
  const accumulatedElapsedMsRef = useRef<number>(0);
  const lastActiveStartTimeRef = useRef<number | null>(null);

  const autoDisplayMode = resolveVisualDisplayMode(question);
  const displayMode = manualDisplayModeOverride || autoDisplayMode;
  const questionContextKey = `question-${questionNumber}-${question.id}`;

  useEffect(() => {
    return sound.subscribeSpeechState((snap) => {
      setSpeechStatus(snap);
    });
  }, []);

  // Reset state when entering a new question — DO NOT auto-read and DO NOT run timer until user clicks Start!
  useEffect(() => {
    setTimeLeft(60);
    setIsAnswering(false);
    setIsPaused(false);
    setSelectedOption(null);
    setManualDisplayModeOverride(null);
    accumulatedElapsedMsRef.current = 0;
    lastActiveStartTimeRef.current = null;
    sound.stopSpeech(true);
  }, [question.id, question.question, questionNumber]);

  // Countdown timer ONLY runs when started (isAnswering === true), NOT paused (!isPaused), and no option selected yet
  useEffect(() => {
    if (!isAnswering || isPaused || selectedOption !== null) return;
    const interval = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(interval);
          return 0;
        }
        if (prev <= 6) {
          sound.playTick();
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [isAnswering, isPaused, selectedOption]);

  const startOrResumeTimerClock = () => {
    setIsAnswering(true);
    setIsPaused(false);
    if (lastActiveStartTimeRef.current === null) {
      lastActiveStartTimeRef.current = Date.now();
    }
  };

  const pauseTimerClock = () => {
    if (lastActiveStartTimeRef.current !== null) {
      accumulatedElapsedMsRef.current += Date.now() - lastActiveStartTimeRef.current;
      lastActiveStartTimeRef.current = null;
    }
    setIsPaused(true);
  };

  const handleStartQuestion = () => {
    if (isPaused) {
      handleResumeReading();
      return;
    }
    startOrResumeTimerClock();
    sound.playTick();
    const isCurrentlyPlayingThisQ =
      speechStatus.state === 'playing' && speechStatus.contextKey === questionContextKey;
    if (!isCurrentlyPlayingThisQ) {
      sound.speakQuestionAndOptions(
        questionNumber,
        question.question,
        question.options,
        undefined,
        questionContextKey
      );
    }
  };

  const handleStartReading = () => {
    startOrResumeTimerClock();
    sound.speakQuestionAndOptions(
      questionNumber,
      question.question,
      question.options,
      undefined,
      questionContextKey
    );
  };

  const handlePauseReading = () => {
    pauseTimerClock();
    sound.pauseSpeech();
  };

  const handleResumeReading = () => {
    startOrResumeTimerClock();
    const pausedSnap = sound.getPausedQuestionSnapshot(questionContextKey);
    if (pausedSnap || speechStatus.state === 'paused') {
      sound.resumeSpeech(questionContextKey);
    }
  };

  const handleReadOption = (optText: string, e: React.MouseEvent) => {
    e.stopPropagation();
    sound.speakText(optText, 'en-US');
  };

  const handleSelectOption = (idx: number) => {
    if (selectedOption !== null) return;
    if (lastActiveStartTimeRef.current !== null) {
      accumulatedElapsedMsRef.current += Date.now() - lastActiveStartTimeRef.current;
      lastActiveStartTimeRef.current = null;
    }
    setSelectedOption(idx);
    setIsAnswering(false);
    setIsPaused(false);
    const totalElapsedMs =
      accumulatedElapsedMsRef.current > 0 ? accumulatedElapsedMsRef.current : 1500;
    const elapsedSec = Math.max(
      0.5,
      Math.min(60, Number((totalElapsedMs / 1000).toFixed(1)))
    );
    onAnswer(idx, elapsedSec);
  };

  const isQuestionPlaying =
    speechStatus.state === 'playing' && speechStatus.contextKey === questionContextKey;
  const pausedQuestionSnap = sound.getPausedQuestionSnapshot(questionContextKey);
  const isEffectivePaused =
    isPaused || (!isQuestionPlaying && pausedQuestionSnap !== null);
  const isEffectiveActive = (isQuestionPlaying || isAnswering) && !isEffectivePaused;

  return (
    <div className="w-full h-full flex flex-col justify-between bg-slate-900/95 backdrop-blur-xl rounded-3xl border-2 border-indigo-500/40 shadow-[0_16px_48px_rgba(0,0,0,0.65)] p-4 sm:p-5 overflow-y-auto">
      {/* Top Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2">
          <span className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 font-black text-xs sm:text-sm uppercase tracking-wider shadow-md">
            QUESTION {questionNumber} / {totalQuestions}
          </span>

          <button
            type="button"
            onClick={() =>
              setManualDisplayModeOverride((prev) => {
                const current = prev || autoDisplayMode;
                return current === 'options_image' ? 'question_image' : 'options_image';
              })
            }
            title="Click to switch visual display between Question Image and 4 Option Images (A–D)"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/35 border border-indigo-400/40 text-indigo-200 text-xs font-bold cursor-pointer transition-colors"
          >
            <ImageIcon className="w-3.5 h-3.5 text-indigo-300" />
            <span>
              {displayMode === 'options_image' ? 'Visual Options (A–D)' : 'Visual Question'}
            </span>
          </button>

          {combo >= 2 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-orange-500/20 border border-orange-400/50 text-orange-300 text-xs font-black">
              <Flame className="w-3.5 h-3.5 text-orange-400" />
              Combo x{combo}
            </span>
          )}
        </div>

        {/* Manual Start Reading / Pause (stops timer & voice) / Resume (continues next voice & timer) Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {!isEffectiveActive && !isEffectivePaused && (
            <button
              type="button"
              onClick={handleStartReading}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-black text-xs sm:text-sm shadow-lg transition-all cursor-pointer border border-indigo-300/50"
              title="Click to start reading the question and options A, B, C, D in American English (en-US) and start the timer"
            >
              <Play className="w-4 h-4 text-amber-300 fill-amber-300" />
              <span>🇺🇸 Start Reading (Bắt đầu đọc)</span>
            </button>
          )}

          {isEffectiveActive && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handlePauseReading}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs sm:text-sm shadow-lg transition-all cursor-pointer border-2 border-white"
                title="Pause reading and stop countdown timer (Tạm dừng đọc & dừng thời gian)"
              >
                <Pause className="w-4 h-4 fill-slate-950" />
                <span>⏸ Pause (Tạm dừng)</span>
              </button>

              {isQuestionPlaying && speechStatus.currentLabel && (
                <span className="hidden md:inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-950/90 border border-indigo-400/40 text-indigo-200 text-[11px] font-bold">
                  <Volume2 className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
                  <span>{speechStatus.currentLabel}</span>
                </span>
              )}

              <button
                type="button"
                onClick={handleStartReading}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/15 cursor-pointer"
                title="Read again from the beginning (Đọc lại từ đầu)"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          )}

          {isEffectivePaused && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleResumeReading}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-slate-950 font-black text-xs sm:text-sm shadow-[0_0_18px_rgba(16,185,129,0.6)] transition-all cursor-pointer border-2 border-white"
                title="Continue reading the next content and resume the timer (Tiếp tục đọc nội dung tiếp theo & chạy tiếp thời gian)"
              >
                <Play className="w-4 h-4 fill-slate-950" />
                <span>
                  ▶ Resume Reading (Tiếp tục
                  {pausedQuestionSnap?.currentLabel
                    ? `: ${pausedQuestionSnap.currentLabel}`
                    : ''}
                  )
                </span>
              </button>

              <button
                type="button"
                onClick={handleStartReading}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/15 cursor-pointer"
                title="Restart reading from the beginning (Đọc lại từ đầu)"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          )}

          <div
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-black text-sm sm:text-base border shadow-inner ${
              isEffectivePaused
                ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                : timeLeft <= 10
                ? 'bg-rose-600/30 border-rose-400 text-rose-300 animate-pulse'
                : 'bg-slate-950/90 border-white/15 text-amber-300'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>
              {timeLeft}s{isEffectivePaused ? ' (PAUSED)' : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Active Team & Selected Student Bar */}
      <div className="my-2.5 flex flex-wrap items-center justify-between gap-2 bg-slate-950/80 border border-white/10 rounded-2xl px-4 py-2.5 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-2xl shrink-0">{activeRacer?.avatar || '🦁'}</span>
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-300 truncate">
              {lessonTitle} • {activeRacer?.name || 'Active Player'}
            </div>
            <div className="text-sm sm:text-base font-black text-amber-300 truncate">
              {selectedStudentName
                ? `🐊 Student Caught: ${selectedStudentName} (Turn #${studentCallCount})`
                : '🐊 Click "🐊 CROCODILE CATCH!" in the 3D Lake to call a student!'}
            </div>
          </div>
        </div>

        {!isEffectiveActive && selectedOption === null && (
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={handleStartQuestion}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-500 text-slate-950 font-black text-xs sm:text-sm uppercase tracking-wider shadow-[0_0_20px_rgba(16,185,129,0.5)] flex items-center gap-2 cursor-pointer shrink-0"
          >
            <Play className="w-4 h-4 fill-slate-950" />
            <span>
              {isEffectivePaused ? `RESUME (${timeLeft}s)` : `START (${timeLeft}s)`}
            </span>
          </motion.button>
        )}
      </div>

      {/* Question Content & Visual Illustration Area - Extra Large for Classroom Visibility */}
      <div className="my-2 flex-1 flex flex-col justify-center gap-3 bg-slate-950/75 border-2 border-indigo-500/30 rounded-2xl p-4 sm:p-5 shadow-inner">
        <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black text-white leading-snug tracking-tight select-text">
          {question.question}
        </h2>

        {displayMode === 'question_image' && (
          <QuestionVisualIllustration question={question} />
        )}
      </div>

      {/* 4 Answer Options Grid - Extra Large Font & Clear Visual Illustrations per Option */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 shrink-0">
        {question.options.map((opt, idx) => {
          const style = OPTION_COLORS[idx % OPTION_COLORS.length];
          const isSelected = selectedOption === idx;
          const isCorrect = idx === question.correctIndex;
          const showResult = selectedOption !== null;

          let cardClass =
            'bg-slate-800/95 hover:bg-slate-800 border-2 border-white/15 text-white';
          if (showResult) {
            if (isCorrect) {
              cardClass =
                'bg-emerald-600/90 border-2 border-emerald-300 text-white shadow-[0_0_25px_rgba(16,185,129,0.6)]';
            } else if (isSelected && !isCorrect) {
              cardClass =
                'bg-rose-600/90 border-2 border-rose-300 text-white shadow-[0_0_25px_rgba(244,63,94,0.6)]';
            } else {
              cardClass = 'bg-slate-900/60 border border-white/10 text-slate-400 opacity-65';
            }
          }

          const cleanOptionText = opt.replace(/^[A-D][\.\)\:\-]\s*/i, '').trim();
          const hasUploadedOptionBitmap = Boolean(
            question.optionImages?.[idx] && question.optionImages[idx].trim()
          );
          const isPlaceholderLabel =
            hasUploadedOptionBitmap && /^Option\s+[A-D]$/i.test(cleanOptionText);

          return (
            <motion.div
              key={idx}
              whileHover={selectedOption === null ? { scale: 1.015 } : {}}
              whileTap={selectedOption === null ? { scale: 0.985 } : {}}
              onClick={() => handleSelectOption(idx)}
              className={`relative rounded-2xl p-3 sm:p-3.5 transition-all cursor-pointer flex flex-col justify-between gap-2 shadow-lg ${cardClass}`}
            >
              <div className="flex items-center justify-between gap-3 w-full">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div
                    className={`w-9 h-9 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center font-black text-base sm:text-xl shrink-0 shadow-md ${style.badge}`}
                  >
                    {OPTION_LABELS[idx]}
                  </div>
                  <div className="min-w-0 flex-1">
                    {!isPlaceholderLabel && (
                      <div className="text-base sm:text-xl md:text-2xl font-black leading-snug break-words">
                        {cleanOptionText}
                      </div>
                    )}
                  </div>
                </div>

                {/* Read Option Aloud in American English */}
                <button
                  type="button"
                  onClick={(e) =>
                    handleReadOption(
                      isPlaceholderLabel ? `Option ${OPTION_LABELS[idx]}` : cleanOptionText,
                      e
                    )
                  }
                  title="Pronounce this option (US English)"
                  className="p-2 rounded-xl bg-slate-950/70 hover:bg-indigo-600 text-amber-300 hover:text-white border border-white/15 transition-colors shrink-0 cursor-pointer"
                >
                  <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>

              {displayMode === 'options_image' && (
                <OptionVisualIllustration
                  question={question}
                  optionIndex={idx}
                  optionText={cleanOptionText}
                  visualSpec={question.optionVisuals?.[idx]}
                  optionSvg={question.optionSvgs?.[idx]}
                  optionImage={question.optionImages?.[idx]}
                  questionText={question.question}
                />
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
export default QuestionHUD;
