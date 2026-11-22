import React, { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { INITIAL_TEAMS } from '../../services/mockData';
import { Users, UserPlus, Upload, Download, CheckCircle2, FileSpreadsheet } from 'lucide-react';

export const StudentManagement: React.FC = () => {
  const {
    students,
    currentClass,
    addStudent,
    importStudentsCsv,
    exportStudentsCsv,
    updateTeamAssignment,
  } = useGameStore();

  const [newStudentName, setNewStudentName] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState(INITIAL_TEAMS[0]?.id || 'team-1');
  const [csvText, setCsvText] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleAddStudent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudentName.trim()) return;
    addStudent({
      classId: currentClass.id,
      name: newStudentName.trim(),
      rollNumber: `${students.length + 1 < 10 ? '0' : ''}${students.length + 1}`,
      teamId: selectedTeamId,
      gender: 'nam',
      avatar: '👦',
    });
    setNewStudentName('');
    setStatusMessage(`Đã thêm học sinh "${newStudentName.trim()}" vào lớp ${currentClass.name}.`);
  };

  const handleImportCsv = () => {
    if (!csvText.trim()) return;
    importStudentsCsv(csvText);
    setCsvText('');
    setStatusMessage('Đã nhập danh sách học sinh thành công!');
  };

  const handleDownloadCsv = () => {
    const content = '\uFEFF' + exportStudentsCsv();
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Danh_Sach_Hoc_Sinh_Lop_${currentClass.name}_Tieng_Anh.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80 flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 font-black text-xs uppercase tracking-wider mb-1">
            Môn Tiếng Anh cấp Tiểu học • Cô giáo Văn Thị Thuỳ Trang
          </span>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-indigo-600" />
            QUẢN LÝ HỌC SINH &amp; PHÂN ĐỘI — LỚP {currentClass.name} (KHỐI {currentClass.grade})
          </h2>
        </div>

        <button
          onClick={handleDownloadCsv}
          className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-sm transition-all cursor-pointer"
        >
          <Download className="w-4 h-4" /> Xuất danh sách lớp (.CSV)
        </button>
      </div>

      {statusMessage && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          {statusMessage}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Add / Import Column */}
        <div className="space-y-6">
          <form
            onSubmit={handleAddStudent}
            className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80 space-y-4"
          >
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-indigo-600" />
              THÊM HỌC SINH MỚI
            </h3>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Họ và tên học sinh</label>
              <input
                type="text"
                value={newStudentName}
                onChange={(e) => setNewStudentName(e.target.value)}
                placeholder="VD: Nguyễn Minh Anh"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Đội thi đấu</label>
              <select
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {INITIAL_TEAMS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.avatar} {t.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm shadow-sm transition-all cursor-pointer"
            >
              + Thêm vào lớp {currentClass.name}
            </button>
          </form>

          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80 space-y-3">
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              NHẬP NHANH DANH SÁCH (.CSV / DÒNG)
            </h3>
            <p className="text-xs text-slate-500">
              Mỗi dòng 1 học sinh theo mẫu: <code>Họ và tên, Mã số, Giới tính</code>
            </p>
            <textarea
              rows={5}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder={'Họ tên, Mã số, Giới tính\nNguyễn Văn An, 01, nam\nTrần Thị Bình, 02, nu'}
              className="w-full p-3 rounded-xl border border-slate-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="button"
              onClick={handleImportCsv}
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Upload className="w-4 h-4" /> Nhập danh sách học sinh
            </button>
          </div>
        </div>

        {/* Roster List */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 shadow-sm border border-slate-200/80">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-black text-slate-900">
              DANH SÁCH HỌC SINH HIỆN TẠI ({students.length} học sinh)
            </h3>
          </div>

          <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-black uppercase text-slate-500">
                  <th className="py-2.5 px-3">STT</th>
                  <th className="py-2.5 px-3">Họ và tên học sinh</th>
                  <th className="py-2.5 px-3">Đội thi đấu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {students.map((st, idx) => (
                  <tr key={st.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-bold text-slate-500">{idx + 1}</td>
                    <td className="py-2.5 px-3 font-bold text-slate-900">{st.name}</td>
                    <td className="py-2.5 px-3">
                      <select
                        value={st.teamId}
                        onChange={(e) => updateTeamAssignment(st.id, e.target.value)}
                        className="px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 bg-slate-50"
                      >
                        {INITIAL_TEAMS.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.avatar} {t.name}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
