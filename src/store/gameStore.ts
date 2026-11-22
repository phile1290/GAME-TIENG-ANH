import { create } from 'zustand';
import {
  ClassRoom,
  GameMode,
  LeaderboardEntry,
  Question,
  QuizSet,
  Racer,
  RaceSetupConfig,
  SessionStudentRecord,
  Student,
  Team,
  TeamLeaderboardEntry,
  WeeklyScoreRecord,
} from '../types';
import { INITIAL_CLASS, INITIAL_STUDENTS } from '../services/mockData';
import {
  clearPersistentStatsForClass,
  findGradeGroupForClass,
  getActiveClassId,
  getLastSessionSnapshot,
  getPersistentStats,
  getSavedClassesFromLocalStorage,
  getUniqueSavedQuizzesForGrade,
  normalizeEntityKey,
  recordTurnResultToStorage,
  sanitizeStoredQuestions,
  saveClassData,
  saveLastSessionSnapshot,
  saveQuizForLessonAndClass,
} from '../services/classroomStorageService';
import { sound } from '../services/soundService';
import confetti from 'canvas-confetti';

const CLIMBER_PALETTE = [
  '#ef4444',
  '#3b82f6',
  '#eab308',
  '#10b981',
  '#8b5cf6',
  '#ec4899',
  '#f97316',
  '#06b6d4',
  '#14b8a6',
  '#84cc16',
  '#6366f1',
  '#f43f5e',
  '#d946ef',
  '#0284c7',
  '#15803d',
  '#ca8a04',
  '#4f46e5',
  '#059669',
  '#e11d48',
  '#7c3aed',
];

const WILD_ANIMAL_AVATARS = [
  { avatar: '🦁', animalName: 'Sư Tử Chúa' },
  { avatar: '🐯', animalName: 'Hổ Vằn Rừng Xanh' },
  { avatar: '🐆', animalName: 'Báo Đốm Thần Tốc' },
  { avatar: '🐻', animalName: 'Gấu Nâu Cổ Thụ' },
  { avatar: '🐺', animalName: 'Sói Đầu Đàn' },
  { avatar: '🐒', animalName: 'Khỉ Vàng Leo Núi' },
  { avatar: '🦊', animalName: 'Cáo Đỏ Tinh Anh' },
  { avatar: '🐼', animalName: 'Gấu Trúc Khổng Lồ' },
  { avatar: '🦅', animalName: 'Đại Bàng Núi Cao' },
  { avatar: '🐘', animalName: 'Voi Rừng Dũng Mãnh' },
  { avatar: '🦌', animalName: 'Hươu Sao Nhanh Nhẹn' },
  { avatar: '🐊', animalName: 'Cá Sấu Đầm Lầy' },
];

function shuffleStudentArrayRandomly<T>(items: T[]): T[] {
  const arr = [...items];
  if (arr.length <= 1) return arr;
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

export function compareRacersByResult(a: Racer, b: Racer): number {
  if (b.score !== a.score) return b.score - a.score;

  const aCorrect = a.correctCount ?? 0;
  const bCorrect = b.correctCount ?? 0;
  if (bCorrect !== aCorrect) return bCorrect - aCorrect;

  const aHook = a.hookLevel ?? Math.round((a.progress || 0) / 10);
  const bHook = b.hookLevel ?? Math.round((b.progress || 0) / 10);
  if (bHook !== aHook) return bHook - aHook;

  const aTurns = aCorrect + (a.wrongCount ?? 0);
  const bTurns = bCorrect + (b.wrongCount ?? 0);
  if (aTurns > 0 && bTurns > 0) {
    const aTime = a.totalTimeSec ?? 999999;
    const bTime = b.totalTimeSec ?? 999999;
    if (aTime !== bTime) return aTime - bTime;
  } else if (aTurns > 0 && bTurns === 0) {
    return -1;
  } else if (bTurns > 0 && aTurns === 0) {
    return 1;
  }

  return 0;
}

export function compareSessionStudentsByResult(
  a: SessionStudentRecord,
  b: SessionStudentRecord
): number {
  const aHooks = a.hooksClimbed ?? 0;
  const bHooks = b.hooksClimbed ?? 0;
  if (bHooks !== aHooks) return bHooks - aHooks;
  if (b.score !== a.score) return b.score - a.score;
  if (b.correctCount !== a.correctCount) return b.correctCount - a.correctCount;
  const aTurns = a.correctCount + a.wrongCount;
  const bTurns = b.correctCount + b.wrongCount;
  if (aTurns > 0 && bTurns > 0) {
    if (a.totalTimeSec !== b.totalTimeSec) return a.totalTimeSec - b.totalTimeSec;
  } else if (aTurns > 0 && bTurns === 0) {
    return -1;
  } else if (bTurns > 0 && aTurns === 0) {
    return 1;
  }
  return 0;
}

interface GameStoreState {
  viewMode: 'classroom' | 'dashboard';
  currentClass: ClassRoom;
  students: Student[];
  selectedWeek: number;
  quizzes: QuizSet[];
  currentQuiz: QuizSet | null;
  activeQuestionIndex: number;
  currentQuestion: Question | null;

  gameMode: GameMode;
  racers: Racer[];
  currentRacerIndex: number;
  selectedStudentName: string | null;
  studentCallCounts: Record<string, number>;
  sessionStudentRecords: Record<string, SessionStudentRecord>;
  isSetupOpen: boolean;

  gameState: 'idle' | 'question' | 'feedback' | 'finished';
  lastFeedback: {
    isCorrect: boolean;
    racerName: string;
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
  } | null;

  winnerRacer: Racer | null;
  isMuted: boolean;
  isSettingsOpen: boolean;

  setViewMode: (mode: 'classroom' | 'dashboard') => void;
  setSelectedWeek: (week: number) => void;
  setCurrentQuiz: (quiz: QuizSet) => void;
  openSetup: () => void;
  closeSetup: () => void;
  openSettings: () => void;
  closeSettings: () => void;

  selectStudentToAnswer: (studentName: string, racerIndex?: number) => void;
  setCurrentRacerIndex: (racerIndex: number) => void;

  setupRace: (config: RaceSetupConfig, generatedQuestions: Question[]) => void;
  startRace: () => void;
  resetRace: () => void;
  openNextQuestion: () => void;
  answerQuestion: (optionIndex: number, elapsedSeconds?: number) => void;
  closeFeedback: () => void;
  toggleSound: () => boolean;

  addStudent: (
    student: Omit<
      Student,
      'id' | 'cumulativeScore' | 'totalCorrect' | 'totalWrong' | 'highestCombo' | 'weeklyScores'
    >
  ) => void;
  importStudentsCsv: (csvContent: string) => number;
  exportStudentsCsv: () => string;
  updateTeamAssignment: (studentId: string, teamId: string) => void;
  addGeneratedQuiz: (quiz: QuizSet) => void;
  hydrateFromPersistentStorage: () => void;

  resetClassStatistics: (targetClassId?: string) => void;
  getLeaderboard: (
    weekNumber?: number,
    startWeek?: number,
    endWeek?: number,
    targetClassId?: string
  ) => LeaderboardEntry[];
  getTeamLeaderboard: (
    weekNumber?: number,
    startWeek?: number,
    endWeek?: number,
    targetClassId?: string
  ) => TeamLeaderboardEntry[];
}

function createInitialRacers(teams: Team[], students: Student[]): Racer[] {
  return teams.map((team, idx) => {
    const wild = WILD_ANIMAL_AVATARS[idx % WILD_ANIMAL_AVATARS.length];
    const teamMembers = students.filter((s) => s.teamId === team.id).map((s) => s.name);
    return {
      id: team.id,
      name: team.name,
      subInfo: `${teamMembers.length} bạn`,
      colorHex: team.carHex,
      carNumber: idx + 1,
      progress: 0,
      hookLevel: 0,
      score: 0,
      correctCount: 0,
      wrongCount: 0,
      totalTimeSec: 0,
      callCount: 0,
      combo: 0,
      isNitro: false,
      avatar: wild.avatar,
      animalName: wild.animalName,
      memberNames: teamMembers,
      weeklyScores: team.weeklyScores || {},
      lane: idx,
    };
  });
}

export const useGameStore = create<GameStoreState>((set, get) => ({
  viewMode: 'classroom',
  currentClass: INITIAL_CLASS,
  students: INITIAL_STUDENTS,
  selectedWeek: 1,
  quizzes: [],
  currentQuiz: null,
  activeQuestionIndex: 0,
  currentQuestion: null,

  gameMode: 'team',
  racers: createInitialRacers(INITIAL_CLASS.teams, INITIAL_STUDENTS),
  currentRacerIndex: 0,
  selectedStudentName: INITIAL_STUDENTS[0]?.name || null,
  studentCallCounts: {},
  sessionStudentRecords: {},
  isSetupOpen: true,

  gameState: 'idle',
  lastFeedback: null,
  winnerRacer: null,
  isMuted: false,
  isSettingsOpen: false,

  setViewMode: (mode) => set({ viewMode: mode }),
  openSetup: () => set({ isSetupOpen: true }),
  closeSetup: () => set({ isSetupOpen: false }),
  openSettings: () => set({ isSettingsOpen: true }),
  closeSettings: () => set({ isSettingsOpen: false }),

  selectStudentToAnswer: (studentName, racerIndex) => {
    set((state) => {
      const normKey = normalizeEntityKey(studentName);
      const nextCalls = {
        ...state.studentCallCounts,
        [normKey]: (state.studentCallCounts[normKey] || 0) + 1,
      };
      return {
        selectedStudentName: studentName,
        currentRacerIndex: typeof racerIndex === 'number' ? racerIndex : state.currentRacerIndex,
        studentCallCounts: nextCalls,
      };
    });
  },

  setCurrentRacerIndex: (racerIndex) => {
    set({
      currentRacerIndex: racerIndex,
      selectedStudentName: null,
    });
  },

  setSelectedWeek: (week) => {
    const { quizzes } = get();
    const foundQuiz = quizzes.find((q) => q.weekNumber === week) || quizzes[0];
    set({
      selectedWeek: week,
      currentQuiz: foundQuiz ? { ...foundQuiz, lessonTitle: foundQuiz.lessonTitle.toUpperCase() } : null,
      activeQuestionIndex: 0,
      currentQuestion: foundQuiz?.questions[0] || null,
    });
  },

  setCurrentQuiz: (quiz) => {
    const cleanedQuestions = sanitizeStoredQuestions(quiz.questions);
    const cleanedQuiz: QuizSet = {
      ...quiz,
      lessonTitle: quiz.lessonTitle.toUpperCase(),
      questions: cleanedQuestions,
    };
    set({
      currentQuiz: cleanedQuiz,
      selectedWeek: quiz.weekNumber,
      activeQuestionIndex: 0,
      currentQuestion: cleanedQuestions[0] || null,
      gameState: 'idle',
    });
  },

  setupRace: (config, questions) => {
    const { currentClass, students, quizzes } = get();
    sound.playEngineRev();

    let newRacers: Racer[] = [];

    if (config.gameMode === 'individual') {
      const studentList = config.studentsText
        .split('\n')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      const rawList = shuffleStudentArrayRandomly(
        studentList.length > 0 ? studentList : students.map((s) => s.name)
      );

      newRacers = rawList.map((name, idx) => {
        const wild = WILD_ANIMAL_AVATARS[idx % WILD_ANIMAL_AVATARS.length];
        return {
          id: `indiv-${idx}`,
          name: name,
          subInfo: `Dây #${idx + 1}`,
          colorHex: CLIMBER_PALETTE[idx % CLIMBER_PALETTE.length],
          carNumber: idx + 1,
          progress: 0,
          hookLevel: 0,
          score: 0,
          correctCount: 0,
          wrongCount: 0,
          totalTimeSec: 0,
          callCount: 0,
          combo: 0,
          isNitro: false,
          avatar: wild.avatar,
          animalName: wild.animalName,
          memberNames: [name],
          weeklyScores: {},
          lane: idx,
        };
      });
    } else {
      newRacers = config.teamsConfig.map((t, idx) => {
        const wild = WILD_ANIMAL_AVATARS[idx % WILD_ANIMAL_AVATARS.length];
        return {
          id: t.teamId,
          name: t.teamName,
          subInfo: `${t.studentNames.length} học sinh`,
          colorHex: CLIMBER_PALETTE[idx % CLIMBER_PALETTE.length],
          carNumber: idx + 1,
          progress: 0,
          hookLevel: 0,
          score: 0,
          correctCount: 0,
          wrongCount: 0,
          totalTimeSec: 0,
          callCount: 0,
          combo: 0,
          isNitro: false,
          avatar: wild.avatar,
          animalName: wild.animalName,
          memberNames: t.studentNames,
          weeklyScores: {},
          lane: idx,
        };
      });
    }

    const upperLessonTitle = (config.lessonTitle || 'UNIT 1: HELLO').trim().toUpperCase();
    const cleanedQuestions = sanitizeStoredQuestions(
      questions.length > 0 ? questions : get().currentQuiz?.questions || []
    );
    const newQuizSet: QuizSet = {
      id: `quiz-week-${config.weekNumber}-${Date.now()}`,
      weekNumber: config.weekNumber,
      lessonTitle: upperLessonTitle,
      subject: 'Tiếng Anh',
      grade: config.grade,
      description: `BÀI HỌC TIẾNG ANH: ${upperLessonTitle}`,
      questions: cleanedQuestions,
      createdAt: new Date().toISOString(),
    };

    let finalStudents = [...students];
    const allEnteredNames: { name: string; teamId: string }[] = [];

    if (config.gameMode === 'team' && config.teamsConfig.length > 0) {
      config.teamsConfig.forEach((t) => {
        t.studentNames.forEach((sName) => {
          if (sName.trim()) {
            allEnteredNames.push({ name: sName.trim(), teamId: t.teamId });
          }
        });
      });
    }

    const studentListFromBox2 = config.studentsText
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    studentListFromBox2.forEach((sName, idx) => {
      if (!allEnteredNames.some((x) => x.name.toLowerCase() === sName.toLowerCase())) {
        const fallbackTeamId =
          config.teamsConfig[idx % Math.max(1, config.teamsConfig.length)]?.teamId || 'team-1';
        allEnteredNames.push({ name: sName, teamId: fallbackTeamId });
      }
    });

    const persistentStats = getPersistentStats(getActiveClassId() || currentClass.id);

    if (allEnteredNames.length > 0) {
      finalStudents = allEnteredNames.map((entry, idx) => {
        const found = students.find((s) => s.name.toLowerCase() === entry.name.toLowerCase());
        const savedStat = persistentStats.individualStats[normalizeEntityKey(entry.name)];
        const mergedWeekly = {
          ...(savedStat?.weeklyScores || {}),
        };
        const totalScore = Object.values(mergedWeekly).reduce((acc, w) => acc + (w.score || 0), 0);
        const totalCorr = Object.values(mergedWeekly).reduce((acc, w) => acc + (w.correctCount || 0), 0);
        const totalWr = Object.values(mergedWeekly).reduce((acc, w) => acc + (w.wrongCount || 0), 0);

        return {
          id: found?.id || `std-${idx + 1}-${Date.now()}`,
          classId: getActiveClassId() || currentClass.id,
          name: entry.name,
          rollNumber: found?.rollNumber || `${idx + 1 < 10 ? '0' : ''}${idx + 1}`,
          teamId: entry.teamId,
          gender: found?.gender || (idx % 2 === 0 ? 'nam' : 'nu'),
          avatar: found?.avatar || (idx % 2 === 0 ? '👦' : '👧'),
          cumulativeScore: totalScore,
          totalCorrect: totalCorr,
          totalWrong: totalWr,
          highestCombo: found?.highestCombo || 0,
          weeklyScores: mergedWeekly,
        };
      });
    }

    const updatedTeams: Team[] =
      config.gameMode === 'team' && config.teamsConfig.length > 0
        ? config.teamsConfig.map((tc, idx) => {
            const wild = WILD_ANIMAL_AVATARS[idx % WILD_ANIMAL_AVATARS.length];
            const savedTeamStat = persistentStats.teamStats[normalizeEntityKey(tc.teamName)];
            return {
              id: tc.teamId,
              name: tc.teamName,
              color: 'from-amber-400 to-orange-500',
              carHex: CLIMBER_PALETTE[idx % CLIMBER_PALETTE.length],
              carNumber: idx + 1,
              score: 0,
              lap: 0,
              combo: 0,
              isNitroActive: false,
              nitroRemainingSec: 0,
              studentIds: finalStudents.filter((s) => s.teamId === tc.teamId).map((s) => s.id),
              avatar: wild.avatar,
              weeklyScores: savedTeamStat?.weeklyScores || {},
            };
          })
        : currentClass.teams;

    set({
      currentClass: {
        ...currentClass,
        id: getActiveClassId() || currentClass.id,
        name: config.className || currentClass.name,
        teams: updatedTeams,
      },
      students: finalStudents,
      gameMode: config.gameMode,
      racers: newRacers,
      currentRacerIndex: 0,
      selectedStudentName: null,
      studentCallCounts: {},
      sessionStudentRecords: {},
      selectedWeek: config.weekNumber,
      currentQuiz: newQuizSet,
      quizzes: [newQuizSet, ...quizzes.filter((q) => q.weekNumber !== config.weekNumber)],
      activeQuestionIndex: 0,
      currentQuestion: newQuizSet.questions[0] || null,
      isSetupOpen: false,
      gameState: 'question',
      lastFeedback: null,
      winnerRacer: null,
    });
    saveLastSessionSnapshot({
      classId: getActiveClassId() || currentClass.id,
      className: config.className || currentClass.name,
      gameMode: config.gameMode,
      selectedWeek: config.weekNumber,
      currentQuiz: newQuizSet,
      updatedAt: new Date().toISOString(),
    });
    sound.stopCelebrationMusic();
  },

  startRace: () => {
    const { racers, currentQuiz } = get();
    if (!currentQuiz || !currentQuiz.questions || currentQuiz.questions.length === 0) {
      set({ isSetupOpen: true });
      return;
    }
    sound.stopCelebrationMusic();
    sound.playEngineRev();

    const resetRacers = racers.map((r) => ({
      ...r,
      progress: 0,
      hookLevel: 0,
      score: 0,
      correctCount: 0,
      wrongCount: 0,
      totalTimeSec: 0,
      callCount: 0,
      combo: 0,
      isNitro: false,
    }));

    set({
      racers: resetRacers,
      currentRacerIndex: 0,
      selectedStudentName: null,
      studentCallCounts: {},
      sessionStudentRecords: {},
      activeQuestionIndex: 0,
      currentQuestion: currentQuiz.questions[0] || null,
      gameState: 'question',
      lastFeedback: null,
      winnerRacer: null,
    });
  },

  resetRace: () => {
    const { racers, currentQuiz } = get();
    sound.stopCelebrationMusic();
    const resetRacers = racers.map((r) => ({
      ...r,
      progress: 0,
      hookLevel: 0,
      score: 0,
      correctCount: 0,
      wrongCount: 0,
      totalTimeSec: 0,
      callCount: 0,
      combo: 0,
      isNitro: false,
    }));

    set({
      racers: resetRacers,
      currentRacerIndex: 0,
      selectedStudentName: null,
      studentCallCounts: {},
      sessionStudentRecords: {},
      activeQuestionIndex: 0,
      currentQuestion: currentQuiz?.questions[0] || null,
      gameState: 'idle',
      lastFeedback: null,
      winnerRacer: null,
    });
  },

  openNextQuestion: () => {
    const { currentQuiz, activeQuestionIndex, racers } = get();
    if (!currentQuiz || currentQuiz.questions.length === 0) return;

    const nextQIndex = activeQuestionIndex + 1;

    if (nextQIndex >= currentQuiz.questions.length) {
      const sortedRacers = [...racers].sort(compareRacersByResult);
      const topWinner = sortedRacers[0] || racers[0] || null;
      sound.playVictory();
      confetti({
        particleCount: 150,
        spread: 90,
        origin: { y: 0.5 },
      });
      set({
        gameState: 'finished',
        winnerRacer: topWinner,
        lastFeedback: null,
      });
      return;
    }

    set({
      gameState: 'question',
      activeQuestionIndex: nextQIndex,
      currentQuestion: currentQuiz.questions[nextQIndex],
      selectedStudentName: null,
      lastFeedback: null,
    });
  },

  answerQuestion: (optionIndex, elapsedSeconds) => {
    const {
      currentQuestion,
      racers,
      currentRacerIndex,
      selectedStudentName,
      studentCallCounts,
      sessionStudentRecords,
      selectedWeek,
      students,
      currentClass,
      gameMode,
    } = get();

    if (!currentQuestion) return;

    let targetRacerIndex = currentRacerIndex;
    if (selectedStudentName && selectedStudentName.trim()) {
      const normSelected = normalizeEntityKey(selectedStudentName);
      if (gameMode === 'individual') {
        const matchedRacerIdx = racers.findIndex(
          (r) => normalizeEntityKey(r.name) === normSelected
        );
        if (matchedRacerIdx !== -1) {
          targetRacerIndex = matchedRacerIdx;
        }
      } else if (gameMode === 'team') {
        const currentTeamHasStudent = racers[currentRacerIndex]?.memberNames?.some(
          (m) => normalizeEntityKey(m) === normSelected
        );
        if (!currentTeamHasStudent) {
          const teamIdx = racers.findIndex((r) =>
            r.memberNames?.some((m) => normalizeEntityKey(m) === normSelected)
          );
          if (teamIdx !== -1) {
            targetRacerIndex = teamIdx;
          }
        }
      }
    }

    const activeRacer = racers[targetRacerIndex] || racers[currentRacerIndex] || racers[0];
    const isCorrect = optionIndex === currentQuestion.correctIndex;

    const rawSec =
      typeof elapsedSeconds === 'number' && !Number.isNaN(elapsedSeconds) && elapsedSeconds > 0
        ? elapsedSeconds
        : optionIndex === -1
        ? 60
        : 3.5;
    const responseTimeSec = Math.max(0.1, Math.min(60, Math.round(rawSec * 10) / 10));

    const newCombo = isCorrect ? activeRacer.combo + 1 : 0;
    let isNitroTriggered = false;

    if (newCombo >= 3) {
      isNitroTriggered = true;
      sound.playNitro();
    } else if (isCorrect) {
      sound.playCorrect();
      sound.playEngineRev();
    } else {
      sound.playWrong();
    }

    const previousHookLevel =
      typeof activeRacer.hookLevel === 'number'
        ? activeRacer.hookLevel
        : Math.round((activeRacer.progress || 0) / 10);
    const hookDelta = isCorrect ? 1 : -1;
    const newHookLevel = isCorrect
      ? Math.min(10, previousHookLevel + 1)
      : previousHookLevel - 1;
    const newProgress = Math.max(0, Math.min(100, newHookLevel * 10));

    const pointsDelta = isCorrect ? 10 : -10;
    const newScore = activeRacer.score + pointsDelta;
    const newRacerCorrect = (activeRacer.correctCount || 0) + (isCorrect ? 1 : 0);
    const newRacerWrong = (activeRacer.wrongCount || 0) + (isCorrect ? 0 : 1);
    const newRacerTimeSec = Math.round(((activeRacer.totalTimeSec || 0) + responseTimeSec) * 10) / 10;
    const newRacerCalls = (activeRacer.callCount || 0) + 1;

    const updatedRacers = racers.map((r, idx) => {
      if (idx === targetRacerIndex) {
        const prevWeekRec = r.weeklyScores?.[selectedWeek] || {
          score: 0,
          correctCount: 0,
          wrongCount: 0,
          hooksClimbed: 0,
          totalTimeSec: 0,
          callCount: 0,
        };
        return {
          ...r,
          score: newScore,
          correctCount: newRacerCorrect,
          wrongCount: newRacerWrong,
          totalTimeSec: newRacerTimeSec,
          callCount: newRacerCalls,
          hookLevel: newHookLevel,
          progress: newProgress,
          combo: newCombo,
          isNitro: isNitroTriggered,
          weeklyScores: {
            ...(r.weeklyScores || {}),
            [selectedWeek]: {
              score: (prevWeekRec.score || 0) + pointsDelta,
              correctCount: prevWeekRec.correctCount + (isCorrect ? 1 : 0),
              wrongCount: prevWeekRec.wrongCount + (isCorrect ? 0 : 1),
              hooksClimbed: (prevWeekRec.hooksClimbed || 0) + hookDelta,
              totalTimeSec: Math.round(((prevWeekRec.totalTimeSec || 0) + responseTimeSec) * 10) / 10,
              callCount: (prevWeekRec.callCount || 0) + 1,
              lastPlayedDate: new Date().toISOString(),
            },
          },
        };
      }
      return r;
    });

    const targetStudentName = selectedStudentName || activeRacer.name;
    const normStudentKey = normalizeEntityKey(targetStudentName);
    const prevSessionStd = sessionStudentRecords[normStudentKey] || {
      studentName: targetStudentName,
      teamId: activeRacer.id,
      teamName: activeRacer.name,
      teamColor: activeRacer.colorHex || '#f59e0b',
      score: 0,
      hooksClimbed: 0,
      correctCount: 0,
      wrongCount: 0,
      totalTimeSec: 0,
      callCount: 0,
    };

    const updatedSessionStd: SessionStudentRecord = {
      ...prevSessionStd,
      studentName: targetStudentName,
      teamId: activeRacer.id,
      teamName: activeRacer.name,
      teamColor: activeRacer.colorHex || '#f59e0b',
      score: (prevSessionStd.score || 0) + pointsDelta,
      hooksClimbed: (prevSessionStd.hooksClimbed || 0) + hookDelta,
      correctCount: prevSessionStd.correctCount + (isCorrect ? 1 : 0),
      wrongCount: prevSessionStd.wrongCount + (isCorrect ? 0 : 1),
      totalTimeSec: Math.round((prevSessionStd.totalTimeSec + responseTimeSec) * 10) / 10,
      callCount: prevSessionStd.callCount + 1,
    };

    const nextSessionStudentRecords = {
      ...sessionStudentRecords,
      [normStudentKey]: updatedSessionStd,
    };

    let updatedStudents = [...students];
    const matchedStudent = students.find(
      (s) => s.name.trim().toLowerCase() === targetStudentName.trim().toLowerCase()
    );

    if (matchedStudent) {
      updatedStudents = updatedStudents.map((s) => {
        if (s.id === matchedStudent.id) {
          const currentWeekRecord = s.weeklyScores[selectedWeek] || {
            score: 0,
            correctCount: 0,
            wrongCount: 0,
            hooksClimbed: 0,
            totalTimeSec: 0,
            callCount: 0,
          };
          const updatedWeekScore = (currentWeekRecord.score || 0) + pointsDelta;
          const updatedWeeklyScores = {
            ...s.weeklyScores,
            [selectedWeek]: {
              score: updatedWeekScore,
              correctCount: currentWeekRecord.correctCount + (isCorrect ? 1 : 0),
              wrongCount: currentWeekRecord.wrongCount + (isCorrect ? 0 : 1),
              hooksClimbed: (currentWeekRecord.hooksClimbed || 0) + hookDelta,
              totalTimeSec: Math.round(((currentWeekRecord.totalTimeSec || 0) + responseTimeSec) * 10) / 10,
              callCount: (currentWeekRecord.callCount || 0) + 1,
              lastPlayedDate: new Date().toISOString(),
            },
          };
          const newCumulative = Object.values(updatedWeeklyScores).reduce(
            (sum, w) => sum + (w.score || 0),
            0
          );

          return {
            ...s,
            cumulativeScore: newCumulative,
            totalCorrect: s.totalCorrect + (isCorrect ? 1 : 0),
            totalWrong: s.totalWrong + (isCorrect ? 0 : 1),
            totalTimeSec: Math.round(((s.totalTimeSec || 0) + responseTimeSec) * 10) / 10,
            highestCombo: Math.max(s.highestCombo, newCombo),
            weeklyScores: updatedWeeklyScores,
          };
        }
        return s;
      });
    } else if (targetStudentName) {
      const newStd: Student = {
        id: `std-auto-${Date.now()}`,
        classId: getActiveClassId() || currentClass.id,
        name: targetStudentName,
        rollNumber: `${updatedStudents.length + 1}`,
        teamId: activeRacer.id,
        gender: 'nam',
        avatar: '🐭',
        cumulativeScore: pointsDelta,
        totalCorrect: isCorrect ? 1 : 0,
        totalWrong: isCorrect ? 0 : 1,
        totalTimeSec: responseTimeSec,
        highestCombo: newCombo,
        weeklyScores: {
          [selectedWeek]: {
            score: pointsDelta,
            correctCount: isCorrect ? 1 : 0,
            wrongCount: isCorrect ? 0 : 1,
            hooksClimbed: hookDelta,
            totalTimeSec: responseTimeSec,
            callCount: 1,
            lastPlayedDate: new Date().toISOString(),
          },
        },
      };
      updatedStudents.push(newStd);
    }

    const updatedClassTeams = currentClass.teams.map((t) => {
      if (t.id === activeRacer.id || t.name === activeRacer.name) {
        const wRec = t.weeklyScores?.[selectedWeek] || {
          score: 0,
          correctCount: 0,
          wrongCount: 0,
          hooksClimbed: 0,
          totalTimeSec: 0,
          callCount: 0,
        };
        return {
          ...t,
          score: newScore,
          weeklyScores: {
            ...(t.weeklyScores || {}),
            [selectedWeek]: {
              score: (wRec.score || 0) + pointsDelta,
              correctCount: wRec.correctCount + (isCorrect ? 1 : 0),
              wrongCount: wRec.wrongCount + (isCorrect ? 0 : 1),
              hooksClimbed: (wRec.hooksClimbed || 0) + hookDelta,
              totalTimeSec: Math.round(((wRec.totalTimeSec || 0) + responseTimeSec) * 10) / 10,
              callCount: (wRec.callCount || 0) + 1,
              lastPlayedDate: new Date().toISOString(),
            },
          },
        };
      }
      return t;
    });

    recordTurnResultToStorage({
      classId: getActiveClassId() || currentClass.id,
      className: currentClass.name,
      weekNumber: selectedWeek,
      studentName: targetStudentName,
      teamId: activeRacer.id,
      teamName: gameMode === 'team' ? activeRacer.name : undefined,
      teamColor: activeRacer.colorHex,
      teamAvatar: activeRacer.avatar,
      memberCount: activeRacer.memberNames?.length || 1,
      isCorrect,
      pointsEarned: pointsDelta,
      hookDelta,
      responseTimeSec,
    });

    const correctAnswerText =
      currentQuestion.options?.[currentQuestion.correctIndex] ||
      currentQuestion.options?.[0] ||
      '';

    set({
      racers: updatedRacers,
      currentRacerIndex: targetRacerIndex,
      students: updatedStudents,
      sessionStudentRecords: nextSessionStudentRecords,
      currentClass: {
        ...currentClass,
        teams: updatedClassTeams,
      },
      gameState: 'feedback',
      lastFeedback: {
        isCorrect,
        racerName: activeRacer.name,
        studentName: selectedStudentName,
        previousHookLevel,
        hookLevel: newHookLevel,
        hookDelta,
        pointsDelta,
        responseTimeSec,
        totalCorrectCount: gameMode === 'individual' ? newRacerCorrect : updatedSessionStd.correctCount,
        totalTimeSec: gameMode === 'individual' ? newRacerTimeSec : updatedSessionStd.totalTimeSec,
        studentCallCount: studentCallCounts[normStudentKey] || updatedSessionStd.callCount || 1,
        correctAnswerText,
        explanation: currentQuestion.explanation,
        isNitroTriggered,
      },
    });
  },

  closeFeedback: () => {
    sound.stopSpeech();
    get().openNextQuestion();
  },

  toggleSound: () => {
    const muted = sound.toggleMute();
    set({ isMuted: muted });
    return muted;
  },

  addStudent: (newStudentData) => {
    const { students, currentClass, gameMode, selectedWeek } = get();
    const newStudent: Student = {
      ...newStudentData,
      id: `s-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      cumulativeScore: 0,
      totalCorrect: 0,
      totalWrong: 0,
      highestCombo: 0,
      weeklyScores: {},
    };
    const nextStudents = [...students, newStudent];
    set({ students: nextStudents });

    const activeClassId = getActiveClassId() || currentClass.id;
    const savedClasses = getSavedClassesFromLocalStorage();
    const existingSaved = savedClasses.find((c) => c.classId === activeClassId);
    void saveClassData({
      classId: activeClassId,
      className: existingSaved?.className || currentClass.name,
      gradeGroupId: existingSaved?.gradeGroupId,
      gradeGroupName: existingSaved?.gradeGroupName,
      subject: 'Tiếng Anh',
      studentsText: nextStudents.map((s) => s.name).join('\n'),
      gameMode: existingSaved?.gameMode || gameMode,
      teamCount: existingSaved?.teamCount || currentClass.teams.length || 4,
      teamsConfig: currentClass.teams.map((t) => ({
        teamId: t.id,
        teamName: t.name,
        studentNames: nextStudents.filter((s) => s.teamId === t.id).map((s) => s.name),
      })),
      lastLessonTitle: existingSaved?.lastLessonTitle,
      lastWeek: existingSaved?.lastWeek || selectedWeek,
      updatedAt: new Date().toISOString(),
    });
  },

  importStudentsCsv: (csvContent) => {
    const lines = csvContent.split('\n').filter((line) => line.trim().length > 0);
    if (lines.length <= 1) return 0;

    const { currentClass, students, gameMode, selectedWeek } = get();
    const teamIds = currentClass.teams.map((t) => t.id);
    const addedStudents: Student[] = [];

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',').map((p) => p.trim());
      if (parts.length >= 2 && parts[0]) {
        const name = parts[0];
        const rollNumber = parts[1];
        const gender =
          parts[2]?.toLowerCase() === 'nu' || parts[2]?.toLowerCase() === 'nữ' ? 'nu' : 'nam';
        const teamIndex = (i - 1) % teamIds.length;
        const teamId = parts[3] || teamIds[teamIndex];

        addedStudents.push({
          id: `csv-${Date.now()}-${i}`,
          classId: currentClass.id,
          name,
          rollNumber,
          teamId,
          gender,
          avatar: gender === 'nu' ? '👧' : '👦',
          cumulativeScore: 0,
          totalCorrect: 0,
          totalWrong: 0,
          highestCombo: 0,
          weeklyScores: {},
        });
      }
    }

    if (addedStudents.length > 0) {
      const nextStudents = [...students, ...addedStudents];
      set({ students: nextStudents });
      const activeClassId = getActiveClassId() || currentClass.id;
      const savedClasses = getSavedClassesFromLocalStorage();
      const existingSaved = savedClasses.find((c) => c.classId === activeClassId);
      void saveClassData({
        classId: activeClassId,
        className: existingSaved?.className || currentClass.name,
        gradeGroupId: existingSaved?.gradeGroupId,
        gradeGroupName: existingSaved?.gradeGroupName,
        subject: 'Tiếng Anh',
        studentsText: nextStudents.map((s) => s.name).join('\n'),
        gameMode: existingSaved?.gameMode || gameMode,
        teamCount: existingSaved?.teamCount || currentClass.teams.length || 4,
        teamsConfig: currentClass.teams.map((t) => ({
          teamId: t.id,
          teamName: t.name,
          studentNames: nextStudents.filter((s) => s.teamId === t.id).map((s) => s.name),
        })),
        lastLessonTitle: existingSaved?.lastLessonTitle,
        lastWeek: existingSaved?.lastWeek || selectedWeek,
        updatedAt: new Date().toISOString(),
      });
    }
    return addedStudents.length;
  },

  exportStudentsCsv: () => {
    const { students, currentClass, selectedWeek } = get();
    const headers = [
      'Mã HS,Họ và Tên,Giới tính,Đội,Điểm Tuần Này,Điểm Cộng Dồn Lũy Kế,Số Câu Đúng,Số Câu Sai,Combo Cao Nhất',
    ];
    const rows = students.map((s) => {
      const team = currentClass.teams.find((t) => t.id === s.teamId);
      const weekScore = s.weeklyScores[selectedWeek]?.score || 0;
      return `${s.rollNumber},"${s.name}",${s.gender},"${team?.name || 'Cá nhân'}",${weekScore},${s.cumulativeScore},${s.totalCorrect},${s.totalWrong},${s.highestCombo}`;
    });
    return [headers, ...rows].join('\n');
  },

  updateTeamAssignment: (studentId, teamId) => {
    const { students, currentClass, gameMode, selectedWeek } = get();
    const nextStudents = students.map((s) => (s.id === studentId ? { ...s, teamId } : s));
    set({
      students: nextStudents,
    });
    const activeClassId = getActiveClassId() || currentClass.id;
    const savedClasses = getSavedClassesFromLocalStorage();
    const existingSaved = savedClasses.find((c) => c.classId === activeClassId);
    void saveClassData({
      classId: activeClassId,
      className: existingSaved?.className || currentClass.name,
      gradeGroupId: existingSaved?.gradeGroupId,
      gradeGroupName: existingSaved?.gradeGroupName,
      subject: 'Tiếng Anh',
      studentsText: nextStudents.map((s) => s.name).join('\n'),
      gameMode: existingSaved?.gameMode || gameMode,
      teamCount: existingSaved?.teamCount || currentClass.teams.length || 4,
      teamsConfig: currentClass.teams.map((t) => ({
        teamId: t.id,
        teamName: t.name,
        studentNames: nextStudents.filter((s) => s.teamId === t.id).map((s) => s.name),
      })),
      lastLessonTitle: existingSaved?.lastLessonTitle,
      lastWeek: existingSaved?.lastWeek || selectedWeek,
      updatedAt: new Date().toISOString(),
    });
  },

  addGeneratedQuiz: (newQuiz) => {
    const { quizzes, currentClass, gameMode } = get();
    const cleanedQuiz: QuizSet = {
      ...newQuiz,
      subject: 'Tiếng Anh',
      questions: sanitizeStoredQuestions(newQuiz.questions),
    };
    const filtered = quizzes.filter((q) => q.weekNumber !== cleanedQuiz.weekNumber);
    const activeClassId = getActiveClassId() || currentClass.id;
    const matchedGrp = findGradeGroupForClass(activeClassId, currentClass.name);
    saveQuizForLessonAndClass(
      activeClassId,
      cleanedQuiz.lessonTitle,
      cleanedQuiz.questions,
      'Tiếng Anh',
      cleanedQuiz.lessonTitle,
      cleanedQuiz.weekNumber,
      currentClass.name,
      matchedGrp?.gradeId
    );
    saveLastSessionSnapshot({
      classId: activeClassId,
      className: currentClass.name,
      gameMode,
      selectedWeek: cleanedQuiz.weekNumber,
      currentQuiz: cleanedQuiz,
      updatedAt: new Date().toISOString(),
    });
    set({
      quizzes: [cleanedQuiz, ...filtered],
      currentQuiz: cleanedQuiz,
      selectedWeek: cleanedQuiz.weekNumber,
      activeQuestionIndex: 0,
      currentQuestion: cleanedQuiz.questions[0] || null,
    });
  },

  hydrateFromPersistentStorage: () => {
    const savedClasses = getSavedClassesFromLocalStorage();
    const activeId = getActiveClassId();
    const lastSession = getLastSessionSnapshot();
    const targetClass =
      savedClasses.find((c) => c.classId === activeId) ||
      (lastSession?.classId ? savedClasses.find((c) => c.classId === lastSession.classId) : undefined) ||
      savedClasses[0];

    if (!targetClass && !lastSession) return;

    const state = get();
    const effectiveClassId = targetClass?.classId || lastSession?.classId || state.currentClass.id;
    const effectiveClassName = targetClass?.className || lastSession?.className || state.currentClass.name;
    const persistentStats = getPersistentStats(effectiveClassId);

    let restoredStudents = state.students;
    if (targetClass) {
      const allNames: { name: string; teamId: string }[] = [];
      if (targetClass.teamsConfig && targetClass.teamsConfig.length > 0) {
        targetClass.teamsConfig.forEach((tc) => {
          tc.studentNames.forEach((n) => {
            if (n.trim()) {
              allNames.push({ name: n.trim(), teamId: tc.teamId });
            }
          });
        });
      }
      const rawLines = (targetClass.studentsText || '')
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      rawLines.forEach((sName, idx) => {
        if (!allNames.some((x) => x.name.toLowerCase() === sName.toLowerCase())) {
          const fallbackTeamId =
            targetClass.teamsConfig?.[idx % Math.max(1, targetClass.teamsConfig?.length || 1)]?.teamId ||
            'team-1';
          allNames.push({ name: sName, teamId: fallbackTeamId });
        }
      });

      if (allNames.length > 0) {
        restoredStudents = allNames.map((entry, idx) => {
          const savedStat = persistentStats.individualStats[normalizeEntityKey(entry.name)];
          const mergedWeekly = { ...(savedStat?.weeklyScores || {}) };
          const totalScore = Object.values(mergedWeekly).reduce((acc, w) => acc + (w.score || 0), 0);
          const totalCorr = Object.values(mergedWeekly).reduce((acc, w) => acc + (w.correctCount || 0), 0);
          const totalWr = Object.values(mergedWeekly).reduce((acc, w) => acc + (w.wrongCount || 0), 0);

          return {
            id: `std-restored-${idx + 1}`,
            classId: effectiveClassId,
            name: entry.name,
            rollNumber: `${idx + 1 < 10 ? '0' : ''}${idx + 1}`,
            teamId: entry.teamId,
            gender: idx % 2 === 0 ? 'nam' : 'nu',
            avatar: idx % 2 === 0 ? '👦' : '👧',
            cumulativeScore: totalScore,
            totalCorrect: totalCorr,
            totalWrong: totalWr,
            highestCombo: 0,
            weeklyScores: mergedWeekly,
          };
        });
      }
    }

    const effectiveMode = targetClass?.gameMode || lastSession?.gameMode || state.gameMode;
    let restoredRacers = state.racers;

    if (effectiveMode === 'individual' && restoredStudents.length > 0) {
      restoredRacers = restoredStudents.map((s, idx) => {
        const wild = WILD_ANIMAL_AVATARS[idx % WILD_ANIMAL_AVATARS.length];
        return {
          id: `indiv-${idx}`,
          name: s.name,
          subInfo: `Dây #${idx + 1}`,
          colorHex: CLIMBER_PALETTE[idx % CLIMBER_PALETTE.length],
          carNumber: idx + 1,
          progress: 0,
          hookLevel: 0,
          score: 0,
          correctCount: 0,
          wrongCount: 0,
          totalTimeSec: 0,
          callCount: 0,
          combo: 0,
          isNitro: false,
          avatar: wild.avatar,
          animalName: wild.animalName,
          memberNames: [s.name],
          weeklyScores: s.weeklyScores || {},
          lane: idx,
        };
      });
    } else if (targetClass?.teamsConfig && targetClass.teamsConfig.length > 0) {
      restoredRacers = targetClass.teamsConfig.map((tc, idx) => {
        const wild = WILD_ANIMAL_AVATARS[idx % WILD_ANIMAL_AVATARS.length];
        return {
          id: tc.teamId,
          name: tc.teamName,
          subInfo: `${tc.studentNames.length} học sinh`,
          colorHex: CLIMBER_PALETTE[idx % CLIMBER_PALETTE.length],
          carNumber: idx + 1,
          progress: 0,
          hookLevel: 0,
          score: 0,
          correctCount: 0,
          wrongCount: 0,
          totalTimeSec: 0,
          callCount: 0,
          combo: 0,
          isNitro: false,
          avatar: wild.avatar,
          animalName: wild.animalName,
          memberNames: tc.studentNames,
          weeklyScores: {},
          lane: idx,
        };
      });
    }

    const sharedQuizzes = getUniqueSavedQuizzesForGrade(
      effectiveClassId,
      effectiveClassName,
      'Tiếng Anh',
      targetClass?.gradeGroupId
    );

    const restoredQuiz =
      lastSession?.currentQuiz ||
      (sharedQuizzes.length > 0
        ? {
            id: `quiz-restored-${Date.now()}`,
            weekNumber: sharedQuizzes[0].weekNumber || 1,
            lessonTitle: sharedQuizzes[0].lessonTitle.toUpperCase(),
            subject: 'Tiếng Anh',
            questions: sharedQuizzes[0].questions,
            createdAt: sharedQuizzes[0].savedAt,
          }
        : state.currentQuiz);

    set({
      currentClass: {
        ...state.currentClass,
        id: effectiveClassId,
        name: effectiveClassName,
      },
      students: restoredStudents,
      gameMode: effectiveMode,
      racers: restoredRacers,
      selectedWeek: targetClass?.lastWeek || lastSession?.selectedWeek || state.selectedWeek,
      currentQuiz: restoredQuiz || null,
      currentQuestion: restoredQuiz?.questions?.[0] || null,
    });
  },

  resetClassStatistics: (targetClassId) => {
    const { currentClass, students } = get();
    const cid = targetClassId || getActiveClassId() || currentClass.id;
    clearPersistentStatsForClass(cid, currentClass.name);
    const resetStds = students.map((s) => ({
      ...s,
      cumulativeScore: 0,
      totalCorrect: 0,
      totalWrong: 0,
      totalTimeSec: 0,
      weeklyScores: {},
    }));
    set({ students: resetStds });
  },

  getLeaderboard: (weekNumber, startWeek, endWeek, targetClassId) => {
    const { currentClass, students, selectedWeek } = get();
    const cid = targetClassId || getActiveClassId() || currentClass.id;
    const persistent = getPersistentStats(cid);
    const wTarget = weekNumber || selectedWeek;
    const sWeek = startWeek || 1;
    const eWeek = endWeek || wTarget;

    const entityMap = new Map<
      string,
      {
        name: string;
        teamName: string;
        teamColor: string;
        rollNumber: string;
        weeklyScores: Record<number, WeeklyScoreRecord>;
        highestCombo: number;
      }
    >();

    students.forEach((s, idx) => {
      const key = normalizeEntityKey(s.name);
      const tObj = currentClass.teams.find((t) => t.id === s.teamId);
      entityMap.set(key, {
        name: s.name,
        teamName: tObj?.name || 'Cá nhân',
        teamColor: tObj?.carHex || '#f59e0b',
        rollNumber: s.rollNumber || `${idx + 1}`,
        weeklyScores: { ...(s.weeklyScores || {}) },
        highestCombo: s.highestCombo || 0,
      });
    });

    Object.entries(persistent.individualStats || {}).forEach(([key, pStd], idx) => {
      const existing = entityMap.get(key);
      if (existing) {
        existing.weeklyScores = { ...existing.weeklyScores, ...(pStd.weeklyScores || {}) };
        if (pStd.teamName) existing.teamName = pStd.teamName;
        if (pStd.teamColor) existing.teamColor = pStd.teamColor;
      } else {
        entityMap.set(key, {
          name: pStd.name,
          teamName: pStd.teamName || 'Cá nhân',
          teamColor: pStd.teamColor || '#f59e0b',
          rollNumber: `${idx + 1}`,
          weeklyScores: { ...(pStd.weeklyScores || {}) },
          highestCombo: 0,
        });
      }
    });

    const entries: LeaderboardEntry[] = Array.from(entityMap.entries()).map(([key, item]) => {
      const wScore = item.weeklyScores[wTarget]?.score || 0;
      let cumulativeScore = 0;
      let rangeScore = 0;
      let rangeCorrect = 0;
      let rangeWrong = 0;
      let rangeHooks = 0;
      let rangeTimeSec = 0;

      Object.entries(item.weeklyScores).forEach(([wStr, rec]) => {
        const wNum = Number(wStr);
        cumulativeScore += rec.score || 0;
        if (wNum >= sWeek && wNum <= eWeek) {
          rangeScore += rec.score || 0;
          rangeCorrect += rec.correctCount || 0;
          rangeWrong += rec.wrongCount || 0;
          rangeHooks += rec.hooksClimbed || 0;
          rangeTimeSec += rec.totalTimeSec || 0;
        }
      });

      const totalAttempts = rangeCorrect + rangeWrong;
      const accuracy = totalAttempts > 0 ? Math.round((rangeCorrect / totalAttempts) * 100) : 0;

      return {
        rank: 0,
        studentId: key,
        studentName: item.name,
        teamName: item.teamName,
        teamColor: item.teamColor,
        rollNumber: item.rollNumber,
        weeklyScore: wScore,
        cumulativeScore,
        rangeScore,
        rangeCorrect,
        rangeWrong,
        rangeHooks,
        rangeTimeSec: Math.round(rangeTimeSec * 10) / 10,
        weeklyBreakdown: item.weeklyScores,
        highestCombo: item.highestCombo,
        accuracy,
      };
    });

    entries.sort((a, b) => {
      if (b.rangeScore !== a.rangeScore) return b.rangeScore - a.rangeScore;
      if (b.rangeCorrect !== a.rangeCorrect) return b.rangeCorrect - a.rangeCorrect;
      if (a.rangeTimeSec > 0 && b.rangeTimeSec > 0 && a.rangeTimeSec !== b.rangeTimeSec) {
        return a.rangeTimeSec - b.rangeTimeSec;
      }
      return a.studentName.localeCompare(b.studentName, 'vi');
    });

    return entries.map((e, idx) => ({ ...e, rank: idx + 1 }));
  },

  getTeamLeaderboard: (weekNumber, startWeek, endWeek, targetClassId) => {
    const { currentClass, selectedWeek } = get();
    const cid = targetClassId || getActiveClassId() || currentClass.id;
    const persistent = getPersistentStats(cid);
    const wTarget = weekNumber || selectedWeek;
    const sWeek = startWeek || 1;
    const eWeek = endWeek || wTarget;

    const teamMap = new Map<
      string,
      {
        id: string;
        name: string;
        color: string;
        avatar: string;
        memberCount: number;
        weeklyScores: Record<number, WeeklyScoreRecord>;
      }
    >();

    currentClass.teams.forEach((t) => {
      const key = normalizeEntityKey(t.name);
      teamMap.set(key, {
        id: t.id,
        name: t.name,
        color: t.carHex || '#10b981',
        avatar: t.avatar || '🦁',
        memberCount: t.studentIds?.length || 1,
        weeklyScores: { ...(t.weeklyScores || {}) },
      });
    });

    Object.entries(persistent.teamStats || {}).forEach(([key, pTeam]) => {
      const existing = teamMap.get(key);
      if (existing) {
        existing.weeklyScores = { ...existing.weeklyScores, ...(pTeam.weeklyScores || {}) };
      } else {
        teamMap.set(key, {
          id: pTeam.id || key,
          name: pTeam.name,
          color: pTeam.teamColor || '#10b981',
          avatar: pTeam.avatar || '🦁',
          memberCount: pTeam.memberCount || 1,
          weeklyScores: { ...(pTeam.weeklyScores || {}) },
        });
      }
    });

    const entries: TeamLeaderboardEntry[] = Array.from(teamMap.values()).map((item) => {
      const wScore = item.weeklyScores[wTarget]?.score || 0;
      let cumulativeScore = 0;
      let rangeScore = 0;
      let rangeCorrect = 0;
      let rangeWrong = 0;
      let rangeHooks = 0;
      let rangeTimeSec = 0;

      Object.entries(item.weeklyScores).forEach(([wStr, rec]) => {
        const wNum = Number(wStr);
        cumulativeScore += rec.score || 0;
        if (wNum >= sWeek && wNum <= eWeek) {
          rangeScore += rec.score || 0;
          rangeCorrect += rec.correctCount || 0;
          rangeWrong += rec.wrongCount || 0;
          rangeHooks += rec.hooksClimbed || 0;
          rangeTimeSec += rec.totalTimeSec || 0;
        }
      });

      const totalAttempts = rangeCorrect + rangeWrong;
      const accuracy = totalAttempts > 0 ? Math.round((rangeCorrect / totalAttempts) * 100) : 0;

      return {
        rank: 0,
        teamId: item.id,
        teamName: item.name,
        teamColor: item.color,
        avatar: item.avatar,
        memberCount: item.memberCount,
        weeklyScore: wScore,
        cumulativeScore,
        rangeScore,
        rangeCorrect,
        rangeWrong,
        rangeHooks,
        rangeTimeSec: Math.round(rangeTimeSec * 10) / 10,
        weeklyBreakdown: item.weeklyScores,
        accuracy,
      };
    });

    entries.sort((a, b) => {
      if (b.rangeScore !== a.rangeScore) return b.rangeScore - a.rangeScore;
      if (b.rangeCorrect !== a.rangeCorrect) return b.rangeCorrect - a.rangeCorrect;
      if (a.rangeTimeSec > 0 && b.rangeTimeSec > 0 && a.rangeTimeSec !== b.rangeTimeSec) {
        return a.rangeTimeSec - b.rangeTimeSec;
      }
      return a.teamName.localeCompare(b.teamName, 'vi');
    });

    return entries.map((e, idx) => ({ ...e, rank: idx + 1 }));
  },
}));
