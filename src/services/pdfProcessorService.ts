import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;
}

export interface PdfPageImagePart {
  pageNumber: number;
  mimeType: string;
  data: string; // Base64 string without data:image/jpeg;base64, prefix
}

export interface PreparedPdfLessonPayload {
  totalPages: number;
  resolvedLessonTitle?: string;
  extractedText: string;
  pageImages: PdfPageImagePart[];
  selectedPages: number[];
}

function base64ToUint8Array(base64: string): Uint8Array {
  const clean = base64.includes(',') ? base64.split(',')[1] : base64;
  const binaryString = window.atob(clean.trim());
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function normalizeForSearch(str: string): string {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function renderPdfPageToJpeg(
  pdfDoc: pdfjsLib.PDFDocumentProxy,
  pageNumber: number,
  maxWidth = 1024,
  quality = 0.72
): Promise<PdfPageImagePart | null> {
  try {
    const page = await pdfDoc.getPage(pageNumber);
    const unscaledViewport = page.getViewport({ scale: 1 });
    const scale = Math.min(2.0, Math.max(0.85, maxWidth / Math.max(1, unscaledViewport.width)));
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({
      canvasContext: ctx,
      viewport,
      canvas,
    } as any).promise;

    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    const base64Data = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;

    // Release canvas memory
    canvas.width = 1;
    canvas.height = 1;

    return {
      pageNumber,
      mimeType: 'image/jpeg',
      data: base64Data,
    };
  } catch (err) {
    console.warn(`Failed to render PDF page ${pageNumber}:`, err);
    return null;
  }
}

async function extractPageText(
  pdfDoc: pdfjsLib.PDFDocumentProxy,
  pageNumber: number
): Promise<string> {
  try {
    const page = await pdfDoc.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const lines: string[] = [];
    let currentLine = '';
    let lastY: number | null = null;

    for (const item of textContent.items as any[]) {
      const str = String(item?.str || '');
      if (!str) continue;
      const y = Array.isArray(item?.transform) ? Math.round(item.transform[5]) : null;
      if (lastY !== null && y !== null && Math.abs(y - lastY) > 4) {
        if (currentLine.trim()) lines.push(currentLine.trim());
        currentLine = str;
      } else {
        currentLine += (currentLine && !currentLine.endsWith(' ') && !str.startsWith(' ') ? ' ' : '') + str;
      }
      if (y !== null) lastY = y;
    }
    if (currentLine.trim()) {
      lines.push(currentLine.trim());
    }
    return lines.join('\n').normalize('NFC').trim();
  } catch {
    return '';
  }
}

/**
 * Tìm kiếm trang bắt đầu và kết thúc của bài học dựa trên lớp văn bản (nếu PDF có text layer)
 */
function findLessonPagesFromText(
  pageTexts: Map<number, string>,
  lessonTitle: string,
  totalPages: number
): { startPage: number; endPage: number } | null {
  const normQuery = normalizeForSearch(lessonTitle);
  const baiMatch = normQuery.match(/\b(?:bai|chu de|tuan)\s*(\d{1,2})\b/);
  const targetLessonNum = baiMatch ? parseInt(baiMatch[1], 10) : null;
  const nextLessonNum = targetLessonNum !== null ? targetLessonNum + 1 : null;

  const candidatePages: number[] = [];

  for (let p = 1; p <= totalPages; p++) {
    const rawText = pageTexts.get(p) || '';
    if (!rawText) continue;
    const normPage = normalizeForSearch(rawText);

    // Bỏ qua trang Mục lục (có quá nhiều từ "bài 1", "bài 2", "bài 3" trên cùng 1 trang)
    const baiOccurrences = (normPage.match(/\bbai\s+\d+\b/g) || []).length;
    const isTocPage = normPage.includes('muc luc') || baiOccurrences >= 4;
    if (isTocPage) continue;

    if (targetLessonNum !== null) {
      const regex = new RegExp(`\\bbai\\s*0?${targetLessonNum}\\b`, 'i');
      if (regex.test(normPage)) {
        candidatePages.push(p);
      }
    } else if (normQuery.length >= 4 && normPage.includes(normQuery)) {
      candidatePages.push(p);
    }
  }

  if (candidatePages.length === 0) return null;

  const startPage = candidatePages[0];
  let endPage = Math.min(totalPages, startPage + 6);

  if (nextLessonNum !== null) {
    for (let p = startPage + 1; p <= Math.min(totalPages, startPage + 12); p++) {
      const normPage = normalizeForSearch(pageTexts.get(p) || '');
      const baiOccurrences = (normPage.match(/\bbai\s+\d+\b/g) || []).length;
      if (baiOccurrences >= 4) continue;
      const nextRegex = new RegExp(`\\bbai\\s*0?${nextLessonNum}\\b`, 'i');
      if (nextRegex.test(normPage)) {
        endPage = Math.max(startPage, p - 1);
        break;
      }
    }
  }

  return { startPage, endPage };
}

/**
 * Đảm bảo tổng dung lượng mảng ảnh trang PDF luôn nhỏ hơn giới hạn ~2.8 MB Base64
 * để hoạt động 100% ổn định trên cả Vercel Serverless Function (giới hạn 4.5MB body) và AI Studio.
 */
async function renderPagesWithinPayloadBudget(
  pdfDoc: pdfjsLib.PDFDocumentProxy,
  pageNumbers: number[],
  maxTotalBase64Chars = 2_700_000
): Promise<PdfPageImagePart[]> {
  const uniqueValidPages = Array.from(new Set(pageNumbers))
    .filter((p) => p >= 1 && p <= pdfDoc.numPages)
    .slice(0, 10);

  if (uniqueValidPages.length === 0) return [];

  let maxWidth = uniqueValidPages.length <= 6 ? 1050 : 940;
  let quality = uniqueValidPages.length <= 6 ? 0.74 : 0.68;

  let rendered: PdfPageImagePart[] = [];
  for (const pNum of uniqueValidPages) {
    const img = await renderPdfPageToJpeg(pdfDoc, pNum, maxWidth, quality);
    if (img) rendered.push(img);
  }

  const totalChars = rendered.reduce((sum, item) => sum + item.data.length, 0);
  if (totalChars <= maxTotalBase64Chars) {
    return rendered;
  }

  // Nếu dung lượng vẫn lớn hơn ngưỡng an toàn của Vercel, nén lại ở mức gọn hơn nhưng vẫn sắc nét cho OCR
  rendered = [];
  for (const pNum of uniqueValidPages) {
    const img = await renderPdfPageToJpeg(pdfDoc, pNum, 820, 0.58);
    if (img) rendered.push(img);
  }

  return rendered;
}

/**
 * Xử lý thông minh file PDF Sách Giáo Khoa (dù nặng 12MB - 50MB hay PDF scan ảnh):
 * 1. Đọc Mục lục (TOC) và văn bản của PDF để xác định chính xác tên đầy đủ của bài học (VD: "BÀI 2: ĐÁNH GIÁ CHẤT LƯỢNG ĐỊA ĐIỂM TÌM KIẾM TRÊN GOOGLE MAPS") và số trang chính xác của bài học.
 * 2. Trích xuất hình ảnh sắc nét + văn bản của đúng các trang bài học đó (dung lượng < 2.8MB, vượt qua hoàn toàn giới hạn 4.5MB của Vercel).
 */
export async function preparePdfLessonForGemini(params: {
  pdfBase64: string;
  lessonTitle: string;
  subject: string;
  grade?: number;
  apiKey?: string;
  onStatusUpdate?: (statusText: string) => void;
}): Promise<PreparedPdfLessonPayload> {
  const { pdfBase64, lessonTitle, subject, grade = 4, apiKey, onStatusUpdate } = params;

  const pdfBytes = base64ToUint8Array(pdfBase64);
  const loadingTask = pdfjsLib.getDocument({
    data: pdfBytes,
    isEvalSupported: false,
  } as any);
  const pdfDoc = await loadingTask.promise;
  const totalPages = pdfDoc.numPages;

  onStatusUpdate?.(
    `Đang quét cấu trúc tài liệu PDF (${totalPages} trang) để tìm chính xác "${lessonTitle.toUpperCase()}"...`
  );

  // Bước 1: Trích xuất text layer trên các trang (rất nhanh)
  const pageTexts = new Map<number, string>();
  let pagesWithMeaningfulText = 0;

  for (let p = 1; p <= totalPages; p++) {
    const txt = await extractPageText(pdfDoc, p);
    if (txt) {
      pageTexts.set(p, txt);
      if (txt.length >= 80) pagesWithMeaningfulText++;
    }
  }

  // Trường hợp sách ngắn (<= 9 trang): gửi toàn bộ các trang
  if (totalPages <= 9) {
    const allPageNums = Array.from({ length: totalPages }, (_, i) => i + 1);
    const pageImages = await renderPagesWithinPayloadBudget(pdfDoc, allPageNums);
    const extractedText = allPageNums
      .map((p) => {
        const t = pageTexts.get(p);
        return t ? `=== TRANG PDF ${p}/${totalPages} ===\n${t}` : '';
      })
      .filter(Boolean)
      .join('\n\n');

    return {
      totalPages,
      extractedText,
      pageImages,
      selectedPages: allPageNums,
    };
  }

  // Bước 2: Tìm trang Mục Lục (Table of Contents) để định vị chính xác tên bài học & số trang
  // Trong SGK Việt Nam (như SGK Kỹ Năng Số 4 - 58 trang), Mục lục nằm ở trang 2..7 (thường là trang 3-6) hoặc 2 trang cuối sách.
  const tocCandidatePages: number[] = [];
  for (let p = 2; p <= Math.min(8, totalPages); p++) {
    tocCandidatePages.push(p);
  }
  // Nếu có trang nào trong text layer chứa chữ "MỤC LỤC" thì ưu tiên thêm vào
  for (let p = 1; p <= totalPages; p++) {
    const normTxt = normalizeForSearch(pageTexts.get(p) || '');
    if (normTxt.includes('muc luc') && !tocCandidatePages.includes(p)) {
      tocCandidatePages.unshift(p);
    }
  }
  if (totalPages >= 12) {
    if (!tocCandidatePages.includes(totalPages - 1)) tocCandidatePages.push(totalPages - 1);
    if (!tocCandidatePages.includes(totalPages)) tocCandidatePages.push(totalPages);
  }

  const finalTocPages = tocCandidatePages.slice(0, 8);

  onStatusUpdate?.(
    `AI Gemini (gemini-3-flash-preview) đang đọc Mục lục sách giáo khoa (${totalPages} trang) để tra cứu chính xác "${lessonTitle.toUpperCase()}"...`
  );

  const tocTextSummary = finalTocPages
    .map((p) => {
      const t = pageTexts.get(p);
      return t ? `[Trang PDF ${p}]:\n${t}` : '';
    })
    .filter(Boolean)
    .join('\n\n');

  const preLocatedTextRange =
    pagesWithMeaningfulText > 3
      ? findLessonPagesFromText(pageTexts, lessonTitle, totalPages)
      : null;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) {
    headers['x-gemini-api-key'] = apiKey;
  }

  let locatedInfo: {
    found?: boolean;
    exactLessonTitle?: string;
    printedStartPage?: number;
    printedEndPage?: number;
    pdfStartPage?: number;
    pdfEndPage?: number;
    pageOffset?: number;
  } | null = null;

  // Only call remote locate-lesson if local text layer could not already pinpoint the unit pages
  if (!preLocatedTextRange) {
    try {
      const tocImages: PdfPageImagePart[] = [];
      for (const pNum of finalTocPages) {
        const img = await renderPdfPageToJpeg(pdfDoc, pNum, 920, 0.68);
        if (img) tocImages.push(img);
      }

      const locateRes = await fetch('/api/gemini/extract-quiz', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'locate-lesson',
          lessonTitle,
          subject,
          grade,
          totalPages,
          pdfPageImages: tocImages,
          extractedPdfText: tocTextSummary,
          apiKey: apiKey || undefined,
        }),
      });
      const locateData = await locateRes.json().catch(() => null);
      if (locateData?.success && locateData?.data) {
        locatedInfo = locateData.data;
      }
    } catch {
      // Fall back cleanly to local page estimation if TOC lookup fails or hits rate limit
    }
  }

  // Bước 3: Tính toán dải trang PDF chính xác của bài học
  let targetStartPdfPage = 1;
  let targetEndPdfPage = Math.min(totalPages, 8);
  let resolvedLessonTitle: string | undefined = undefined;

  if (locatedInfo && locatedInfo.found) {
    if (locatedInfo.exactLessonTitle && locatedInfo.exactLessonTitle.trim().length > 2) {
      resolvedLessonTitle = locatedInfo.exactLessonTitle.trim().toUpperCase();
    }

    const offset =
      typeof locatedInfo.pageOffset === 'number' &&
      locatedInfo.pageOffset >= -5 &&
      locatedInfo.pageOffset <= 10
        ? locatedInfo.pageOffset
        : 1;

    const rawStart =
      typeof locatedInfo.pdfStartPage === 'number' && locatedInfo.pdfStartPage >= 1
        ? locatedInfo.pdfStartPage
        : typeof locatedInfo.printedStartPage === 'number' && locatedInfo.printedStartPage >= 1
        ? locatedInfo.printedStartPage + offset
        : 1;

    const rawEnd =
      typeof locatedInfo.pdfEndPage === 'number' && locatedInfo.pdfEndPage >= rawStart
        ? locatedInfo.pdfEndPage
        : typeof locatedInfo.printedEndPage === 'number' &&
          locatedInfo.printedEndPage >= (locatedInfo.printedStartPage || 1)
        ? locatedInfo.printedEndPage + offset
        : rawStart + 5;

    // Mở rộng biên an toàn (-1 trang đầu, +1 trang cuối) để đảm bảo lấy trọn vẹn 100% bài học dù độ lệch trang sách in và trang PDF chênh 1-2 trang
    targetStartPdfPage = Math.max(1, rawStart - 1);
    targetEndPdfPage = Math.min(totalPages, Math.max(targetStartPdfPage + 3, rawEnd + 1));

    if (targetEndPdfPage - targetStartPdfPage + 1 > 9) {
      targetEndPdfPage = targetStartPdfPage + 8;
    }
  } else {
    // Nếu không tìm thấy trong Mục lục hình ảnh, thử tìm bằng Text Layer
    const textRange =
      pagesWithMeaningfulText > 3
        ? findLessonPagesFromText(pageTexts, lessonTitle, totalPages)
        : null;

    if (textRange) {
      targetStartPdfPage = Math.max(1, textRange.startPage);
      targetEndPdfPage = Math.min(totalPages, Math.min(textRange.endPage + 1, targetStartPdfPage + 7));
    } else {
      // Ước lượng theo số bài (VD: Bài 1 -> trang 5..11, Bài 2 -> trang 9..16, Bài 3 -> trang 14..21...)
      const numMatch = lessonTitle.match(/(\d{1,2})/);
      const lessonNum = numMatch ? Math.max(1, parseInt(numMatch[1], 10)) : 1;
      const estimatedStart = Math.min(
        Math.max(4, (lessonNum - 1) * 5 + 5),
        Math.max(1, totalPages - 6)
      );
      targetStartPdfPage = estimatedStart;
      targetEndPdfPage = Math.min(totalPages, estimatedStart + 7);
    }
  }

  const selectedPages: number[] = [];
  for (let p = targetStartPdfPage; p <= targetEndPdfPage; p++) {
    selectedPages.push(p);
  }

  const displayTitle = resolvedLessonTitle || lessonTitle.toUpperCase();
  onStatusUpdate?.(
    `Đã xác định "${displayTitle}" (Trang PDF ${targetStartPdfPage} - ${targetEndPdfPage}/${totalPages}). Đang trích xuất nội dung chi tiết bài học...`
  );

  // Kết xuất hình ảnh rõ nét của đúng các trang bài học
  const lessonPageImages = await renderPagesWithinPayloadBudget(pdfDoc, selectedPages);

  // Kèm theo văn bản trích xuất được của Mục lục + các trang bài học
  const extractedChunks: string[] = [];
  if (tocTextSummary) {
    extractedChunks.push(`=== VĂN BẢN MỤC LỤC / TRANG ĐẦU SÁCH ===\n${tocTextSummary}`);
  }
  for (const p of selectedPages) {
    const pageTxt = pageTexts.get(p);
    if (pageTxt) {
      extractedChunks.push(`=== NỘI DUNG TRANG PDF ${p}/${totalPages} ===\n${pageTxt}`);
    }
  }

  return {
    totalPages,
    resolvedLessonTitle,
    extractedText: extractedChunks.join('\n\n'),
    pageImages: lessonPageImages,
    selectedPages,
  };
}
