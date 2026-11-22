import React, { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { getAvailableClassesForStatistics } from '../../services/classroomStorageService';
import { Trophy, Users, Calendar, Download, RotateCcw, Award, Clock, CheckCircle2 } from 'lucide-react';

export const WeeklyLeaderboard: React.FC = () => {
  const {
    currentClass,
    selectedWeek,
    getLeaderboard,
    getTeamLeaderboard,
    resetClassStatistics,
  } = useGameStore();

  const availableClasses = getAvailableClassesForStatistics();
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>(currentClass.id || '4A');
  const [startWeek, setStartWeek] = useState<number>(1);
  const [endWeek, setEndWeek] = useState<number>(selectedWeek || 35);
  const [confirmReset, setConfirmReset] = useState(false);

  const selectedClassObj = availableClasses.find((c) => c.classId === selectedClassFilter);
  const displayClassName = selectedClassObj?.className || currentClass.name || '4A';

  const studentEntries = getLeaderboard(endWeek, startWeek, endWeek, selectedClassFilter);
  const teamEntries = getTeamLeaderboard(endWeek, startWeek, endWeek, selectedClassFilter);

  const handleExportCsv = () => {
    const header = 'Rank,Student,Class,Team,Hooks,TotalPoints,CorrectAnswers,TotalTurns,TimeSeconds';
    const rows = studentEntries.map((item, idx) => {
      const attempts = item.rangeCorrect + item.rangeWrong;
      return `${idx + 1},"${item.studentName}","${displayClassName}","${item.teamName}",${item.rangeHooks},${item.rangeScore},${item.rangeCorrect},${attempts},${item.rangeTimeSec}`;
    });
    const csv = '\uFEFF' + [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `English_Leaderboard_Class_${displayClassName}_Week_${startWeek}_${endWeek}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80 flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 font-black text-xs uppercase tracking-wider mb-1">
            Primary School English • Developed by Teacher Van Thi Thuy Trang
          </span>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Trophy className="w-6 h-6 text-amber-500" />
            WEEKLY &amp; CUMULATIVE LEADERBOARD — CLASS {displayClassName}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Class selector */}
          <div className="flex items-center gap-2 bg-slate-100 px-3 py-2 rounded-xl">
            <Users className="w-4 h-4 text-slate-500" />
            <span className="text-xs font-bold text-slate-600">Class:</span>
            <select
              value={selectedClassFilter}
              onChange={(e) => setSelectedClassFilter(e.target.value)}
              className="bg-transparent text-xs font-black text-slate-900 focus:outline-none"
            >
              {availableClasses.length === 0 ? (
                <option value={currentClass.id}>{currentClass.name}</option>
              ) : (
                availableClasses.map((cls) => (
                  <option key={cls.classId} value={cls.classId}>
                    {cls.className}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Week range selector */}
          <div className="flex items-center gap-2 bg-slate-100 px-3 py-2 rounded-xl">
            <Calendar className="w-4 h-4 text-slate-500" />
            <span className="text-xs font-bold text-slate-600">From:</span>
            <select
              value={startWeek}
              onChange={(e) => setStartWeek(Number(e.target.value))}
              className="bg-transparent text-xs font-black text-slate-900 focus:outline-none"
            >
              {Array.from({ length: 35 }, (_, i) => i + 1).map((w) => (
                <option key={w} value={w}>
                  Week {w}
                </option>
              ))}
            </select>
            <span className="text-xs font-bold text-slate-600">to</span>
            <select
              value={endWeek}
              onChange={(e) => setEndWeek(Number(e.target.value))}
              className="bg-transparent text-xs font-black text-slate-900 focus:outline-none"
            >
              {Array.from({ length: 35 }, (_, i) => i + 1).map((w) => (
                <option key={w} value={w}>
                  Week {w}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleExportCsv}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>

          {!confirmReset ? (
            <button
              onClick={() => setConfirmReset(true)}
              className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs flex items-center gap-1.5 border border-rose-200 transition-all cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset Class Stats
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  resetClassStatistics(selectedClassFilter);
                  setConfirmReset(false);
                }}
                className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-black cursor-pointer"
              >
                Confirm Reset
              </button>
              <button
                onClick={() => setConfirmReset(false)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Leaderboards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Team Leaderboard */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80">
          <h3 className="text-base font-black text-slate-900 flex items-center gap-2 mb-4">
            <Award className="w-5 h-5 text-indigo-600" />
            TEAM LEADERBOARD
          </h3>
          {teamEntries.length === 0 ? (
            <p className="text-xs text-slate-500 py-8 text-center">
              No team records in the selected week range yet.
            </p>
          ) : (
            <div className="space-y-3">
              {teamEntries.map((team) => {
                const attempts = team.rangeCorrect + team.rangeWrong;
                return (
                  <div
                    key={team.teamName}
                    className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-xl bg-indigo-600 text-white font-black text-xs flex items-center justify-center">
                        #{team.rank}
                      </span>
                      <div>
                        <div className="font-black text-sm text-slate-900">{team.teamName}</div>
                        <div className="text-[11px] text-slate-500">
                          {team.memberCount} members • Correct {team.rangeCorrect}/{attempts} • Hook {team.rangeHooks}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className={`text-sm font-black ${
                          team.rangeScore < 0 ? 'text-rose-600' : 'text-indigo-600'
                        }`}
                      >
                        {team.rangeScore} pts
                      </div>
                      <div className="text-[10px] text-slate-400">{team.rangeTimeSec}s</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Individual Leaderboard */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80">
          <h3 className="text-base font-black text-slate-900 flex items-center gap-2 mb-4">
            <Trophy className="w-5 h-5 text-amber-500" />
            INDIVIDUAL STUDENT LEADERBOARD
          </h3>
          {studentEntries.length === 0 ? (
            <p className="text-xs text-slate-500 py-8 text-center">
              No student records in this week range yet. Start a game to record results!
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-black uppercase text-slate-500">
                    <th className="py-2.5 px-3">Rank</th>
                    <th className="py-2.5 px-3">Student</th>
                    <th className="py-2.5 px-3">Team</th>
                    <th className="py-2.5 px-3">Correct / Turns</th>
                    <th className="py-2.5 px-3">Hooks</th>
                    <th className="py-2.5 px-3">Time</th>
                    <th className="py-2.5 px-3 text-right">Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {studentEntries.map((entry) => {
                    const attempts = entry.rangeCorrect + entry.rangeWrong;
                    return (
                      <tr key={entry.studentId} className="hover:bg-slate-50/80">
                        <td className="py-3 px-3 font-black text-slate-700">#{entry.rank}</td>
                        <td className="py-3 px-3 font-bold text-slate-900">{entry.studentName}</td>
                        <td className="py-3 px-3 text-xs text-slate-600">{entry.teamName}</td>
                        <td className="py-3 px-3 text-xs font-bold text-emerald-600">
                          <span className="inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {entry.rangeCorrect}/{attempts} ({entry.accuracy}%)
                          </span>
                        </td>
                        <td
                          className={`py-3 px-3 text-xs font-black ${
                            entry.rangeHooks < 0 ? 'text-rose-600' : 'text-amber-600'
                          }`}
                        >
                          Hook {entry.rangeHooks}
                        </td>
                        <td className="py-3 px-3 text-xs text-slate-500">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {entry.rangeTimeSec}s
                          </span>
                        </td>
                        <td
                          className={`py-3 px-3 text-right font-black ${
                            entry.rangeScore < 0 ? 'text-rose-600' : 'text-indigo-600'
                          }`}
                        >
                          {entry.rangeScore} pts
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
