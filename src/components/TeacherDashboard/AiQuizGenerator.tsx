import React, { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { QuizSet, Question } from '../../types';
import {
  extractQuizWithGemini,
  normalizeQuestionVisuals,
  stripOptionPrefix,
} from '../../services/geminiClientService';
import {
  downloadSampleTemplate,
  parseUserQuizFile,
  parseRawUserQuizText,
} from '../../services/userQuizTemplateService';
import {
  QuestionVisualIllustration,
  OptionVisualIllustration,
  getUniformOptionVisuals,
  resolveVisualDisplayMode,
} from '../ClassroomGame/QuestionVisualIllustration';
import { sound } from '../../services/soundService';
import {
  Sparkles,
  Upload,
  CheckCircle,
  RefreshCw,
  BookOpen,
  HelpCircle,
  Settings,
  Volume2,
  Download,
  FileSpreadsheet,
  FileText,
  FileCode,
  PlusCircle,
  Trash2,
  AlertCircle,
} from 'lucide-react';

export const AiQuizGenerator: React.FC = () => {
  const { selectedWeek, addGeneratedQuiz, setViewMode, openSettings } = useGameStore();

  // Chế độ tạo bộ câu hỏi: 'ai' (Trí tuệ nhân tạo) hoặc 'user' (Người dùng cung cấp)
  const [creationMode, setCreationMode] = useState<'ai' | 'user'>('ai');

  const [lessonTitle, setLessonTitle] = useState('');
  const subject = 'Tiếng Anh';
  const [grade, setGrade] = useState<number>(4);
  const [questionCount, setQuestionCount] = useState<number>(5);
  const [rawText, setRawText] = useState<string>('');
  const [pdfFileName, setPdfFileName] = useState<string | null>(null);
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);

  // State cho chế độ tạo từ người dùng cung cấp
  const [userUploadedFileName, setUserUploadedFileName] = useState<string | null>(null);
  const [userPasteText, setUserPasteText] = useState<string>('');
  const [manualQuestionText, setManualQuestionText] = useState<string>('');
  const [manualOptionA, setManualOptionA] = useState<string>('');
  const [manualOptionB, setManualOptionB] = useState<string>('');
  const [manualOptionC, setManualOptionC] = useState<string>('');
  const [manualOptionD, setManualOptionD] = useState<string>('');
  const [manualCorrectIndex, setManualCorrectIndex] = useState<number>(0);
  const [manualExplanation, setManualExplanation] = useState<string>('');
  const [manualDifficulty, setManualDifficulty] = useState<'co_ban' | 'nang_cao'>('co_ban');

  const [isLoading, setIsLoading] = useState(false);
  const [generatedQuestions, setGeneratedQuestions] = useState<Question[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isErrorStatus, setIsErrorStatus] = useState<boolean>(false);

  // Handle PDF file selection for AI
  const handlePdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPdfFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64Clean = result.split(',')[1] || result;
      setPdfBase64(base64Clean);
    };
    reader.readAsDataURL(file);
  };

  // Handle User Quiz File Upload (.csv, .txt, .json)
  const handleUserQuizFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUserUploadedFileName(file.name);
    try {
      const result = await parseUserQuizFile(file);
      if (result.questions.length > 0) {
        setGeneratedQuestions(result.questions);
        if (!lessonTitle.trim()) {
          const cleanFileTitle = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ');
          setLessonTitle(cleanFileTitle.toUpperCase());
        }
        setIsErrorStatus(false);
        const warnText =
          result.warnings.length > 0 ? ` (Lưu ý: ${result.warnings[0]})` : '';
        setStatusMessage(
          `Đã nạp thành công ${result.questions.length} câu hỏi Tiếng Anh từ file "${file.name}"!${warnText}`
        );
      } else {
        setIsErrorStatus(true);
        setStatusMessage(
          result.warnings[0] ||
            'Không tìm thấy câu hỏi hợp lệ trong file. Vui lòng tải file mẫu bộ câu hỏi để xem đúng cấu trúc!'
        );
      }
    } catch (err: any) {
      setIsErrorStatus(true);
      setStatusMessage(
        'Lỗi khi đọc file câu hỏi: ' + (err?.message || 'Định dạng không hợp lệ')
      );
    }
  };

  // Parse user pasted text
  const handleParsePastedQuiz = () => {
    if (!userPasteText.trim()) {
      setIsErrorStatus(true);
      setStatusMessage(
        'Vui lòng dán nội dung câu hỏi theo định dạng mẫu trước khi bấm Phân tích!'
      );
      return;
    }
    const result = parseRawUserQuizText(userPasteText);
    if (result.questions.length > 0) {
      setGeneratedQuestions(result.questions);
      setIsErrorStatus(false);
      setStatusMessage(
        `Đã phân tích và tạo thành công ${result.questions.length} câu hỏi từ nội dung giáo viên cung cấp!`
      );
    } else {
      setIsErrorStatus(true);
      setStatusMessage(
        result.warnings[0] ||
          'Không nhận diện được câu hỏi. Vui lòng kiểm tra lại định dạng hoặc tải file mẫu về tham khảo.'
      );
    }
  };

  // Add a single manual question to the current set
  const handleAddManualQuestion = () => {
    if (
      !manualQuestionText.trim() ||
      !manualOptionA.trim() ||
      !manualOptionB.trim() ||
      !manualOptionC.trim() ||
      !manualOptionD.trim()
    ) {
      setIsErrorStatus(true);
      setStatusMessage(
        'Vui lòng nhập đầy đủ nội dung câu hỏi và cả 4 phương án A, B, C, D!'
      );
      return;
    }

    const newQ: Question = {
      id: `manual_en_${Date.now()}_${generatedQuestions.length + 1}`,
      question: manualQuestionText.trim(),
      options: [
        stripOptionPrefix(manualOptionA.trim()),
        stripOptionPrefix(manualOptionB.trim()),
        stripOptionPrefix(manualOptionC.trim()),
        stripOptionPrefix(manualOptionD.trim()),
      ],
      correctIndex: manualCorrectIndex,
      explanation:
        manualExplanation.trim() ||
        'Kiến thức trọng tâm bài học môn Tiếng Anh cấp Tiểu học.',
      difficulty: manualDifficulty,
      isAdvanced: manualDifficulty === 'nang_cao',
      visualDisplayMode: 'question_image',
    };

    const nextList = normalizeQuestionVisuals([...generatedQuestions, newQ]);
    setGeneratedQuestions(nextList);
    setManualQuestionText('');
    setManualOptionA('');
    setManualOptionB('');
    setManualOptionC('');
    setManualOptionD('');
    setManualCorrectIndex(0);
    setManualExplanation('');
    setIsErrorStatus(false);
    setStatusMessage(
      `Đã thêm câu hỏi thứ ${nextList.length} (kèm hình ảnh minh hoạ) vào bộ đề Tiếng Anh!`
    );
  };

  const handleDeleteQuestionAt = (idxToRemove: number) => {
    setGeneratedQuestions((prev) => prev.filter((_, idx) => idx !== idxToRemove));
  };

  // Call Gemini API via stable gemini-3-flash-preview model
  const handleGenerate = async () => {
    if (!lessonTitle.trim()) {
      setIsErrorStatus(true);
      setStatusMessage(
        'Vui lòng nhập tên bài học Tiếng Anh (ví dụ: Unit 1: Hello hoặc Unit 3: My Friends) trước khi tạo câu hỏi!'
      );
      return;
    }

    setIsLoading(true);
    setStatusMessage(null);
    setIsErrorStatus(false);

    const previousQuestionTexts = generatedQuestions.map((q) => q.question);

    try {
      const result = await extractQuizWithGemini({
        lessonTitle: lessonTitle.trim(),
        subject: 'Tiếng Anh',
        grade,
        questionCount,
        content: rawText,
        pdfBase64,
        excludeQuestions: previousQuestionTexts,
        onStatusUpdate: (msg) => setStatusMessage(msg),
      });

      if (result.success && result.questions && result.questions.length > 0) {
        const resolvedUpperTitle = (
          result.resolvedLessonTitle ||
          lessonTitle ||
          'UNIT 1: HELLO'
        )
          .trim()
          .toUpperCase();
        setLessonTitle(resolvedUpperTitle);
        setGeneratedQuestions(
          normalizeQuestionVisuals(result.questions, previousQuestionTexts)
        );
        setIsErrorStatus(false);
        setStatusMessage(
          `Đã tạo thành công bộ ${result.questions.length} câu hỏi môn Tiếng Anh (Khối ${grade}) kèm hình ảnh minh hoạ trực quan bằng AI Gemini!`
        );
      } else {
        setIsErrorStatus(true);
        setStatusMessage(
          result.message ||
            'Không thể tạo bộ câu hỏi từ Gemini AI. Vui lòng kiểm tra kết nối hoặc bấm "Cài Đặt API Key" để thay đổi API KEY GEMINI!'
        );
      }
    } catch (err: any) {
      console.error(err);
      setIsErrorStatus(true);
      setStatusMessage(
        err?.message ||
          'Lỗi kết nối tới máy chủ Gemini AI. Vui lòng thử lại hoặc thay đổi khóa API KEY GEMINI!'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Apply Questions to Game Session
  const handleApplyToRace = () => {
    if (generatedQuestions.length === 0) return;
    const upperTitle = (lessonTitle || 'UNIT 1: TIẾNG ANH TIỂU HỌC')
      .trim()
      .toUpperCase();

    const newQuizSet: QuizSet = {
      id: `quiz-gen-week-${selectedWeek}-${Date.now()}`,
      weekNumber: selectedWeek,
      lessonTitle: upperTitle,
      subject: 'Tiếng Anh',
      grade,
      description: `BÀI HỌC TIẾNG ANH: ${upperTitle}`,
      questions: generatedQuestions,
      createdAt: new Date().toISOString(),
    };

    addGeneratedQuiz(newQuizSet);
    setViewMode('classroom');
  };

  const advancedCount = generatedQuestions.filter(
    (q) => q.isAdvanced || q.difficulty === 'nang_cao'
  ).length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-900/60 via-purple-900/40 to-slate-900 p-6 rounded-3xl border border-indigo-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-amber-300 font-bold text-xs uppercase tracking-wider mb-1">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>
              Chuyên Biệt Môn Tiếng Anh Cấp Tiểu Học (Khối 1 - 5) • Tác giả: Cô giáo Văn Thị Thuỳ Trang
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white">
            Hệ Thống Biên Soạn Bộ Câu Hỏi Tiếng Anh Tiểu Học (Có Hình Ảnh Trực Quan &amp; Phát Âm Chuẩn Mỹ)
          </h2>
          <p className="text-sm text-slate-300 mt-1">
            Hỗ trợ song song 2 phương thức chuyên nghiệp: <strong>(1) Tạo tự động bằng Trí tuệ nhân tạo AI Gemini kèm hình ảnh minh hoạ</strong> hoặc <strong>(2) Tạo từ file mẫu Word (.DOCX) có hình ảnh trực quan của giáo viên</strong>.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={openSettings}
            className="w-full sm:w-auto px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-md"
          >
            <Settings className="w-4 h-4 text-amber-400" />
            <span>Cài Đặt API Key</span>
          </button>
          <div className="bg-indigo-950/80 px-4 py-2 rounded-2xl border border-indigo-500/40 text-center w-full sm:w-auto">
            <div className="text-[10px] text-indigo-300 font-bold">Môn Tiếng Anh • Gán cho:</div>
            <div className="text-base font-black text-amber-400">Tuần {selectedWeek}</div>
          </div>
        </div>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-900/90 p-2 rounded-2xl border border-slate-800">
        <button
          type="button"
          onClick={() => {
            setCreationMode('ai');
            setStatusMessage(null);
          }}
          className={`py-3 px-4 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
            creationMode === 'ai'
              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg'
              : 'bg-slate-800/70 text-slate-300 hover:text-white'
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-300" />
          <span>1. Tạo Bộ Câu Hỏi Có Hình Ảnh Bằng Trí Tuệ Nhân Tạo (AI Gemini)</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setCreationMode('user');
            setStatusMessage(null);
          }}
          className={`py-3 px-4 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
            creationMode === 'user'
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg'
              : 'bg-slate-800/70 text-slate-300 hover:text-white'
          }`}
        >
          <FileText className="w-4 h-4 text-amber-300" />
          <span>2. Tạo Bộ Câu Hỏi Từ Người Dùng Cung Cấp &amp; Tải File Mẫu (.DOCX)</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Input Form (5 cols) */}
        <div className="lg:col-span-5 bg-slate-900 p-6 rounded-3xl border border-slate-800 space-y-4 shadow-xl">
          <h3 className="font-extrabold text-white text-base flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-amber-400" />
            <span>
              {creationMode === 'ai'
                ? 'Thiết Lập AI Tạo Đề Tiếng Anh Tiểu Học (Kèm Hình Ảnh)'
                : 'Nhập Bộ Câu Hỏi Từ Giáo Viên & Tải File Mẫu (.DOCX)'}
            </span>
          </h3>

          {/* Common fields: Lesson Title & Primary Grade (1 - 5) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-300 uppercase mb-1.5">
                Tên bài học Tiếng Anh (Unit / Lesson):
              </label>
              <input
                type="text"
                value={lessonTitle}
                onChange={(e) => setLessonTitle(e.target.value)}
                placeholder='VD: "Unit 1: Hello" hoặc "Unit 3: Our Friends"...'
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm focus:outline-none focus:border-amber-400 placeholder:text-slate-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase mb-1.5">
                Khối Tiểu học:
              </label>
              <select
                value={grade}
                onChange={(e) => setGrade(Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white font-bold text-sm focus:outline-none focus:border-amber-400"
              >
                {[1, 2, 3, 4, 5].map((g) => (
                  <option key={g} value={g}>
                    Khối lớp {g}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-slate-800/70 border border-emerald-500/30 rounded-xl px-3.5 py-2 flex items-center justify-between text-xs">
            <span className="text-slate-300 font-semibold">Môn học &amp; Phát âm:</span>
            <span className="font-black text-emerald-300 uppercase">
              🇺🇸 Tiếng Anh Tiểu Học (Lớp {grade} • Chuẩn Bản Ngữ Mỹ)
            </span>
          </div>

          {creationMode === 'ai' ? (
            <>
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1.5">
                  Số lượng câu hỏi cần sinh (kèm hình ảnh trực quan):
                </label>
                <div className="flex gap-1.5">
                  {[3, 5, 8, 10, 15, 20].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setQuestionCount(num)}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        questionCount === num
                          ? 'bg-indigo-600 text-white shadow-md'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {num} câu
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1.5">
                  Tải lên Sách Giáo Khoa Tiếng Anh (PDF - Tùy chọn):
                </label>
                <div className="border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-2xl p-4 text-center cursor-pointer transition-colors bg-slate-800/40 relative">
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={handlePdfUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <Upload className="w-8 h-8 text-indigo-400 mx-auto mb-2" />
                  {pdfFileName ? (
                    <div className="text-xs font-bold text-emerald-400 flex items-center justify-center gap-1.5">
                      <CheckCircle className="w-4 h-4" />
                      <span>{pdfFileName}</span>
                    </div>
                  ) : (
                    <>
                      <div className="text-xs font-bold text-slate-200">
                        Bấm để tải tệp PDF sách giáo khoa Tiếng Anh Tiểu học
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        Hỗ trợ Global Success, Family &amp; Friends, i-Learn Smart Start, Wonderful World...
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1.5">
                  Từ vựng / Mẫu câu trọng tâm muốn kiểm tra (Tùy chọn):
                </label>
                <textarea
                  rows={3}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder="Dán từ vựng (Vocabulary), mẫu câu (Sentence Patterns) hoặc nội dung bài học Tiếng Anh..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <button
                onClick={handleGenerate}
                disabled={isLoading}
                className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 hover:from-indigo-500 hover:to-purple-500 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>AI Đang Biên Soạn Câu Hỏi &amp; Hình Ảnh...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    <span>TẠO BỘ CÂU HỎI &amp; HÌNH ẢNH BẰNG AI</span>
                  </>
                )}
              </button>
            </>
          ) : (
            /* CHẾ ĐỘ 2: TẠO BỘ CÂU HỎI TỪ NGƯỜI DÙNG CUNG CẤP + TẢI FILE MẪU DUY NHẤT .DOCX CÓ HÌNH ẢNH */
            <div className="space-y-4">
              {/* Khung 1: Tải file mẫu bộ câu hỏi duy nhất .DOCX */}
              <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-2xl p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-emerald-300 uppercase flex items-center gap-1.5">
                    <Download className="w-4 h-4 text-amber-400" />
                    <span>Bước 1: Tải File Mẫu Bộ Câu Hỏi Tiếng Anh (.DOCX)</span>
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Tải file mẫu chuẩn duy nhất định dạng Microsoft Word (<strong>.docx</strong>) đã có sẵn 5 câu hỏi Tiếng Anh Tiểu học kèm <strong>hình ảnh minh hoạ trực quan</strong> trong từng câu hỏi:
                </p>
                <button
                  type="button"
                  onClick={() => void downloadSampleTemplate()}
                  className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs flex items-center justify-center gap-2 shadow-lg cursor-pointer transition-all"
                >
                  <FileText className="w-4 h-4 text-amber-300 shrink-0" />
                  <span>📥 Tải File Mẫu Bộ Câu Hỏi Có Hình Ảnh Minh Hoạ (.DOCX)</span>
                </button>
              </div>

              {/* Khung 2: Tải file bộ câu hỏi .docx từ máy tính lên */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase mb-1.5">
                  Bước 2: Tải lên file bộ câu hỏi của giáo viên (.DOCX):
                </label>
                <div className="border-2 border-dashed border-emerald-500/50 hover:border-emerald-400 rounded-2xl p-4 text-center cursor-pointer transition-colors bg-slate-800/50 relative">
                  <input
                    type="file"
                    accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={handleUserQuizFileUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  />
                  <Upload className="w-7 h-7 text-emerald-400 mx-auto mb-1.5" />
                  {userUploadedFileName ? (
                    <div className="text-xs font-bold text-emerald-300 flex items-center justify-center gap-1.5">
                      <CheckCircle className="w-4 h-4" />
                      <span>Đã tải file: {userUploadedFileName}</span>
                    </div>
                  ) : (
                    <>
                      <div className="text-xs font-bold text-white">
                        Bấm vào đây để chọn file câu hỏi Word (.DOCX)
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Hệ thống trích xuất chính xác tuyệt đối 100% cả hình ảnh minh hoạ và văn bản câu hỏi khi vào chơi
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Khung 3: Dán nhanh văn bản câu hỏi */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-300 uppercase">
                  Hoặc dán trực tiếp nội dung bộ câu hỏi:
                </label>
                <textarea
                  rows={4}
                  value={userPasteText}
                  onChange={(e) => setUserPasteText(e.target.value)}
                  placeholder={`Câu 1: What is your name?\nA. My name is Lan.\nB. I am fine.\nC. Thank you.\nD. Goodbye.\nĐáp án: A\nGiải thích: Câu hỏi tên "What is your name?" trả lời bằng "My name is + tên".`}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={handleParsePastedQuiz}
                  className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>Nạp Bộ Câu Hỏi Từ Nội Dung Đã Dán</span>
                </button>
              </div>

              {/* Khung 4: Thêm từng câu hỏi trực tiếp trên giao diện */}
              <div className="bg-slate-800/70 border border-slate-700 rounded-2xl p-3.5 space-y-2.5">
                <div className="text-xs font-black text-amber-300 uppercase flex items-center gap-1.5">
                  <PlusCircle className="w-4 h-4 text-amber-400" />
                  <span>Soạn & Thêm Từng Câu Hỏi Trực Tiếp</span>
                </div>
                <input
                  type="text"
                  value={manualQuestionText}
                  onChange={(e) => setManualQuestionText(e.target.value)}
                  placeholder="Nhập nội dung câu hỏi Tiếng Anh..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-amber-400"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={manualOptionA}
                    onChange={(e) => setManualOptionA(e.target.value)}
                    placeholder="Đáp án A..."
                    className="bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-amber-400"
                  />
                  <input
                    type="text"
                    value={manualOptionB}
                    onChange={(e) => setManualOptionB(e.target.value)}
                    placeholder="Đáp án B..."
                    className="bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-amber-400"
                  />
                  <input
                    type="text"
                    value={manualOptionC}
                    onChange={(e) => setManualOptionC(e.target.value)}
                    placeholder="Đáp án C..."
                    className="bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-amber-400"
                  />
                  <input
                    type="text"
                    value={manualOptionD}
                    onChange={(e) => setManualOptionD(e.target.value)}
                    placeholder="Đáp án D..."
                    className="bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-1">Đáp án đúng:</span>
                    <select
                      value={manualCorrectIndex}
                      onChange={(e) => setManualCorrectIndex(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white font-bold text-xs"
                    >
                      <option value={0}>Đáp án A</option>
                      <option value={1}>Đáp án B</option>
                      <option value={2}>Đáp án C</option>
                      <option value={3}>Đáp án D</option>
                    </select>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block mb-1">Mức độ câu hỏi:</span>
                    <select
                      value={manualDifficulty}
                      onChange={(e) =>
                        setManualDifficulty(e.target.value as 'co_ban' | 'nang_cao')
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white font-bold text-xs"
                    >
                      <option value="co_ban">Cơ bản (Nhận biết)</option>
                      <option value="nang_cao">Nâng cao (Vận dụng)</option>
                    </select>
                  </div>
                </div>
                <input
                  type="text"
                  value={manualExplanation}
                  onChange={(e) => setManualExplanation(e.target.value)}
                  placeholder="Giải thích đáp án (tùy chọn)..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-white text-xs focus:outline-none focus:border-amber-400"
                />
                <button
                  type="button"
                  onClick={handleAddManualQuestion}
                  className="w-full py-2 px-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Thêm Câu Hỏi Này Vào Danh Sách</span>
                </button>
              </div>
            </div>
          )}

          {statusMessage && (
            <div
              className={`text-xs p-3 rounded-xl flex items-start gap-2 border ${
                isErrorStatus
                  ? 'text-rose-200 bg-rose-950/60 border-rose-500/60'
                  : 'text-emerald-300 bg-emerald-950/50 border-emerald-700'
              }`}
            >
              {isErrorStatus ? (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              ) : (
                <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
              )}
              <span>{statusMessage}</span>
            </div>
          )}
        </div>

        {/* Right Column: Generated / Imported Questions Preview (7 cols) */}
        <div className="lg:col-span-7 bg-slate-900 p-6 rounded-3xl border border-slate-800 flex flex-col shadow-xl">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4 gap-2 flex-wrap">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-extrabold text-white text-base">
                  Danh Sách Bộ Câu Hỏi Tiếng Anh ({generatedQuestions.length} câu)
                </h3>
                {generatedQuestions.length > 0 && (
                  <span className="text-xs font-black bg-purple-600/90 border border-purple-300/60 text-white px-2.5 py-0.5 rounded-lg">
                    🌟 {advancedCount} câu nâng cao
                  </span>
                )}
              </div>
              {lessonTitle && (
                <div className="text-xs font-black text-amber-300 uppercase mt-0.5">
                  MÔN TIẾNG ANH (KHỐI {grade}) • {lessonTitle.toUpperCase()}
                </div>
              )}
              <p className="text-xs text-slate-300">
                Giáo viên có thể nghe thử phát âm, kiểm tra đáp án và bấm "Lưu & Nạp vào trò chơi".
              </p>
            </div>

            {generatedQuestions.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setGeneratedQuestions([])}
                  className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-300 font-bold text-xs cursor-pointer border border-slate-700"
                >
                  Xóa danh sách
                </button>
                <button
                  onClick={handleApplyToRace}
                  className="py-2.5 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md shadow-amber-400/20 cursor-pointer"
                >
                  <span>LƯU & NẠP VÀO TRÒ CHƠI</span>
                </button>
              </div>
            )}
          </div>

          {generatedQuestions.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-300 border-2 border-dashed border-slate-800 rounded-2xl">
              <HelpCircle className="w-12 h-12 text-slate-400 mb-3" />
              <p className="text-sm font-semibold">Chưa có câu hỏi Tiếng Anh nào trong danh sách</p>
              <p className="text-xs text-slate-400 max-w-md mt-1 leading-relaxed">
                Bạn có thể chọn <strong>Tạo bằng AI Gemini</strong> (nhập tên Unit hoặc tải SGK Tiếng Anh PDF) hoặc chọn <strong>Tạo từ người dùng cung cấp</strong> (tải file mẫu .CSV/.TXT/.JSON về điền rồi tải lên).
              </p>
            </div>
          ) : (
            <div className="space-y-3.5 overflow-y-auto max-h-[600px] pr-1">
              {generatedQuestions.map((q, qIdx) => {
                const qMode = resolveVisualDisplayMode(q);
                const showQImg = qMode === 'question_image';
                const uniformOpts = qMode === 'options_image' ? getUniformOptionVisuals(q) : null;
                const isAdv = Boolean(q.isAdvanced || q.difficulty === 'nang_cao');
                return (
                  <div
                    key={q.id || qIdx}
                    className={`rounded-2xl p-4 border text-left space-y-2.5 ${
                      isAdv
                        ? 'bg-gradient-to-br from-purple-950/60 via-slate-800/90 to-slate-900 border-purple-400/70'
                        : 'bg-slate-800/80 border-slate-700/80'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-md">
                          Question {qIdx + 1}
                        </span>
                        {isAdv && (
                          <span className="text-[11px] font-black bg-gradient-to-r from-purple-500 to-pink-500 text-white px-2.5 py-0.5 rounded-md shadow">
                            🌟 NÂNG CAO
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            sound.speakQuestionAndOptions(qIdx + 1, q.question, q.options)
                          }
                          title="Nghe máy đọc câu hỏi và 4 đáp án"
                          className="px-2.5 py-0.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-black flex items-center gap-1 cursor-pointer shadow"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                          <span>Nghe đọc</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteQuestionAt(qIdx)}
                          title="Xóa câu hỏi này"
                          className="p-1 rounded-md bg-slate-900 hover:bg-rose-950 text-slate-400 hover:text-rose-300 border border-slate-700 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <h4 className="text-sm sm:text-base font-bold text-white leading-snug">
                      {q.question}
                    </h4>

                    {showQImg && <QuestionVisualIllustration question={q} index={qIdx + 1} compact />}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      {q.options.map((opt, oIdx) => (
                        <div
                          key={oIdx}
                          className={`p-2 rounded-xl text-xs flex flex-col gap-1.5 border ${
                            oIdx === q.correctIndex
                              ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold'
                              : 'bg-slate-900/60 border-slate-700 text-slate-300'
                          }`}
                        >
                          {uniformOpts && (
                            <OptionVisualIllustration
                              optionText={stripOptionPrefix(opt)}
                              visualSpec={uniformOpts[oIdx]}
                              optionSvg={q.optionSvgs?.[oIdx]}
                              optionIndex={oIdx}
                              visualType={q.visualType}
                              questionText={q.question}
                            />
                          )}
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-md bg-white/10 flex items-center justify-center font-bold text-[10px] shrink-0">
                              {String.fromCharCode(65 + oIdx)}
                            </span>
                            <span className="break-words">{stripOptionPrefix(opt)}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="text-xs text-amber-300/90 bg-amber-950/30 p-2 rounded-xl border border-amber-900/30">
                      💡 <strong>Giải thích:</strong> {q.explanation}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
