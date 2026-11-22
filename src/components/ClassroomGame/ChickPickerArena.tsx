import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Racer, Student, GameMode } from '../../types';
import { sound } from '../../services/soundService';
import { Play, Sparkles, UserCheck, Volume2, Waves, ChevronLeft, ChevronRight } from 'lucide-react';

interface ChickPickerArenaProps {
  gameMode: GameMode;
  racers: Racer[];
  students: Student[];
  currentRacerIndex: number;
  selectedStudentName: string | null;
  studentCallCounts: Record<string, number>;
  onSelectStudent: (studentName: string, racerIdx?: number) => void;
  onSelectTeamFilter: (racerIdx: number) => void;
}

interface StudentMatEntity {
  name: string;
  teamName: string;
  racerIdx: number;
  matColor: string;
  matBorder: string;
  shirtColor: string;
  isDippingLegs: boolean;
  legKickPhase: number;
  dipTimerSec: number;
}

interface CrocodileSwimState {
  xPx: number;
  yPercent: number;
  headingRad: number;
  targetXPx: number;
  targetYPercent: number;
  swimPhase: number;
  isSnapping: boolean;
}

const MAT_PALETTES = [
  { matColor: '#f59e0b', matBorder: '#fef08a', shirtColor: '#ef4444' },
  { matColor: '#10b981', matBorder: '#a7f3d0', shirtColor: '#3b82f6' },
  { matColor: '#ec4899', matBorder: '#fbcfe8', shirtColor: '#eab308' },
  { matColor: '#8b5cf6', matBorder: '#ddd6fe', shirtColor: '#10b981' },
  { matColor: '#06b6d4', matBorder: '#cffafe', shirtColor: '#f97316' },
  { matColor: '#f97316', matBorder: '#fed7aa', shirtColor: '#6366f1' },
];

function clampVal(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function normalizeAngleRad(angle: number): number {
  let a = angle;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

/**
 * Illustration of a Student Standing on a Small Floating Mat ("tấm thảm nhỏ") in the 3D Lake
 * and Dipping Their Legs into the Water ("thò chân xuống dưới nước") with Water Ripples
 */
const StudentOnMatCard: React.FC<{
  student: StudentMatEntity;
  isCaught: boolean;
  isAlreadyCalled: boolean;
  onClick: () => void;
}> = ({ student, isCaught, isAlreadyCalled, onClick }) => {
  const dipping = (student.isDippingLegs && !isAlreadyCalled) || isCaught;
  const leftKick = dipping ? Math.sin(student.legKickPhase) * 3.5 : 0;
  const rightKick = dipping ? Math.sin(student.legKickPhase + Math.PI) * 3.5 : 0;
  const rippleScale = 0.92 + Math.sin(student.legKickPhase * 1.6) * 0.16;

  return (
    <div
      onClick={onClick}
      className={`group relative flex flex-col items-center justify-center select-none transition-all duration-200 ${
        isCaught
          ? 'scale-110 z-40 cursor-pointer'
          : isAlreadyCalled
          ? 'opacity-75 z-10 cursor-not-allowed'
          : 'hover:scale-105 z-10 cursor-pointer'
      }`}
    >
      {/* Glowing Golden Spotlight Halo behind the Caught Student Character */}
      {isCaught && (
        <div className="absolute -inset-2 rounded-2xl bg-amber-400/30 border-2 border-amber-300 shadow-[0_0_28px_rgba(250,204,21,0.95)] animate-pulse pointer-events-none" />
      )}

      <svg
        viewBox="0 0 110 86"
        className={`w-24 h-18 sm:w-28 sm:h-20 overflow-visible relative z-10 ${
          isCaught
            ? 'drop-shadow-[0_0_16px_rgba(250,204,21,1)]'
            : 'drop-shadow-[0_4px_6px_rgba(0,0,0,0.6)]'
        }`}
      >
        {/* Water reflection shadow under the small mat */}
        <ellipse cx="55" cy="56" rx="42" ry="13" fill="rgba(2,44,34,0.45)" />

        {/* The Small Floating Mat ("Tấm thảm nhỏ") with 3D perspective & woven trim */}
        <ellipse
          cx="55"
          cy="52"
          rx="39"
          ry="12.5"
          fill={student.matColor}
          stroke={isCaught ? '#ffffff' : student.matBorder}
          strokeWidth={isCaught ? '3.4' : '2.2'}
        />
        <ellipse
          cx="55"
          cy="50.5"
          rx="33"
          ry="8.8"
          fill="none"
          stroke="rgba(255,255,255,0.45)"
          strokeWidth="1.2"
          strokeDasharray="4 3"
        />

        {/* Student Upper Body & Head on the Small Mat */}
        {/* Torso / Shirt */}
        <path
          d="M 43 32 C 43 25, 67 25, 67 32 L 69 47 C 60 50, 50 50, 41 47 Z"
          fill={student.shirtColor}
          stroke="#ffffff"
          strokeWidth="1.3"
        />
        {/* Arms */}
        <path
          d={dipping ? 'M 43 31 Q 34 38 37 46' : 'M 43 31 Q 33 24 35 17'}
          stroke="#fde68a"
          strokeWidth="4.2"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d={dipping ? 'M 67 31 Q 76 38 73 46' : 'M 67 31 Q 77 24 75 17'}
          stroke="#fde68a"
          strokeWidth="4.2"
          strokeLinecap="round"
          fill="none"
        />

        {/* Cute Student Head */}
        <circle cx="55" cy="17.5" r="10.5" fill="#fde68a" stroke="#78350f" strokeWidth="1" />
        {/* Hair */}
        <path
          d="M 44.5 16 C 45 7, 65 7, 65.5 16 C 62 12, 48 12, 44.5 16 Z"
          fill="#1e293b"
        />
        {/* Eyes & Smile */}
        <circle cx="51.5" cy="17.5" r="1.4" fill="#0f172a" />
        <circle cx="58.5" cy="17.5" r="1.4" fill="#0f172a" />
        <path
          d={isCaught ? 'M 52 22 Q 55 19.5 58 22' : 'M 51.5 21 Q 55 24 58.5 21'}
          stroke="#78350f"
          strokeWidth="1.3"
          fill="none"
          strokeLinecap="round"
        />

        {/* Student Legs: Either Pulled Safely onto the Mat OR Dipped Down into the Lake Water ("Thò chân xuống nước") */}
        {dipping ? (
          <g>
            {/* Shorts on mat edge */}
            <rect x="44" y="44" width="10" height="7" rx="2.5" fill="#1e3a8a" />
            <rect x="56" y="44" width="10" height="7" rx="2.5" fill="#1e3a8a" />

            {/* Two legs dangling down off the front edge of the mat into the blue water */}
            <line
              x1="49"
              y1="50"
              x2={48 + leftKick}
              y2="68"
              stroke="#fde68a"
              strokeWidth="4.8"
              strokeLinecap="round"
            />
            <line
              x1="61"
              y1="50"
              x2={62 + rightKick}
              y2="68"
              stroke="#fde68a"
              strokeWidth="4.8"
              strokeLinecap="round"
            />

            {/* Submerged feet kicking in the water */}
            <ellipse
              cx={48 + leftKick}
              cy="70"
              rx="4.2"
              ry="2.2"
              fill="#38bdf8"
              opacity="0.85"
            />
            <ellipse
              cx={62 + rightKick}
              cy="70"
              rx="4.2"
              ry="2.2"
              fill="#38bdf8"
              opacity="0.85"
            />

            {/* Concentric Water Ripples around the dipped legs */}
            <ellipse
              cx="55"
              cy="69"
              rx={16 * rippleScale}
              ry={5.2 * rippleScale}
              fill="none"
              stroke="#7dd3fc"
              strokeWidth="1.6"
              opacity="0.9"
            />
            <ellipse
              cx="55"
              cy="69"
              rx={23 * rippleScale}
              ry={7.5 * rippleScale}
              fill="none"
              stroke="#bae6fd"
              strokeWidth="1.1"
              strokeDasharray="4 3"
              opacity="0.7"
            />
          </g>
        ) : (
          <g>
            {/* Legs safely standing/kneeling on top of the mat ("Trên bờ / Trên thảm") */}
            <rect x="45" y="44" width="8.5" height="7.5" rx="2.5" fill="#1e3a8a" />
            <rect x="56.5" y="44" width="8.5" height="7.5" rx="2.5" fill="#1e3a8a" />
            <ellipse cx="49" cy="52.5" rx="4.2" ry="2" fill="#fde68a" />
            <ellipse cx="61" cy="52.5" rx="4.2" ry="2" fill="#fde68a" />
          </g>
        )}
      </svg>

      {/* Full Student Name & Status Badge — Never truncates caught student's full name */}
      <div
        className={`relative z-20 -mt-2 px-2.5 py-1 rounded-xl text-center leading-tight shadow-lg transition-all ${
          isCaught
            ? 'bg-amber-400 text-slate-950 border-2 border-white ring-2 ring-rose-500 shadow-[0_0_20px_rgba(250,204,21,0.95)] min-w-[144px]'
            : isAlreadyCalled
            ? 'bg-slate-900/95 text-slate-300 border border-emerald-500/60 min-w-[134px] max-w-[158px]'
            : dipping
            ? 'bg-sky-950/95 text-sky-100 border border-sky-400/75 group-hover:border-amber-300 min-w-[134px] max-w-[158px]'
            : 'bg-slate-950/90 text-emerald-100 border border-emerald-400/45 group-hover:border-amber-300 min-w-[134px] max-w-[158px]'
        }`}
      >
        <div
          className={`font-black ${
            isCaught
              ? 'text-xs sm:text-sm text-slate-950 whitespace-nowrap'
              : 'text-[11px] sm:text-xs break-words'
          }`}
        >
          {student.name}
        </div>
        <div
          className={`text-[8px] sm:text-[9px] font-extrabold uppercase tracking-wider mt-0.5 ${
            isCaught
              ? 'text-rose-700'
              : isAlreadyCalled
              ? 'text-emerald-400'
              : dipping
              ? 'text-cyan-300'
              : 'text-emerald-400'
          }`}
        >
          {isCaught
            ? '🐊 BỊ CÁ SẤU BẮT (1/1)!'
            : isAlreadyCalled
            ? '✓ Đã được gọi (1/1)'
            : dipping
            ? '💦 Thò chân xuống nước'
            : '🛡️ Đứng trên thảm'}
        </div>
      </div>
    </div>
  );
};

/**
 * Lifelike Articulated Swimming Crocodile ("Cá Sấu Đang Bơi Tự Nhiên")
 * Features S-curve body & tail undulation, armored dorsal scutes, glowing reptile eyes, jaw snap, and water wake.
 */
const LifelikeSwimmingCrocodile: React.FC<{
  headingRad: number;
  swimPhase: number;
  isSnapping: boolean;
}> = ({ headingRad, swimPhase, isSnapping }) => {
  const cosH = Math.cos(headingRad);
  const sinH = Math.sin(headingRad);
  const facingLeft = cosH < -0.02;
  const localAngleDeg = (Math.atan2(sinH, Math.abs(cosH) + 0.22) * 180) / Math.PI;
  const tiltDeg = clampVal(localAngleDeg, -26, 26);

  const tailWave1 = Math.sin(swimPhase) * 6;
  const tailWave2 = Math.sin(swimPhase - 1.1) * 10;
  const bodySway = Math.sin(swimPhase + 0.6) * 2.2;
  const paddleSwing = Math.sin(swimPhase) * 7;
  const jawOpen = isSnapping ? 8 : Math.max(0, Math.sin(swimPhase * 0.7)) * 2.5;

  return (
    <div
      style={{
        transform: `${facingLeft ? 'scaleX(-1)' : 'scaleX(1)'} rotate(${tiltDeg}deg)`,
      }}
      className="pointer-events-none select-none"
    >
      <svg
        viewBox="0 0 165 76"
        className="w-28 h-13 sm:w-32 sm:h-15 overflow-visible drop-shadow-[0_6px_10px_rgba(0,0,0,0.75)]"
      >
        <defs>
          <linearGradient id="croc-scales" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#4d7c0f" />
            <stop offset="55%" stopColor="#15803d" />
            <stop offset="100%" stopColor="#14532d" />
          </linearGradient>
          <linearGradient id="croc-belly" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#bef264" />
            <stop offset="100%" stopColor="#65a30d" />
          </linearGradient>
        </defs>

        {/* Foamy V-shaped water wake & ripples around the swimming crocodile */}
        <path
          d={`M 118 38 Q 75 ${16 + bodySway} 12 ${10 + tailWave1} M 118 38 Q 75 ${60 + bodySway} 12 ${66 + tailWave1}`}
          fill="none"
          stroke="rgba(186,230,253,0.65)"
          strokeWidth="2.2"
          strokeDasharray="6 4"
          strokeLinecap="round"
        />
        <ellipse
          cx="82"
          cy={39 + bodySway * 0.5}
          rx="52"
          ry="18"
          fill="rgba(14,165,233,0.22)"
          stroke="rgba(125,211,252,0.55)"
          strokeWidth="1.4"
        />

        {/* Webbed Swimming Legs Paddling in the Water */}
        <g transform={`translate(0, ${bodySway})`}>
          {/* Hind Leg */}
          <path
            d={`M 56 30 Q ${50 - paddleSwing} 16 ${44 - paddleSwing} 14`}
            stroke="#166534"
            strokeWidth="5"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d={`M 56 46 Q ${50 + paddleSwing} 60 ${44 + paddleSwing} 62`}
            stroke="#166534"
            strokeWidth="5"
            strokeLinecap="round"
            fill="none"
          />
          {/* Front Leg */}
          <path
            d={`M 92 29 Q ${90 + paddleSwing} 15 ${84 + paddleSwing} 13`}
            stroke="#15803d"
            strokeWidth="5.2"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d={`M 92 47 Q ${90 - paddleSwing} 61 ${84 - paddleSwing} 63`}
            stroke="#15803d"
            strokeWidth="5.2"
            strokeLinecap="round"
            fill="none"
          />
        </g>

        {/* Undulating S-Curve Segmented Crocodile Tail */}
        <path
          d={`M 48 ${38 + bodySway} Q 28 ${38 + tailWave1} 6 ${38 + tailWave2} Q 26 ${45 + tailWave1} 48 ${44 + bodySway} Z`}
          fill="url(#croc-scales)"
          stroke="#052e16"
          strokeWidth="1.2"
        />
        {/* Tail armored scutes */}
        <circle cx="36" cy={36 + tailWave1 * 0.5} r="2.5" fill="#a3e635" />
        <circle cx="24" cy={37 + tailWave1 * 0.8} r="2.2" fill="#a3e635" />
        <circle cx="14" cy={38 + tailWave2 * 0.9} r="1.8" fill="#a3e635" />

        {/* Armored Crocodile Torso */}
        <g transform={`translate(0, ${bodySway})`}>
          <ellipse
            cx="75"
            cy="38"
            rx="32"
            ry="13.5"
            fill="url(#croc-scales)"
            stroke="#052e16"
            strokeWidth="1.4"
          />
          {/* Dorsal armor osteoderm ridges */}
          {[54, 64, 74, 84, 94].map((rx, i) => (
            <g key={i}>
              <polygon
                points={`${rx - 3},33 ${rx},28 ${rx + 3},33`}
                fill="#84cc16"
                stroke="#14532d"
                strokeWidth="0.7"
              />
              <polygon
                points={`${rx - 3},43 ${rx},48 ${rx + 3},43`}
                fill="#84cc16"
                stroke="#14532d"
                strokeWidth="0.7"
              />
            </g>
          ))}

          {/* Crocodile Head, Snout & Jaws */}
          {/* Lower Jaw + Teeth when snapping */}
          <path
            d={`M 102 40 L 146 ${42 + jawOpen} Q 140 ${48 + jawOpen} 102 45 Z`}
            fill="url(#croc-belly)"
            stroke="#14532d"
            strokeWidth="1.1"
          />
          {/* Sharp White Crocodile Teeth */}
          <polygon
            points={`114,39 116,${42 + jawOpen * 0.5} 118,39 122,39 124,${42 + jawOpen * 0.6} 126,39 131,39 133,${42 + jawOpen * 0.7} 135,39 140,39 142,${42 + jawOpen * 0.8} 144,39`}
            fill="#ffffff"
          />

          {/* Upper Snout & Skull */}
          <path
            d={`M 98 30 C 115 27, 138 29, 150 ${34 - jawOpen * 0.4} C 152 ${38 - jawOpen * 0.4}, 148 ${41 - jawOpen * 0.4}, 102 40 Z`}
            fill="url(#croc-scales)"
            stroke="#052e16"
            strokeWidth="1.3"
          />

          {/* Raised Nostrils at tip of snout */}
          <circle cx="144" cy={32 - jawOpen * 0.3} r="1.8" fill="#052e16" />

          {/* Raised Glowing Yellow Reptile Eyes with Vertical Slit Pupils */}
          <ellipse cx="107" cy="28" rx="5.2" ry="4.2" fill="#15803d" stroke="#052e16" strokeWidth="1" />
          <ellipse cx="108" cy="28" rx="3.6" ry="3.1" fill="#facc15" />
          <ellipse cx="108.4" cy="28" rx="1.1" ry="2.7" fill="#090d16" />
          <circle cx="109.2" cy="26.9" r="0.8" fill="#ffffff" />
        </g>
      </svg>
    </div>
  );
};

export const ChickPickerArena: React.FC<ChickPickerArenaProps> = ({
  gameMode,
  racers,
  students,
  currentRacerIndex,
  selectedStudentName,
  studentCallCounts,
  onSelectStudent,
  onSelectTeamFilter,
}) => {
  const [isChasing, setIsChasing] = useState(false);
  const [studentMats, setStudentMats] = useState<StudentMatEntity[]>([]);
  const [crocState, setCrocState] = useState<CrocodileSwimState>({
    xPx: 180,
    yPercent: 52,
    headingRad: 0,
    targetXPx: 420,
    targetYPercent: 50,
    swimPhase: 0,
    isSnapping: false,
  });
  const [caughtStudentName, setCaughtStudentName] = useState<string | null>(null);
  const [callNotice, setCallNotice] = useState<string | null>(null);

  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const scrollLakeRef = useRef<HTMLDivElement | null>(null);
  const matDomRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const studentMatsRef = useRef<StudentMatEntity[]>([]);
  const studentCallCountsRef = useRef<Record<string, number>>(studentCallCounts);
  useEffect(() => {
    studentCallCountsRef.current = studentCallCounts;
  }, [studentCallCounts]);

  const crocRef = useRef<CrocodileSwimState>({
    xPx: 180,
    yPercent: 52,
    headingRad: 0,
    targetXPx: 420,
    targetYPercent: 50,
    swimPhase: 0,
    isSnapping: false,
  });
  const isChasingRef = useRef<boolean>(false);
  const lockedCaughtIdxRef = useRef<number | null>(null);
  const manualScrollPauseUntilRef = useRef<number>(0);
  const chaseDataRef = useRef<{
    active: boolean;
    chosenIdx: number;
    decoyIdx: number;
    elapsedSec: number;
    durationSec: number;
    lastSplashSec: number;
  }>({
    active: false,
    chosenIdx: 0,
    decoyIdx: 0,
    elapsedSec: 0,
    durationSec: 2.75,
    lastSplashSec: 0,
  });

  const onSelectStudentRef = useRef(onSelectStudent);
  useEffect(() => {
    onSelectStudentRef.current = onSelectStudent;
  }, [onSelectStudent]);

  // Initialize ALL students on their own Small Floating Mats ("tấm thảm nhỏ") in the 3D Lake
  useEffect(() => {
    const activeRacer = racers[currentRacerIndex];
    let pool: { name: string; teamName: string; racerIdx: number }[] = [];

    if (gameMode === 'team' && activeRacer) {
      const members =
        activeRacer.memberNames && activeRacer.memberNames.length > 0
          ? activeRacer.memberNames
          : students.filter((s) => s.teamId === activeRacer.id).map((s) => s.name);

      pool = members.map((name: string) => ({
        name,
        teamName: activeRacer.name,
        racerIdx: currentRacerIndex,
      }));
    } else {
      pool = racers.map((r, idx) => ({
        name: r.name,
        teamName: r.subInfo || 'Individual',
        racerIdx: idx,
      }));
    }

    if (pool.length === 0 && students.length > 0) {
      pool = students.map((s, idx) => ({
        name: s.name,
        teamName: 'Class',
        racerIdx: idx % Math.max(1, racers.length),
      }));
    }

    const initialMats: StudentMatEntity[] = pool.map((item, idx) => {
      const pal = MAT_PALETTES[idx % MAT_PALETTES.length];
      return {
        name: item.name,
        teamName: item.teamName,
        racerIdx: item.racerIdx,
        matColor: pal.matColor,
        matBorder: pal.matBorder,
        shirtColor: pal.shirtColor,
        // Randomly ~65% of students start with their legs dipped into the water ("thò chân xuống nước")
        isDippingLegs: idx % 3 !== 0,
        legKickPhase: Math.random() * Math.PI * 2,
        dipTimerSec: 1.2 + Math.random() * 2.4,
      };
    });

    studentMatsRef.current = initialMats;
    setStudentMats(initialMats);
    setCaughtStudentName(selectedStudentName);

    if (selectedStudentName) {
      const foundIdx = initialMats.findIndex((m) => m.name === selectedStudentName);
      lockedCaughtIdxRef.current = foundIdx >= 0 ? foundIdx : null;
    } else {
      lockedCaughtIdxRef.current = null;
    }
  }, [gameMode, racers.length, students, currentRacerIndex]);

  useEffect(() => {
    setCaughtStudentName(selectedStudentName);
    if (!selectedStudentName) {
      lockedCaughtIdxRef.current = null;
    } else {
      const foundIdx = studentMatsRef.current.findIndex((m) => m.name === selectedStudentName);
      if (foundIdx >= 0) {
        lockedCaughtIdxRef.current = foundIdx;
      }
    }
  }, [selectedStudentName]);

  // Three.js 3D Lake Scene (3D Animated Water Waves, Floating Lily Pads, Lotus Flowers & 3D Swimming Crocodile)
  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      try {
        const gl = document.createElement('canvas').getContext('webgl2');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    const width = Math.max(300, container.clientWidth);
    const height = Math.max(180, container.clientHeight);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x033f58);
    scene.fog = new THREE.FogExp2(0x044e6c, 0.018);

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.5, 160);
    camera.position.set(0, 21, 24);
    camera.lookAt(0, 0, 0);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    try {
      const pmremGenerator = new THREE.PMREMGenerator(renderer);
      scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
      pmremGenerator.dispose();
    } catch {}

    // Sunlit 3D Lake Lighting
    const hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x064e3b, 1.5);
    hemiLight.position.set(0, 30, 0);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfef08a, 2.4);
    sunLight.position.set(14, 28, 16);
    scene.add(sunLight);

    // 3D Lake Water Surface with Vertex Wave Undulation
    const waterGeo = new THREE.PlaneGeometry(90, 60, 36, 24);
    waterGeo.rotateX(-Math.PI / 2);
    const waterMat = new THREE.MeshPhysicalMaterial({
      color: 0x0284c7,
      roughness: 0.18,
      metalness: 0.15,
      clearcoat: 0.9,
      clearcoatRoughness: 0.15,
    });
    const waterMesh = new THREE.Mesh(waterGeo, waterMat);
    scene.add(waterMesh);

    // Green Grassy Lake Banks at Top & Bottom Horizons
    const bankMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.85 });
    const backBank = new THREE.Mesh(new THREE.BoxGeometry(90, 2.2, 6), bankMat);
    backBank.position.set(0, 0.6, -15);
    scene.add(backBank);

    // Floating 3D Lily Pads ("Lá sen") & Pink Lotus Blossoms on the 3D Lake
    const lilyMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.65 });
    const lotusMat = new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.5 });
    const lilyGroups: THREE.Group[] = [];
    const lilyCoords: [number, number, number][] = [
      [-14, -7, 1.1],
      [-7, -8.5, 0.9],
      [4, -8, 1.15],
      [13, -7.2, 1.0],
      [-15, 6.5, 1.0],
      [-5, 7.5, 0.95],
      [8, 7.2, 1.1],
      [15, 5.8, 0.9],
    ];
    lilyCoords.forEach(([lx, lz, sc], idx) => {
      const g = new THREE.Group();
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(1.1 * sc, 1.1 * sc, 0.08, 16), lilyMat);
      g.add(pad);
      if (idx % 2 === 0) {
        const flower = new THREE.Mesh(new THREE.DodecahedronGeometry(0.38 * sc, 0), lotusMat);
        flower.position.y = 0.22;
        g.add(flower);
      }
      g.position.set(lx, 0.08, lz);
      scene.add(g);
      lilyGroups.push(g);
    });

    // 3D Multi-Part Swimming Crocodile in the 3D Lake
    const croc3DGroup = new THREE.Group();
    const crocSkinMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.55 });
    const crocEyeMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.2 });

    const body3D = new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 2.2, 8, 12), crocSkinMat);
    body3D.rotation.z = Math.PI / 2;
    body3D.position.y = 0.15;
    croc3DGroup.add(body3D);

    const snout3D = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.42, 0.78), crocSkinMat);
    snout3D.position.set(1.75, 0.22, 0);
    croc3DGroup.add(snout3D);

    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), crocEyeMat);
    eyeL.position.set(1.15, 0.52, 0.25);
    const eyeR = eyeL.clone();
    eyeR.position.z = -0.25;
    croc3DGroup.add(eyeL, eyeR);

    const tail3D = new THREE.Mesh(new THREE.ConeGeometry(0.45, 2.2, 8), crocSkinMat);
    tail3D.rotation.z = Math.PI / 2;
    tail3D.position.set(-2.1, 0.15, 0);
    croc3DGroup.add(tail3D);

    scene.add(croc3DGroup);

    const posAttr = waterGeo.attributes.position as THREE.BufferAttribute;
    const basePositions = new Float32Array(posAttr.array.length);
    basePositions.set(posAttr.array);

    let frameId = 0;
    const clock = new THREE.Clock();

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (!gl || !gl.fenceSync) {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    const tick = () => {
      const elapsed = clock.getElapsedTime();

      // Animate 3D lake waves
      for (let i = 0; i < posAttr.count; i++) {
        const vx = basePositions[i * 3];
        const vz = basePositions[i * 3 + 2];
        const waveY =
          Math.sin(vx * 0.35 + elapsed * 2.4) * 0.16 +
          Math.cos(vz * 0.45 + elapsed * 1.9) * 0.14;
        posAttr.setY(i, waveY);
      }
      posAttr.needsUpdate = true;

      // Bob lily pads on waves
      lilyGroups.forEach((g, idx) => {
        g.position.y = 0.08 + Math.sin(elapsed * 2.2 + idx) * 0.08;
      });

      // Sync 3D Crocodile in the lake
      const cs = crocRef.current;
      const scrollEl = scrollLakeRef.current;
      const scrollLeft = scrollEl ? scrollEl.scrollLeft : 0;
      const viewW = scrollEl ? Math.max(300, scrollEl.clientWidth) : 500;
      const visibleXRatio = clampVal((cs.xPx - scrollLeft) / viewW, 0, 1);

      const worldX = (visibleXRatio - 0.5) * 24;
      const worldZ = ((cs.yPercent - 50) / 40) * 9;
      croc3DGroup.position.set(worldX, Math.sin(elapsed * 4) * 0.08, worldZ);
      croc3DGroup.rotation.y = -cs.headingRad;
      tail3D.rotation.y = Math.sin(cs.swimPhase) * 0.32;

      renderer.render(scene, camera);
      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    tick();

    const handleResize = () => {
      if (!container) return;
      const w = Math.max(300, container.clientWidth);
      const h = Math.max(180, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      renderer.dispose();
    };
  }, []);

  // Helper to get pixel coordinates of a student mat inside the scrollable lake content
  const getStudentMatCoords = (idx: number): { xPx: number; yPercent: number } => {
    const el = matDomRefs.current[idx];
    const scrollEl = scrollLakeRef.current;
    if (el && scrollEl) {
      const xPx = el.offsetLeft + el.offsetWidth * 0.5;
      const yPercent = clampVal(
        ((el.offsetTop + el.offsetHeight * 0.55) / Math.max(180, scrollEl.clientHeight)) * 100,
        24,
        78
      );
      return { xPx, yPercent };
    }
    const col = Math.floor(idx / 2);
    const row = idx % 2;
    return {
      xPx: 95 + col * 172,
      yPercent: row === 0 ? 34 : 68,
    };
  };

  // Continuous 60 FPS Simulation:
  // - Fast Crocodile swimming
  // - Horizontal scrollbar continuously tracking the Crocodile wherever it swims
  // - Locking onto the caught student so their character and full name are clearly displayed on screen
  useEffect(() => {
    let animId = 0;
    let lastTime = performance.now();
    let uiSyncAccum = 0;

    const stepLakeSimulation = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.004, (now - lastTime) / 1000));
      lastTime = now;
      uiSyncAccum += dt;

      const chasing = chaseDataRef.current.active;
      const lockedIdx = lockedCaughtIdxRef.current;

      const normalizeKey = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

      // 1. Update Students on their Small Mats (only uncalled students dip their legs into the water)
      const nextMats = studentMatsRef.current.map((st, idx) => {
        const alreadyCalled =
          (studentCallCountsRef.current[normalizeKey(st.name)] || 0) >= 1 &&
          lockedIdx !== idx &&
          !(chasing && idx === chaseDataRef.current.chosenIdx);

        if (alreadyCalled) {
          return {
            ...st,
            isDippingLegs: false,
            dipTimerSec: 2.0,
          };
        }

        let timer = st.dipTimerSec - dt;
        let isDipping = st.isDippingLegs;

        if (timer <= 0) {
          isDipping = Math.random() < (chasing ? 0.8 : 0.65);
          timer = (chasing ? 0.55 : 1.35) + Math.random() * (chasing ? 0.8 : 2.1);
        }

        // Ensure the target student during the final lunge or when caught has their legs dipped in the water!
        if (
          (chasing && idx === chaseDataRef.current.chosenIdx && chaseDataRef.current.elapsedSec > 1.35) ||
          (!chasing && lockedIdx === idx)
        ) {
          isDipping = true;
        }

        const kickSpeed = chasing ? 9.5 : 5.5;
        const nextKickPhase = (st.legKickPhase + dt * kickSpeed) % (Math.PI * 200);

        return {
          ...st,
          isDippingLegs: isDipping,
          legKickPhase: nextKickPhase,
          dipTimerSec: timer,
        };
      });

      studentMatsRef.current = nextMats;

      // 2. Update Swimming Crocodile ("Nhanh vừa" — Moderately Fast & Smooth)
      const prevCroc = crocRef.current;
      const scrollEl = scrollLakeRef.current;
      const maxContentW = scrollEl ? Math.max(460, scrollEl.scrollWidth - 70) : 600;

      let targetXPx = prevCroc.targetXPx;
      let targetYPercent = prevCroc.targetYPercent;
      let swimSpeedPxPerSec = 135;
      let isSnapping = false;

      if (chasing && nextMats.length > 0) {
        chaseDataRef.current.elapsedSec += dt;
        const el = chaseDataRef.current.elapsedSec;
        const dur = chaseDataRef.current.durationSec;

        // Play realistic water swimming splash sound periodically while hunting
        if (el - chaseDataRef.current.lastSplashSec > 0.36) {
          chaseDataRef.current.lastSplashSec = el;
          sound.playCrocodileSwimSplash();
        }

        if (el < dur * 0.62) {
          if (Math.floor(el * 1.8) !== Math.floor((el - dt) * 1.8)) {
            const uncalledPool = nextMats
              .map((s, i) => ({ s, i }))
              .filter(({ s }) => (studentCallCountsRef.current[normalizeKey(s.name)] || 0) === 0);
            const dippingUncalled = uncalledPool.filter(({ s }) => s.isDippingLegs);
            if (dippingUncalled.length > 0) {
              chaseDataRef.current.decoyIdx =
                dippingUncalled[Math.floor(Math.random() * dippingUncalled.length)].i;
            } else if (uncalledPool.length > 0) {
              chaseDataRef.current.decoyIdx =
                uncalledPool[Math.floor(Math.random() * uncalledPool.length)].i;
            } else {
              chaseDataRef.current.decoyIdx = chaseDataRef.current.chosenIdx;
            }
          }
          const decoyCoords = getStudentMatCoords(chaseDataRef.current.decoyIdx);
          targetXPx = decoyCoords.xPx;
          targetYPercent = decoyCoords.yPercent;
          const distToDecoy = Math.hypot(
            targetXPx - prevCroc.xPx,
            (targetYPercent - prevCroc.yPercent) * 2.1
          );
          swimSpeedPxPerSec = Math.min(460, Math.max(240, distToDecoy * 2.6));
        } else {
          // Moderately fast final lunge toward the chosen student dipping their legs in the water
          const chosenCoords = getStudentMatCoords(chaseDataRef.current.chosenIdx);
          targetXPx = chosenCoords.xPx;
          targetYPercent = chosenCoords.yPercent + 5;
          const distToChosen = Math.hypot(
            targetXPx - prevCroc.xPx,
            (targetYPercent - prevCroc.yPercent) * 2.1
          );
          swimSpeedPxPerSec = Math.min(590, Math.max(320, distToChosen * 3.4));
          isSnapping = true;
        }

        if (el >= dur) {
          chaseDataRef.current.active = false;
          isChasingRef.current = false;
          setIsChasing(false);

          const chosenIdx = chaseDataRef.current.chosenIdx;
          const finalChosen = nextMats[chosenIdx] || nextMats[0];
          const finalCoords = getStudentMatCoords(chosenIdx);

          lockedCaughtIdxRef.current = chosenIdx;

          nextMats[chosenIdx] = {
            ...finalChosen,
            isDippingLegs: true,
          };
          studentMatsRef.current = nextMats;

          const caughtCroc: CrocodileSwimState = {
            xPx: finalCoords.xPx,
            yPercent: finalCoords.yPercent + 6,
            headingRad: prevCroc.headingRad,
            targetXPx: finalCoords.xPx,
            targetYPercent: finalCoords.yPercent + 6,
            swimPhase: prevCroc.swimPhase,
            isSnapping: true,
          };
          crocRef.current = caughtCroc;
          setCrocState(caughtCroc);
          setStudentMats([...nextMats]);
          setCaughtStudentName(finalChosen.name);

          // Immediately center the horizontal scrollbar on the caught student so their character and full name are 100% clear
          if (scrollEl) {
            const maxScroll = Math.max(0, scrollEl.scrollWidth - scrollEl.clientWidth);
            scrollEl.scrollLeft = clampVal(
              finalCoords.xPx - scrollEl.clientWidth * 0.5,
              0,
              maxScroll
            );
          }

          sound.playCrocodileSnap();
          window.setTimeout(() => {
            sound.speakStudentCall(finalChosen.name);
          }, 220);
          onSelectStudentRef.current(finalChosen.name, finalChosen.racerIdx);
          animId = requestAnimationFrame(stepLakeSimulation);
          return;
        }
      } else if (lockedIdx !== null && nextMats[lockedIdx]) {
        // Hold position at the caught student's floating mat so the horizontal scrollbar and camera keep them clearly spotlighted
        const caughtCoords = getStudentMatCoords(lockedIdx);
        const holdCroc: CrocodileSwimState = {
          xPx: caughtCoords.xPx,
          yPercent: caughtCoords.yPercent + 6,
          headingRad: prevCroc.headingRad,
          targetXPx: caughtCoords.xPx,
          targetYPercent: caughtCoords.yPercent + 6,
          swimPhase: (prevCroc.swimPhase + dt * 4.5) % (Math.PI * 200),
          isSnapping: true,
        };
        crocRef.current = holdCroc;

        if (scrollEl && now > manualScrollPauseUntilRef.current) {
          const maxScroll = Math.max(0, scrollEl.scrollWidth - scrollEl.clientWidth);
          const desiredScrollLeft = clampVal(
            caughtCoords.xPx - scrollEl.clientWidth * 0.5,
            0,
            maxScroll
          );
          scrollEl.scrollLeft +=
            (desiredScrollLeft - scrollEl.scrollLeft) * Math.min(1, dt * 10);
        }

        if (uiSyncAccum >= 0.033) {
          uiSyncAccum = 0;
          setStudentMats([...nextMats]);
          setCrocState(holdCroc);
        }

        animId = requestAnimationFrame(stepLakeSimulation);
        return;
      } else {
        // Moderately fast ("nhanh vừa") natural swimming along the 3D lake channels
        const distToWp = Math.hypot(
          targetXPx - prevCroc.xPx,
          (targetYPercent - prevCroc.yPercent) * 2.2
        );
        if (distToWp < 38) {
          targetXPx = 75 + Math.random() * Math.max(240, maxContentW - 140);
          targetYPercent = 28 + Math.random() * 44;
        }
        swimSpeedPxPerSec = 135;
      }

      const dx = targetXPx - prevCroc.xPx;
      const dyPx = (targetYPercent - prevCroc.yPercent) * 2.1;
      const desiredHeading = Math.atan2(dyPx, dx);
      const angleDiff = normalizeAngleRad(desiredHeading - prevCroc.headingRad);
      const maxTurnRate = chasing ? 12.5 : 6.5;
      const turnDelta = clampVal(angleDiff, -maxTurnRate * dt, maxTurnRate * dt);
      const nextHeading = normalizeAngleRad(prevCroc.headingRad + turnDelta);

      const alignFactor = Math.max(
        chasing ? 0.8 : 0.65,
        Math.cos(Math.min(Math.PI * 0.45, Math.abs(angleDiff)))
      );
      const actualSpeed = swimSpeedPxPerSec * alignFactor;

      const nxPx = clampVal(
        prevCroc.xPx + Math.cos(nextHeading) * actualSpeed * dt,
        55,
        Math.max(300, maxContentW)
      );
      const nyPercent = clampVal(
        prevCroc.yPercent + (Math.sin(nextHeading) * actualSpeed * dt) / 2.1,
        24,
        78
      );

      // Continuously drag/follow the horizontal scrollbar wherever the Crocodile moves!
      if (scrollEl) {
        const maxScroll = Math.max(0, scrollEl.scrollWidth - scrollEl.clientWidth);
        const desiredScrollLeft = clampVal(
          nxPx - scrollEl.clientWidth * 0.5,
          0,
          maxScroll
        );
        if (chasing) {
          scrollEl.scrollLeft +=
            (desiredScrollLeft - scrollEl.scrollLeft) * Math.min(1, dt * 9.5);
        } else if (now > manualScrollPauseUntilRef.current) {
          scrollEl.scrollLeft +=
            (desiredScrollLeft - scrollEl.scrollLeft) * Math.min(1, dt * 6.5);
        }
      }

      const nextSwimPhase =
        (prevCroc.swimPhase + dt * (chasing ? 14.0 : 8.5)) % (Math.PI * 200);

      const nextCroc: CrocodileSwimState = {
        xPx: nxPx,
        yPercent: nyPercent,
        headingRad: nextHeading,
        targetXPx,
        targetYPercent,
        swimPhase: nextSwimPhase,
        isSnapping,
      };
      crocRef.current = nextCroc;

      if (uiSyncAccum >= 0.033) {
        uiSyncAccum = 0;
        setStudentMats([...nextMats]);
        setCrocState(nextCroc);
      }

      animId = requestAnimationFrame(stepLakeSimulation);
    };

    animId = requestAnimationFrame(stepLakeSimulation);
    return () => {
      cancelAnimationFrame(animId);
    };
  }, []);

  const normalizeStudentKey = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

  const startCrocodileCatch = () => {
    if (isChasingRef.current || studentMatsRef.current.length === 0) return;

    const currentPool = studentMatsRef.current;
    // Mỗi học sinh chỉ được gọi DUY NHẤT 1 LẦN trong một cuộc chơi (callCount === 0)
    const uncalledCandidates = currentPool
      .map((m, idx) => ({ m, idx }))
      .filter(({ m }) => (studentCallCountsRef.current[normalizeStudentKey(m.name)] || 0) === 0);

    if (uncalledCandidates.length === 0) {
      // Nếu đang ở chế độ Nhóm (Team Mode), kiểm tra xem có đội nào khác còn học sinh chưa được gọi không
      if (gameMode === 'team') {
        const nextTeamWithUncalledIdx = racers.findIndex((r, rIdx) => {
          if (rIdx === currentRacerIndex) return false;
          const teamMembers =
            r.memberNames && r.memberNames.length > 0
              ? r.memberNames
              : students.filter((s) => s.teamId === r.id).map((s) => s.name);
          return teamMembers.some(
            (name) => (studentCallCountsRef.current[normalizeStudentKey(name)] || 0) === 0
          );
        });

        if (nextTeamWithUncalledIdx !== -1) {
          onSelectTeamFilter(nextTeamWithUncalledIdx);
          setCallNotice(
            `Đội hiện tại đã gọi hết học sinh. Đã chuyển sang ${racers[nextTeamWithUncalledIdx].name} — bấm "🐊 CROCODILE CATCH!" để gọi tiếp!`
          );
          window.setTimeout(() => setCallNotice(null), 3500);
          return;
        }
      }

      setCallNotice('🎉 Tất cả học sinh đều đã được gọi đủ 1 lần trong cuộc chơi này!');
      window.setTimeout(() => setCallNotice(null), 4000);
      return;
    }

    setCallNotice(null);
    sound.playCrocodileSwimSplash();
    lockedCaughtIdxRef.current = null;
    manualScrollPauseUntilRef.current = 0;
    isChasingRef.current = true;
    setIsChasing(true);
    setCaughtStudentName(null);

    const pickedEntry =
      uncalledCandidates[Math.floor(Math.random() * uncalledCandidates.length)];
    const initialDecoyEntry =
      uncalledCandidates[Math.floor(Math.random() * uncalledCandidates.length)];

    chaseDataRef.current = {
      active: true,
      chosenIdx: pickedEntry.idx,
      decoyIdx: initialDecoyEntry.idx,
      elapsedSec: 0,
      durationSec: 2.75,
      lastSplashSec: 0,
    };
  };

  const scrollLakeBy = (deltaPx: number) => {
    manualScrollPauseUntilRef.current = performance.now() + 2800;
    if (scrollLakeRef.current) {
      scrollLakeRef.current.scrollBy({ left: deltaPx, behavior: 'smooth' });
    }
  };

  const activeCaughtName = caughtStudentName || selectedStudentName;
  const activeCaughtStudentEntity = activeCaughtName
    ? studentMats.find((m) => m.name === activeCaughtName) || null
    : null;

  const uncalledRemainingCount = studentMats.filter(
    (m) => (studentCallCounts[normalizeStudentKey(m.name)] || 0) === 0
  ).length;
  const allStudentsCalledInPool =
    studentMats.length > 0 && uncalledRemainingCount === 0;

  return (
    <div className="w-full h-full flex flex-col bg-sky-950 rounded-2xl border-2 border-cyan-400/70 shadow-2xl overflow-hidden relative">
      {/* Notice Toast when a student was already called or all students have been called */}
      {callNotice && (
        <div className="absolute top-11 left-1/2 -translate-x-1/2 z-50 px-3.5 py-1.5 rounded-xl bg-amber-400 text-slate-950 font-black text-[11px] sm:text-xs shadow-2xl border-2 border-white whitespace-nowrap animate-in fade-in zoom-in-95">
          {callNotice}
        </div>
      )}

      {/* Top 3D Lake Control Bar */}
      <div className="px-3 py-1.5 bg-slate-950/95 border-b border-cyan-400/30 flex flex-wrap items-center justify-between gap-1.5 shrink-0 z-30">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-cyan-400/20 border border-cyan-400/50 flex items-center justify-center text-cyan-300 shrink-0">
            <Waves className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-cyan-300 flex items-center gap-1.5 truncate">
              <span>CROCODILE ASHORE • 3D LAKE</span>
              <span
                className="text-[10px] bg-emerald-500/20 text-emerald-200 px-1.5 py-0.5 rounded-md border border-emerald-400/30 shrink-0"
                title="Each student can only be called once per game session"
              >
                🐊 Uncalled: {uncalledRemainingCount}/{studentMats.length}
              </span>
            </h3>
          </div>
        </div>

        {/* Team selector in Team Mode */}
        {gameMode === 'team' && (
          <div className="flex items-center gap-1 flex-wrap">
            {racers.map((racer, idx) => (
              <button
                key={racer.id}
                onClick={() => onSelectTeamFilter(idx)}
                disabled={isChasing}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-black transition-all flex items-center gap-1 border cursor-pointer ${
                  idx === currentRacerIndex
                    ? 'bg-amber-400 text-slate-950 border-amber-200 shadow'
                    : 'bg-slate-800 text-slate-300 border-white/10 hover:bg-slate-700'
                }`}
              >
                <span>{racer.avatar}</span>
                <span className="truncate max-w-[70px]">{racer.name}</span>
              </button>
            ))}
          </div>
        )}

        {/* Quick Scroll + Crocodile Catch Button */}
        <div className="flex items-center gap-1 shrink-0">
          {studentMats.length > 6 && (
            <div className="flex items-center gap-1 mr-1">
              <button
                type="button"
                onClick={() => scrollLakeBy(-280)}
                title="Scroll Lake Left"
                className="w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 border border-cyan-400/40 text-cyan-200 flex items-center justify-center cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => scrollLakeBy(280)}
                title="Scroll Lake Right"
                className="w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 border border-cyan-400/40 text-cyan-200 flex items-center justify-center cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <button
            onClick={startCrocodileCatch}
            disabled={isChasing || (allStudentsCalledInPool && gameMode !== 'team')}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-400 via-lime-400 to-amber-400 hover:from-emerald-300 hover:to-amber-300 disabled:opacity-50 text-slate-950 font-black text-xs shadow-lg flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shrink-0"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>
              {isChasing
                ? '🐊 CROCODILE SWIMMING...'
                : allStudentsCalledInPool && gameMode !== 'team'
                ? '✓ ALL CALLED (1/1)'
                : '🐊 CROCODILE CATCH!'}
            </span>
          </button>
        </div>
      </div>

      {/* 3D WebGL Lake Viewport + Scrollable Floating Student Mats & Swimming Crocodile */}
      <div className="flex-1 relative overflow-hidden select-none bg-sky-900">
        {/* Three.js 3D Lake Canvas */}
        <div ref={canvasMountRef} className="absolute inset-0 w-full h-full pointer-events-none" />

        {/* Scrollable Lake Surface holding all Student Small Mats & the Swimming Crocodile */}
        <div
          ref={scrollLakeRef}
          onWheel={() => {
            if (!isChasingRef.current) {
              manualScrollPauseUntilRef.current = performance.now() + 2500;
            }
          }}
          onPointerDown={() => {
            if (!isChasingRef.current) {
              manualScrollPauseUntilRef.current = performance.now() + 2500;
            }
          }}
          className="relative w-full h-full overflow-x-auto overflow-y-hidden z-20 px-6 py-2"
        >
          <div className="relative h-full min-w-full w-max flex items-center">
            {/* Two-Row Floating Mat Layout with wide spacing so every student's character & full name are 100% clear */}
            <div className="grid grid-rows-2 grid-flow-col auto-cols-max gap-x-6 gap-y-2 items-center my-auto pr-12">
              {studentMats.map((student, idx) => {
                const isCaught = activeCaughtName === student.name;
                const isAlreadyCalled =
                  (studentCallCounts[normalizeStudentKey(student.name)] || 0) >= 1;
                return (
                  <div
                    key={`${student.name}-${idx}`}
                    ref={(el) => {
                      matDomRefs.current[idx] = el;
                    }}
                    className="shrink-0 min-w-[154px] sm:min-w-[168px] px-1 flex items-center justify-center"
                  >
                    <StudentOnMatCard
                      student={student}
                      isCaught={isCaught}
                      isAlreadyCalled={isAlreadyCalled}
                      onClick={() => {
                        if (isChasing) return;
                        if (isAlreadyCalled) {
                          setCallNotice(
                            `Bạn ${student.name} đã được gọi 1 lần trong cuộc chơi này (mỗi học sinh chỉ gọi 1 lần)!`
                          );
                          window.setTimeout(() => setCallNotice(null), 3200);
                          return;
                        }
                        const coords = getStudentMatCoords(idx);
                        lockedCaughtIdxRef.current = idx;
                        manualScrollPauseUntilRef.current = 0;
                        const nextCroc: CrocodileSwimState = {
                          ...crocRef.current,
                          xPx: coords.xPx,
                          yPercent: coords.yPercent + 6,
                          targetXPx: coords.xPx,
                          targetYPercent: coords.yPercent + 6,
                          isSnapping: true,
                        };
                        crocRef.current = nextCroc;
                        setCrocState(nextCroc);
                        setCaughtStudentName(student.name);
                        if (scrollLakeRef.current) {
                          const maxScroll = Math.max(
                            0,
                            scrollLakeRef.current.scrollWidth - scrollLakeRef.current.clientWidth
                          );
                          scrollLakeRef.current.scrollLeft = clampVal(
                            coords.xPx - scrollLakeRef.current.clientWidth * 0.5,
                            0,
                            maxScroll
                          );
                        }
                        sound.playCrocodileSnap();
                        window.setTimeout(() => {
                          sound.speakStudentCall(student.name);
                        }, 220);
                        onSelectStudent(student.name, student.racerIdx);
                      }}
                    />
                  </div>
                );
              })}
            </div>

            {/* The Lifelike Swimming Crocodile patrolling the 3D Lake */}
            <div
              style={{
                left: `${crocState.xPx}px`,
                top: `${crocState.yPercent}%`,
                zIndex: 45,
              }}
              className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none flex flex-col items-center"
            >
              <LifelikeSwimmingCrocodile
                headingRad={crocState.headingRad}
                swimPhase={crocState.swimPhase}
                isSnapping={crocState.isSnapping || isChasing}
              />
              <span className="-mt-1 px-2 py-0.5 rounded-md bg-emerald-500 text-slate-950 border border-white text-[8px] font-black uppercase tracking-wider shadow-lg whitespace-nowrap">
                {isChasing
                  ? '🐊 CÁ SẤU ĐANG SĂN MỒI TỐC ĐỘ CAO...'
                  : activeCaughtName
                  ? `🐊 ĐÃ BẮT ĐƯỢC: ${activeCaughtName}`
                  : '🐊 CÁ SẤU ĐANG BƠI'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Caught Student Spotlight Bar — Clearly displays the caught student's character & full name */}
      <div className="px-3 py-1.5 bg-slate-950 border-t border-cyan-400/30 flex items-center justify-between gap-2 shrink-0 z-30">
        <div className="flex items-center gap-2 min-w-0">
          {activeCaughtName ? (
            <div className="flex items-center gap-2 bg-gradient-to-r from-amber-400/25 via-emerald-500/20 to-cyan-500/20 border-2 border-amber-400 rounded-xl px-2.5 py-1 shadow-[0_0_15px_rgba(250,204,21,0.35)] min-w-0">
              {/* Mini Character Illustration of the Caught Student */}
              <svg viewBox="0 0 44 40" className="w-7 h-7 shrink-0 overflow-visible">
                <ellipse
                  cx="22"
                  cy="34"
                  rx="18"
                  ry="5"
                  fill={activeCaughtStudentEntity?.matColor || '#f59e0b'}
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />
                <path
                  d="M 14 21 C 14 16, 30 16, 30 21 L 31 32 L 13 32 Z"
                  fill={activeCaughtStudentEntity?.shirtColor || '#ef4444'}
                  stroke="#ffffff"
                  strokeWidth="1"
                />
                <circle cx="22" cy="10" r="7" fill="#fde68a" stroke="#78350f" strokeWidth="1" />
                <path d="M 15 9 C 16 3, 28 3, 29 9 Z" fill="#1e293b" />
                <circle cx="19.5" cy="10" r="1" fill="#0f172a" />
                <circle cx="24.5" cy="10" r="1" fill="#0f172a" />
              </svg>

              <div className="min-w-0">
                <div className="text-[9px] font-extrabold uppercase tracking-wider text-amber-300 leading-none">
                  🐊 HỌC SINH BỊ CÁ SẤU BẮT TRẢ LỜI:
                </div>
                <div className="text-xs sm:text-sm font-black text-white leading-tight break-words">
                  {activeCaughtName}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 min-w-0">
              <UserCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="text-[11px] italic text-cyan-200/90 truncate">
                Click &ldquo;🐊 CROCODILE CATCH!&rdquo; — Crocodile swims fast &amp; auto-scrolls to catch a student!
              </span>
            </div>
          )}
        </div>

        {activeCaughtName && (
          <button
            onClick={() => sound.speakStudentCall(activeCaughtName)}
            className="px-2.5 py-1 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-[11px] font-black text-white flex items-center gap-1 transition-all cursor-pointer shrink-0 border border-indigo-400/50 shadow"
            title="Speak student full name loudly in Vietnamese"
          >
            <Volume2 className="w-3.5 h-3.5 text-amber-300" />
            <span>Đọc tên</span>
          </button>
        )}
      </div>
    </div>
  );
};
