import { GameMode, Question, QuizSet, SubjectType, WeeklyScoreRecord } from '../types';
import {
  normalizeQuestionVisuals,
  sanitizePedagogicalQuestionStem,
  stripDecorativeEmojis,
} from './geminiClientService';

export function stripStoredOptionPrefix(rawOption: string): string {
  let text = String(rawOption || '').normalize('NFC').trim();
  for (let i = 0; i < 3; i++) {
    const next = text
      .replace(/^(?:đáp\s*án|phương\s*án|lựa\s*chọn)\s+[A-Da-d]\s*[.:)\-–—]?\s*/i, '')
      .replace(/^\([A-Da-d]\)\s*[.:;\-–—]?\s*/, '')
      .replace(/^\[[A-Da-d]\]\s*[.:;\-–—]?\s*/, '')
      .replace(/^[A-Da-d]\s*[.:)]\s*/, '')
      .replace(/^[A-Da-d]\s+[-–—]\s+/, '')
      .trim();
    if (next === text) break;
    text = next;
  }
  return text || String(rawOption || '').normalize('NFC').trim();
}

export function sanitizeStoredQuestions(questions?: Question[]): Question[] {
  if (!Array.isArray(questions) || questions.length === 0) return [];
  const preCleaned = questions.map((q) => {
    const isVerbatim =
      String(q?.id || '').startsWith('docx_') ||
      String(q?.id || '').startsWith('user_') ||
      String(q?.id || '').startsWith('sample_') ||
      String(q?.id || '').startsWith('manual_');

    const cleanOpts = Array.isArray(q?.options)
      ? q.options.map((opt) => stripStoredOptionPrefix(String(opt ?? '')))
      : [];
    const correctIdx =
      typeof q?.correctIndex === 'number' && q.correctIndex >= 0 && q.correctIndex <= 3
        ? q.correctIndex
        : 0;
    const cleanExp = String(q?.explanation || '').normalize('NFC').trim();
    const cleanQ = isVerbatim
      ? String(q?.question || '').normalize('NFC').trim()
      : sanitizePedagogicalQuestionStem(
          String(q?.question || ''),
          cleanOpts,
          correctIdx,
          cleanExp
        );
    return {
      ...q,
      question: cleanQ,
      options: isVerbatim
        ? cleanOpts
        : cleanOpts.map((opt) =>
            q?.visualDisplayMode === 'options_image' ? opt : stripDecorativeEmojis(opt) || opt
          ),
      explanation: cleanExp,
      visualData: q?.visualData || '',
      questionSvg: q?.questionSvg || '',
      visualKey: q?.visualKey || '',
      visualPrompt: '',
      optionVisuals: Array.isArray(q?.optionVisuals) ? q.optionVisuals : undefined,
      optionSvgs: Array.isArray(q?.optionSvgs) ? q.optionSvgs : undefined,
    };
  });
  return normalizeQuestionVisuals(preCleaned);
}

export const ALLOWED_SUBJECTS = [
  'Tiếng Anh',
] as const;

export interface SavedTeamConfig {
  teamId: string;
  teamName: string;
  studentNames: string[];
}

export interface SavedGradeGroup {
  gradeId: string;
  gradeName: string; // e.g. "Khối lớp 3"
  classIds: string[]; // Danh sách classId của các lớp thuộc khối lớp này (VD: 3A, 3B, 3C)
  updatedAt: string;
}

export interface SavedLessonQuiz {
  lessonTitle: string; // e.g. "BÀI 1"
  normalizedKey: string; // normalized key for matching
  subject: string;
  normalizedSubject?: string;
  weekNumber?: number;
  grade?: number | null;
  gradeGroupId?: string;
  gradeGroupName?: string;
  sourceClassName?: string;
  questions: Question[];
  savedAt: string;
}

export interface PersistentEntityStats {
  id: string;
  name: string;
  teamName?: string;
  teamColor?: string;
  avatar?: string;
  memberCount?: number;
  weeklyScores: Record<number, WeeklyScoreRecord>;
}

export interface SavedClassStats {
  classId: string;
  className: string;
  individualStats: Record<string, PersistentEntityStats>; // key: normalized student name
  teamStats: Record<string, PersistentEntityStats>; // key: normalized team name or teamId
  updatedAt: string;
}

export interface SavedClassData {
  classId: string;
  className: string; // e.g. "Lớp 3A"
  grade?: number;
  gradeGroupId?: string;
  gradeGroupName?: string;
  subject?: SubjectType;
  studentsText: string;
  gameMode: GameMode;
  teamCount: number;
  teamsConfig: SavedTeamConfig[];
  lastLessonTitle?: string;
  lastWeek?: number;
  savedQuizzes?: Record<string, SavedLessonQuiz>;
  updatedAt: string;
}

export interface LastSessionSnapshot {
  classId: string;
  className: string;
  gradeGroupId?: string;
  subject?: string;
  weekNumber?: number;
  selectedWeek?: number;
  lessonTitle?: string;
  gameMode: GameMode;
  teamCount?: number;
  studentsText?: string;
  teamsConfig?: SavedTeamConfig[];
  questions?: Question[];
  currentQuiz?: QuizSet;
  updatedAt: string;
}

// Keys for LocalStorage & Server-side permanent persistence
const LOCAL_STORAGE_CLASSES_KEY = 'knowledge_race_classes_clean_v3';
const LOCAL_STORAGE_GRADE_GROUPS_KEY = 'knowledge_race_grade_groups_v1';
const LOCAL_STORAGE_ACTIVE_CLASS_ID_KEY = 'knowledge_race_active_class_id_v3';
const LOCAL_STORAGE_QUIZZES_KEY = 'knowledge_race_lesson_quizzes_v3';
const LOCAL_STORAGE_STATS_KEY = 'ancient_forest_weekly_stats_v1';
const LOCAL_STORAGE_LAST_SESSION_KEY = 'knowledge_race_last_session_v1';
const FIREBASE_CONFIG_STORAGE_KEY = 'knowledge_race_firebase_config_v1';

/**
 * ĐỒNG BỘ DỮ LIỆU VĨNH VIỄN LÊN MÁY CHỦ (/api/storage/sync)
 * Đảm bảo khi người dùng xóa lịch sử duyệt web (Clear Browsing History / LocalStorage / Cache)
 * rồi truy cập lại ứng dụng thì toàn bộ dữ liệu đã lưu vẫn được khôi phục nguyên vẹn 100%!
 */
export async function syncKeysToServer(
  entries: Record<string, string>,
  deletedKeys: string[] = [],
  forceOverwriteKeys: string[] = []
): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    await fetch('/api/storage/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entries,
        deletedKeys,
        forceOverwriteKeys,
      }),
    });
  } catch {
    // Ignore transient network errors; next sync or hydration will reconcile
  }
}

export function setPersistentItem(
  key: string,
  value: string,
  forceOverwrite: boolean = false
): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, value);
  } catch (err) {
    console.error(`Failed to set localStorage key ${key}:`, err);
  }
  void syncKeysToServer({ [key]: value }, [], forceOverwrite ? [key] : []);
}

export function removePersistentItem(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(key);
  } catch (err) {
    console.error(`Failed to remove localStorage key ${key}:`, err);
  }
  void syncKeysToServer({}, [key], [key]);
}

function isPersistentAppKey(key: string): boolean {
  return (
    key === LOCAL_STORAGE_CLASSES_KEY ||
    key === LOCAL_STORAGE_GRADE_GROUPS_KEY ||
    key === LOCAL_STORAGE_ACTIVE_CLASS_ID_KEY ||
    key === LOCAL_STORAGE_LAST_SESSION_KEY ||
    key === FIREBASE_CONFIG_STORAGE_KEY ||
    key === 'FOREST_CLIMB_GEMINI_API_KEY_V1' ||
    key === 'gemini_api_key' ||
    key.startsWith(`${LOCAL_STORAGE_QUIZZES_KEY}_`) ||
    key.startsWith(`${LOCAL_STORAGE_STATS_KEY}_`)
  );
}

/**
 * Khôi phục tự động toàn bộ dữ liệu đã lưu từ máy chủ khi ứng dụng khởi động
 * (Đặc biệt khi người dùng vừa xóa lịch sử duyệt web khiến localStorage bị trống)
 */
export async function hydrateStorageFromServer(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    const response = await fetch('/api/storage/sync', {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return false;

    const data = await response.json();
    const serverEntries: Record<string, string> =
      data && data.entries && typeof data.entries === 'object' ? data.entries : {};

    let restoredAnyKey = false;

    // 1. Khôi phục từ máy chủ về trình duyệt (khi trình duyệt bị xóa lịch sử, thiếu khóa, hoặc cần chuẩn hóa xóa tiền tố A., B., C., D.)
    for (const [key, serverVal] of Object.entries(serverEntries)) {
      if (typeof serverVal !== 'string' || !serverVal.trim()) continue;
      const localVal = localStorage.getItem(key);
      const isLocalEmpty =
        !localVal ||
        localVal.trim() === '' ||
        localVal.trim() === '[]' ||
        localVal.trim() === '{}';

      const hasLegacyOptionPrefixInLocal =
        Boolean(localVal) &&
        (key === LOCAL_STORAGE_CLASSES_KEY ||
          key === LOCAL_STORAGE_LAST_SESSION_KEY ||
          key.startsWith(`${LOCAL_STORAGE_QUIZZES_KEY}_`)) &&
        /"[A-D]\.\s+/i.test(localVal || '');

      if (isLocalEmpty || (hasLegacyOptionPrefixInLocal && serverVal !== localVal)) {
        try {
          localStorage.setItem(key, serverVal);
          restoredAnyKey = true;
        } catch {}
      }
    }

    // 2. Đồng bộ chiều ngược lại: Đẩy mọi dữ liệu hiện có trên trình duyệt mà máy chủ chưa có lên máy chủ
    const localToPush: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && isPersistentAppKey(k)) {
        const v = localStorage.getItem(k);
        if (v && v.trim() && v !== '[]' && v !== '{}' && serverEntries[k] !== v) {
          localToPush[k] = v;
        }
      }
    }

    if (Object.keys(localToPush).length > 0) {
      void syncKeysToServer(localToPush);
    }

    if (restoredAnyKey) {
      window.dispatchEvent(new CustomEvent('classroom-storage-hydrated'));
    }

    return restoredAnyKey;
  } catch {
    return false;
  }
}

/**
 * Lưu & Đọc phiên làm việc gần nhất (LastSessionSnapshot) để khi F5 hoặc xóa lịch sử duyệt web
 * rồi mở lại ứng dụng, lớp học & bài học đang chơi sẽ được nạp lại ngay lập tức!
 */
export function saveLastSessionSnapshot(snapshot: LastSessionSnapshot): void {
  if (typeof window === 'undefined') return;
  try {
    const cleanedQuiz = snapshot.currentQuiz
      ? {
          ...snapshot.currentQuiz,
          questions: sanitizeStoredQuestions(snapshot.currentQuiz.questions),
        }
      : undefined;
    const payload = JSON.stringify({
      ...snapshot,
      questions: snapshot.questions ? sanitizeStoredQuestions(snapshot.questions) : undefined,
      currentQuiz: cleanedQuiz,
      updatedAt: new Date().toISOString(),
    });
    setPersistentItem(LOCAL_STORAGE_LAST_SESSION_KEY, payload, true);
  } catch {}
}

export function getLastSessionSnapshot(): LastSessionSnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_LAST_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LastSessionSnapshot;
    if (parsed && typeof parsed === 'object' && parsed.className) {
      if (parsed.questions) {
        parsed.questions = sanitizeStoredQuestions(parsed.questions);
      }
      if (parsed.currentQuiz && Array.isArray(parsed.currentQuiz.questions)) {
        parsed.currentQuiz = {
          ...parsed.currentQuiz,
          questions: sanitizeStoredQuestions(parsed.currentQuiz.questions),
        };
      }
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

// Normalize lesson title (e.g. "Bài 1" -> "bai 1", "bài 01" -> "bai 1")
export function normalizeLessonKey(title: string): string {
  if (!title) return '';
  const trimmed = title.trim().toLowerCase();
  const noDiacritics = trimmed
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');

  const cleaned = noDiacritics.replace(/[^a-z0-9]/g, ' ').trim().replace(/\s+/g, ' ');
  return cleaned;
}

// Normalize subject key for Primary School English subject
export function normalizeSubjectKey(subject?: string): string {
  if (!subject || !subject.trim()) return 'tieng_anh';
  const norm = normalizeLessonKey(subject);
  if (norm.includes('tieng anh') || norm.includes('english')) return 'tieng_anh';
  return 'tieng_anh';
}

export function normalizeEntityKey(name: string): string {
  if (!name) return '';
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Get persistent weekly & cumulative statistics for a class (or default active class)
 */
export function getPersistentStats(classId?: string): SavedClassStats {
  const targetClassId = classId || getActiveClassId() || 'default-class';
  if (typeof window === 'undefined') {
    return {
      classId: targetClassId,
      className: 'Lớp học',
      individualStats: {},
      teamStats: {},
      updatedAt: new Date().toISOString(),
    };
  }
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_STATS_KEY}_${targetClassId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        classId: targetClassId,
        className: parsed.className || 'Lớp học',
        individualStats: parsed.individualStats || {},
        teamStats: parsed.teamStats || {},
        updatedAt: parsed.updatedAt || new Date().toISOString(),
      };
    }
  } catch (err) {
    console.error('Failed to load persistent stats:', err);
  }
  return {
    classId: targetClassId,
    className: 'Lớp học',
    individualStats: {},
    teamStats: {},
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Save persistent weekly & cumulative statistics for a class
 */
export function savePersistentStats(stats: SavedClassStats): void {
  if (typeof window === 'undefined') return;
  try {
    const targetClassId = stats.classId || getActiveClassId() || 'default-class';
    const key = `${LOCAL_STORAGE_STATS_KEY}_${targetClassId}`;
    const serialized = JSON.stringify({
      ...stats,
      classId: targetClassId,
      updatedAt: new Date().toISOString(),
    });
    setPersistentItem(key, serialized);
  } catch (err) {
    console.error('Failed to save persistent stats:', err);
  }
}

export interface StatsClassOption {
  classId: string;
  className: string;
  studentCount: number;
  teamCount: number;
  subject?: string;
}

/**
 * Get all available classes that can be selected in the Statistics screen.
 * Combines saved classes from localStorage, classes with recorded stats, and current active class.
 */
export function getAvailableClassesForStatistics(currentStoreClass?: {
  id: string;
  name: string;
  studentCount?: number;
  teamCount?: number;
}): StatsClassOption[] {
  const savedClasses = getSavedClassesFromLocalStorage();
  const map = new Map<string, StatsClassOption>();

  // 1. Add all explicitly saved classes
  savedClasses.forEach((c) => {
    const stdCount = (c.studentsText || '')
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean).length;
    const tCount = c.teamsConfig?.length || c.teamCount || 0;
    map.set(c.classId, {
      classId: c.classId,
      className: c.className || 'Lớp đã lưu',
      studentCount: stdCount,
      teamCount: tCount,
      subject: c.subject,
    });
  });

  // 2. Check localStorage for any stats keys
  if (typeof window !== 'undefined') {
    try {
      const prefix = `${LOCAL_STORAGE_STATS_KEY}_`;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) {
          const cid = key.slice(prefix.length);
          if (cid && !map.has(cid)) {
            const raw = localStorage.getItem(key);
            if (raw) {
              const parsed = JSON.parse(raw) as SavedClassStats;
              const stdCount = Object.keys(parsed.individualStats || {}).length;
              const tCount = Object.keys(parsed.teamStats || {}).length;
              if (stdCount > 0 || tCount > 0) {
                map.set(cid, {
                  classId: cid,
                  className: parsed.className || cid,
                  studentCount: stdCount,
                  teamCount: tCount,
                });
              }
            }
          }
        }
      }
    } catch {}
  }

  // 3. Include current active class in store if not already in map
  if (currentStoreClass && currentStoreClass.id && !map.has(currentStoreClass.id)) {
    map.set(currentStoreClass.id, {
      classId: currentStoreClass.id,
      className: currentStoreClass.name || 'Lớp hiện tại',
      studentCount: currentStoreClass.studentCount || 0,
      teamCount: currentStoreClass.teamCount || 0,
    });
  }

  return Array.from(map.values());
}

/**
 * Record a single turn result (Correct or Wrong) into persistent weekly storage
 * for BOTH the answering student (Individual) AND their team (Team).
 */
export function recordTurnResultToStorage({
  classId,
  className,
  weekNumber,
  studentName,
  teamId,
  teamName,
  teamColor,
  teamAvatar,
  memberCount,
  isCorrect,
  pointsEarned,
  hookDelta,
  responseTimeSec = 0,
}: {
  classId?: string;
  className?: string;
  weekNumber: number;
  studentName?: string | null;
  teamId?: string;
  teamName?: string;
  teamColor?: string;
  teamAvatar?: string;
  memberCount?: number;
  isCorrect: boolean;
  pointsEarned: number;
  hookDelta: number;
  responseTimeSec?: number;
}): SavedClassStats {
  const effectiveClassId = classId || getActiveClassId() || 'default-class';
  const currentStats = getPersistentStats(effectiveClassId);
  if (className) {
    currentStats.className = className;
  }

  const safeSec = Math.max(0.1, Math.round((Number(responseTimeSec) || 0) * 10) / 10);

  // 1. Update Individual Student Weekly Record
  if (studentName && studentName.trim()) {
    const stdKey = normalizeEntityKey(studentName);
    const existingStd = currentStats.individualStats[stdKey] || {
      id: stdKey,
      name: studentName.trim(),
      teamName: teamName || 'Cá nhân',
      teamColor: teamColor || '#f59e0b',
      avatar: '🐥',
      weeklyScores: {},
    };

    const weekRec = existingStd.weeklyScores[weekNumber] || {
      score: 0,
      correctCount: 0,
      wrongCount: 0,
      hooksClimbed: 0,
      totalTimeSec: 0,
      callCount: 0,
    };

    existingStd.name = studentName.trim();
    if (teamName) existingStd.teamName = teamName;
    if (teamColor) existingStd.teamColor = teamColor;

    existingStd.weeklyScores[weekNumber] = {
      score: (weekRec.score || 0) + pointsEarned,
      correctCount: weekRec.correctCount + (isCorrect ? 1 : 0),
      wrongCount: weekRec.wrongCount + (isCorrect ? 0 : 1),
      hooksClimbed: (weekRec.hooksClimbed || 0) + hookDelta,
      totalTimeSec: Math.round(((weekRec.totalTimeSec || 0) + safeSec) * 10) / 10,
      callCount: (weekRec.callCount || 0) + 1,
      lastPlayedDate: new Date().toISOString(),
    };

    currentStats.individualStats[stdKey] = existingStd;
  }

  // 2. Update Team Weekly Record
  if (teamName && teamName.trim()) {
    const tKey = normalizeEntityKey(teamName);
    const existingTeam = currentStats.teamStats[tKey] || {
      id: teamId || tKey,
      name: teamName.trim(),
      teamColor: teamColor || '#10b981',
      avatar: teamAvatar || '🦁',
      memberCount: memberCount || 1,
      weeklyScores: {},
    };

    const weekRec = existingTeam.weeklyScores[weekNumber] || {
      score: 0,
      correctCount: 0,
      wrongCount: 0,
      hooksClimbed: 0,
      totalTimeSec: 0,
      callCount: 0,
    };

    existingTeam.name = teamName.trim();
    if (teamColor) existingTeam.teamColor = teamColor;
    if (teamAvatar) existingTeam.avatar = teamAvatar;
    if (memberCount) existingTeam.memberCount = memberCount;

    existingTeam.weeklyScores[weekNumber] = {
      score: (weekRec.score || 0) + pointsEarned,
      correctCount: weekRec.correctCount + (isCorrect ? 1 : 0),
      wrongCount: weekRec.wrongCount + (isCorrect ? 0 : 1),
      hooksClimbed: (weekRec.hooksClimbed || 0) + hookDelta,
      totalTimeSec: Math.round(((weekRec.totalTimeSec || 0) + safeSec) * 10) / 10,
      callCount: (weekRec.callCount || 0) + 1,
      lastPlayedDate: new Date().toISOString(),
    };

    currentStats.teamStats[tKey] = existingTeam;
  }

  savePersistentStats(currentStats);
  return currentStats;
}

/**
 * Clear persistent stats for a class and reset its stored statistics to initial default (empty)
 */
export function clearPersistentStatsForClass(classId?: string, className?: string): void {
  if (typeof window === 'undefined') return;
  const targetClassId = classId || getActiveClassId() || 'default-class';
  const normTargetName = (className || '').trim().toLowerCase();
  const keysToRemove: string[] = [`${LOCAL_STORAGE_STATS_KEY}_${targetClassId}`];

  try {
    if (targetClassId === getActiveClassId()) {
      keysToRemove.push(`${LOCAL_STORAGE_STATS_KEY}_default-class`);
    }
    if (normTargetName) {
      const prefix = `${LOCAL_STORAGE_STATS_KEY}_`;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) {
          try {
            const raw = localStorage.getItem(key);
            if (raw) {
              const parsed = JSON.parse(raw) as SavedClassStats;
              if (
                parsed.classId === targetClassId ||
                (parsed.className && parsed.className.trim().toLowerCase() === normTargetName)
              ) {
                keysToRemove.push(key);
              }
            }
          } catch {}
        }
      }
    }
    keysToRemove.forEach((k) => removePersistentItem(k));
  } catch {}
}

/**
 * Get all saved classes from LocalStorage.
 * GUARANTEED: Absolutely NO sample classes (no pre-filled Lớp 3A, 4B, 5C).
 * Only classes explicitly saved by the user are returned.
 */
export function getSavedClassesFromLocalStorage(): SavedClassData[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_CLASSES_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (c) => c && c.classId && !['class-3a', 'class-4b', 'class-5c'].includes(c.classId)
      );
    }
    return [];
  } catch (err) {
    console.error('Failed to parse saved classes from localStorage:', err);
    return [];
  }
}

/**
 * Save classes to LocalStorage & Server
 */
export function saveClassesToLocalStorage(
  classes: SavedClassData[],
  forceOverwrite: boolean = false
): void {
  if (typeof window === 'undefined') return;
  try {
    setPersistentItem(LOCAL_STORAGE_CLASSES_KEY, JSON.stringify(classes), forceOverwrite);
  } catch (err) {
    console.error('Failed to save classes to localStorage:', err);
  }
}

/**
 * Get active class ID
 */
export function getActiveClassId(): string {
  if (typeof window === 'undefined') return '';
  try {
    const id = localStorage.getItem(LOCAL_STORAGE_ACTIVE_CLASS_ID_KEY) || '';
    if (['class-3a', 'class-4b', 'class-5c'].includes(id)) {
      removePersistentItem(LOCAL_STORAGE_ACTIVE_CLASS_ID_KEY);
      return '';
    }
    return id;
  } catch {
    return '';
  }
}

/**
 * Set active class ID
 */
export function setActiveClassId(classId: string): void {
  if (typeof window === 'undefined') return;
  try {
    if (!classId) {
      removePersistentItem(LOCAL_STORAGE_ACTIVE_CLASS_ID_KEY);
    } else {
      setPersistentItem(LOCAL_STORAGE_ACTIVE_CLASS_ID_KEY, classId, true);
    }
  } catch (err) {
    console.error('Failed to set active class ID:', err);
  }
}

/**
 * Get Firebase Config if saved by user
 */
export function getStoredFirebaseConfig(): Record<string, string> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(FIREBASE_CONFIG_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Save Firebase Config
 */
export function saveStoredFirebaseConfig(config: Record<string, string> | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (!config) {
      removePersistentItem(FIREBASE_CONFIG_STORAGE_KEY);
    } else {
      setPersistentItem(FIREBASE_CONFIG_STORAGE_KEY, JSON.stringify(config), true);
    }
  } catch (err) {
    console.error('Failed to save Firebase config:', err);
  }
}

/**
 * Save single class data (updates existing or adds new).
 */
export async function saveClassData(
  classData: SavedClassData
): Promise<{ success: boolean; message: string; savedClass: SavedClassData }> {
  try {
    const classes = getSavedClassesFromLocalStorage();
    let currentId = classData.classId;
    if (!currentId || currentId === '__new__') {
      currentId = `class-${Date.now()}`;
    }

    const updatedData: SavedClassData = {
      ...classData,
      classId: currentId,
      className: classData.className.trim() || 'Lớp mới',
      updatedAt: new Date().toISOString(),
    };

    const existingIndex = classes.findIndex((c) => c.classId === updatedData.classId);
    let newClasses: SavedClassData[];
    if (existingIndex >= 0) {
      const prevClass = classes[existingIndex];
      const mergedClass: SavedClassData = {
        ...prevClass,
        ...updatedData,
        gradeGroupId:
          updatedData.gradeGroupId !== undefined ? updatedData.gradeGroupId : prevClass.gradeGroupId,
        gradeGroupName:
          updatedData.gradeGroupName !== undefined
            ? updatedData.gradeGroupName
            : prevClass.gradeGroupName,
      };
      newClasses = [...classes];
      newClasses[existingIndex] = mergedClass;
      updatedData.gradeGroupId = mergedClass.gradeGroupId;
      updatedData.gradeGroupName = mergedClass.gradeGroupName;
    } else {
      newClasses = [updatedData, ...classes];
    }

    saveClassesToLocalStorage(newClasses);
    setActiveClassId(updatedData.classId);

    // Đồng bộ danh sách classIds trong SavedGradeGroup nếu lớp có gán gradeGroupId
    if (updatedData.gradeGroupId) {
      const groups = getSavedGradeGroupsFromLocalStorage();
      let groupsChanged = false;
      groups.forEach((grp) => {
        if (grp.gradeId === updatedData.gradeGroupId) {
          if (!grp.classIds.includes(updatedData.classId)) {
            grp.classIds = [...grp.classIds, updatedData.classId];
            groupsChanged = true;
          }
          updatedData.gradeGroupName = grp.gradeName;
        } else if (grp.classIds.includes(updatedData.classId)) {
          grp.classIds = grp.classIds.filter((id) => id !== updatedData.classId);
          groupsChanged = true;
        }
      });
      if (groupsChanged) {
        saveGradeGroupsToLocalStorage(groups);
      }
    }

    // Optional Firebase Firestore cloud sync if user configured
    try {
      const fbConfig = getStoredFirebaseConfig();
      if (fbConfig && fbConfig.projectId) {
        const projectId = fbConfig.projectId;
        const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/classrooms/${updatedData.classId}`;

        await fetch(firestoreUrl, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fields: {
              className: { stringValue: updatedData.className },
              subject: { stringValue: updatedData.subject || '' },
              studentsText: { stringValue: updatedData.studentsText },
              gameMode: { stringValue: updatedData.gameMode },
              teamCount: { integerValue: String(updatedData.teamCount) },
              teamsConfigJson: { stringValue: JSON.stringify(updatedData.teamsConfig) },
              updatedAt: { stringValue: updatedData.updatedAt },
            },
          }),
        }).catch(() => {});
      }
    } catch {}

    return {
      success: true,
      message: `Đã lưu vĩnh viễn dữ liệu "${updatedData.className}" vào hệ thống!`,
      savedClass: updatedData,
    };
  } catch (err: any) {
    console.error('Error saving class data:', err);
    return {
      success: false,
      message: 'Không thể lưu dữ liệu lớp học: ' + (err?.message || 'Lỗi không xác định'),
      savedClass: classData,
    };
  }
}

/**
 * Delete a class completely from LocalStorage, Server, and active selection
 */
export function deleteClassData(classId: string): SavedClassData[] {
  const classes = getSavedClassesFromLocalStorage();
  const filtered = classes.filter((c) => c.classId !== classId);
  saveClassesToLocalStorage(filtered, true);

  // Also remove classId from any SavedGradeGroup
  try {
    const groups = getSavedGradeGroupsFromLocalStorage();
    let updatedGroups = false;
    groups.forEach((g) => {
      if (g.classIds.includes(classId)) {
        g.classIds = g.classIds.filter((id) => id !== classId);
        updatedGroups = true;
      }
    });
    if (updatedGroups) {
      saveGradeGroupsToLocalStorage(groups, true);
    }
  } catch {}

  try {
    removePersistentItem(`${LOCAL_STORAGE_QUIZZES_KEY}_${classId}`);
    removePersistentItem(`${LOCAL_STORAGE_STATS_KEY}_${classId}`);
  } catch {}

  const activeId = getActiveClassId();
  if (activeId === classId) {
    if (filtered.length > 0) {
      setActiveClassId(filtered[0].classId);
    } else {
      setActiveClassId('');
    }
  }
  return filtered;
}

/**
 * QUẢN LÝ KHỐI LỚP (SavedGradeGroup)
 * Cho phép người dùng khai báo Khối lớp (VD: "Khối lớp 3") và thêm các lớp học hiện có (VD: 3A, 3B, 3C) vào Khối lớp đó.
 */
export function getSavedGradeGroupsFromLocalStorage(): SavedGradeGroup[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_GRADE_GROUPS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((g) => g && typeof g.gradeId === 'string' && typeof g.gradeName === 'string');
  } catch {
    return [];
  }
}

export function saveGradeGroupsToLocalStorage(
  groups: SavedGradeGroup[],
  forceOverwrite: boolean = false
): void {
  if (typeof window === 'undefined') return;
  try {
    setPersistentItem(LOCAL_STORAGE_GRADE_GROUPS_KEY, JSON.stringify(groups), forceOverwrite);
  } catch (err) {
    console.error('Failed to save grade groups:', err);
  }
}

/**
 * Lưu thông tin Khối lớp (thêm mới hoặc cập nhật) và gán danh sách các lớp học vào Khối lớp đó.
 */
export function saveGradeGroupData(params: {
  gradeId?: string;
  gradeName: string;
  classIds: string[];
}): {
  success: boolean;
  message: string;
  savedGrade: SavedGradeGroup;
  allGrades: SavedGradeGroup[];
} {
  const cleanName = params.gradeName.trim();
  const groups = getSavedGradeGroupsFromLocalStorage();
  const normName = normalizeLessonKey(cleanName);

  // Tìm xem đã có khối lớp trùng ID hoặc trùng tên chưa
  const existing =
    (params.gradeId && groups.find((g) => g.gradeId === params.gradeId)) ||
    groups.find((g) => normalizeLessonKey(g.gradeName) === normName);

  const resolvedGradeId =
    existing?.gradeId ||
    (params.gradeId && params.gradeId !== '__new__'
      ? params.gradeId
      : `grade-${normName.replace(/\s+/g, '-')}-${Date.now()}`);

  const uniqueClassIds = Array.from(new Set(params.classIds.filter(Boolean)));
  const savedGrade: SavedGradeGroup = {
    gradeId: resolvedGradeId,
    gradeName: cleanName,
    classIds: uniqueClassIds,
    updatedAt: new Date().toISOString(),
  };

  // Cập nhật danh sách Khối lớp (đảm bảo mỗi lớp học chỉ thuộc 1 Khối lớp duy nhất)
  const otherGroups = groups
    .filter((g) => g.gradeId !== resolvedGradeId)
    .map((g) => ({
      ...g,
      classIds: g.classIds.filter((cid) => !uniqueClassIds.includes(cid)),
    }));

  const allGrades = [savedGrade, ...otherGroups];
  saveGradeGroupsToLocalStorage(allGrades);

  // Đồng bộ gradeGroupId & gradeGroupName vào từng lớp học trong SavedClassData
  const classes = getSavedClassesFromLocalStorage();
  let classesUpdated = false;
  const extractedNum = extractGradeFromClass(cleanName);

  classes.forEach((cls) => {
    if (uniqueClassIds.includes(cls.classId)) {
      cls.gradeGroupId = savedGrade.gradeId;
      cls.gradeGroupName = savedGrade.gradeName;
      if (extractedNum !== null) cls.grade = extractedNum;
      classesUpdated = true;
    } else if (cls.gradeGroupId === savedGrade.gradeId) {
      cls.gradeGroupId = undefined;
      cls.gradeGroupName = undefined;
      classesUpdated = true;
    }
  });

  if (classesUpdated) {
    saveClassesToLocalStorage(classes);
  }

  const classNamesList = classes
    .filter((c) => uniqueClassIds.includes(c.classId))
    .map((c) => c.className)
    .join(', ');

  return {
    success: true,
    message: classNamesList
      ? `Đã lưu vĩnh viễn "${cleanName}" gồm các lớp: ${classNamesList}!`
      : `Đã lưu vĩnh viễn thông tin "${cleanName}" thành công!`,
    savedGrade,
    allGrades,
  };
}

/**
 * Xóa một Khối lớp đã lưu
 */
export function deleteGradeGroupData(gradeId: string): SavedGradeGroup[] {
  const groups = getSavedGradeGroupsFromLocalStorage();
  const filtered = groups.filter((g) => g.gradeId !== gradeId);
  saveGradeGroupsToLocalStorage(filtered, true);

  const classes = getSavedClassesFromLocalStorage();
  let updated = false;
  classes.forEach((cls) => {
    if (cls.gradeGroupId === gradeId) {
      cls.gradeGroupId = undefined;
      cls.gradeGroupName = undefined;
      updated = true;
    }
  });
  if (updated) {
    saveClassesToLocalStorage(classes, true);
  }

  try {
    removePersistentItem(`${LOCAL_STORAGE_QUIZZES_KEY}_GRADEGROUP_${gradeId}`);
  } catch {}

  return filtered;
}

/**
 * Tìm Khối lớp (SavedGradeGroup) mà lớp học hiện tại thuộc về
 */
export function findGradeGroupForClass(
  classId?: string,
  className?: string,
  explicitGradeGroupId?: string
): SavedGradeGroup | null {
  const groups = getSavedGradeGroupsFromLocalStorage();
  if (groups.length === 0) return null;

  // 1. Ưu tiên nếu truyền trực tiếp explicitGradeGroupId
  if (explicitGradeGroupId && explicitGradeGroupId !== '__new__') {
    const byExplicit = groups.find((g) => g.gradeId === explicitGradeGroupId);
    if (byExplicit) return byExplicit;
  }

  // 2. Tìm theo classId nằm trong danh sách classIds của Khối lớp
  if (classId && classId !== '__new__') {
    const byMember = groups.find((g) => g.classIds.includes(classId));
    if (byMember) return byMember;

    const classes = getSavedClassesFromLocalStorage();
    const clsObj = classes.find((c) => c.classId === classId);
    if (clsObj?.gradeGroupId) {
      const byClsProp = groups.find((g) => g.gradeId === clsObj.gradeGroupId);
      if (byClsProp) return byClsProp;
    }
  }

  // 3. Nếu người dùng gõ tên lớp trùng tên lớp đã nằm trong một Khối lớp
  if (className && className.trim()) {
    const classes = getSavedClassesFromLocalStorage();
    const normCls = normalizeLessonKey(className);
    const matchingSavedClass = classes.find((c) => normalizeLessonKey(c.className) === normCls);
    if (matchingSavedClass) {
      const bySavedMember = groups.find(
        (g) =>
          g.classIds.includes(matchingSavedClass.classId) ||
          g.gradeId === matchingSavedClass.gradeGroupId
      );
      if (bySavedMember) return bySavedMember;
    }
  }

  return null;
}

/**
 * Trích xuất số Khối (1 -> 12) từ tên lớp / tên khối (VD: "Lớp 3A", "3B", "Khối lớp 3" -> 3)
 */
export function extractGradeFromClass(className?: string, classId?: string): number | null {
  if (className && className.trim()) {
    const match =
      className.trim().match(/(?:lớp|khối|^|\s|-)(\d{1,2})(?:[a-zA-Z/_-\s]|$)/i) ||
      className.trim().match(/(\d{1,2})/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num >= 1 && num <= 12) {
        return num;
      }
    }
  }

  if (classId && typeof window !== 'undefined') {
    const grp = findGradeGroupForClass(classId, className);
    if (grp) {
      const grpMatch = grp.gradeName.match(/(\d{1,2})/);
      if (grpMatch) {
        const gNum = parseInt(grpMatch[1], 10);
        if (gNum >= 1 && gNum <= 12) return gNum;
      }
    }

    const classes = getSavedClassesFromLocalStorage();
    const found = classes.find((c) => c.classId === classId);
    if (found) {
      if (typeof found.grade === 'number' && found.grade >= 1 && found.grade <= 12) {
        return found.grade;
      }
      if (found.className) {
        const match = found.className.trim().match(/(\d{1,2})/);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num >= 1 && num <= 12) {
            return num;
          }
        }
      }
    }
  }

  return null;
}

/**
 * Lấy toàn bộ bộ câu hỏi đã lưu của đúng KHỐI LỚP và đúng MÔN HỌC hiện tại.
 * - Khi Lớp 3A thuộc "Khối lớp 3" lưu bộ câu hỏi môn "Tin học" -> Dùng chung cho 3A, 3B, 3C thuộc "Khối lớp 3" ở môn "Tin học".
 * - Khi chuyển sang môn học khác (VD: "Công nghệ", "Kỹ năng số", "Trí tuệ nhân tạo") hoặc Khối lớp khác -> TUYỆT ĐỐI KHÔNG hiển thị câu hỏi của môn khác hay khối lớp khác.
 */
export function getAllSavedQuizzesForClass(
  classId?: string,
  className?: string,
  subject?: string,
  explicitGradeGroupId?: string
): Record<string, SavedLessonQuiz> {
  if (typeof window === 'undefined') return {};
  const merged: Record<string, SavedLessonQuiz> = {};

  const classes = getSavedClassesFromLocalStorage();
  const matchedGradeGroup = findGradeGroupForClass(classId, className, explicitGradeGroupId);
  const gradeNum = extractGradeFromClass(
    matchedGradeGroup?.gradeName || className,
    classId
  );
  const targetSubjKey = subject !== undefined ? normalizeSubjectKey(subject) : '';

  const isQuizMatchingScopeAndSubject = (quiz: SavedLessonQuiz): boolean => {
    if (!quiz || !quiz.questions || quiz.questions.length === 0) return false;

    // 1. Kiểm tra MÔN HỌC nghiêm ngặt: Nếu đang chọn môn học cụ thể, chỉ lấy đúng bộ câu hỏi của môn học đó!
    if (subject !== undefined) {
      const quizSubjKey = quiz.normalizedSubject || normalizeSubjectKey(quiz.subject);
      if (!targetSubjKey || quizSubjKey !== targetSubjKey) {
        return false;
      }
    }

    // 2. Kiểm tra KHỐI LỚP nghiêm ngặt:
    if (matchedGradeGroup) {
      if (quiz.gradeGroupId) {
        return quiz.gradeGroupId === matchedGradeGroup.gradeId;
      }
      // Tương thích dữ liệu cũ lưu theo số khối nếu cùng số khối
      if (gradeNum !== null && quiz.grade !== undefined && quiz.grade !== null) {
        return quiz.grade === gradeNum;
      }
      return false;
    } else {
      // Nếu lớp hiện tại CHƯA gán vào Khối lớp nào đã khai báo:
      // Không lấy các bộ câu hỏi đã gắn cứng vào một Khối lớp khác
      if (quiz.gradeGroupId) {
        return false;
      }
      if (gradeNum !== null && quiz.grade !== undefined && quiz.grade !== null) {
        return quiz.grade === gradeNum;
      }
    }

    return true;
  };

  const mergeSource = (source?: Record<string, SavedLessonQuiz> | null) => {
    if (!source || typeof source !== 'object') return;
    for (const [k, v] of Object.entries(source)) {
      if (!isQuizMatchingScopeAndSubject(v)) continue;
      const existing = merged[k];
      if (!existing || (v.savedAt && (!existing.savedAt || v.savedAt >= existing.savedAt))) {
        merged[k] = {
          ...v,
          questions: sanitizeStoredQuestions(v.questions),
        };
      }
    }
  };

  try {
    // TH1: Lớp thuộc một Khối lớp đã khai báo (VD: Khối lớp 3 gồm 3A, 3B, 3C)
    if (matchedGradeGroup) {
      try {
        const rawGroup = localStorage.getItem(
          `${LOCAL_STORAGE_QUIZZES_KEY}_GRADEGROUP_${matchedGradeGroup.gradeId}`
        );
        if (rawGroup) mergeSource(JSON.parse(rawGroup));
      } catch {}

      matchedGradeGroup.classIds.forEach((memberId) => {
        const clsObj = classes.find((c) => c.classId === memberId);
        if (clsObj?.savedQuizzes) mergeSource(clsObj.savedQuizzes);
        try {
          const rawCls = localStorage.getItem(`${LOCAL_STORAGE_QUIZZES_KEY}_${memberId}`);
          if (rawCls) mergeSource(JSON.parse(rawCls));
        } catch {}
      });

      if (gradeNum !== null) {
        try {
          const rawGrade = localStorage.getItem(`${LOCAL_STORAGE_QUIZZES_KEY}_GRADE_${gradeNum}`);
          if (rawGrade) mergeSource(JSON.parse(rawGrade));
        } catch {}
      }
      return merged;
    }

    // TH2: Lớp chưa gán vào Khối lớp khai báo, kiểm tra theo số khối hoặc chính lớp đó
    if (gradeNum !== null) {
      classes.forEach((cls) => {
        if (cls.gradeGroupId) return; // Đã thuộc khối khai báo riêng thì không trộn
        const clsGrade = extractGradeFromClass(cls.className, cls.classId);
        if (clsGrade === gradeNum) {
          mergeSource(cls.savedQuizzes);
          try {
            const rawCls = localStorage.getItem(`${LOCAL_STORAGE_QUIZZES_KEY}_${cls.classId}`);
            if (rawCls) mergeSource(JSON.parse(rawCls));
          } catch {}
        }
      });

      try {
        const rawGrade = localStorage.getItem(`${LOCAL_STORAGE_QUIZZES_KEY}_GRADE_${gradeNum}`);
        if (rawGrade) mergeSource(JSON.parse(rawGrade));
      } catch {}
    }

    if (classId) {
      const found = classes.find((c) => c.classId === classId);
      if (found?.savedQuizzes) {
        mergeSource(found.savedQuizzes);
      }
      try {
        const raw = localStorage.getItem(`${LOCAL_STORAGE_QUIZZES_KEY}_${classId}`);
        if (raw) mergeSource(JSON.parse(raw));
      } catch {}
    }

    return merged;
  } catch {
    return merged;
  }
}

/**
 * Lấy danh sách các bộ câu hỏi duy nhất đã lưu của đúng (Khối lớp + Môn học) hiện tại
 */
export function getUniqueSavedQuizzesForGrade(
  classId?: string,
  className?: string,
  subject?: string,
  explicitGradeGroupId?: string
): SavedLessonQuiz[] {
  const allMap = getAllSavedQuizzesForClass(classId, className, subject, explicitGradeGroupId);
  const byTitleWeekSubject = new Map<string, SavedLessonQuiz>();

  for (const quiz of Object.values(allMap)) {
    if (!quiz || !quiz.questions || quiz.questions.length === 0) continue;
    const subjKey = quiz.normalizedSubject || normalizeSubjectKey(quiz.subject);
    const uniqueId = `${subjKey}__${normalizeLessonKey(quiz.lessonTitle)}__w${quiz.weekNumber || 0}`;
    const existing = byTitleWeekSubject.get(uniqueId);
    if (!existing || (quiz.savedAt && (!existing.savedAt || quiz.savedAt >= existing.savedAt))) {
      byTitleWeekSubject.set(uniqueId, quiz);
    }
  }

  return Array.from(byTitleWeekSubject.values()).sort((a, b) =>
    (b.savedAt || '').localeCompare(a.savedAt || '')
  );
}

/**
 * Lưu bộ câu hỏi thẳng vào KHỐI LỚP (VD: Khối lớp 3) và MÔN HỌC (VD: Tin học / Công nghệ / Kỹ năng số / Trí tuệ nhân tạo),
 * giúp tất cả các lớp thuộc Khối lớp đó (3A, 3B, 3C...) dùng chung chính xác tuyệt đối theo từng môn học!
 */
export function saveQuizForLessonAndClass(
  classId: string,
  lessonTitle: string,
  questions: Question[],
  subject = 'Tiếng Anh',
  inputKey?: string,
  weekNumber?: number,
  className?: string,
  explicitGradeGroupId?: string
): { success: boolean; message: string } {
  if (!lessonTitle.trim() || !questions || questions.length === 0) {
    return { success: false, message: 'Dữ liệu câu hỏi hoặc tên bài không hợp lệ để lưu' };
  }

  const effectiveClassId = classId || getActiveClassId() || `class-${Date.now()}`;
  const upperLessonTitle = lessonTitle.trim().toUpperCase();
  const cleanSubject = 'Tiếng Anh';
  const subjKey = normalizeSubjectKey(cleanSubject);
  const normKey = normalizeLessonKey(inputKey || lessonTitle);
  const fullNormKey = normalizeLessonKey(upperLessonTitle);
  const weekKey = weekNumber ? `tuan_${weekNumber}` : '';

  const classes = getSavedClassesFromLocalStorage();
  const sourceClassObj = classes.find((c) => c.classId === effectiveClassId);
  const resolvedClassName = className?.trim() || sourceClassObj?.className || '';

  const matchedGradeGroup = findGradeGroupForClass(
    effectiveClassId,
    resolvedClassName,
    explicitGradeGroupId
  );
  const gradeNum = extractGradeFromClass(
    matchedGradeGroup?.gradeName || resolvedClassName,
    effectiveClassId
  );

  try {
    const sanitizedQuestions = sanitizeStoredQuestions(questions);
    const quizEntry: SavedLessonQuiz = {
      lessonTitle: upperLessonTitle,
      normalizedKey: normKey,
      subject: cleanSubject,
      normalizedSubject: subjKey,
      weekNumber,
      grade: gradeNum,
      gradeGroupId: matchedGradeGroup?.gradeId,
      gradeGroupName: matchedGradeGroup?.gradeName,
      sourceClassName: resolvedClassName || undefined,
      questions: sanitizedQuestions,
      savedAt: new Date().toISOString(),
    };

    const keyPrefix = subjKey ? `${subjKey}__` : '';
    const assignKeys = (targetMap: Record<string, SavedLessonQuiz>) => {
      if (normKey) targetMap[`${keyPrefix}${normKey}`] = quizEntry;
      if (fullNormKey && fullNormKey !== normKey) {
        targetMap[`${keyPrefix}${fullNormKey}`] = quizEntry;
      }
      if (weekKey) {
        targetMap[`${keyPrefix}${weekKey}`] = quizEntry;
      }
    };

    // 1. Lưu vào Kho của Khối lớp đã khai báo (VD: Khối lớp 3 -> dùng chung cho 3A, 3B, 3C)
    if (matchedGradeGroup) {
      let groupQuizzes: Record<string, SavedLessonQuiz> = {};
      const grpKey = `${LOCAL_STORAGE_QUIZZES_KEY}_GRADEGROUP_${matchedGradeGroup.gradeId}`;
      try {
        const rawGroup = localStorage.getItem(grpKey);
        if (rawGroup) groupQuizzes = JSON.parse(rawGroup);
      } catch {}
      assignKeys(groupQuizzes);
      setPersistentItem(grpKey, JSON.stringify(groupQuizzes));
    }

    // 2. Lưu cho classId hiện tại
    let currentClsQuizzes: Record<string, SavedLessonQuiz> = {};
    const clsQuizKey = `${LOCAL_STORAGE_QUIZZES_KEY}_${effectiveClassId}`;
    try {
      const rawCurrent = localStorage.getItem(clsQuizKey);
      if (rawCurrent) currentClsQuizzes = JSON.parse(rawCurrent);
    } catch {}
    assignKeys(currentClsQuizzes);
    setPersistentItem(clsQuizKey, JSON.stringify(currentClsQuizzes));

    // 3. Lưu vào Kho theo số Khối (nếu có)
    if (gradeNum !== null) {
      let gradeQuizzes: Record<string, SavedLessonQuiz> = {};
      const numGradeKey = `${LOCAL_STORAGE_QUIZZES_KEY}_GRADE_${gradeNum}`;
      try {
        const rawGrade = localStorage.getItem(numGradeKey);
        if (rawGrade) gradeQuizzes = JSON.parse(rawGrade);
      } catch {}
      assignKeys(gradeQuizzes);
      setPersistentItem(numGradeKey, JSON.stringify(gradeQuizzes));
    }

    // 4. Đồng bộ cho tất cả các lớp thuộc cùng Khối lớp (VD: 3A, 3B, 3C trong Khối lớp 3)
    let updatedClasses = false;
    classes.forEach((cls) => {
      const isSameClass = cls.classId === effectiveClassId;
      const isMemberOfGradeGroup =
        matchedGradeGroup !== null &&
        (matchedGradeGroup.classIds.includes(cls.classId) ||
          cls.gradeGroupId === matchedGradeGroup.gradeId);
      const clsGrade = extractGradeFromClass(cls.className, cls.classId);
      const isSameNumericGrade =
        !matchedGradeGroup && !cls.gradeGroupId && gradeNum !== null && clsGrade === gradeNum;

      if (isSameClass || isMemberOfGradeGroup || isSameNumericGrade) {
        if (!cls.savedQuizzes) {
          cls.savedQuizzes = {};
        }
        assignKeys(cls.savedQuizzes);

        if (isSameClass) {
          cls.lastLessonTitle = upperLessonTitle;
          if (weekNumber) cls.lastWeek = weekNumber;
          if (cleanSubject) cls.subject = cleanSubject;
          cls.updatedAt = new Date().toISOString();
        } else {
          try {
            let siblingQuizzes: Record<string, SavedLessonQuiz> = {};
            const sibKey = `${LOCAL_STORAGE_QUIZZES_KEY}_${cls.classId}`;
            const rawSibling = localStorage.getItem(sibKey);
            if (rawSibling) siblingQuizzes = JSON.parse(rawSibling);
            assignKeys(siblingQuizzes);
            setPersistentItem(sibKey, JSON.stringify(siblingQuizzes));
          } catch {}
        }
        updatedClasses = true;
      }
    });

    if (updatedClasses) {
      saveClassesToLocalStorage(classes);
    }

    const scopeLabel = matchedGradeGroup
      ? ` vào "${matchedGradeGroup.gradeName}" (Môn ${cleanSubject})`
      : gradeNum !== null
      ? ` vào Khối ${gradeNum} (Môn ${cleanSubject})`
      : ` (Môn ${cleanSubject})`;

    return {
      success: true,
      message: `Đã lưu vĩnh viễn bộ ${questions.length} câu hỏi bài "${upperLessonTitle}"${scopeLabel}!`,
    };
  } catch (err: any) {
    console.error('Error saving quiz for lesson:', err);
    return { success: false, message: 'Không thể lưu câu hỏi: ' + err.message };
  }
}

/**
 * Tìm bộ câu hỏi đã lưu theo đúng (KHỐI LỚP + MÔN HỌC + Tên bài học / Tuần học).
 * Đảm bảo khi chuyển sang Khối lớp khác hoặc Môn học khác sẽ KHÔNG hiển thị kết quả của môn học khác!
 */
export function findSavedQuizForLesson(
  classId: string,
  lessonTitle: string,
  className?: string,
  weekNumber?: number,
  subject?: string,
  explicitGradeGroupId?: string
): SavedLessonQuiz | null {
  const quizzes = getAllSavedQuizzesForClass(
    classId,
    className,
    subject,
    explicitGradeGroupId
  );
  if (Object.keys(quizzes).length === 0) return null;

  const normKey = normalizeLessonKey(lessonTitle);
  const subjKey = subject ? normalizeSubjectKey(subject) : '';
  const keyPrefix = subjKey ? `${subjKey}__` : '';

  // 1. Nếu có nhập tên bài học: Tìm chính xác theo tên bài học trong phạm vi (Khối lớp + Môn học)
  if (normKey) {
    if (keyPrefix && quizzes[`${keyPrefix}${normKey}`]) {
      return quizzes[`${keyPrefix}${normKey}`];
    }
    if (quizzes[normKey]) {
      return quizzes[normKey];
    }

    const strippedNorm = normKey.replace(/\s+/g, '');
    for (const [key, value] of Object.entries(quizzes)) {
      const cleanKey = keyPrefix && key.startsWith(keyPrefix) ? key.slice(keyPrefix.length) : key;
      if (cleanKey === normKey || cleanKey.replace(/\s+/g, '') === strippedNorm) {
        return value;
      }
    }

    for (const [key, value] of Object.entries(quizzes)) {
      const cleanKey = keyPrefix && key.startsWith(keyPrefix) ? key.slice(keyPrefix.length) : key;
      const valTitleNorm = normalizeLessonKey(value.lessonTitle || '');
      if (
        normKey.length >= 4 &&
        (cleanKey === normKey ||
          cleanKey.startsWith(normKey + ' ') ||
          normKey.startsWith(cleanKey + ' ') ||
          valTitleNorm === normKey ||
          valTitleNorm.startsWith(normKey + ' ') ||
          normKey.startsWith(valTitleNorm + ' '))
      ) {
        return value;
      }
    }
  }

  // 2. Nếu tìm theo Tuần học của cùng (Khối lớp + Môn học) khi chưa nhập tên bài học
  if (weekNumber && !normKey) {
    const weekKey = `tuan_${weekNumber}`;
    if (keyPrefix && quizzes[`${keyPrefix}${weekKey}`]) {
      return quizzes[`${keyPrefix}${weekKey}`];
    }
    if (quizzes[weekKey]) {
      return quizzes[weekKey];
    }
    for (const value of Object.values(quizzes)) {
      if (value && value.weekNumber === weekNumber) {
        return value;
      }
    }
  }

  return null;
}

/**
 * Xóa bộ câu hỏi đã lưu của bài học trong phạm vi (Khối lớp + Môn học) hiện tại
 */
export function deleteSavedQuizForLesson(
  classId: string,
  lessonTitle: string,
  className?: string,
  weekNumber?: number,
  subject?: string,
  explicitGradeGroupId?: string
): { success: boolean; message: string } {
  if (!lessonTitle.trim() && !weekNumber) {
    return { success: false, message: 'Chưa chọn tên bài học hoặc tuần học để xóa bộ câu hỏi!' };
  }

  const normKey = normalizeLessonKey(lessonTitle);
  const strippedNorm = normKey.replace(/\s+/g, '');
  const weekKey = weekNumber ? `tuan_${weekNumber}` : '';
  const targetSubjKey = subject ? normalizeSubjectKey(subject) : '';
  const matchedGradeGroup = findGradeGroupForClass(classId, className, explicitGradeGroupId);
  const gradeNum = extractGradeFromClass(matchedGradeGroup?.gradeName || className, classId);

  try {
    const targetQuiz = findSavedQuizForLesson(
      classId,
      lessonTitle,
      className,
      weekNumber,
      subject,
      explicitGradeGroupId
    );
    const targetTitleNorm = targetQuiz ? normalizeLessonKey(targetQuiz.lessonTitle) : '';
    const deletedTitle = targetQuiz?.lessonTitle
      ? targetQuiz.lessonTitle.toUpperCase()
      : lessonTitle.trim().toUpperCase();

    let deletedCount = 0;

    const cleanQuizMap = (mapObj?: Record<string, SavedLessonQuiz> | null) => {
      if (!mapObj) return;
      for (const [key, val] of Object.entries(mapObj)) {
        if (!val) continue;
        // Nếu có chỉ định môn học, chỉ xóa đúng môn học đó, không ảnh hưởng môn khác
        if (targetSubjKey) {
          const valSubjKey = val.normalizedSubject || normalizeSubjectKey(val.subject);
          if (valSubjKey && valSubjKey !== targetSubjKey) continue;
        }

        const cleanKey = key.includes('__') ? key.split('__').slice(1).join('__') : key;
        const valNorm = normalizeLessonKey(val.lessonTitle || '');
        const matchByTitle =
          normKey &&
          (cleanKey === normKey ||
            cleanKey.replace(/\s+/g, '') === strippedNorm ||
            (targetTitleNorm && (cleanKey === targetTitleNorm || valNorm === targetTitleNorm)) ||
            (normKey.length >= 4 &&
              (cleanKey.startsWith(normKey + ' ') || valNorm.startsWith(normKey + ' '))));
        const matchByWeek =
          !normKey &&
          weekKey &&
          (cleanKey === weekKey || (val.weekNumber && val.weekNumber === weekNumber));

        if (matchByTitle || matchByWeek) {
          delete mapObj[key];
          deletedCount++;
        }
      }
    };

    // 1. Xóa trong kho của Khối lớp khai báo
    if (matchedGradeGroup) {
      const grpKey = `${LOCAL_STORAGE_QUIZZES_KEY}_GRADEGROUP_${matchedGradeGroup.gradeId}`;
      const rawGroup = localStorage.getItem(grpKey);
      if (rawGroup) {
        const parsedGroup = JSON.parse(rawGroup);
        cleanQuizMap(parsedGroup);
        setPersistentItem(grpKey, JSON.stringify(parsedGroup), true);
      }
    }

    // 2. Xóa trong classId hiện tại
    if (classId) {
      const clsKey = `${LOCAL_STORAGE_QUIZZES_KEY}_${classId}`;
      const raw = localStorage.getItem(clsKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        cleanQuizMap(parsed);
        setPersistentItem(clsKey, JSON.stringify(parsed), true);
      }
    }

    // 3. Xóa trong kho chung theo số Khối
    if (gradeNum !== null) {
      const numKey = `${LOCAL_STORAGE_QUIZZES_KEY}_GRADE_${gradeNum}`;
      const rawGrade = localStorage.getItem(numKey);
      if (rawGrade) {
        const parsedGrade = JSON.parse(rawGrade);
        cleanQuizMap(parsedGrade);
        setPersistentItem(numKey, JSON.stringify(parsedGrade), true);
      }
    }

    // 4. Xóa trong tất cả các lớp cùng Khối lớp
    const classes = getSavedClassesFromLocalStorage();
    classes.forEach((cls) => {
      const isMember =
        matchedGradeGroup !== null &&
        (matchedGradeGroup.classIds.includes(cls.classId) ||
          cls.gradeGroupId === matchedGradeGroup.gradeId);
      const clsGrade = extractGradeFromClass(cls.className, cls.classId);
      if (
        cls.classId === classId ||
        isMember ||
        (!matchedGradeGroup && gradeNum !== null && clsGrade === gradeNum)
      ) {
        cleanQuizMap(cls.savedQuizzes);
        try {
          const sibKey = `${LOCAL_STORAGE_QUIZZES_KEY}_${cls.classId}`;
          const rawCls = localStorage.getItem(sibKey);
          if (rawCls) {
            const parsedCls = JSON.parse(rawCls);
            cleanQuizMap(parsedCls);
            setPersistentItem(sibKey, JSON.stringify(parsedCls), true);
          }
        } catch {}
      }
    });
    saveClassesToLocalStorage(classes, true);

    if (deletedCount > 0) {
      return {
        success: true,
        message: `Đã xóa vĩnh viễn bộ câu hỏi đã lưu của bài "${deletedTitle}"${subject ? ` (Môn ${subject})` : ''}!`,
      };
    }

    return {
      success: false,
      message: `Không tìm thấy bộ câu hỏi đã lưu nào cho bài "${deletedTitle}".`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: 'Lỗi khi xóa bộ câu hỏi: ' + (err?.message || 'Không xác định'),
    };
  }
}
