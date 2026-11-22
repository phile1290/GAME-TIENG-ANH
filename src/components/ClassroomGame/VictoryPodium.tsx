import React, { useEffect, useMemo, useState } from 'react';
import { Racer, GameMode, SessionStudentRecord } from '../../types';
import { compareRacersByResult, compareSessionStudentsByResult } from '../../store/gameStore';
import { Trophy, RotateCcw, Home, BarChart3, Award, Clock, CheckCircle2, Sparkles, Volume2, Music } from 'lucide-react';
import { motion } from 'motion/react';
import confetti from 'canvas-confetti';
import { sound } from '../../services/soundService';

interface VictoryPodiumProps {
  winner: Racer;
  allRacers: Racer[];
  gameMode: GameMode;
  sessionStudentRecords: Record<string, SessionStudentRecord>;
  totalQuestions: number;
  lessonTitle: string;
  onRestart: () => void;
  onReturnHome: () => void;
  onGoToDashboard: () => void;
}

interface FallingParticle {
  id: number;
  symbol: string;
  leftPercent: number;
  durationSec: number;
  delaySec: number;
  sizePx: number;
  swayPx: number;
  isTrophy: boolean;
}

const FLOWER_AND_TROPHY_SYMBOLS = [
  '🌸',
  '🌺',
  '🌻',
  '🌷',
  '🌼',
  '🌹',
  '💮',
  '💐',
  '🏆',
  '🌸',
  '🌺',
  '🌻',
  '🌷',
  '🌼',
  '🏆',
  '✨',
];

export const VictoryPodium: React.FC<VictoryPodiumProps> = ({
  winner,
  allRacers,
  gameMode,
  sessionStudentRecords,
  totalQuestions,
  lessonTitle,
  onRestart,
  onReturnHome,
  onGoToDashboard,
}) => {
  const [isMusicPlaying, setIsMusicPlaying] = useState(true);
  const sortedRacers = [...allRacers].sort(compareRacersByResult);
  const sortedStudents = Object.values(sessionStudentRecords).sort(compareSessionStudentsByResult);

  const winnerHookLevel =
    typeof winner.hookLevel === 'number'
      ? winner.hookLevel
      : Math.round((winner.progress || 0) / 10);

  // Pre-compute falling flowers & trophies from top to bottom
  const fallingParticles = useMemo<FallingParticle[]>(() => {
    return Array.from({ length: 42 }).map((_, i) => {
      const symbol = FLOWER_AND_TROPHY_SYMBOLS[i % FLOWER_AND_TROPHY_SYMBOLS.length];
      return {
        id: i,
        symbol,
        leftPercent: (i * 97) % 100,
        durationSec: 4.5 + (i % 6) * 0.85,
        delaySec: (i % 10) * 0.45,
        sizePx: symbol === '🏆' ? 28 + (i % 3) * 6 : 22 + (i % 4) * 5,
        swayPx: (i % 2 === 0 ? 1 : -1) * (25 + (i % 4) * 12),
        isTrophy: symbol === '🏆',
      };
    });
  }, []);

  useEffect(() => {
    // Start lively celebration fanfare loop & announce final results
    sound.startCelebrationMusic();
    sound.speakVictoryResult(winner.name, winner.score, winnerHookLevel);

    // Multi-wave festive confetti bursts
    const burst = () => {
      confetti({
        particleCount: 70,
        spread: 80,
        origin: { x: 0.2, y: 0.35 },
        colors: ['#fbbf24', '#f43f5e', '#ec4899', '#34d399', '#60a5fa'],
      });
      confetti({
        particleCount: 70,
        spread: 80,
        origin: { x: 0.8, y: 0.35 },
        colors: ['#fbbf24', '#f43f5e', '#ec4899', '#34d399', '#60a5fa'],
      });
    };

    burst();
    const t1 = window.setTimeout(burst, 1400);
    const t2 = window.setTimeout(burst, 2900);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      sound.stopCelebrationMusic();
      sound.stopSpeech();
    };
  }, [winner.name, winner.score, winnerHookLevel]);

  const handleReplayAnnouncement = () => {
    sound.playVictory();
    sound.speakVictoryResult(winner.name, winner.score, winnerHookLevel);
  };

  const handleToggleCelebrationMusic = () => {
    if (isMusicPlaying) {
      sound.stopCelebrationMusic();
      setIsMusicPlaying(false);
    } else {
      sound.startCelebrationMusic();
      setIsMusicPlaying(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/88 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      {/* Continuous Falling Flowers & Trophies from Top to Bottom */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
        {fallingParticles.map((item) => (
          <motion.div
            key={item.id}
            initial={{
              top: '-10%',
              left: `${item.leftPercent}%`,
              rotate: 0,
              opacity: 0.95,
              x: 0,
            }}
            animate={{
              top: '110%',
              rotate: item.isTrophy ? [0, -18, 18, -12, 12, 0] : 360,
              x: [0, item.swayPx, -item.swayPx * 0.7, item.swayPx * 0.5, 0],
              opacity: [0.95, 1, 1, 0.85],
            }}
            transition={{
              duration: item.durationSec,
              delay: item.delaySec,
              repeat: Infinity,
              ease: 'linear',
            }}
            style={{ fontSize: `${item.sizePx}px` }}
            className="absolute select-none drop-shadow-[0_4px_8px_rgba(0,0,0,0.45)]"
          >
            {item.symbol}
          </motion.div>
        ))}
      </div>

      {/* Main Victory Modal */}
      <div className="relative z-10 w-full max-w-4xl bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-900 border-2 border-amber-400/70 rounded-3xl shadow-[0_0_60px_rgba(251,191,36,0.35)] overflow-hidden my-auto">
        {/* Header with Animated Golden Trophy Cup & Result Announcement */}
        <div className="px-6 py-5 bg-gradient-to-r from-amber-500/25 via-yellow-400/20 to-amber-500/25 border-b border-amber-400/40 text-center relative overflow-hidden">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-amber-400/20 border border-amber-300/50 text-amber-200 text-xs font-black uppercase tracking-widest mb-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" /> OFFICIAL MATCH RESULT ANNOUNCEMENT • PRIMARY ENGLISH
          </div>

          {/* Animated Trophy Showcase */}
          <div className="flex items-center justify-center gap-4 my-2">
            <motion.div
              animate={{ y: [0, -8, 0], rotate: [-8, 8, -8], scale: [1, 1.12, 1] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
              className="text-3xl sm:text-4xl select-none drop-shadow-[0_0_16px_rgba(251,191,36,0.8)]"
            >
              🌸🏆🌸
            </motion.div>

            <motion.div
              initial={{ scale: 0.4, rotate: -15 }}
              animate={{
                scale: [1, 1.12, 1],
                rotate: [0, 4, -4, 0],
              }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
              className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-amber-300 via-yellow-400 to-orange-500 p-1 shadow-[0_0_40px_rgba(251,191,36,0.85)] flex items-center justify-center border-2 border-white"
            >
              <div className="w-full h-full rounded-full bg-slate-950/90 flex items-center justify-center relative">
                <Trophy className="w-11 h-11 sm:w-13 sm:h-13 text-amber-300 drop-shadow-[0_0_12px_rgba(251,191,36,0.9)]" />
                <span className="absolute -top-2 -right-1 text-xl">👑</span>
                <span className="absolute -bottom-2 px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black text-[10px] uppercase tracking-wider shadow">
                  1ST PLACE
                </span>
              </div>
            </motion.div>

            <motion.div
              animate={{ y: [0, -8, 0], rotate: [8, -8, 8], scale: [1, 1.12, 1] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
              className="text-3xl sm:text-4xl select-none drop-shadow-[0_0_16px_rgba(251,191,36,0.8)]"
            >
              🌺🏆🌺
            </motion.div>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-2">
            🏆 CHAMPION: <span className="text-amber-300">{winner.name}</span> {winner.avatar}
          </h2>

          {/* Result Summary Banner */}
          <div className="mt-2 inline-flex flex-wrap items-center justify-center gap-3 px-4 py-1.5 rounded-2xl bg-slate-950/75 border border-amber-300/40 text-xs sm:text-sm font-black text-amber-200">
            <span>Final Score: {winner.score} pts</span>
            <span>•</span>
            <span className="text-emerald-300">Peak Reached: Hook {winnerHookLevel}/10</span>
            <span>•</span>
            <span className="text-sky-300">
              Correct Answers: {winner.correctCount || 0}/
              {(winner.correctCount || 0) + (winner.wrongCount || 0)}
            </span>
          </div>

          <p className="text-xs sm:text-sm text-indigo-200 mt-1.5 font-medium">
            Lesson: <span className="text-white font-bold">{lessonTitle}</span> • Total Questions: {totalQuestions}
          </p>
          <p className="text-[11px] text-amber-300/90 font-semibold mt-0.5">
            Developed by Teacher Van Thi Thuy Trang
          </p>

          {/* Audio Controls for Announcement & Celebration Music */}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={handleReplayAnnouncement}
              className="px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
            >
              <Volume2 className="w-3.5 h-3.5" /> Replay Result Announcement
            </button>
            <button
              type="button"
              onClick={handleToggleCelebrationMusic}
              className={`px-3.5 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 border transition-all cursor-pointer ${
                isMusicPlaying
                  ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-200 hover:bg-emerald-500/30'
                  : 'bg-slate-800 border-white/15 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Music className="w-3.5 h-3.5" />
              {isMusicPlaying ? 'Celebration Music: ON' : 'Celebration Music: OFF'}
            </button>
          </div>
        </div>

        {/* Rankings Grid */}
        <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 max-h-[55vh] overflow-y-auto">
          {/* Team / Racer Podium */}
          <div className="bg-slate-950/60 border border-white/10 rounded-2xl p-4">
            <h3 className="text-sm font-black uppercase tracking-wider text-amber-300 flex items-center gap-2 mb-3">
              <Trophy className="w-4 h-4" />
              {gameMode === 'team' ? 'TEAM LEADERBOARD & TROPHIES' : 'CLIMBER LEADERBOARD & TROPHIES'}
            </h3>
            <div className="space-y-2.5">
              {sortedRacers.map((racer, idx) => {
                const hookReached =
                  typeof racer.hookLevel === 'number'
                    ? racer.hookLevel
                    : Math.round((racer.progress || 0) / 10);
                const totalAttempts = (racer.correctCount || 0) + (racer.wrongCount || 0);
                const medalIcon = idx === 0 ? '🏆' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '🏵️';
                return (
                  <div
                    key={racer.id}
                    className={`flex items-center justify-between p-3 rounded-xl border ${
                      idx === 0
                        ? 'bg-amber-400/15 border-amber-400/60 text-white shadow-[0_0_20px_rgba(251,191,36,0.15)]'
                        : 'bg-slate-900/70 border-white/10 text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-8 h-8 rounded-lg font-black text-xs flex items-center justify-center ${
                          idx === 0
                            ? 'bg-amber-400 text-slate-950'
                            : idx === 1
                            ? 'bg-slate-300 text-slate-950'
                            : idx === 2
                            ? 'bg-amber-700 text-white'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {medalIcon}
                      </span>
                      <span className="text-xl">{racer.avatar}</span>
                      <div>
                        <div className="font-black text-sm flex items-center gap-1.5">
                          <span>{racer.name}</span>
                          {idx === 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 font-black">
                              CHAMPION
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-2">
                          <span>
                            Correct {racer.correctCount || 0}/{totalAttempts}
                          </span>
                          <span
                            className={
                              hookReached < 0 ? 'text-rose-400 font-bold' : 'text-emerald-300 font-bold'
                            }
                          >
                            • Hook {hookReached}/10
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className={`text-sm font-black ${
                          racer.score < 0 ? 'text-rose-400' : 'text-amber-300'
                        }`}
                      >
                        {racer.score} pts
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center justify-end gap-1">
                        <Clock className="w-3 h-3" /> {(racer.totalTimeSec || 0).toFixed(1)}s
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Individual Student Participation */}
          <div className="bg-slate-950/60 border border-white/10 rounded-2xl p-4">
            <h3 className="text-sm font-black uppercase tracking-wider text-emerald-300 flex items-center gap-2 mb-3">
              <Award className="w-4 h-4" />
              INDIVIDUAL STUDENT HONORS
            </h3>
            {sortedStudents.length === 0 ? (
              <div className="text-xs text-slate-400 py-8 text-center">
                No individual student turns recorded in this match yet.
              </div>
            ) : (
              <div className="space-y-2">
                {sortedStudents.map((st, idx) => {
                  const attempts = st.correctCount + st.wrongCount;
                  const netHooks = st.hooksClimbed ?? st.correctCount - st.wrongCount;
                  return (
                    <div
                      key={st.studentName}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/70 border border-white/10"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-6 h-6 rounded-lg bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 font-black text-xs flex items-center justify-center">
                          {idx === 0 ? '🏆' : idx + 1}
                        </span>
                        <div>
                          <div className="font-bold text-xs sm:text-sm text-white">{st.studentName}</div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-2">
                            <span>{st.teamName}</span>
                            <span className="text-emerald-400 flex items-center gap-0.5">
                              <CheckCircle2 className="w-3 h-3" /> {st.correctCount}/{attempts} correct
                            </span>
                            <span
                              className={
                                netHooks < 0 ? 'text-rose-400 font-bold' : 'text-amber-300 font-bold'
                              }
                            >
                              • Hook {netHooks}/10
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div
                          className={`text-xs font-black ${
                            st.score < 0 ? 'text-rose-400' : 'text-amber-300'
                          }`}
                        >
                          {st.score} pts
                        </div>
                        <div className="text-[10px] text-slate-400">{st.totalTimeSec.toFixed(1)}s</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="px-6 py-4 bg-slate-950/90 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={() => {
              sound.stopCelebrationMusic();
              onReturnHome();
            }}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer"
          >
            <Home className="w-4 h-4" /> Change Lesson / New Setup
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                sound.stopCelebrationMusic();
                onGoToDashboard();
              }}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer"
            >
              <BarChart3 className="w-4 h-4" /> View Weekly Leaderboard
            </button>
            <button
              onClick={() => {
                sound.stopCelebrationMusic();
                onRestart();
              }}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-slate-950 font-black text-xs sm:text-sm flex items-center gap-2 shadow-lg transition-all cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" /> Play This Quiz Again
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
