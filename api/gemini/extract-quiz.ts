import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Type } from '@google/genai';

/**
 * Sử dụng duy nhất Model Gemini 3 Flash Preview (gemini-3-flash-preview) cho toàn bộ chức năng của ứng dụng
 * theo đúng yêu cầu (tuyệt đối không sử dụng model gemini 2.5).
 */
const STABLE_GEMINI_MODELS = [
  'gemini-3-flash-preview',
  'gemini-3.8-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
];

function stripOptionPrefixServer(rawOption: string): string {
  let text = String(rawOption || '')
    .normalize('NFC')
    .trim();
  if (!text) return '';

  for (let i = 0; i < 3; i++) {
    const next = text
      .replace(
        /^(?:(?:đáp\s*án|phương\s*án|lựa\s*chọn|câu)\s*)?(?:[\(\[\{]?\s*[A-Da-d]\s*[\)\]\}]?\s*[\.\:\)\-\/–—]+|[\(\[\{][A-Da-d][\)\]\}]\s+)\s*/i,
        ''
      )
      .trim();
    if (next && next !== text) {
      text = next;
    } else {
      break;
    }
  }
  return text;
}

function stripDecorativeEmojisServer(text: string): string {
  return String(text || '')
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizePedagogicalQuestionStemServer(
  rawQuestion: string,
  options: string[],
  correctIndex: number,
  explanation: string
): string {
  let q = String(rawQuestion || '')
    .normalize('NFC')
    .replace(/^câu\s*(?:hỏi)?\s*\d+\s*[:.)-]?\s*/i, '')
    .trim();
  if (!q) return '';

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

function inferServerVisualKeyFromContext(text: string): string {
  const s = String(text || '').toLowerCase();
  if (!s) return 'english_classroom_general';
  if (/\bgood morning\b|\bgreeting\b|\bhello\b|\bhi\b|\bgoodbye\b|\bteacher\b/.test(s))
    return 'english_greeting';
  if (/\bpencil case\b|\bschool bag\b|\bnotebook\b|\bruler\b|\beraser\b|\bpen\b|\bpencil\b|\bbook\b|\bschool thing/.test(s))
    return 'english_school_things';
  if (/\bmonkey\b|\belephant\b|\btiger\b|\blion\b|\banimal\b|\bzoo\b|\bbird\b|\bcat\b|\bdog\b|\brabbit\b|\bbear\b/.test(s))
    return 'english_animals';
  if (/\bbadminton\b|\bfootball\b|\bsoccer\b|\bskipping\b|\bswimming\b|\bplaying\b|\bschoolyard\b|\bsport\b|\brunning\b/.test(s))
    return 'english_sports_actions';
  if (/\bclock\b|\bo'clock\b|\bwhat time\b|\bget up\b|\bbreakfast\b|\bbed\b|\bmorning\b/.test(s))
    return 'english_time_clock';
  if (/\bfamily\b|\bmother\b|\bfather\b|\bsister\b|\bbrother\b|\bgrandmother\b|\bgrandfather\b|\bparents\b/.test(s))
    return 'english_family';
  if (/\bfood\b|\bdrink\b|\bapple\b|\bmilk\b|\bbread\b|\brice\b|\bchicken\b|\bjuice\b|\bwater\b|\bbanana\b|\bcake\b/.test(s))
    return 'english_food_drinks';
  if (/\bweather\b|\bsunny\b|\brainy\b|\bcloudy\b|\bwindy\b|\bsummer\b|\bwinter\b|\bspring\b|\bautumn\b|\bholiday\b/.test(s))
    return 'english_weather_seasons';
  if (/\bhouse\b|\bbedroom\b|\bkitchen\b|\bliving room\b|\bbathroom\b|\bschool\b|\blibrary\b|\bpark\b|\bbus\b|\bcar\b|\bbike\b/.test(s))
    return 'english_places_transport';
  if (/\bcolor\b|\bcolour\b|\bred\b|\bblue\b|\byellow\b|\bgreen\b|\bnumber\b|\bhow many\b|\bhow old\b/.test(s))
    return 'english_colors_numbers';
  if (/\bdoctor\b|\bnurse\b|\bdriver\b|\bfarmer\b|\bworker\b|\bpilot\b|\bcook\b|\bjob\b/.test(s))
    return 'english_jobs';
  return 'english_classroom_general';
}

function sanitizeQuestionsArrayServer(questions: any[]): any[] {
  if (!Array.isArray(questions)) return [];
  return questions.map((q) => {
    if (!q || typeof q !== 'object') return q;
    const rawOptions = Array.isArray(q.options)
      ? q.options.map((opt: any) => stripOptionPrefixServer(String(opt || '')))
      : [];
    const correctIdx =
      typeof q.correctIndex === 'number' && q.correctIndex >= 0 && q.correctIndex <= 3
        ? q.correctIndex
        : 0;
    const explanation = String(q.explanation || '').normalize('NFC').trim();
    const cleanedQuestion = sanitizePedagogicalQuestionStemServer(
      String(q.question || ''),
      rawOptions,
      correctIdx,
      explanation
    );

    const existingVisualKey = String(q.visualKey || '').trim();
    const inferredVisualKey =
      existingVisualKey && existingVisualKey !== 'NONE' && existingVisualKey !== 'none'
        ? existingVisualKey
        : inferServerVisualKeyFromContext(
            `${cleanedQuestion} ${rawOptions[correctIdx] || ''} ${explanation}`
          );

    const rawSvg = String(q.questionSvg || '').trim();
    const validSvg = rawSvg.startsWith('<svg') && rawSvg.includes('</svg>') ? rawSvg : '';
    const cleanedOptions = rawOptions.map((opt: string) => stripDecorativeEmojisServer(opt) || opt);
    const rawOptSvgs = Array.isArray(q.optionSvgs)
      ? q.optionSvgs.map((s: any) => {
          const str = String(s || '').trim();
          return str.startsWith('<svg') && str.includes('</svg>') ? str : '';
        })
      : [];

    const isGrammarOptions = cleanedOptions.some((opt: string) =>
      /^(am|is|are|was|were|do|does|did|have|has|can|in|on|at|under|behind|near|to|for|with|a|an|the|he|she|it|they|we|you|i)$/i.test(
        opt.trim()
      )
    );

    const isOptionsImage =
      !isGrammarOptions &&
      (q.visualDisplayMode === 'options_image' ||
        rawOptSvgs.some(Boolean) ||
        (/(pencil case|school bag|blackboard|bicycle|ruler|notebook|book|pen|pencil|eraser|monkey|elephant|tiger|lion|rabbit|dog|cat|bird|fish|duck|o'clock|apple|banana|milk|bread|rice|juice|cake|ice cream|football|badminton|swimming|sunny|rainy|cloudy|windy|bus|car|plane|doctor|nurse|teacher|farmer|red|blue|yellow|green)/i.test(
          cleanedOptions.join(' ')
        ) &&
          !/_____/.test(cleanedQuestion)));

    return {
      ...q,
      question: cleanedQuestion || q.question,
      options: cleanedOptions,
      visualDisplayMode: isOptionsImage ? 'options_image' : 'question_image',
      visualKey: inferredVisualKey || 'english_classroom_general',
      visualPrompt: '',
      questionSvg: validSvg,
      visualData: String(q.visualData || '').trim(),
      optionVisuals: isOptionsImage ? cleanedOptions : [],
      optionSvgs: isOptionsImage ? rawOptSvgs : [],
    };
  });
}

function buildSmartFallbackEnglishQuizServer(
  lessonTitle: string,
  grade: number,
  questionCount: number,
  extractedPdfText: string,
  content: string,
  excludeQuestions: string[]
) {
  const combinedContext = `${lessonTitle} ${extractedPdfText} ${content}`.toLowerCase();
  const excludedSet = new Set(
    (Array.isArray(excludeQuestions) ? excludeQuestions : []).map((q) =>
      String(q || '').toLowerCase().trim()
    )
  );

  const questionBank = [
    {
      topic: 'greeting',
      keywords: ['hello', 'hi', 'greeting', 'morning', 'name', 'unit 1', 'unit 2', 'starter'],
      question: 'Look at the picture and choose the best greeting: When you meet your teacher in the morning, what do you say?',
      options: [
        'Good morning, teacher!',
        'Good night, teacher!',
        'Goodbye, see you tomorrow!',
        'Thank you very much!',
      ],
      correctIndex: 0,
      explanation:
        '"Good morning, teacher!" là lời chào buổi sáng trang trọng, lịch sự khi học sinh gặp thầy cô giáo ở trường.',
      visualDisplayMode: 'question_image',
      visualKey: 'english_greeting',
      isAdvanced: false,
    },
    {
      topic: 'greeting',
      keywords: ['hello', 'how are you', 'fine', 'name', 'unit 1', 'unit 2'],
      question: 'Complete the dialogue: "How _____ you today, Mai? - I am fine, thank you."',
      options: ['is', 'am', 'are', 'do'],
      correctIndex: 2,
      explanation:
        '"How are you today?" sử dụng động từ to be "are" đi kèm với chủ ngữ "you" để hỏi thăm sức khỏe.',
      visualDisplayMode: 'question_image',
      visualKey: 'english_greeting',
      isAdvanced: false,
    },
    {
      topic: 'school',
      keywords: ['school', 'pen', 'pencil', 'bag', 'book', 'ruler', 'classroom', 'unit 3', 'unit 6', 'unit 7', 'unit 8'],
      question: 'Which school thing do you use to keep your pens, pencils, and erasers neatly inside?',
      options: ['A pencil case', 'A blackboard', 'A football', 'A bicycle'],
      correctIndex: 0,
      explanation:
        '"A pencil case" (hộp bút) là đồ dùng học tập dùng để đựng bút mực, bút chì và cục tẩy gọn gàng.',
      visualDisplayMode: 'options_image',
      visualKey: 'english_school_things',
      isAdvanced: false,
    },
    {
      topic: 'animals',
      keywords: ['animal', 'zoo', 'monkey', 'elephant', 'tiger', 'bird', 'cat', 'dog', 'pet', 'unit 15', 'unit 16', 'unit 19'],
      question: 'Read the riddle and choose the correct animal: "I live at the zoo. I love eating bananas and I can climb trees very fast. Who am I?"',
      options: ['An elephant', 'A monkey', 'A goldfish', 'A turtle'],
      correctIndex: 1,
      explanation:
        '"A monkey" (con khỉ) là con vật thích ăn chuối ("eating bananas") và trèo cây rất giỏi ("climb trees").',
      visualDisplayMode: 'options_image',
      visualKey: 'english_animals',
      isAdvanced: true,
    },
    {
      topic: 'sports',
      keywords: ['sport', 'play', 'badminton', 'football', 'skipping', 'swimming', 'break time', 'unit 5', 'unit 10', 'unit 13'],
      question: 'Look at the schoolyard activity: "The students _____ playing badminton happily at break time."',
      options: ['am', 'is', 'are', 'does'],
      correctIndex: 2,
      explanation:
        'Câu ở thì Hiện tại tiếp diễn ("Present Continuous") với chủ ngữ số nhiều "The students" nên dùng "are + V-ing" ("are playing").',
      visualDisplayMode: 'question_image',
      visualKey: 'english_sports_actions',
      isAdvanced: false,
    },
    {
      topic: 'time',
      keywords: ['time', 'clock', 'get up', 'morning', 'daily', 'routine', 'sunday', 'week', 'unit 2', 'unit 3', 'unit 11'],
      question: 'Look at the question and choose the correct time: "What time do you get up in the morning?"',
      options: [
        "At six o'clock",
        "At nine o'clock",
        "At twelve o'clock",
        "At three o'clock",
      ],
      correctIndex: 0,
      explanation:
        '"At six o\'clock" (lúc 6 giờ đúng) là thời gian thức dậy buổi sáng phù hợp với câu hỏi "What time do you get up in the morning?".',
      visualDisplayMode: 'options_image',
      visualKey: 'english_time_clock',
      isAdvanced: true,
    },
    {
      topic: 'food',
      keywords: ['food', 'drink', 'milk', 'apple', 'bread', 'rice', 'juice', 'breakfast', 'lunch', 'party', 'unit 4', 'unit 14', 'unit 16'],
      question: 'Choose the healthy food or drink for breakfast: "Would you like some _____ and bread for breakfast?"',
      options: ['milk', 'pencil case', 'school bag', 'notebook'],
      correctIndex: 0,
      explanation:
        '"Milk" (sữa) là đồ uống bổ dưỡng dùng cho bữa sáng cùng với "bread" (bánh mì) trong mẫu câu mời lịch sự "Would you like some...?".',
      visualDisplayMode: 'options_image',
      visualKey: 'english_food_drinks',
      isAdvanced: false,
    },
    {
      topic: 'family',
      keywords: ['family', 'mother', 'father', 'sister', 'brother', 'job', 'doctor', 'nurse', 'teacher', 'farmer', 'unit 11', 'unit 12'],
      question: 'Read and choose the correct job: "My mother works at a hospital and takes care of sick people. What is her job?"',
      options: ['A doctor', 'A farmer', 'A teacher', 'A driver'],
      correctIndex: 0,
      explanation:
        '"A doctor" (bác sĩ) làm việc tại bệnh viện ("works at a hospital") và khám chữa bệnh cho mọi người.',
      visualDisplayMode: 'options_image',
      visualKey: 'english_jobs',
      isAdvanced: true,
    },
    {
      topic: 'weather',
      keywords: ['weather', 'sunny', 'rainy', 'cloudy', 'windy', 'summer', 'winter', 'season', 'unit 17', 'unit 18', 'unit 20'],
      question: 'Look outside: The sun is shining brightly in the blue sky. What is the weather like today?',
      options: ['It is sunny', 'It is rainy', 'It is cloudy', 'It is windy'],
      correctIndex: 0,
      explanation:
        '"It is sunny" (trời nắng đẹp) phù hợp với mô tả mặt trời chiếu sáng rực rỡ trên bầu trời xanh ("The sun is shining brightly").',
      visualDisplayMode: 'options_image',
      visualKey: 'english_weather_seasons',
      isAdvanced: false,
    },
    {
      topic: 'colors',
      keywords: ['color', 'colour', 'red', 'blue', 'yellow', 'green', 'what colour', 'unit 9'],
      question: 'Choose the correct color: "What color is the ripe banana on the table?"',
      options: ['Yellow', 'Blue', 'Red', 'Green'],
      correctIndex: 0,
      explanation:
        '"Yellow" (màu vàng) là màu sắc chính xác của quả chuối chín ("ripe banana").',
      visualDisplayMode: 'options_image',
      visualKey: 'english_colors_numbers',
      isAdvanced: false,
    },
  ];

  const scored = questionBank.map((item, idx) => {
    let score = 0;
    for (const kw of item.keywords) {
      if (combinedContext.includes(kw)) score += 5;
    }
    if (!excludedSet.has(item.question.toLowerCase().trim())) {
      score += 2;
    }
    return { item, score, idx };
  });

  scored.sort((a, b) => b.score - a.score || a.idx - b.idx);

  const selected = scored.slice(0, Math.max(1, questionCount)).map((entry, idx) => {
    const q = entry.item;
    const isAdv = idx === Math.min(2, questionCount - 1) || q.isAdvanced;
    return {
      id: `q-${idx + 1}`,
      question: q.question,
      options: q.options,
      difficulty: isAdv ? 'nang_cao' : 'co_ban',
      isAdvanced: isAdv,
      visualDisplayMode: q.visualDisplayMode,
      visualKey: q.visualKey,
      visualPrompt: '',
      questionSvg: '',
      optionVisuals: q.visualDisplayMode === 'options_image' ? q.options : [],
      optionSvgs: [],
      correctIndex: q.correctIndex,
      explanation: q.explanation,
      visualType: 'ICON',
      visualData: '',
      points: 10,
    };
  });

  return {
    lessonTitle: String(lessonTitle || `UNIT 1: HELLO (GRADE ${grade})`).trim().toUpperCase(),
    subject: 'Tiếng Anh',
    grade,
    questions: sanitizeQuestionsArrayServer(selected),
  };
}

function analyzeServerGeminiError(errOrMsg: any): {
  isQuotaError: boolean;
  isAuthError: boolean;
  message: string;
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
      message:
        '⚠️ LỖI HẾT HẠN MỨC (QUOTA) GEMINI API KEY: Khóa API Gemini hiện tại đã hết hạn mức sử dụng (Quota Exhausted / 429). Vui lòng bấm "Cài Đặt API Key" để THAY ĐỔI API KEY GEMINI mới!',
    };
  }

  const isAuthError =
    lower.includes('api_key_invalid') ||
    lower.includes('api key not valid') ||
    lower.includes('invalid api key') ||
    lower.includes('unauthenticated') ||
    lower.includes('permission_denied');

  if (isAuthError) {
    return {
      isQuotaError: false,
      isAuthError: true,
      message:
        '🔑 LỖI KHÓA GEMINI API KEY: Khóa API không hợp lệ hoặc đã bị thu hồi. Vui lòng bấm "Cài Đặt API Key" để nhập API KEY GEMINI mới!',
    };
  }

  return {
    isQuotaError: false,
    isAuthError: false,
    message: raw || 'Lỗi xử lý Gemini API trên máy chủ.',
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, x-gemini-api-key'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      action,
      lessonTitle = 'Unit 1: Hello',
      originalUserLessonInput = '',
      resolvedLessonTitleFromToc = '',
      subject = 'Tiếng Anh',
      grade,
      className = '',
      questionCount = 5,
      content = '',
      extractedPdfText = '',
      pdfPageImages = [],
      pdfBase64 = null,
      totalPages = 0,
      excludeQuestions = [],
      apiKey: bodyApiKey,
    } = req.body || {};

    const customKey = String((req.headers['x-gemini-api-key'] as string) || bodyApiKey || '').trim();
    const envKey = String(process.env.GEMINI_API_KEY || '').trim();
    const candidateKeys = Array.from(new Set([customKey, envKey].filter(Boolean)));

    if (candidateKeys.length === 0) {
      return res.status(200).json({
        success: false,
        isAuthError: true,
        message:
          '🔑 Chưa cấu hình GEMINI API KEY. Vui lòng bấm "Cài Đặt API Key" (biểu tượng bánh răng) để nhập khóa Gemini API của bạn!',
      });
    }

    if (action === 'test-key') {
      const keyToTest = customKey || candidateKeys[0];
      const testAi = new GoogleGenAI({
        apiKey: keyToTest,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      });
      let lastErr: any = null;
      for (const m of STABLE_GEMINI_MODELS) {
        try {
          const response = await testAi.models.generateContent({
            model: m,
            contents: 'Trả lời ngắn gọn: OK',
          });
          if (response.text) {
            return res.status(200).json({
              success: true,
              message: `Kết nối thành công với Model (${m})! Khóa API hoạt động tốt.`,
            });
          }
        } catch (err: any) {
          lastErr = err;
          const analysis = analyzeServerGeminiError(err);
          if (analysis.isAuthError) {
            return res.status(200).json({
              success: false,
              isQuotaError: false,
              isAuthError: true,
              message: analysis.message,
            });
          }
        }
      }
      const finalAnalysis = analyzeServerGeminiError(lastErr);
      return res.status(200).json({
        success: false,
        isQuotaError: finalAnalysis.isQuotaError,
        isAuthError: finalAnalysis.isAuthError,
        message: finalAnalysis.message,
      });
    }

    const detectedGrade =
      grade ||
      (String(className).match(/[1-5]/) ? parseInt(String(className).match(/[1-5]/)![0], 10) : 4);

    // ACTION: Đọc trang MỤC LỤC của PDF sách giáo khoa Tiếng Anh Tiểu học để xác định chính xác Tên bài học & Số trang của bài học
    if (action === 'locate-lesson') {
      const locateParts: any[] = [];
      if (Array.isArray(pdfPageImages)) {
        for (const img of pdfPageImages) {
          if (img && img.data) {
            locateParts.push({
              text: `Hình ảnh Trang PDF số ${img.pageNumber} (trên tổng số ${totalPages || 'nhiều'} trang PDF):`,
            });
            locateParts.push({
              inlineData: {
                mimeType: img.mimeType || 'image/jpeg',
                data: img.data,
              },
            });
          }
        }
      }

      const locatePrompt = `Bạn đang đọc các trang đầu / trang MỤC LỤC (Book Map / Contents) của cuốn Sách Giáo Khoa môn Tiếng Anh cấp Tiểu học (Khối ${detectedGrade}) gồm tổng cộng ${totalPages} trang PDF.
Người dùng muốn tìm bài học / đơn vị bài học (Unit / Lesson): "${lessonTitle}".
${extractedPdfText ? `\nVăn bản trích xuất từ các trang này:\n${extractedPdfText}\n` : ''}
Nhiệm vụ của bạn:
1. Quan sát kỹ trang MỤC LỤC (Contents / Book Map) trong các hình ảnh trang PDF đính kèm.
2. Tìm đúng dòng tương ứng với bài học "${lessonTitle}" (Ví dụ: nếu người dùng nhập "Unit 1" hoặc "Unit 2" thì tìm đúng tên đầy đủ của Unit đó trong Mục lục sách Tiếng Anh Tiểu học).
3. Xác định:
   - "found": true nếu tìm thấy bài học trong Mục lục hoặc các trang đính kèm.
   - "exactLessonTitle": Tên đầy đủ chính xác 100% theo Mục lục, viết IN HOA (Ví dụ: "UNIT 1: HELLO" hoặc "UNIT 2: OUR NAMES").
   - "printedStartPage": Số trang in trên sách của bài học đó ghi ở cột Page/Trang trong Mục lục.
   - "printedEndPage": Số trang in trên sách kết thúc bài học đó.
   - "pageOffset": Độ lệch giữa Số trang PDF và Số trang in trên sách (pdfPageNumber - printedPageNumber).
   - "pdfStartPage": printedStartPage + pageOffset.
   - "pdfEndPage": printedEndPage + pageOffset.`;

      locateParts.push({ text: locatePrompt });

      const locateSchema = {
        type: Type.OBJECT,
        properties: {
          found: { type: Type.BOOLEAN },
          exactLessonTitle: { type: Type.STRING },
          printedStartPage: { type: Type.INTEGER },
          printedEndPage: { type: Type.INTEGER },
          pageOffset: { type: Type.INTEGER },
          pdfStartPage: { type: Type.INTEGER },
          pdfEndPage: { type: Type.INTEGER },
        },
        required: [
          'found',
          'exactLessonTitle',
          'printedStartPage',
          'printedEndPage',
          'pageOffset',
          'pdfStartPage',
          'pdfEndPage',
        ],
      };

      for (const apiKeyCandidate of candidateKeys) {
        const ai = new GoogleGenAI({
          apiKey: apiKeyCandidate,
          httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
        });
        for (const modelName of STABLE_GEMINI_MODELS) {
          try {
            const response = await ai.models.generateContent({
              model: modelName,
              contents: { parts: locateParts },
              config: {
                responseMimeType: 'application/json',
                responseSchema: locateSchema,
              },
            });
            const parsedLocate = JSON.parse(response.text || '{}');
            return res.status(200).json({
              success: true,
              data: parsedLocate,
            });
          } catch {
            // Tiếp tục thử model / key tiếp theo nếu gặp lỗi 429
          }
        }
      }

      return res.status(200).json({
        success: false,
        data: { found: false },
      });
    }

    const targetAdvancedCount =
      questionCount <= 5 ? 1 : questionCount <= 10 ? 2 : 3;

    const exclusionBlock =
      Array.isArray(excludeQuestions) && excludeQuestions.length > 0
        ? `\nDANH SÁCH CÂU HỎI ĐÃ SỬ DỤNG (TUYỆT ĐỐI KHÔNG ĐƯỢC LẶP LẠI HOẶC TRÙNG NỘI DUNG):\n${excludeQuestions
            .slice(0, 30)
            .map((q: string, idx: number) => `  - Câu cũ ${idx + 1}: "${q}"`)
            .join('\n')}\n`
        : '';

    const hasUploadedPdfContent =
      (Array.isArray(pdfPageImages) && pdfPageImages.length > 0) ||
      Boolean(extractedPdfText && extractedPdfText.trim().length > 20) ||
      Boolean(pdfBase64);

    const systemInstruction = `Bạn là một Chuyên gia Sư phạm môn Tiếng Anh cấp Tiểu học (Chương trình GDPT 2018 - Khối lớp 1, 2, 3, 4, 5: Global Success, Family and Friends, i-Learn Smart Start, Wonderful World, Macmillan...) tại Việt Nam.
Nhiệm vụ của bạn là đọc kỹ nội dung bài học "${lessonTitle}"${
      originalUserLessonInput && originalUserLessonInput !== lessonTitle
        ? ` (Người dùng tìm: "${originalUserLessonInput}")`
        : ''
    } thuộc môn Tiếng Anh cấp Tiểu học (Khối ${detectedGrade} ${
      className ? `- Lớp ${className}` : ''
    }) và tài liệu Sách Giáo Khoa Tiếng Anh đính kèm để biên soạn đúng ${questionCount} câu hỏi trắc nghiệm khách quan MANG TÍNH CHIỀU SÂU SƯ PHẠM, CHUẨN NGỮ PHÁP - TỪ VỰNG - GIAO TIẾP TIẾNG ANH TIỂU HỌC VÀ DỄ HIỂU.

YÊU CẦU BẮT BUỘC TUYỆT ĐỐI:
1. DÀNH RIÊNG CHO MÔN TIẾNG ANH CẤP TIỂU HỌC (KHỐI 1 - 5) & BÁM SÁT 100% TÀI LIỆU / BÀI HỌC:
   - ${
     hasUploadedPdfContent
       ? `Người dùng ĐÃ TẢI LÊN TÀI LIỆU SÁCH GIÁO KHOA TIẾNG ANH PDF${
           resolvedLessonTitleFromToc
             ? ` và Mục lục sách đã xác nhận tên bài học là "${resolvedLessonTitleFromToc}"`
             : ''
         }. Bạn BẮT BUỘC phải đọc kỹ từng trang hình ảnh/văn bản của bài học trong tài liệu PDF đính kèm để lấy đúng tên bài học (Unit / Lesson) và tạo toàn bộ ${questionCount} câu hỏi Tiếng Anh bám sát 100% Từ vựng (Vocabulary), Mẫu câu (Sentence Patterns), Ngữ âm (Phonics), Hội thoại giao tiếp (Everyday English) và Đọc hiểu (Reading) trong các trang sách đó.`
       : `Hãy tạo bộ câu hỏi trắc nghiệm môn Tiếng Anh cấp Tiểu học bám sát 100% chủ đề / bài học "${lessonTitle}" (Khối ${detectedGrade}) theo chương trình Tiếng Anh Tiểu học GDPT 2018 (bao gồm Vocabulary, Sentence Patterns, Phonics, Communication và Reading).`
   }
   - Xuất trường "lessonTitle" là tên đầy đủ, chính xác của bài học Tiếng Anh VIẾT IN HOA TOÀN BỘ${
     resolvedLessonTitleFromToc ? ` (Giữ đúng "${resolvedLessonTitleFromToc}")` : ''
   }.

2. NGHIÊM CẤM TUYỆT ĐỐI CÁC CÂU HỎI ĐÁNH ĐỐ VỊ TRÍ BỐ CỤC TRANG SÁCH:
   - TUYỆT ĐỐI KHÔNG đặt câu hỏi dựa trên vị trí trình bày hình thức của sách giáo khoa (Ví dụ: không hỏi "Ở Activity 2 trang 10 nhân vật đứng bên trái mặc áo màu gì?" mà không có ngữ cảnh).
   - MỖI CÂU HỎI TIẾNG ANH PHẢI ĐỘC LẬP, RÕ RÀNG, TỰ ĐẦY ĐỦ NGỮ CẢNH: Đa dạng hóa các dạng bài chuẩn sư phạm Tiếng Anh Tiểu học như:
     + Chọn từ hoàn thành câu / mẫu câu giao tiếp (Complete the sentence / dialogue).
     + Chọn từ khác nhóm (Choose the odd one out).
     + Chọn đáp án đúng cho câu hỏi giao tiếp (Choose the best response).
     + Sắp xếp từ thành câu đúng (Arrange the words to make a correct sentence).
     + Đọc câu/đoạn văn ngắn và chọn thông tin đúng (Read and choose the correct answer).
   - Phần giải thích ("explanation") viết song ngữ rõ ràng: câu đầu viết bằng Tiếng Anh nêu câu/đáp án đúng hoàn chỉnh (đặt các từ/câu Tiếng Anh trong dấu ngoặc kép "..." để bộ đọc nhận diện chính xác 100% phần Tiếng Anh đọc chuẩn giọng Mỹ en-US và phần giải thích ngữ pháp/nghĩa từ vựng Tiếng Việt đọc chuẩn giọng Tiếng Việt vi-VN).
   - Bộ đề có ${questionCount} câu hỏi thì cả ${questionCount} câu phải hoàn toàn khác nhau, TUYỆT ĐỐI KHÔNG trùng lặp nội dung.${exclusionBlock}

3. BẮT BUỘC CÓ TỪ 1 ĐẾN 3 CÂU HỎI NÂNG CAO (difficulty = "nang_cao", isAdvanced = true):
   - Trong bộ ${questionCount} câu hỏi phải có đúng ${targetAdvancedCount} câu hỏi nâng cao / vận dụng (đặt "difficulty": "nang_cao", "isAdvanced": true).
   - Các câu hỏi còn lại đặt "difficulty": "co_ban", "isAdvanced": false.

4. QUY TẮC ĐỊNH DẠNG ĐÁP ÁN ("options") — KHÔNG LẶP CHỮ CÁI A, B, C, D:
   - Giao diện trò chơi đã có sẵn huy hiệu tròn A, B, C, D ở bên trái mỗi nút đáp án.
   - Do đó, trong mảng "options" gồm 4 phần tử, CHỈ GHI NỘI DUNG ĐÁP ÁN THUẦN TÚY, TUYỆT ĐỐI KHÔNG ghi kèm chữ cái "A.", "B.", "C.", "D." ở đầu chuỗi!

5. QUY TẮC HÌNH ẢNH MINH HỌA TRỰC QUAN CHÍNH XÁC TUYỆT ĐỐI (LINH HOẠT GIỮA CÂU HỎI VÀ ĐÁP ÁN):
   - TUYỆT ĐỐI KHÔNG mặc định tất cả câu hỏi đều là "question_image". Trong một bộ đề ${questionCount} câu hỏi, bạn BẮT BUỘC phải phân bổ linh hoạt, ngẫu nhiên và CHÍNH XÁC TUYỆT ĐỐI DỰA VÀO NỘI DUNG giữa 2 chế độ:
     + Chế độ 1 ("visualDisplayMode": "question_image"): Dùng cho câu hỏi mô tả tình huống giao tiếp, hội thoại, điền từ ngữ pháp (am/is/are/do/in/on/under...) hoặc hỏi về một bức tranh chung. Khi đó, trường "questionSvg" BẮT BUỘC là mã đồ họa vector SVG (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 220">...</svg>) vẽ TRỰC TIẾP hình ảnh sự vật, nhân vật, bối cảnh bằng các thẻ đồ họa (<circle>, <ellipse>, <rect>, <path>, <polygon>, <line>) với ít nhất 8 phần tử hình học sinh động. TUYỆT ĐỐI KHÔNG viết chữ câu hỏi, không viết dấu "_____" và không viết prompt mô tả vào trong SVG!
     + Chế độ 2 ("visualDisplayMode": "options_image"): Dùng cho câu hỏi từ vựng, nhận diện đồ vật học tập, con vật, đồ ăn thức uống, màu sắc, nghề nghiệp, phương tiện, thời tiết, hoạt động hoặc giờ trên đồng hồ mà 4 đáp án A, B, C, D là 4 đối tượng cụ thể. Khi đó, đặt "visualDisplayMode": "options_image" và cung cấp mảng "optionSvgs" gồm đúng 4 mã SVG (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 220">...</svg>) vẽ chính xác tuyệt đối hình ảnh của từng đáp án A, B, C, D (tuyệt đối không viết chữ hay viết prompt thay cho hình vẽ!).`;

    const promptText = `Thông tin bài học cần tạo bộ câu hỏi trắc nghiệm chuẩn xác 100%:
- Tên bài học yêu cầu: "${lessonTitle}"${
      resolvedLessonTitleFromToc
        ? `\n- Tên bài học chính xác tra cứu từ Mục lục sách giáo khoa PDF: "${resolvedLessonTitleFromToc}"`
        : ''
    }
- Môn học: ${subject}
- Khối/Lớp: Khối ${detectedGrade} ${className ? `(Lớp ${className})` : ''}
${content ? `- Ghi chú bổ sung: ${content}` : ''}
${
  extractedPdfText
    ? `\n=== NỘI DUNG VĂN BẢN TRÍCH XUẤT TỪ SÁCH GIÁO KHOA PDF ===\n${extractedPdfText}\n========================================================\n`
    : ''
}
${exclusionBlock}
Hãy đọc kỹ toàn bộ các trang hình ảnh và văn bản của bài học "${
      resolvedLessonTitleFromToc || lessonTitle
    }" trong tài liệu đính kèm và xuất JSON gồm:
1. "lessonTitle": Tên đầy đủ, chính xác của bài học viết IN HOA${
      resolvedLessonTitleFromToc ? ` (Bắt buộc là "${resolvedLessonTitleFromToc}")` : ''
    }.
2. "questions": Đúng ${questionCount} câu hỏi trắc nghiệm KHÁC NHAU HOÀN TOÀN (không trùng lặp nội dung), bám sát 100% kiến thức trọng tâm của bài học "${
      resolvedLessonTitleFromToc || lessonTitle
    }":
   - TUYỆT ĐỐI KHÔNG có câu hỏi đánh đố hoặc hỏi vị trí bố cục văn bản.
   - Kết hợp linh hoạt, ngẫu nhiên và chính xác tuyệt đối dựa vào nội dung giữa "visualDisplayMode": "question_image" (hình ảnh ở phần câu hỏi qua "questionSvg") và "visualDisplayMode": "options_image" (hình ảnh ở cả 4 đáp án A, B, C, D qua "optionSvgs"). Hình vẽ SVG phải là hình ảnh trực quan chính xác 100% bằng hình khối đồ họa, tuyệt đối không viết prompt hay chép lại câu hỏi vào ảnh.
   - Có đúng ${targetAdvancedCount} câu hỏi nâng cao ("isAdvanced": true, "difficulty": "nang_cao"), và trong "options" TUYỆT ĐỐI KHÔNG ghi kèm chữ cái "A.", "B.", "C.", "D." ở đầu đáp án.`;

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        lessonTitle: { type: Type.STRING },
        subject: { type: Type.STRING },
        grade: { type: Type.NUMBER },
        questions: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              question: { type: Type.STRING },
              options: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              difficulty: { type: Type.STRING },
              isAdvanced: { type: Type.BOOLEAN },
              visualDisplayMode: { type: Type.STRING },
              visualKey: { type: Type.STRING },
              visualPrompt: { type: Type.STRING },
              questionSvg: { type: Type.STRING },
              optionVisuals: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              optionSvgs: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              correctIndex: { type: Type.INTEGER },
              explanation: { type: Type.STRING },
              visualType: { type: Type.STRING },
              visualData: { type: Type.STRING },
              points: { type: Type.INTEGER },
            },
            required: [
              'id',
              'question',
              'options',
              'difficulty',
              'isAdvanced',
              'visualDisplayMode',
              'visualKey',
              'visualPrompt',
              'questionSvg',
              'optionVisuals',
              'optionSvgs',
              'correctIndex',
              'explanation',
              'visualType',
              'visualData',
            ],
          },
        },
      },
      required: ['lessonTitle', 'questions'],
    };

    const parts: any[] = [];
    if (Array.isArray(pdfPageImages) && pdfPageImages.length > 0) {
      for (const pageImg of pdfPageImages) {
        if (pageImg && pageImg.data) {
          parts.push({
            text: `Trang sách giáo khoa PDF (Trang số ${pageImg.pageNumber}):`,
          });
          parts.push({
            inlineData: {
              mimeType: pageImg.mimeType || 'image/jpeg',
              data: pageImg.data,
            },
          });
        }
      }
    } else if (pdfBase64 && pdfBase64.length <= 18_500_000) {
      parts.push({
        inlineData: {
          mimeType: 'application/pdf',
          data: pdfBase64,
        },
      });
    }
    parts.push({ text: promptText });

    let parsedData: any = null;
    let lastErr: any = null;
    let quotaErr: any = null;

    outerLoop: for (const apiKeyCandidate of candidateKeys) {
      const ai = new GoogleGenAI({
        apiKey: apiKeyCandidate,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      });

      for (const modelName of STABLE_GEMINI_MODELS) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: parts.length === 1 ? promptText : { parts },
            config: {
              systemInstruction,
              responseMimeType: 'application/json',
              responseSchema,
            },
          });

          const responseText = response.text || '{}';
          const candidate = JSON.parse(responseText);
          if (candidate && Array.isArray(candidate.questions) && candidate.questions.length > 0) {
            candidate.lessonTitle = String(
              resolvedLessonTitleFromToc || candidate.lessonTitle || lessonTitle || ''
            )
              .trim()
              .toUpperCase();
            candidate.questions = sanitizeQuestionsArrayServer(candidate.questions);
            parsedData = candidate;
            break outerLoop;
          }
        } catch (err) {
          lastErr = err;
          const check = analyzeServerGeminiError(err);
          if (check.isQuotaError) quotaErr = err;
          if (check.isAuthError) break;
        }
      }
    }

    if (!parsedData) {
      // Nếu tất cả các model Free Tier đều chạm giới hạn Quota 429 trong ngày,
      // tự động cung cấp bộ câu hỏi chuẩn Sư phạm Tiếng Anh Tiểu học khớp chủ đề bài học để không làm gián đoạn tiết dạy
      if (quotaErr || analyzeServerGeminiError(lastErr).isQuotaError) {
        const fallbackQuiz = buildSmartFallbackEnglishQuizServer(
          resolvedLessonTitleFromToc || lessonTitle,
          detectedGrade,
          questionCount,
          extractedPdfText,
          content,
          excludeQuestions
        );
        return res.status(200).json({
          success: true,
          data: fallbackQuiz,
        });
      }
      throw lastErr || new Error('Không thể khởi tạo câu hỏi từ Gemini API');
    }

    return res.status(200).json({
      success: true,
      data: parsedData,
    });
  } catch (error: any) {
    const analysis = analyzeServerGeminiError(error);
    return res.status(200).json({
      success: false,
      isQuotaError: analysis.isQuotaError,
      isAuthError: analysis.isAuthError,
      error: analysis.message,
      message: analysis.message,
    });
  }
}
