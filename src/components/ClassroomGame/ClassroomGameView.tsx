import React, { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { ChickPickerArena } from './ChickPickerArena';
import { AncientForestRopeClimb } from './AncientForestRopeClimb';
import { QuestionHUD } from './QuestionHUD';
import { FeedbackModal } from './FeedbackModal';
import { VictoryPodium } from './VictoryPodium';
import { RaceSetupModal } from './RaceSetupModal';
import { WeeklyLeaderboard } from '../TeacherDashboard/WeeklyLeaderboard';
import { SettingsModal } from '../SettingsModal';
import {
  Volume2,
  VolumeX,
  Play,
  RotateCcw,
  LayoutDashboard,
  Maximize2,
  Minimize2,
  Settings,
  SlidersHorizontal,
  Flag,
  Save,
  Trash2,
  CheckCircle2,
  BarChart3,
  X,
} from 'lucide-react';
import {
  saveQuizForLessonAndClass,
  deleteSavedQuizForLesson,
  getActiveClassId,
} from '../../services/classroomStorageService';

export const ClassroomGameView: React.FC = () => {
  const {
    selectedWeek,
    currentQuiz,
    currentClass,
    activeQuestionIndex,
    gameState,
    currentQuestion,
    gameMode,
    racers,
    students,
    currentRacerIndex,
    selectedStudentName,
    studentCallCounts,
    sessionStudentRecords,
    lastFeedback,
    winnerRacer,
    isMuted,
    isSettingsOpen,
    isSetupOpen,
    openSettings,
    closeSettings,
    openSetup,
    closeSetup,
    setViewMode,
    selectStudentToAnswer,
    setCurrentRacerIndex,
    setupRace,
    startRace,
    resetRace,
    answerQuestion,
    closeFeedback,
    toggleSound,
  } = useGameStore();

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
  const [quizToast, setQuizToast] = useState<{ text: string; type: 'success' | 'info' } | null>(null);

  const handleSaveCurrentQuiz = () => {
    if (!currentQuiz || !currentQuiz.questions || currentQuiz.questions.length === 0) {
      return;
    }
    const classId = currentClass?.id || getActiveClassId() || 'class-active';
    const upperTitle = (currentQuiz.lessonTitle || 'ENGLISH LESSON').toUpperCase();
    saveQuizForLessonAndClass(
      classId,
      upperTitle,
      currentQuiz.questions,
      currentQuiz.subject,
      upperTitle,
      selectedWeek,
      currentClass?.name
    );
    setQuizToast({
      text: `Saved English quiz "${upperTitle}" for ${currentClass?.name || 'Class'}!`,
      type: 'success',
    });
    setTimeout(() => setQuizToast(null), 4500);
  };

  const handleDeleteCurrentSavedQuiz = () => {
    if (!currentQuiz || !currentQuiz.lessonTitle) return;
    const classId = currentClass?.id || getActiveClassId() || 'class-active';
    const upperTitle = currentQuiz.lessonTitle.toUpperCase();
    deleteSavedQuizForLesson(
      classId,
      upperTitle,
      currentClass?.name,
      selectedWeek,
      currentQuiz.subject
    );
    setQuizToast({
      text: `Deleted saved quiz for "${upperTitle}"!`,
      type: 'info',
    });
    setTimeout(() => setQuizToast(null), 4500);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
        setIsFullscreen(false);
      }
    }
  };

  const activeRacer = racers[currentRacerIndex] || racers[0];
  const displayLessonTitle = (currentQuiz?.lessonTitle || 'PRIMARY ENGLISH REVIEW').toUpperCase();

  const handleReturnToStartScreen = () => {
    setIsStatsModalOpen(false);
    closeSetup();
    closeSettings();
    resetRace();
    setViewMode('classroom');
  };

  return (
    <div className="relative w-full h-[100dvh] max-h-[100dvh] bg-slate-950 overflow-hidden flex flex-col font-sans select-none">
      {/* Toast Notification when user saves or deletes current quiz */}
      {quizToast && (
        <div
          className={`fixed top-14 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl shadow-2xl text-xs sm:text-sm font-bold flex items-center gap-2.5 animate-in fade-in slide-in-from-top-3 border-2 ${
            quizToast.type === 'success'
              ? 'bg-emerald-950/95 border-emerald-400 text-emerald-200'
              : 'bg-rose-950/95 border-rose-400 text-rose-200'
          }`}
        >
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{quizToast.text}</span>
        </div>
      )}

      {/* 1. TOP HEADER BAR */}
      <header className="z-30 shrink-0 bg-slate-900 border-b border-slate-800 px-2 py-1.5 sm:px-4 sm:py-2 flex items-center justify-between gap-2 shadow-md">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={handleReturnToStartScreen}
            title="Click to return to the main start screen"
            className="group flex items-center gap-2 min-w-0 pr-2 sm:pr-3 border-r border-slate-800 text-left hover:opacity-95 transition-all cursor-pointer rounded-xl focus:outline-none"
          >
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-amber-400 text-slate-950 flex items-center justify-center text-base sm:text-lg font-black shadow shrink-0 group-hover:scale-105 transition-transform">
              🌲
            </div>
            <div className="min-w-0">
              <div className="text-xs sm:text-sm font-black text-white group-hover:text-amber-300 tracking-wide leading-tight truncate transition-colors">
                CONQUER THE PEAK OF KNOWLEDGE • PRIMARY ENGLISH
              </div>
              <div className="text-[10px] sm:text-[11px] font-bold text-amber-300 leading-tight truncate">
                Developed by Teacher Van Thi Thuy Trang
              </div>
            </div>
          </button>

          <div className="hidden md:flex items-center gap-2 min-w-0">
            <span className="bg-amber-400 text-slate-950 text-[10px] sm:text-xs font-black px-2 py-0.5 rounded-lg shrink-0">
              WEEK {selectedWeek}
            </span>
            <div className="min-w-0">
              <h1
                className="text-xs sm:text-sm font-black text-emerald-300 uppercase truncate max-w-[160px] lg:max-w-md tracking-wide"
                title={displayLessonTitle}
              >
                {displayLessonTitle}
              </h1>
              <div className="text-[10px] text-slate-300 flex items-center gap-1.5">
                <span>Subject: Primary English •</span>
                <span className="text-slate-400 font-bold">
                  {gameMode === 'individual'
                    ? `Individual (${racers.length} Students)`
                    : `Team Mode (${racers.length} Teams)`}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {currentQuiz && currentQuiz.questions && currentQuiz.questions.length > 0 && (
            <>
              <button
                onClick={handleSaveCurrentQuiz}
                title="Save this English quiz for this lesson and class"
                className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 shadow-md transition-all cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Save Quiz</span>
              </button>

              <button
                onClick={handleDeleteCurrentSavedQuiz}
                title="Delete saved quiz for this lesson"
                className="px-2 py-1.5 rounded-xl bg-rose-900/90 hover:bg-rose-800 border border-rose-500/60 text-rose-200 font-bold text-xs flex items-center gap-1 shadow-md transition-all cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden xl:inline">Delete Saved Quiz</span>
              </button>
            </>
          )}

          <button
            onClick={() => setIsStatsModalOpen(true)}
            title="View Weekly & Cumulative Leaderboard"
            className="px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1 shadow-md transition-all cursor-pointer"
          >
            <BarChart3 className="w-3.5 h-3.5 text-amber-300" />
            <span className="hidden sm:inline">Leaderboard &amp; Stats</span>
          </button>

          <button
            onClick={openSetup}
            title="Lesson, Team & Quiz Setup"
            className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-slate-950 font-black text-xs flex items-center gap-1 shadow-md transition-all cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Lesson &amp; Team Setup</span>
          </button>

          <button
            onClick={openSettings}
            title="Gemini API Key Settings"
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center justify-center text-slate-200 hover:text-white transition-colors cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5 text-amber-400" />
          </button>

          <button
            onClick={toggleSound}
            title={isMuted ? 'Unmute Sound' : 'Mute Sound (Loud Classroom Mode Active)'}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center justify-center text-slate-200 hover:text-white transition-colors cursor-pointer"
          >
            {isMuted ? (
              <VolumeX className="w-3.5 h-3.5 text-rose-400" />
            ) : (
              <Volume2 className="w-3.5 h-3.5 text-amber-400" />
            )}
          </button>

          <button
            onClick={toggleFullscreen}
            title="Toggle Fullscreen"
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center justify-center text-slate-200 hover:text-white transition-colors cursor-pointer hidden md:flex"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={resetRace}
            title="Reset Game"
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center justify-center text-slate-200 hover:text-white transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setViewMode('dashboard')}
            className="px-2 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs flex items-center gap-1 border border-slate-700 cursor-pointer"
            title="Teacher Dashboard & 35-Week Statistics"
          >
            <LayoutDashboard className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden xl:inline">Dashboard</span>
          </button>
        </div>
      </header>

      {/* 2. GAMEPLAY LAYOUT:
          - Left 60%-62%: Expanded English Question, Visual Illustration & Large Options (A, B, C, D) so students sitting far away can read clearly
          - Right 38%-40% (Narrowed):
            + Top: 3D Dense Forest Cat Catching Mouse — Student Picker Arena
            + Bottom: Ancient Forest 10-Hook Rope Climb */}
      <div className="flex-1 w-full h-full flex flex-col lg:flex-row gap-2.5 p-2 overflow-y-auto lg:overflow-hidden relative min-h-0 bg-slate-950">
        {/* LEFT COLUMN (EXPANDED TO 60-62% WIDTH): QUESTION & OPTIONS (A, B, C, D) */}
        <div className="w-full lg:w-[60%] xl:w-[62%] lg:h-full shrink-0 flex flex-col min-h-[440px] lg:min-h-0 z-20">
          {currentQuestion && gameState === 'question' ? (
            <QuestionHUD
              question={currentQuestion}
              activeRacer={activeRacer}
              selectedStudentName={selectedStudentName}
              studentCallCount={
                selectedStudentName
                  ? studentCallCounts[selectedStudentName.trim().toLowerCase().replace(/\s+/g, ' ')] || 1
                  : 1
              }
              lessonTitle={displayLessonTitle}
              questionNumber={activeQuestionIndex + 1}
              totalQuestions={currentQuiz?.questions?.length || 1}
              onAnswer={answerQuestion}
              combo={activeRacer?.combo || 0}
            />
          ) : (
            <div className="w-full h-full bg-slate-900/95 border-2 border-amber-400/75 rounded-2xl p-6 flex flex-col items-center justify-center text-center gap-4 shadow-2xl">
              <Flag className="w-12 h-12 text-amber-400" />
              <div className="text-sm font-black text-amber-300 uppercase tracking-wider">
                Primary School English • Large Classroom Display
              </div>
              <div className="font-black text-xl sm:text-2xl lg:text-3xl text-white uppercase">
                {currentQuiz ? displayLessonTitle : 'NO ENGLISH QUIZ SELECTED YET'}
              </div>
              <p className="text-sm sm:text-base text-slate-300 max-w-xl leading-relaxed">
                {currentQuiz
                  ? 'English questions with visual illustrations and 4 large options (A, B, C, D) will appear here in high-visibility classroom size.'
                  : 'Please click "LESSON & TEAM SETUP" to generate an English quiz with AI or upload your own .DOCX question set.'}
              </p>
              <button
                onClick={currentQuiz ? startRace : openSetup}
                className="py-3 px-6 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded-xl cursor-pointer shadow-lg text-sm sm:text-base"
              >
                {currentQuiz ? 'START GAME' : 'LESSON & TEAM SETUP'}
              </button>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN (NARROWED TO 38-40% WIDTH): TOP = 3D FOREST CAT CATCHING MOUSE • BOTTOM = 10-HOOK ROPE CLIMB */}
        <div className="w-full lg:w-[40%] xl:w-[38%] lg:h-full flex-1 flex flex-col gap-2 min-w-0 min-h-0 overflow-hidden">
          {/* TOP: 3D DENSE FOREST CAT CATCHING MOUSE — STUDENT PICKER */}
          <div className="w-full h-[230px] sm:h-[250px] lg:h-[46%] shrink-0 overflow-hidden">
            <ChickPickerArena
              gameMode={gameMode}
              racers={racers}
              students={students}
              currentRacerIndex={currentRacerIndex}
              selectedStudentName={selectedStudentName}
              studentCallCounts={studentCallCounts}
              onSelectStudent={(studentName, racerIdx) =>
                selectStudentToAnswer(studentName, racerIdx)
              }
              onSelectTeamFilter={(racerIdx) => setCurrentRacerIndex(racerIdx)}
            />
          </div>

          {/* BOTTOM: ANCIENT FOREST 10-HOOK ROPE CLIMB */}
          <div className="w-full flex-1 min-h-[210px] lg:min-h-0 overflow-hidden rounded-2xl border-2 border-emerald-500/50 shadow-xl">
            <AncientForestRopeClimb
              racers={racers}
              activeRacerIndex={currentRacerIndex}
              selectedStudentName={selectedStudentName}
            />
          </div>
        </div>

        {/* Idle Welcome Overlay before game starts */}
        {gameState === 'idle' && (
          <div className="absolute inset-0 z-30 bg-slate-950/75 flex items-center justify-center p-3">
            <div className="bg-slate-900/95 border-2 border-amber-400 rounded-3xl p-5 sm:p-7 max-w-lg text-center text-white shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="text-3xl mb-1">🌊🐊🧒 🌳🧗🏆</div>
              <div className="text-xs font-black text-amber-400 uppercase tracking-wider mb-1">
                {displayLessonTitle}
              </div>
              <h3 className="text-lg sm:text-xl font-black mb-1.5 text-white">
                3D LAKE CROCODILE ASHORE (CÁ SẤU LÊN BỜ) &amp; 10-HOOK CLIMB!
              </h3>
              <p className="text-slate-300 text-xs mb-4 leading-relaxed text-left">
                • <strong>Expanded Left Panel (62% width):</strong> Large, high-contrast English questions with visual illustrations either in the Question or in the 4 Options (A, B, C, D) depending on question content.
                <br />• <strong>Top-Right 3D Lake Arena (Cá Sấu Lên Bờ):</strong> Each student stands on a small floating mat and dips their legs into the 3D lake while the Crocodile swims with realistic water splash sounds to catch a student randomly!
                <br />• <strong>Bottom-Right 10-Hook Rope Climb:</strong> Clear, wide columns with horizontal scrolling for{' '}
                <strong className="text-amber-400">
                  {gameMode === 'individual' ? `${racers.length} students` : `${racers.length} teams`}
                </strong>
                . Correct answer: Climb +1 Hook (+10 pts). Wrong answer: Drop -1 Hook (-10 pts)!
              </p>

              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={startRace}
                  className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-orange-500/30 cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-slate-950" />
                  <span>START GAME NOW</span>
                </button>

                <button
                  onClick={openSetup}
                  className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
                  <span>Lesson &amp; Team Setup</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Feedback Modal */}
        {gameState === 'feedback' && lastFeedback && (
          <FeedbackModal
            isCorrect={lastFeedback.isCorrect}
            teamName={lastFeedback.racerName}
            studentName={lastFeedback.studentName}
            previousHookLevel={lastFeedback.previousHookLevel}
            hookLevel={lastFeedback.hookLevel}
            hookDelta={lastFeedback.hookDelta}
            pointsDelta={lastFeedback.pointsDelta}
            responseTimeSec={lastFeedback.responseTimeSec}
            totalCorrectCount={lastFeedback.totalCorrectCount}
            totalTimeSec={lastFeedback.totalTimeSec}
            studentCallCount={lastFeedback.studentCallCount}
            correctAnswerText={lastFeedback.correctAnswerText}
            explanation={lastFeedback.explanation}
            isNitroTriggered={lastFeedback.isNitroTriggered}
            questionNumber={activeQuestionIndex + 1}
            totalQuestions={currentQuiz?.questions?.length || 1}
            onContinue={closeFeedback}
          />
        )}

        {/* Victory Podium */}
        {gameState === 'finished' && winnerRacer && (
          <VictoryPodium
            winner={winnerRacer}
            allRacers={racers}
            gameMode={gameMode}
            sessionStudentRecords={sessionStudentRecords}
            totalQuestions={currentQuiz?.questions?.length || 1}
            lessonTitle={displayLessonTitle}
            onRestart={startRace}
            onReturnHome={handleReturnToStartScreen}
            onGoToDashboard={() => setIsStatsModalOpen(true)}
          />
        )}

        {/* Quick Statistics Modal */}
        {isStatsModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-5 overflow-y-auto">
            <div className="bg-slate-950 border-2 border-amber-400 w-full max-w-6xl rounded-3xl p-4 sm:p-6 shadow-2xl text-white max-h-[94dvh] flex flex-col">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-black text-lg">
                    📊
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-white">
                      INDIVIDUAL &amp; TEAM LEADERBOARD (WEEKLY &amp; CUMULATIVE)
                    </h3>
                    <p className="text-xs text-slate-300">
                      Automatically recorded from Week 1 up to Week {selectedWeek}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsStatsModalOpen(false)}
                  className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto pr-1">
                <WeeklyLeaderboard />
              </div>
            </div>
          </div>
        )}

        {/* Setup Modal */}
        <RaceSetupModal
          isOpen={isSetupOpen}
          onClose={closeSetup}
          onStartGame={setupRace}
        />

        {/* Global Settings Modal for API Key */}
        <SettingsModal isOpen={isSettingsOpen} onClose={closeSettings} />
      </div>
    </div>
  );
};
