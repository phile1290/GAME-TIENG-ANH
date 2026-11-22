import { Question } from '../types';
import {
  resolveVisualDisplayMode,
  getUniformOptionVisuals,
  detectSemanticTopicKey,
} from '../components/ClassroomGame/QuestionVisualIllustration';
import {
  preparePdfLessonForGemini,
  PdfPageImagePart,
} from './pdfProcessorService';

const GEMINI_API_KEY_STORAGE_KEY = 'FOREST_CLIMB_GEMINI_API_KEY_V1';
const LEGACY_API_KEY_STORAGE_KEYS = [
  'FOREST_CLIMB_GEMINI_API_KEY_V1',
  'forest_climb_gemini_api_key',
  'gemini_api_key',
  'GEMINI_API_KEY',
];

/**
 * Model Gemini duy nhất theo yêu cầu cho mọi chức năng của ứng dụng:
 * gemini-3-flash-preview (Tuyệt đối không sử dụng gemini-2.5)
 */
export const STABLE_GEMINI_MODELS = ['gemini-3-flash-preview'];

export function getStoredGeminiApiKey(): string {
  try {
    for (const k of LEGACY_API_KEY_STORAGE_KEYS) {
      const val = (localStorage.getItem(k) || '').trim();
      if (val) return val;
    }
    return '';
  } catch {
    return '';
  }
}

export function getStoredApiKey(): string {
  return getStoredGeminiApiKey();
}

export function saveGeminiApiKey(apiKey: string): void {
  try {
    const clean = apiKey.trim();
    if (clean) {
      localStorage.setItem(GEMINI_API_KEY_STORAGE_KEY, clean);
      localStorage.setItem('gemini_api_key', clean);
      fetch('/api/storage/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entries: {
            [GEMINI_API_KEY_STORAGE_KEY]: clean,
            gemini_api_key: clean,
          },
          forceOverwriteKeys: [GEMINI_API_KEY_STORAGE_KEY, 'gemini_api_key'],
        }),
      }).catch(() => {});
    } else {
      for (const k of LEGACY_API_KEY_STORAGE_KEYS) {
        localStorage.removeItem(k);
      }
      fetch('/api/storage/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deletedKeys: LEGACY_API_KEY_STORAGE_KEYS,
          forceOverwriteKeys: LEGACY_API_KEY_STORAGE_KEYS,
        }),
      }).catch(() => {});
    }
  } catch (e) {
    console.error('Failed to save API Key to localStorage:', e);
  }
}

export function saveStoredApiKey(apiKey: string): void {
  saveGeminiApiKey(apiKey);
}

export function hasConfiguredGeminiApiKey(): boolean {
  return Boolean(getStoredGeminiApiKey());
}

/**
 * Kiểm tra xem lỗi trả về từ Gemini API có phải là lỗi hết hạn mức (QUOTA / 429 / RESOURCE_EXHAUSTED)
 * hoặc lỗi khóa API không hợp lệ hay không.
 */
export function analyzeGeminiError(errOrMsg: any): {
  isQuotaError: boolean;
  isAuthError: boolean;
  formattedMessage: string;
} {
  const raw =
    typeof errOrMsg === 'string'
      ? errOrMsg
      : errOrMsg?.message || errOrMsg?.error || JSON.stringify(errOrMsg || '');
  const lower = String(raw).toLowerCase();

  const isQuotaError =
    lower.includes('429') ||
    lower.includes('quota') ||
    lower.includes('resource_exhausted') ||
    lower.includes('rate limit') ||
    lower.includes('too many requests') ||
    lower.includes('exceeded your current quota') ||
    lower.includes('billing');

  if (isQuotaError) {
    return {
      isQuotaError: true,
      isAuthError: false,
      formattedMessage:
        '⚠️ LỖI HẾT HẠN MỨC (QUOTA) GEMINI API KEY: Khóa API Gemini hiện tại đã hết hạn mức sử dụng (Quota Exhausted / 429). Vui lòng thay đổi sang API KEY GEMINI mới trong mục "Cài Đặt API Key"! (Hệ thống tuyệt đối không tự ý tạo câu hỏi ngẫu nhiên).',
    };
  }

  const isAuthError =
    lower.includes('api_key_invalid') ||
    lower.includes('api key not valid') ||
    lower.includes('invalid api key') ||
    lower.includes('unauthenticated') ||
    lower.includes('permission_denied') ||
    lower.includes('chưa cấu hình gemini_api_key') ||
    lower.includes('chưa được cấu hình');

  if (isAuthError) {
    return {
      isQuotaError: false,
      isAuthError: true,
      formattedMessage:
        '🔑 LỖI KHÓA GEMINI API KEY: Khóa API chưa được cấu hình hoặc không hợp lệ. Vui lòng bấm "Cài Đặt API Key" để nhập hoặc thay đổi API KEY GEMINI mới!',
    };
  }

  return {
    isQuotaError: false,
    isAuthError: false,
    formattedMessage:
      raw ||
      'Không thể tạo bộ câu hỏi từ Gemini AI. Vui lòng kiểm tra kết nối hoặc thay đổi API KEY GEMINI trong mục Cài đặt.',
  };
}

export async function testGeminiApiKey(
  apiKey: string
): Promise<{ success: boolean; message: string }> {
  const cleanKey = (apiKey || '').trim();
  if (!cleanKey) {
    return { success: false, message: 'Khóa API đang để trống!' };
  }
  try {
    const response = await fetch('/api/gemini/extract-quiz', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-gemini-api-key': cleanKey,
      },
      body: JSON.stringify({
        action: 'test-key',
        apiKey: cleanKey,
      }),
    });

    const data = await response.json().catch(() => null);
    if (data?.success) {
      return {
        success: true,
        message:
          data.message ||
          'Kết nối thành công với Model gemini-3-flash-preview! Khóa API hoạt động tốt.',
      };
    }

    const analysis = analyzeGeminiError(data?.message || data?.error || `HTTP ${response.status}`);
    return {
      success: false,
      message: analysis.formattedMessage,
    };
  } catch (err: any) {
    const analysis = analyzeGeminiError(err);
    return {
      success: false,
      message: analysis.formattedMessage,
    };
  }
}

/**
 * Loại bỏ triệt để tiền tố nhãn đáp án bị lặp lại (VD: "A. Bàn phím" -> "Bàn phím", "B: Màn hình" -> "Màn hình", "(C) Chuột" -> "Chuột", "Đáp án D. Loa" -> "Loa")
 * Đảm bảo trên nút đáp án đã có huy hiệu A, B, C, D thì bên trong văn bản TUYỆT ĐỐI KHÔNG còn chữ A., B., C., D. lặp lại nữa!
 */
export function stripOptionPrefix(rawOption: string): string {
  let text = String(rawOption ?? '').normalize('NFC').trim();
  if (!text) return '';
  if (
    /^(?:(?:option|answer|choice|đáp\s*án|phương\s*án|lựa\s*chọn)\s+)?\*?[A-Da-d]\s*[.:)\-–—]*$/i.test(
      text
    )
  ) {
    return '';
  }
  for (let i = 0; i < 3; i++) {
    const next = text
      .replace(
        /^(?:option|answer|choice|đáp\s*án|phương\s*án|lựa\s*chọn)\s+\*?[A-Da-d]\s*[.:)\-–—]?\s*/i,
        ''
      )
      .replace(/^\(\*?[A-Da-d]\)\s*[.:;\-–—]?\s*/, '')
      .replace(/^\[\*?[A-Da-d]\]\s*[.:;\-–—]?\s*/, '')
      .replace(/^\*?[A-Da-d]\s*[.:)]\s*/, '')
      .replace(/^\*?[A-Da-d]\s+[-–—]\s+/, '')
      .trim();
    if (next === text) break;
    text = next;
  }
  if (
    /^(?:(?:option|answer|choice|đáp\s*án|phương\s*án|lựa\s*chọn)\s+)?\*?[A-Da-d]\s*[.:)\-–—]*$/i.test(
      text
    )
  ) {
    return '';
  }
  return text;
}

/**
 * Chuẩn hóa chuỗi câu hỏi để phát hiện trùng lặp nội dung tuyệt đối
 */
export function normalizeQuestionFingerprint(text: string): string {
  return String(text || '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/^câu\s*(?:hỏi)?\s*\d+\s*[:.)-]?\s*/i, '')
    .replace(/^\[(?:vận dụng\s*)?nâng cao\]\s*/i, '')
    .replace(/[.,?!;:"'()[\]{}“”‘’\-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function stripDecorativeEmojis(text: string): string {
  return String(text || '')
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Loại bỏ các cụm từ đánh đố dựa trên vị trí trình bày/bố cục hình thức của sách giáo khoa
 * (ví dụ: hỏi gạch đầu hàng thứ mấy, mục số mấy, dòng thứ mấy, đoạn thứ mấy...)
 * và chuyển hóa thành câu hỏi kiến thức trực diện, độc lập, dễ hiểu.
 */
export function sanitizePedagogicalQuestionStem(
  rawQuestion: string,
  options: string[],
  correctIndex: number,
  explanation: string
): string {
  let q = String(rawQuestion || '')
    .normalize('NFC')
    .replace(/^câu\s*(?:hỏi)?\s*\d+\s*[:.)-]?\s*/i, '')
    .replace(/^\[(?:vận dụng\s*)?nâng cao\]\s*/i, '')
    .trim();
  if (!q) return '';

  // 1. Loại bỏ các cụm tham chiếu vị trí/bố cục hình thức ở đầu câu hỏi
  q = q
    .replace(
      /^(?:theo|dựa\s+vào|căn\s+cứ\s+vào|ở|trong|tại)\s+(?:gạch\s+đầu\s+(?:hàng|dòng)|dấu\s+gạch\s+ngang|chấm\s+tròn|ý|dòng|đoạn|khổ|mục|nội\s+dung|phần|bảng|hộp\s+thông\s+tin)\s*(?:số|thứ)?\s*(?:\d+|[ivx]+|một|hai|ba|bốn|năm|sáu|nhất|nhì|tư|đầu\s+tiên|cuối\s+cùng)(?:\s+(?:của|trong|thuộc)\s+(?:nội\s+dung|mục|phần|bài\s+học|hoạt\s+động|trang)\s*(?:số|thứ)?\s*(?:\d+|[a-z]|[ivx]+|một|hai|ba|bốn|năm)?)?\s*[,.:;-]?\s*/i,
      ''
    )
    .replace(
      /^(?:theo|trong|ở)\s+(?:nội\s+dung|mục|phần|hoạt\s+động)\s*(?:số|thứ)?\s*(?:\d+|[a-z]|[ivx]+|một|hai|ba|bốn|năm)(?:\s*,\s*(?:gạch\s+đầu\s+(?:hàng|dòng)|ý|dòng|đoạn)\s*(?:số|thứ)?\s*(?:\d+|một|hai|ba|bốn|năm|nhất|nhì|tư))?\s*[,.:;-]?\s*/i,
      ''
    )
    .trim();

  // 2. Nếu bản thân câu hỏi hỏi đánh đố vị trí bố cục (hỏi gạch đầu hàng/mục/dòng thứ mấy nói về vấn đề gì)
  const isLayoutMemorizationQuestion =
    /(?:gạch\s*đầu\s*(?:hàng|dòng)|dấu\s*gạch\s*ngang|chấm\s*tròn|ý\s*thứ|dòng\s*thứ|đoạn\s*thứ|mục\s*số|nội\s*dung\s*(?:số|thứ))\s*(?:thứ\s*)?(?:\d+|một|hai|ba|bốn|năm|sáu|nhất|nhì|tư|đầu\s*tiên|cuối\s*cùng)\b.*(?:nói\s*về|đề\s*cập|trình\s*bày|cho\s*biết|nêu|nhắc\s*đến|hướng\s*dẫn|là\s*gì|vấn\s*đề\s*gì|nội\s*dung\s*gì)/i.test(
      q
    );

  if (isLayoutMemorizationQuestion) {
    const cleanExp = String(explanation || '')
      .replace(
        /^(?:theo|ở|trong)\s+(?:gạch\s+đầu\s+(?:hàng|dòng)|mục|nội\s+dung|phần)[^,.:;]*[,.:;-]\s*/i,
        ''
      )
      .trim();
    if (cleanExp && cleanExp.length > 20) {
      q = 'Trong bài học, phát biểu nào dưới đây nêu đúng kiến thức và cách thực hiện chính xác nhất?';
    } else if (Array.isArray(options) && options[correctIndex]) {
      q = 'Phương án nào dưới đây thể hiện đúng nhất nội dung kiến thức trọng tâm trong bài học?';
    }
  }

  if (q.length > 0) {
    q = q.charAt(0).toUpperCase() + q.slice(1);
  }
  return q;
}

/**
 * Chuẩn hóa danh sách câu hỏi:
 * - Hỗ trợ đáp án chỉ có văn bản, chỉ có hình ảnh (văn bản rỗng ''), hoặc có cả văn bản và hình ảnh.
 * - Loại bỏ tiền tố A., B., C., D. hoặc "Option A..D" thừa trong nội dung 4 đáp án.
 */
export function normalizeQuestionVisuals(
  questions: Question[],
  excludeQuestionTexts: string[] = []
): Question[] {
  if (!Array.isArray(questions) || questions.length === 0) return [];

  // Kiểm tra xem đây có phải bộ câu hỏi từ file người dùng tải lên (.docx) không
  const isUserUploadedSet = questions.some((q) =>
    String(q?.id || '').startsWith('docx_') ||
    String(q?.id || '').startsWith('user_') ||
    String(q?.id || '').startsWith('sample_') ||
    String(q?.id || '').startsWith('manual_')
  );

  let sourceList: Question[] = [];

  if (isUserUploadedSet) {
    // Đối với bộ câu hỏi từ file mẫu .docx / người dùng tải lên: GIỮ NGUYÊN TUYỆT ĐỐI 100% danh sách câu hỏi, văn bản và hình ảnh!
    sourceList = [...questions];
  } else {
    // Đối với câu hỏi AI tạo: Lọc bỏ các câu hỏi trùng lặp nội dung
    const seenFingerprints = new Set<string>(
      excludeQuestionTexts.map((t) => normalizeQuestionFingerprint(t)).filter(Boolean)
    );
    const seenCorrectAnswerPairs = new Set<string>();

    for (const q of questions) {
      const fp = normalizeQuestionFingerprint(q.question);
      if (!fp) continue;
      if (seenFingerprints.has(fp)) continue;

      const correctOptText = Array.isArray(q.options)
        ? normalizeQuestionFingerprint(stripOptionPrefix(q.options[q.correctIndex ?? 0] || ''))
        : '';
      const stemWords = fp.split(' ').slice(0, 10).join(' ');
      const comboKey = `${stemWords}__${correctOptText}`;
      if (correctOptText && seenCorrectAnswerPairs.has(comboKey)) {
        continue;
      }

      seenFingerprints.add(fp);
      if (correctOptText) {
        seenCorrectAnswerPairs.add(comboKey);
      }
      sourceList.push(q);
    }
  }

  if (sourceList.length === 0) return [];

  const normalized = sourceList.map((q, idx) => {
    const isVerbatimUserQuestion =
      isUserUploadedSet ||
      String(q?.id || '').startsWith('docx_') ||
      String(q?.id || '').startsWith('user_') ||
      String(q?.id || '').startsWith('sample_') ||
      String(q?.id || '').startsWith('manual_');

    // Cho phép đáp án không có văn bản (chỉ có hình ảnh) giữ nguyên chuỗi rỗng ''
    const cleanOptions = [0, 1, 2, 3].map((optIdx) => {
      const rawOpt = Array.isArray(q.options) ? q.options[optIdx] : '';
      return stripOptionPrefix(String(rawOpt ?? ''));
    });

    const rawQText = String(q.question || `Question ${idx + 1}`).normalize('NFC').trim();
    const isAdvFromText = /\[(?:vận dụng\s*)?nâng cao\]/i.test(rawQText);
    const validCorrectIndex =
      typeof q.correctIndex === 'number' && q.correctIndex >= 0 && q.correctIndex <= 3
        ? q.correctIndex
        : 0;
    const correctLetter = ['A', 'B', 'C', 'D'][validCorrectIndex] || 'A';
    const correctOptionLabel =
      cleanOptions[validCorrectIndex] || `Option ${correctLetter}`;
    const cleanExplanation = String(
      q.explanation ||
        `The correct answer is "${correctOptionLabel}", which matches the key vocabulary and grammar pattern of this Primary English lesson.`
    )
      .normalize('NFC')
      .trim();

    // Nếu là câu hỏi từ file mẫu .docx người dùng tải lên -> giữ nguyên 100% văn bản gốc của câu hỏi
    const finalQuestionText = isVerbatimUserQuestion
      ? rawQText
      : sanitizePedagogicalQuestionStem(
          rawQText,
          cleanOptions,
          validCorrectIndex,
          cleanExplanation
        ) || rawQText;

    const isAdvanced = Boolean(
      q.isAdvanced || q.difficulty === 'nang_cao' || isAdvFromText
    );

    const detectedTopicKey =
      detectSemanticTopicKey(finalQuestionText, q.visualKey) ||
      detectSemanticTopicKey(cleanOptions[validCorrectIndex] || '', q.visualKey) ||
      detectSemanticTopicKey(cleanExplanation, q.visualKey) ||
      'english_classroom_general';

    const preservedOptionImages = Array.isArray(q.optionImages) ? q.optionImages : [];

    const draft: Question = {
      ...q,
      id: q.id || `q-${Date.now()}-${idx + 1}`,
      question: finalQuestionText,
      options: cleanOptions,
      correctIndex: validCorrectIndex,
      explanation: cleanExplanation,
      difficulty: isAdvanced ? 'nang_cao' : 'co_ban',
      isAdvanced,
      points: isAdvanced ? 15 : q.points || 10,
      visualDisplayMode:
        q.visualDisplayMode === 'options_image' ? 'options_image' : 'question_image',
      visualKey: q.visualKey || detectedTopicKey,
      visualData: q.visualData || '',
      questionSvg: q.questionSvg || '',
      visualPrompt: q.visualPrompt || '',
      optionImages: preservedOptionImages,
    };

    const resolvedMode = resolveVisualDisplayMode(draft);

    if (resolvedMode === 'options_image') {
      const uniformVisuals = getUniformOptionVisuals(draft) || cleanOptions;
      return {
        ...draft,
        visualDisplayMode: 'options_image' as const,
        visualPrompt: '',
        optionVisuals: uniformVisuals,
        optionSvgs: Array.isArray(q.optionSvgs) ? q.optionSvgs : [],
        optionImages: preservedOptionImages,
      };
    }

    return {
      ...draft,
      options: isVerbatimUserQuestion
        ? cleanOptions
        : cleanOptions.map((opt) => stripDecorativeEmojis(opt) || opt),
      visualDisplayMode: 'question_image' as const,
      visualKey: draft.visualKey || detectedTopicKey,
      visualPrompt: '',
      visualData: draft.visualData || '',
      questionSvg: draft.questionSvg || '',
      optionVisuals: [],
      optionSvgs: Array.isArray(q.optionSvgs) ? q.optionSvgs : [],
      optionImages: preservedOptionImages,
    };
  });

  // Chỉ tự động cân bằng số câu nâng cao khi câu hỏi do AI tạo (không tự ý sửa mức độ của file .docx người dùng tải lên)
  if (!isUserUploadedSet && normalized.length > 0) {
    const total = normalized.length;
    const minAdvanced = 1;
    const maxAdvanced = Math.min(3, total);
    const desiredAdvanced = total <= 5 ? 1 : total <= 10 ? 2 : Math.min(3, total);

    const currentAdvIndices = normalized
      .map((q, i) => (q.isAdvanced ? i : -1))
      .filter((i) => i !== -1);

    if (currentAdvIndices.length > maxAdvanced) {
      const keepSet = new Set(currentAdvIndices.slice(-maxAdvanced));
      normalized.forEach((q, idx) => {
        const keep = keepSet.has(idx);
        q.isAdvanced = keep;
        q.difficulty = keep ? 'nang_cao' : 'co_ban';
        q.points = keep ? 15 : 10;
      });
    } else if (currentAdvIndices.length < minAdvanced) {
      const needed = Math.min(desiredAdvanced, total);
      for (let k = 0; k < needed; k++) {
        const targetIdx = total - 1 - k;
        if (targetIdx >= 0) {
          normalized[targetIdx].isAdvanced = true;
          normalized[targetIdx].difficulty = 'nang_cao';
          normalized[targetIdx].points = 15;
        }
      }
    }
  }

  return normalized;
}

export async function extractQuizWithGemini(params: {
  lessonTitle: string;
  subject?: string;
  grade?: number;
  className?: string;
  questionCount: number;
  content?: string;
  pdfBase64?: string | null;
  excludeQuestions?: string[];
  onStatusUpdate?: (statusText: string) => void;
}): Promise<{
  success: boolean;
  questions?: Question[];
  resolvedLessonTitle?: string;
  isQuotaError?: boolean;
  isAuthError?: boolean;
  message?: string;
}> {
  const userKey = getStoredGeminiApiKey();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (userKey) {
    headers['x-gemini-api-key'] = userKey;
  }

  try {
    let pdfPageImages: PdfPageImagePart[] = [];
    let extractedPdfText = '';
    let resolvedLessonTitleFromToc: string | undefined = undefined;
    let inlineSmallPdfBase64: string | null = null;

    if (params.pdfBase64) {
      try {
        const prepared = await preparePdfLessonForGemini({
          pdfBase64: params.pdfBase64,
          lessonTitle: params.lessonTitle,
          subject: 'Tiếng Anh',
          grade: params.grade || 4,
          apiKey: userKey || undefined,
          onStatusUpdate: params.onStatusUpdate,
        });
        pdfPageImages = prepared.pageImages;
        extractedPdfText = prepared.extractedText;
        resolvedLessonTitleFromToc = prepared.resolvedLessonTitle;
      } catch (pdfPrepErr: any) {
        const prepAnalysis = analyzeGeminiError(pdfPrepErr);
        if (prepAnalysis.isQuotaError || prepAnalysis.isAuthError) {
          return {
            success: false,
            isQuotaError: prepAnalysis.isQuotaError,
            isAuthError: prepAnalysis.isAuthError,
            message: prepAnalysis.formattedMessage,
          };
        }
        // Nếu file PDF nhỏ (<= 3.2MB base64) có thể gửi trực tiếp
        if (params.pdfBase64.length <= 3_200_000) {
          inlineSmallPdfBase64 = params.pdfBase64;
        } else {
          return {
            success: false,
            message:
              'Không thể đọc tệp PDF đã tải lên: ' +
              (pdfPrepErr?.message || 'Vui lòng kiểm tra lại tệp PDF sách giáo khoa Tiếng Anh.'),
          };
        }
      }
    }

    const effectiveLessonTitle =
      resolvedLessonTitleFromToc || params.lessonTitle;

    params.onStatusUpdate?.(
      `AI Gemini (gemini-3-flash-preview) đang biên soạn ${params.questionCount} câu hỏi Tiếng Anh cấp Tiểu học từ bài "${effectiveLessonTitle.toUpperCase()}"...`
    );

    const response = await fetch('/api/gemini/extract-quiz', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        lessonTitle: effectiveLessonTitle,
        originalUserLessonInput: params.lessonTitle,
        resolvedLessonTitleFromToc,
        subject: 'Tiếng Anh',
        grade: params.grade,
        className: params.className,
        questionCount: params.questionCount,
        content: params.content,
        extractedPdfText,
        pdfPageImages,
        pdfBase64: inlineSmallPdfBase64,
        excludeQuestions: params.excludeQuestions,
        apiKey: userKey || undefined,
      }),
    });

    const result = await response.json().catch(() => null);
    if (!response.ok && !result) {
      throw new Error(`HTTP ${response.status}`);
    }

    if (result?.success && Array.isArray(result.data?.questions) && result.data.questions.length > 0) {
      const normalizedQuestions = normalizeQuestionVisuals(
        result.data.questions,
        params.excludeQuestions
      );
      const resolvedTitle = String(
        resolvedLessonTitleFromToc ||
          result.data.lessonTitle ||
          params.lessonTitle ||
          'BÀI HỌC'
      )
        .trim()
        .toUpperCase();

      return {
        success: true,
        questions: normalizedQuestions,
        resolvedLessonTitle: resolvedTitle,
      };
    }

    const errAnalysis = analyzeGeminiError(
      result?.message || result?.error || `HTTP ${response.status}`
    );
    return {
      success: false,
      isQuotaError: Boolean(result?.isQuotaError || errAnalysis.isQuotaError),
      isAuthError: Boolean(result?.isAuthError || errAnalysis.isAuthError),
      message: errAnalysis.formattedMessage,
    };
  } catch (err: any) {
    console.error('Gemini API extraction failed:', err);
    const analysis = analyzeGeminiError(err);
    return {
      success: false,
      isQuotaError: analysis.isQuotaError,
      isAuthError: analysis.isAuthError,
      message: analysis.formattedMessage,
    };
  }
}
