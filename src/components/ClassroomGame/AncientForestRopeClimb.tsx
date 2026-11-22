import React, { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Racer } from '../../types';
import { Trophy, Sparkles, TreePine, Award, ChevronLeft, ChevronRight } from 'lucide-react';

interface AncientForestRopeClimbProps {
  racers: Racer[];
  activeRacerIndex?: number;
  selectedStudentName?: string | null;
  compact?: boolean;
}

const HOOK_STEPS = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0];

const CLIMBER_COLORS = [
  { shirt: '#ef4444', pants: '#1d4ed8', hat: '#f59e0b', glow: 'rgba(239,68,68,0.5)' },
  { shirt: '#10b981', pants: '#047857', hat: '#fbbf24', glow: 'rgba(16,185,129,0.5)' },
  { shirt: '#3b82f6', pants: '#1e3a8a', hat: '#38bdf8', glow: 'rgba(59,130,246,0.5)' },
  { shirt: '#ec4899', pants: '#831843', hat: '#f472b6', glow: 'rgba(236,72,153,0.5)' },
  { shirt: '#a855f7', pants: '#581c87', hat: '#c084fc', glow: 'rgba(168,85,247,0.5)' },
  { shirt: '#f97316', pants: '#7c2d12', hat: '#fb923c', glow: 'rgba(249,115,22,0.5)' },
  { shirt: '#14b8a6', pants: '#134e4a', hat: '#2dd4bf', glow: 'rgba(20,184,166,0.5)' },
  { shirt: '#eab308', pants: '#713f12', hat: '#facc15', glow: 'rgba(234,179,8,0.5)' },
];

const KidClimberSVG: React.FC<{
  colorSet: (typeof CLIMBER_COLORS)[0];
  isClimbing: boolean;
  isWinner: boolean;
  avatarEmoji?: string;
  compact?: boolean;
}> = ({ colorSet, isClimbing, isWinner, avatarEmoji, compact }) => {
  return (
    <motion.div
      animate={
        isWinner
          ? { y: [0, -5, 0], rotate: [-4, 4, -4], scale: [1, 1.08, 1] }
          : isClimbing
            ? { y: [0, -3, 0], rotate: [-2, 2, -2] }
            : { y: [0, -1.5, 0] }
      }
      transition={{ duration: isWinner ? 0.6 : 1.6, repeat: Infinity, ease: 'easeInOut' }}
      className="relative flex flex-col items-center select-none"
    >
      {isWinner && (
        <motion.div
          animate={{ scale: [1, 1.25, 1], rotate: [-8, 8, -8] }}
          transition={{ duration: 0.7, repeat: Infinity }}
          className="absolute -top-4 z-20 drop-shadow-[0_2px_6px_rgba(250,204,21,0.9)] text-xs"
        >
          👑
        </motion.div>
      )}

      <svg
        width={compact ? '36' : '42'}
        height={compact ? '44' : '50'}
        viewBox="0 0 60 72"
        className="overflow-visible drop-shadow-[0_4px_8px_rgba(0,0,0,0.75)]"
      >
        <path
          d="M 18 32 Q 10 22 25 18"
          stroke={colorSet.shirt}
          strokeWidth="6"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M 42 32 Q 50 22 35 18"
          stroke={colorSet.shirt}
          strokeWidth="6"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="26" cy="17" r="4" fill="#fde68a" stroke="#92400e" strokeWidth="1.2" />
        <circle cx="34" cy="17" r="4" fill="#fde68a" stroke="#92400e" strokeWidth="1.2" />

        <circle cx="30" cy="24" r="11" fill="#fde68a" stroke="#78350f" strokeWidth="1.5" />
        <path
          d="M 18 21 Q 30 9 42 21 Z"
          fill={colorSet.hat}
          stroke="#78350f"
          strokeWidth="1.5"
        />
        <ellipse cx="30" cy="21" rx="14" ry="3" fill={colorSet.hat} stroke="#78350f" strokeWidth="1.2" />

        <circle cx="26" cy="25" r="1.7" fill="#1e293b" />
        <circle cx="34" cy="25" r="1.7" fill="#1e293b" />
        <path
          d="M 26 29 Q 30 33 34 29"
          stroke="#b45309"
          strokeWidth="1.6"
          fill="none"
          strokeLinecap="round"
        />

        <rect
          x="21"
          y="35"
          width="18"
          height="16"
          rx="5"
          fill={colorSet.shirt}
          stroke="#1e293b"
          strokeWidth="1.4"
        />
        <rect x="23" y="37" width="14" height="11" rx="3" fill="#b45309" opacity="0.35" />

        <path
          d="M 24 50 L 20 62"
          stroke={colorSet.pants}
          strokeWidth="6"
          strokeLinecap="round"
        />
        <path
          d="M 36 50 L 40 62"
          stroke={colorSet.pants}
          strokeWidth="6"
          strokeLinecap="round"
        />
        <ellipse cx="19" cy="64" rx="4.5" ry="2.5" fill="#451a03" />
        <ellipse cx="41" cy="64" rx="4.5" ry="2.5" fill="#451a03" />
      </svg>

      {avatarEmoji && (
        <div className="absolute -right-2 top-0 w-5 h-5 rounded-full bg-slate-900/95 border border-amber-300/80 flex items-center justify-center text-[11px] shadow-md">
          {avatarEmoji}
        </div>
      )}
    </motion.div>
  );
};

export const AncientForestRopeClimb: React.FC<AncientForestRopeClimbProps> = ({
  racers,
  activeRacerIndex,
  selectedStudentName,
  compact = false,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const columnRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Auto-scroll smoothly to the active student or team column so even in a 45-student class it's immediately visible
  useEffect(() => {
    if (selectedStudentName) {
      const normSelected = selectedStudentName.trim().toLowerCase();
      const matched = racers.find((r) => r.name.trim().toLowerCase() === normSelected);
      if (matched && columnRefs.current[matched.id]) {
        columnRefs.current[matched.id]?.scrollIntoView({
          behavior: 'smooth',
          inline: 'center',
          block: 'nearest',
        });
        return;
      }
    }
    if (activeRacerIndex !== undefined && racers[activeRacerIndex]) {
      const targetRacer = racers[activeRacerIndex];
      const el = columnRefs.current[targetRacer.id];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }
  }, [activeRacerIndex, selectedStudentName, racers]);

  const scrollHorizontally = (direction: 'left' | 'right') => {
    if (!scrollContainerRef.current) return;
    const amount = direction === 'left' ? -420 : 420;
    scrollContainerRef.current.scrollBy({ left: amount, behavior: 'smooth' });
  };

  return (
    <div className="w-full h-full flex flex-col rounded-2xl overflow-hidden bg-gradient-to-b from-[#042f2e] via-[#064e3b] to-[#022c22] relative">
      {/* Top Header with Left / Right Scroll Controls */}
      <div className="relative z-20 flex items-center justify-between px-3 py-1.5 bg-slate-950/90 border-b border-emerald-500/30 shrink-0 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <TreePine className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-xs font-black uppercase tracking-wider text-emerald-300 truncate">
            10-HOOK ROPE CLIMB ({racers.length} {racers.length > 8 ? 'STUDENTS' : 'TEAMS'})
          </span>
          <span className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[10px] font-black shrink-0">
            GOAL: HOOK 10 🏆
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {selectedStudentName && (
            <div className="hidden sm:flex items-center gap-1 bg-amber-500/20 border border-amber-400/50 px-2 py-0.5 rounded-lg text-[10px] font-black text-amber-200 max-w-[150px] truncate">
              <Sparkles className="w-3 h-3 text-amber-300 shrink-0" />
              <span className="truncate">{selectedStudentName}</span>
            </div>
          )}
          <button
            type="button"
            onClick={() => scrollHorizontally('left')}
            title="Scroll Left to view more students"
            className="flex items-center justify-center w-6 h-6 rounded-md bg-emerald-900/80 hover:bg-emerald-700 text-emerald-200 border border-emerald-500/50 transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => scrollHorizontally('right')}
            title="Scroll Right to view more students"
            className="flex items-center justify-center w-6 h-6 rounded-md bg-emerald-900/80 hover:bg-emerald-700 text-emerald-200 border border-emerald-500/50 transition-colors cursor-pointer"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Horizontal Scrollable Rope Climb Lanes - Wide, Non-Overlapping Columns for Every Student */}
      <div
        ref={scrollContainerRef}
        className="relative z-10 flex-1 min-h-0 flex flex-row items-stretch gap-3 px-3 py-2 overflow-x-auto overflow-y-hidden scroll-smooth"
      >
        {racers.map((racer, idx) => {
          const rawScore = racer.score ?? 0;
          const hookLevel =
            typeof racer.hookLevel === 'number'
              ? racer.hookLevel
              : Math.round((racer.progress || 0) / 10);
          const visualClampedHook = Math.min(10, Math.max(0, hookLevel));
          const progressPct = (visualClampedHook / 10) * 100;
          const isSelectedByName =
            selectedStudentName &&
            racer.name.trim().toLowerCase() === selectedStudentName.trim().toLowerCase();
          const isActive = activeRacerIndex === idx || Boolean(isSelectedByName);
          const isWinner = hookLevel >= 10;
          const colorSet = CLIMBER_COLORS[idx % CLIMBER_COLORS.length];
          const totalTimeSec = racer.totalTimeSec || 0;
          const correctCount = racer.correctCount || 0;

          return (
            <div
              key={racer.id}
              ref={(node) => {
                columnRefs.current[racer.id] = node;
              }}
              className={`relative h-full shrink-0 w-[134px] sm:w-[146px] flex flex-col items-center justify-between rounded-xl px-2 py-2 transition-all border ${
                isActive
                  ? 'bg-emerald-900/65 border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.38)] ring-2 ring-amber-400/55'
                  : 'bg-slate-950/60 border-emerald-500/35 hover:bg-slate-900/75'
              }`}
            >
              {/* Top Crown / Peak Marker + Student Number Badge */}
              <div className="relative z-20 w-full flex flex-col items-center gap-1 shrink-0">
                <div className="w-full flex items-center justify-between px-1">
                  <span className="px-1.5 py-0.5 rounded bg-slate-900/90 border border-emerald-500/40 text-[9px] font-black text-emerald-300">
                    #{idx + 1}
                  </span>
                  {isActive && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 text-[9px] font-black uppercase animate-pulse">
                      ACTIVE
                    </span>
                  )}
                </div>

                <div
                  className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black border shadow-sm ${
                    isWinner
                      ? 'bg-gradient-to-r from-amber-400 to-yellow-300 text-slate-950 border-white animate-bounce'
                      : 'bg-amber-950/90 text-amber-300 border-amber-500/50'
                  }`}
                >
                  <Trophy className="w-3 h-3 shrink-0" />
                  <span>HOOK 10</span>
                </div>
              </div>

              {/* Rope Track Container */}
              <div className="relative flex-1 w-full my-1.5 flex justify-center">
                {/* Vertical Braided Rope */}
                <div
                  className="relative h-full w-2.5 rounded-full shadow-inner border border-amber-950/80"
                  style={{
                    background:
                      'repeating-linear-gradient(45deg, #d97706, #d97706 4px, #92400e 4px, #92400e 8px)',
                  }}
                />

                {/* 10 Hook Markers with Clear Labels */}
                <div className="absolute inset-y-0 left-0 right-0 flex flex-col justify-between items-center pointer-events-none">
                  {HOOK_STEPS.map((step) => {
                    const isReached = hookLevel >= step;
                    const isCurrent = visualClampedHook === step;
                    return (
                      <div key={step} className="relative flex items-center justify-center w-full">
                        {/* Horizontal tick across rope */}
                        <div
                          className={`w-6 h-1 rounded-full transition-all ${
                            isCurrent
                              ? 'bg-amber-300 shadow-[0_0_8px_rgba(252,211,77,1)] scale-125'
                              : isReached
                                ? 'bg-emerald-400'
                                : 'bg-slate-600/70'
                          }`}
                        />
                        {/* Clear Step Number Badge on Left Side of Rope */}
                        <span
                          className={`absolute left-1.5 text-[9px] font-black px-1 rounded transition-all ${
                            isCurrent
                              ? 'bg-amber-400 text-slate-950 shadow-sm scale-110'
                              : isReached
                                ? 'text-emerald-300 bg-emerald-950/80'
                                : 'text-slate-400'
                          }`}
                        >
                          {step}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Climber Character Positioned at Current Hook */}
                <motion.div
                  className="absolute left-1/2 -translate-x-1/2 z-30 pointer-events-none"
                  initial={false}
                  animate={{
                    bottom: `calc(${progressPct}% - 18px)`,
                  }}
                  transition={{
                    type: 'spring',
                    stiffness: 120,
                    damping: 16,
                  }}
                >
                  <div className="relative flex flex-col items-center">
                    <KidClimberSVG
                      colorSet={colorSet}
                      isClimbing={isActive}
                      isWinner={isWinner}
                      avatarEmoji={racer.avatar}
                      compact={compact}
                    />
                    <div
                      className={`mt-0.5 px-2 py-0.5 rounded-md text-[10px] font-black whitespace-nowrap border shadow-md ${
                        hookLevel < 0
                          ? 'bg-rose-950/95 text-rose-300 border-rose-400/70'
                          : isActive
                            ? 'bg-amber-400 text-slate-950 border-white'
                            : 'bg-slate-900/95 text-emerald-300 border-emerald-500/40'
                      }`}
                    >
                      Hook {hookLevel}/10
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Bottom Student / Team Full Name & Stats Card */}
              <div
                className={`relative z-20 w-full rounded-xl p-2 text-center border transition-all shrink-0 ${
                  isActive
                    ? 'bg-slate-900/95 border-amber-400 shadow-md'
                    : 'bg-slate-950/90 border-white/15'
                }`}
              >
                <div
                  className="text-xs font-black text-white leading-tight line-clamp-2 min-h-[2rem] flex items-center justify-center break-words"
                  title={racer.name}
                >
                  {racer.name}
                </div>
                <div className="flex items-center justify-between gap-1 mt-1 pt-1 border-t border-white/10 text-[10px] font-black">
                  <span className={hookLevel < 0 ? 'text-rose-400' : 'text-amber-300'}>
                    {rawScore} pts
                  </span>
                  <span className="text-emerald-300 flex items-center gap-0.5">
                    <Award className="w-3 h-3" />
                    {correctCount} ({totalTimeSec.toFixed(0)}s)
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
export default AncientForestRopeClimb;
