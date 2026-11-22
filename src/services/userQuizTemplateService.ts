import JSZip from 'jszip';
import { Question } from '../types';
import { normalizeQuestionVisuals, stripOptionPrefix } from './geminiClientService';
import {
  buildTopicSvgMarkup,
  buildOptionItemSvgMarkup,
  detectSemanticTopicKey,
  resolveVisualDisplayMode,
} from '../components/ClassroomGame/QuestionVisualIllustration';

export interface ParsedUserQuizResult {
  questions: Question[];
  warnings: string[];
}

export interface SampleDocxQuestionSpec extends Omit<Question, 'id'> {
  visualKey: string;
  visualPrompt: string;
}

export const SAMPLE_PRIMARY_ENGLISH_QUESTIONS: SampleDocxQuestionSpec[] = [
  {
    question:
      'Unit 1 - Greeting: Look at the picture. How do you respond when your teacher says "Good morning, class!"?',
    options: [
      'Good morning, teacher!',
      'Good night, teacher!',
      'Goodbye, see you tomorrow!',
      'Thank you very much!',
    ],
    correctIndex: 0,
    explanation:
      '"Good morning, teacher!" is a polite morning greeting to your teacher. "Good morning, teacher!" là lời chào buổi sáng lịch sự khi học sinh đáp lại lời chào "Good morning, class!" của giáo viên.',
    difficulty: 'co_ban',
    isAdvanced: false,
    visualDisplayMode: 'question_image',
    visualKey: 'english_greeting',
    visualPrompt: 'Classroom Morning Greeting: "Good morning, class!"',
  },
  {
    question:
      'Vocabulary - School Things: Look at the 4 pictures in the options below. Which one is a "Pencil case"?',
    options: ['Pencil case', 'School bag', 'Blackboard', 'Bicycle'],
    correctIndex: 0,
    explanation:
      'This is a "Pencil case" on the student desk. Hình ảnh minh họa hộp đựng bút "Pencil case" dùng để đựng bút chì và thước kẻ.',
    difficulty: 'co_ban',
    isAdvanced: false,
    visualDisplayMode: 'options_image',
    visualKey: 'english_school_things',
    visualPrompt: 'Choose the correct picture for "Pencil case" among options A, B, C, D',
    optionVisuals: ['Pink Pencil Case', 'Blue School Bag', 'Green Blackboard', 'Red Bicycle'],
  },
  {
    question:
      'Vocabulary - Animals & Nature: Look at the picture. Where is the monkey?',
    options: [
      'It is under the table.',
      'It is in the tree.',
      'It is in the classroom.',
      'It is on the bus.',
    ],
    correctIndex: 1,
    explanation:
      'The monkey is in the green tree, so the correct answer is "It is in the tree." Trong tranh, chú khỉ "monkey" đang ở trên cây nên ta chọn "It is in the tree."',
    difficulty: 'co_ban',
    isAdvanced: false,
    visualDisplayMode: 'question_image',
    visualKey: 'english_animals',
    visualPrompt: 'Animals & Nature: A Monkey in the Tree',
  },
  {
    question:
      'Present Continuous: Look at the picture of the schoolyard! The students _____ playing badminton happily.',
    options: ['is', 'am', 'are', 'do'],
    correctIndex: 2,
    explanation:
      '"The students are playing badminton happily." Chủ ngữ số nhiều "The students" đi với động từ "are" trong thì "Present Continuous".',
    difficulty: 'nang_cao',
    isAdvanced: true,
    visualDisplayMode: 'question_image',
    visualKey: 'english_sports_actions',
    visualPrompt: 'Schoolyard Activity: Students Playing Badminton',
  },
  {
    question:
      'Time & Daily Routines: Look at the 4 clocks in the options below. I get up at 6:00 AM — Which clock shows "six o\'clock"?',
    options: ["six o'clock", "nine o'clock", "twelve o'clock", "four o'clock"],
    correctIndex: 0,
    explanation:
      '"I get up at six o\'clock." Đồng hồ chỉ 6 giờ đúng nên đáp án chính xác là "six o\'clock".',
    difficulty: 'nang_cao',
    isAdvanced: true,
    visualDisplayMode: 'options_image',
    visualKey: 'english_time_clock',
    visualPrompt: "Compare the 4 clocks in options A, B, C, D and choose Six O'clock (06:00)",
    optionVisuals: ['Clock: 06:00', 'Clock: 09:00', 'Clock: 12:00', 'Clock: 04:00'],
  },
];

/**
 * Chuyển đổi mã SVG thành ảnh PNG chất lượng cao (Uint8Array + DataURL) để nhúng trực tiếp vào file Word (.docx)
 */
async function renderSvgToPngBuffer(
  svgMarkup: string,
  width = 720,
  height = 330
): Promise<{ uint8: Uint8Array; dataUrl: string }> {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      const svgBlob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
        }
        URL.revokeObjectURL(url);
        const dataUrl = canvas.toDataURL('image/png');
        const base64 = dataUrl.split(',')[1] || '';
        const binary = atob(base64);
        const uint8 = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          uint8[i] = binary.charCodeAt(i);
        }
        resolve({ uint8, dataUrl });
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve({ uint8: new Uint8Array(), dataUrl: '' });
      };

      img.src = url;
    } catch {
      resolve({ uint8: new Uint8Array(), dataUrl: '' });
    }
  });
}

function escapeXml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildWordParagraphXml(
  text: string,
  options?: { bold?: boolean; color?: string; sizeHalfPt?: number; spacingAfter?: number }
): string {
  const boldTag = options?.bold ? '<w:b/>' : '';
  const colorTag = options?.color ? `<w:color w:val="${options.color}"/>` : '';
  const sizeTag = options?.sizeHalfPt ? `<w:sz w:val="${options.sizeHalfPt}"/><w:szCs w:val="${options.sizeHalfPt}"/>` : '';
  const after = options?.spacingAfter ?? 120;
  return `<w:p>
    <w:pPr><w:spacing w:after="${after}"/></w:pPr>
    <w:r>
      <w:rPr>${boldTag}${colorTag}${sizeTag}</w:rPr>
      <w:t xml:space="preserve">${escapeXml(text)}</w:t>
    </w:r>
  </w:p>`;
}

function buildWordImageParagraphXml(
  rId: string,
  docPrId: number,
  title: string,
  compactOption = false
): string {
  // Question image: ~480px x 220px; Option image: ~260px x 135px
  const cx = compactOption ? 2476500 : 4389120;
  const cy = compactOption ? 1285875 : 2011680;
  const align = compactOption ? 'left' : 'center';
  return `<w:p>
    <w:pPr><w:jc w:val="${align}"/><w:spacing w:before="80" w:after="120"/></w:pPr>
    <w:r>
      <w:drawing>
        <wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">
          <wp:extent cx="${cx}" cy="${cy}"/>
          <wp:docPr id="${docPrId}" name="Picture ${docPrId}" descr="${escapeXml(title)}"/>
          <wp:cNvGraphicFramePr>
            <a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/>
          </wp:cNvGraphicFramePr>
          <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
            <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
              <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
                <pic:nvPicPr>
                  <pic:cNvPr id="${docPrId}" name="image${docPrId}.png" descr="${escapeXml(title)}"/>
                  <pic:cNvPicPr/>
                </pic:nvPicPr>
                <pic:blipFill>
                  <a:blip r:embed="${rId}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>
                  <a:stretch><a:fillRect/></a:stretch>
                </pic:blipFill>
                <pic:spPr>
                  <a:xfrm>
                    <a:off x="0" y="0"/>
                    <a:ext cx="${cx}" cy="${cy}"/>
                  </a:xfrm>
                  <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
                </pic:spPr>
              </pic:pic>
            </a:graphicData>
          </a:graphic>
        </wp:inline>
      </w:drawing>
    </w:r>
  </w:p>`;
}

/**
 * TẠO VÀ TẢI FILE MẪU BỘ CÂU HỎI DUY NHẤT ĐỊNH DẠNG WORD (.DOCX) CÓ KÈM HÌNH ẢNH MINH HỌA TRỰC QUAN
 * (Bao gồm cả câu hỏi có hình ảnh ở phần Câu hỏi VÀ câu hỏi có hình ảnh ở 4 Đáp án A, B, C, D)
 */
export async function downloadSampleTemplate(): Promise<void> {
  const zip = new JSZip();

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const docRelsItems: string[] = [];
  const bodyParagraphs: string[] = [];

  bodyParagraphs.push(
    buildWordParagraphXml(
      'BỘ CÂU HỎI MẪU MÔN TIẾNG ANH CẤP TIỂU HỌC (CÓ HÌNH ẢNH MINH HỌA Ở CÂU HỎI & Ở CÁC ĐÁP ÁN)',
      { bold: true, color: '1E3A8A', sizeHalfPt: 28, spacingAfter: 80 }
    ),
    buildWordParagraphXml(
      'Ứng dụng được phát triển bởi cô giáo Văn Thị Thuỳ Trang',
      { bold: true, color: 'B45309', sizeHalfPt: 22, spacingAfter: 120 }
    ),
    buildWordParagraphXml(
      'Hướng dẫn: Mỗi câu hỏi gồm Câu hỏi (Câu 1: ...), hình ảnh minh họa ở câu hỏi hoặc hình ảnh minh họa ở 4 phương án A., B., C., D., Đáp án đúng (A/B/C/D), Giải thích và Mức độ (co_ban hoặc nang_cao). Khi tải file .docx này lên ứng dụng, toàn bộ hình ảnh ở câu hỏi và hình ảnh ở các đáp án sẽ được hiển thị chính xác tuyệt đối 100% trong trò chơi.',
      { color: '334155', sizeHalfPt: 20, spacingAfter: 240 }
    )
  );

  const letterMap = ['A', 'B', 'C', 'D'];
  let nextDocPrId = 1;

  for (let i = 0; i < SAMPLE_PRIMARY_ENGLISH_QUESTIONS.length; i++) {
    const q = SAMPLE_PRIMARY_ENGLISH_QUESTIONS[i];
    const qNum = i + 1;
    const isOptionsImageQuestion = q.visualDisplayMode === 'options_image';

    bodyParagraphs.push(
      buildWordParagraphXml(`Câu ${qNum}: ${q.question}`, {
        bold: true,
        color: '0F172A',
        sizeHalfPt: 24,
        spacingAfter: 100,
      })
    );

    if (!isOptionsImageQuestion) {
      // Nhúng 1 hình ảnh minh họa ở phần Câu hỏi
      const rId = `rIdImgQ${qNum}`;
      const svgMarkup = buildTopicSvgMarkup(
        q.question,
        q.explanation,
        q.options,
        q.options[q.correctIndex] || ''
      );
      const { uint8 } = await renderSvgToPngBuffer(svgMarkup, 720, 330);
      if (uint8.length > 0) {
        zip.file(`word/media/image_q${qNum}.png`, uint8);
        docRelsItems.push(
          `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image_q${qNum}.png"/>`
        );
        bodyParagraphs.push(
          buildWordImageParagraphXml(rId, nextDocPrId++, q.visualPrompt, false)
        );
      }

      bodyParagraphs.push(
        buildWordParagraphXml(`A. ${q.options[0]}`, { sizeHalfPt: 22, spacingAfter: 60 }),
        buildWordParagraphXml(`B. ${q.options[1]}`, { sizeHalfPt: 22, spacingAfter: 60 }),
        buildWordParagraphXml(`C. ${q.options[2]}`, { sizeHalfPt: 22, spacingAfter: 60 }),
        buildWordParagraphXml(`D. ${q.options[3]}`, { sizeHalfPt: 22, spacingAfter: 80 })
      );
    } else {
      // Nhúng 4 hình ảnh minh họa riêng biệt ngay tại 4 đáp án A, B, C, D
      for (let optIdx = 0; optIdx < 4; optIdx++) {
        const optLetter = letterMap[optIdx];
        const optText = q.options[optIdx] || `Option ${optLetter}`;
        bodyParagraphs.push(
          buildWordParagraphXml(`${optLetter}. ${optText}`, {
            bold: true,
            sizeHalfPt: 22,
            spacingAfter: 40,
          })
        );

        const optRId = `rIdImgQ${qNum}_Opt${optLetter}`;
        const optSvg = buildOptionItemSvgMarkup(optText, optIdx, q.question);
        const { uint8: optUint8 } = await renderSvgToPngBuffer(optSvg, 420, 220);
        if (optUint8.length > 0) {
          zip.file(`word/media/image_q${qNum}_opt${optLetter}.png`, optUint8);
          docRelsItems.push(
            `<Relationship Id="${optRId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image_q${qNum}_opt${optLetter}.png"/>`
          );
          bodyParagraphs.push(
            buildWordImageParagraphXml(
              optRId,
              nextDocPrId++,
              `${optLetter}. ${optText}`,
              true
            )
          );
        }
      }
    }

    bodyParagraphs.push(
      buildWordParagraphXml(`Đáp án: ${letterMap[q.correctIndex] || 'A'}`, {
        bold: true,
        color: '047857',
        sizeHalfPt: 22,
        spacingAfter: 60,
      }),
      buildWordParagraphXml(`Giải thích: ${q.explanation}`, {
        color: '475569',
        sizeHalfPt: 20,
        spacingAfter: 60,
      }),
      buildWordParagraphXml(`Mức độ: ${q.difficulty || 'co_ban'}`, {
        color: '6D28D9',
        sizeHalfPt: 20,
        spacingAfter: 240,
      })
    );
  }

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    ${bodyParagraphs.join('\n')}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  const docRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${docRelsItems.join('\n  ')}
</Relationships>`;

  zip.file('[Content_Types].xml', contentTypesXml);
  zip.file('_rels/.rels', rootRelsXml);
  zip.file('word/document.xml', documentXml);
  zip.file('word/_rels/document.xml.rels', docRelsXml);

  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType:
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'File_Mau_Bo_Cau_Hoi_Tieng_Anh_Tieu_Hoc.docx');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function parseAnswerIndex(raw: string | number | undefined): number {
  if (typeof raw === 'number') {
    if (raw >= 0 && raw <= 3) return raw;
    if (raw >= 1 && raw <= 4) return raw - 1;
  }
  const normalized = String(raw || '').trim().toUpperCase();
  if (normalized === 'A' || normalized === '1' || normalized.startsWith('A')) return 0;
  if (normalized === 'B' || normalized === '2' || normalized.startsWith('B')) return 1;
  if (normalized === 'C' || normalized === '3' || normalized.startsWith('C')) return 2;
  if (normalized === 'D' || normalized === '4' || normalized.startsWith('D')) return 3;
  return 0;
}

function parseDifficulty(raw: string | undefined): 'co_ban' | 'nang_cao' {
  const norm = String(raw || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (
    norm.includes('nang_cao') ||
    norm.includes('nang cao') ||
    norm.includes('hard') ||
    norm.includes('advanced')
  ) {
    return 'nang_cao';
  }
  return 'co_ban';
}

/**
 * ĐỌC FILE WORD (.DOCX) NGƯỜI DÙNG TẢI LÊN:
 * Trích xuất chính xác tuyệt đối 100% VĂN BẢN CÂU HỎI, 4 ĐÁP ÁN A/B/C/D,
 * HÌNH ẢNH Ở CÂU HỎI VÀ HÌNH ẢNH Ở CÁC ĐÁP ÁN A, B, C, D NHÚNG TRONG FILE DOCX!
 */
export async function parseDocxQuestions(file: File): Promise<ParsedUserQuizResult> {
  const warnings: string[] = [];
  try {
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);

    const docXmlFile = zip.file('word/document.xml');
    if (!docXmlFile) {
      return {
        questions: [],
        warnings: [
          'Tệp tải lên không đúng chuẩn định dạng Microsoft Word (.docx). Vui lòng tải File mẫu .docx của ứng dụng!',
        ],
      };
    }

    // 1. Đọc bảng ánh xạ hình ảnh từ word/_rels/document.xml.rels
    const relsMap: Record<string, string> = {};
    const relsFile = zip.file('word/_rels/document.xml.rels');
    if (relsFile) {
      const relsXmlText = await relsFile.async('string');
      const parser = new DOMParser();
      const relsDoc = parser.parseFromString(relsXmlText, 'application/xml');
      const relNodes = Array.from(relsDoc.getElementsByTagName('Relationship'));

      for (const rel of relNodes) {
        const id = rel.getAttribute('Id') || '';
        const target = rel.getAttribute('Target') || '';
        if (id && target && /media\//i.test(target)) {
          const cleanTarget = target.replace(/^\/?word\//i, '').replace(/^\//, '');
          const imgZipEntry = zip.file(`word/${cleanTarget}`) || zip.file(cleanTarget);
          if (imgZipEntry) {
            const base64Data = await imgZipEntry.async('base64');
            const ext = cleanTarget.split('.').pop()?.toLowerCase() || 'png';
            const mime =
              ext === 'jpg' || ext === 'jpeg'
                ? 'image/jpeg'
                : ext === 'svg'
                ? 'image/svg+xml'
                : ext === 'gif'
                ? 'image/gif'
                : 'image/png';
            relsMap[id] = `data:${mime};base64,${base64Data}`;
          }
        }
      }
    }

    // 2. Đọc từng đoạn văn (<w:p>) và trích xuất theo thứ tự xuất hiện cả văn bản lẫn hình ảnh
    const docXmlText = await docXmlFile.async('string');
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(docXmlText, 'application/xml');
    const paragraphs = Array.from(xmlDoc.getElementsByTagNameNS('*', 'p'));

    interface DocxParagraphItem {
      text: string;
      images: string[];
      orderedTokens: Array<{ type: 'text' | 'image'; value: string }>;
    }

    const items: DocxParagraphItem[] = [];

    const extractTokensInOrder = (
      node: Element,
      out: Array<{ type: 'text' | 'image'; value: string }>
    ) => {
      const local = (node.localName || node.nodeName || '').replace(/^.*:/, '');
      if (local === 't') {
        const txt = node.textContent || '';
        if (txt) out.push({ type: 'text', value: txt });
        return;
      }
      if (local === 'tab' || local === 'br') {
        out.push({ type: 'text', value: ' ' });
        return;
      }
      if (local === 'blip') {
        const embedId =
          node.getAttribute('r:embed') ||
          node.getAttributeNS(
            'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
            'embed'
          ) ||
          '';
        if (embedId && relsMap[embedId]) {
          out.push({ type: 'image', value: relsMap[embedId] });
        }
        return;
      }
      if (local === 'imagedata') {
        const rId =
          node.getAttribute('r:id') ||
          node.getAttributeNS(
            'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
            'id'
          ) ||
          '';
        if (rId && relsMap[rId]) {
          out.push({ type: 'image', value: relsMap[rId] });
        }
        return;
      }
      const children = Array.from(node.children || []);
      for (const child of children) {
        extractTokensInOrder(child, out);
      }
    };

    for (const p of paragraphs) {
      const rawTokens: Array<{ type: 'text' | 'image'; value: string }> = [];
      extractTokensInOrder(p, rawTokens);

      // Gộp các token text liên tiếp nhau
      const mergedTokens: Array<{ type: 'text' | 'image'; value: string }> = [];
      for (const tok of rawTokens) {
        if (
          tok.type === 'text' &&
          mergedTokens.length > 0 &&
          mergedTokens[mergedTokens.length - 1].type === 'text'
        ) {
          mergedTokens[mergedTokens.length - 1].value += tok.value;
        } else {
          mergedTokens.push({ ...tok });
        }
      }

      const fullText = mergedTokens
        .filter((t) => t.type === 'text')
        .map((t) => t.value)
        .join('')
        .trim();
      const imagesInP = mergedTokens
        .filter((t) => t.type === 'image')
        .map((t) => t.value);

      if (fullText || imagesInP.length > 0) {
        items.push({
          text: fullText,
          images: imagesInP,
          orderedTokens: mergedTokens,
        });
      }
    }

    // 3. Phân tích danh sách câu hỏi và gán chính xác hình ảnh ở câu hỏi HOẶC hình ảnh ở 4 đáp án A, B, C, D
    const rawQuestions: Question[] = [];
    let currentQuestion: {
      question: string;
      options: string[];
      correctIndex: number;
      explanation: string;
      difficulty: 'co_ban' | 'nang_cao';
      questionImages: string[];
      optionImages: string[];
      allBlockImages: string[];
      activeOptionIdx: number; // -1: đang ở câu hỏi, 0..3: đang ở đáp án A..D, -2: đã qua phần Đáp án/Giải thích
    } | null = null;
    let pendingImagesBeforeQuestion: string[] = [];

    const assignImageToCurrentQuestion = (imgData: string) => {
      if (!imgData) return;
      if (!currentQuestion) {
        pendingImagesBeforeQuestion.push(imgData);
        return;
      }
      currentQuestion.allBlockImages.push(imgData);
      if (
        currentQuestion.activeOptionIdx >= 0 &&
        currentQuestion.activeOptionIdx <= 3
      ) {
        const targetIdx = currentQuestion.activeOptionIdx;
        if (!currentQuestion.optionImages[targetIdx]) {
          currentQuestion.optionImages[targetIdx] = imgData;
        } else {
          // Nếu trong cùng một đoạn có nhiều ảnh đáp án liên tiếp, gán sang ô đáp án kế tiếp còn trống
          const nextEmpty = currentQuestion.optionImages.findIndex(
            (v, idx) => idx > targetIdx && !v
          );
          if (nextEmpty !== -1) {
            currentQuestion.optionImages[nextEmpty] = imgData;
          }
        }
      } else if (currentQuestion.activeOptionIdx === -1) {
        currentQuestion.questionImages.push(imgData);
      }
    };

    const flushCurrent = () => {
      if (!currentQuestion) return;
      const qStem = currentQuestion.question.trim();
      if (qStem) {
        let resolvedOptImages = [...currentQuestion.optionImages];
        let resolvedQuestionImages = [...currentQuestion.questionImages];

        // Trường hợp giáo viên chèn 4 hình ảnh đáp án trên cùng 1 hàng/bảng ngay trước hoặc trong khối câu hỏi
        if (
          resolvedOptImages.filter(Boolean).length === 0 &&
          resolvedQuestionImages.length === 4
        ) {
          resolvedOptImages = resolvedQuestionImages.slice(0, 4);
          resolvedQuestionImages = [];
        } else if (
          resolvedOptImages.filter(Boolean).length > 0 &&
          resolvedOptImages.filter(Boolean).length < 4 &&
          currentQuestion.allBlockImages.length === 4
        ) {
          resolvedOptImages = currentQuestion.allBlockImages.slice(0, 4);
          resolvedQuestionImages = [];
        }

        const hasExplicitOptionBitmaps = resolvedOptImages.some((img) =>
          Boolean(img && img.trim())
        );

        // Cho phép đáp án không có văn bản (chỉ hiển thị hình ảnh) giữ nguyên chuỗi rỗng ''
        const filledOpts = [0, 1, 2, 3].map((idx) => {
          const rawOpt = (currentQuestion?.options[idx] || '').trim();
          return stripOptionPrefix(rawOpt);
        });

        const topicKey = detectSemanticTopicKey(qStem);

        const draftForMode: Question = {
          id: `docx_q_${Date.now()}_${rawQuestions.length + 1}`,
          question: qStem,
          options: filledOpts,
          correctIndex: currentQuestion.correctIndex,
          explanation:
            currentQuestion.explanation.trim() ||
            'Giải thích theo nội dung bài học Tiếng Anh cấp Tiểu học.',
          difficulty: currentQuestion.difficulty,
          isAdvanced: currentQuestion.difficulty === 'nang_cao',
          visualKey: topicKey,
          visualData: resolvedQuestionImages[0] || '',
          optionImages: hasExplicitOptionBitmaps ? resolvedOptImages : [],
        };

        const mode = hasExplicitOptionBitmaps
          ? 'options_image'
          : resolveVisualDisplayMode(draftForMode);

        rawQuestions.push({
          ...draftForMode,
          visualDisplayMode: mode,
          visualData: resolvedQuestionImages[0] || '',
          optionImages: hasExplicitOptionBitmaps ? resolvedOptImages : [],
          questionSvg:
            mode === 'options_image' || resolvedQuestionImages[0]
              ? ''
              : buildTopicSvgMarkup(
                  qStem,
                  draftForMode.explanation,
                  filledOpts,
                  filledOpts[currentQuestion.correctIndex] || ''
                ),
        });
      }
      currentQuestion = null;
    };

    for (const item of items) {
      const line = item.text;

      // Bỏ qua các dòng tiêu đề hướng dẫn ở đầu file mẫu .docx
      if (
        line &&
        (/^BỘ CÂU HỎI MẪU MÔN TIẾNG ANH/i.test(line) ||
          /^Ứng dụng được phát triển bởi cô giáo/i.test(line) ||
          /^Hướng dẫn:/i.test(line))
      ) {
        continue;
      }

      if (!line) {
        // Đoạn văn chỉ chứa hình ảnh (không có chữ)
        for (const img of item.images) {
          assignImageToCurrentQuestion(img);
        }
        continue;
      }

      const qMatch = line.match(
        /^(?:Câu(?:\s*hỏi)?\s*\d+|Question\s*\d+|\d+)\s*[:.)]\s*(.+)$/i
      );
      // Cho phép dòng đáp án chỉ có "A." hoặc "A" + hình ảnh (không bắt buộc có chữ sau A.)
      const optMatch =
        line.match(/^(\*?[A-Da-d])\s*[.:)\-]\s*(.*)$/) ||
        line.match(/^(?:Option|Đáp\s*án|Phương\s*án)\s+(\*?[A-Da-d])\s*[.:)\-]?\s*(.*)$/i) ||
        (currentQuestion ? line.match(/^(\*?[A-Da-d])()$/) : null);
      const ansMatch = line.match(
        /^(?:Đáp\s*án(?:\s*đúng)?|Answer|Correct(?:\s*answer)?)\s*[:=\-]\s*([A-Da-d1-4])/i
      );
      const expMatch = line.match(
        /^(?:Giải\s*thích|Explanation|Hint|Gợi\s*ý)\s*[:=\-]\s*(.+)$/i
      );
      const diffMatch = line.match(
        /^(?:Mức\s*độ|Difficulty|Level)\s*[:=\-]\s*(.+)$/i
      );

      if (qMatch) {
        flushCurrent();
        currentQuestion = {
          question: qMatch[1].trim(),
          options: ['', '', '', ''],
          correctIndex: 0,
          explanation: '',
          difficulty: 'co_ban',
          questionImages: [...pendingImagesBeforeQuestion],
          optionImages: ['', '', '', ''],
          allBlockImages: [...pendingImagesBeforeQuestion],
          activeOptionIdx: -1,
        };
        pendingImagesBeforeQuestion = [];
        for (const img of item.images) {
          assignImageToCurrentQuestion(img);
        }
      } else if (ansMatch && currentQuestion) {
        currentQuestion.activeOptionIdx = -2;
        currentQuestion.correctIndex = parseAnswerIndex(ansMatch[1]);
      } else if (expMatch && currentQuestion) {
        currentQuestion.activeOptionIdx = -2;
        currentQuestion.explanation = expMatch[1].trim();
      } else if (diffMatch && currentQuestion) {
        currentQuestion.activeOptionIdx = -2;
        currentQuestion.difficulty = parseDifficulty(diffMatch[1]);
      } else if (optMatch && currentQuestion) {
        // Kiểm tra xem trên cùng 1 dòng có nhiều đáp án (VD: "A. Cat   B. Dog   C. Bird   D. Fish") kèm hình ảnh không
        const multiOptRegex = /(?:^|\s)(\*?[A-Da-d])\s*[.:)]\s*/g;
        const matches = Array.from(line.matchAll(multiOptRegex));

        if (matches.length >= 2) {
          // Dòng chứa nhiều đáp án ngang nhau: duyệt theo orderedTokens để gán cả chữ và ảnh đúng vào từng đáp án A, B, C, D
          for (const tok of item.orderedTokens) {
            if (tok.type === 'text') {
              const subMatches = Array.from(
                tok.value.matchAll(/(?:^|\s)(\*?[A-Da-d])\s*[.:)]\s*([^A-D]*)/g)
              );
              if (subMatches.length > 0) {
                for (const sm of subMatches) {
                  const rawPref = sm[1].toUpperCase();
                  const starred = rawPref.startsWith('*');
                  const letter = rawPref.replace('*', '');
                  const oIdx = ['A', 'B', 'C', 'D'].indexOf(letter);
                  if (oIdx !== -1) {
                    currentQuestion.activeOptionIdx = oIdx;
                    const content = stripOptionPrefix((sm[2] || '').trim());
                    if (starred || content.endsWith('*')) {
                      currentQuestion.options[oIdx] = content
                        .replace(/\*+$/, '')
                        .trim();
                      currentQuestion.correctIndex = oIdx;
                    } else {
                      currentQuestion.options[oIdx] = content;
                    }
                  }
                }
              } else if (
                currentQuestion.activeOptionIdx >= 0 &&
                currentQuestion.activeOptionIdx <= 3
              ) {
                const extra = stripOptionPrefix(tok.value.trim());
                if (extra) {
                  currentQuestion.options[currentQuestion.activeOptionIdx] = (
                    (currentQuestion.options[currentQuestion.activeOptionIdx] ||
                      '') +
                    ' ' +
                    extra
                  ).trim();
                }
              }
            } else if (tok.type === 'image') {
              assignImageToCurrentQuestion(tok.value);
            }
          }
        } else {
          const rawPrefix = optMatch[1].toUpperCase();
          const hasLeadingStar = rawPrefix.startsWith('*');
          const optLetter = rawPrefix.replace('*', '');
          const idx = ['A', 'B', 'C', 'D'].indexOf(optLetter);
          const optContent = stripOptionPrefix((optMatch[2] || '').trim());

          if (idx !== -1) {
            currentQuestion.activeOptionIdx = idx;
            if (hasLeadingStar || optContent.endsWith('*')) {
              currentQuestion.options[idx] = optContent
                .replace(/\*+$/, '')
                .trim();
              currentQuestion.correctIndex = idx;
            } else {
              currentQuestion.options[idx] = optContent;
            }
          }

          for (const img of item.images) {
            assignImageToCurrentQuestion(img);
          }
        }
      } else if (currentQuestion) {
        if (currentQuestion.activeOptionIdx === -1) {
          currentQuestion.question += ' ' + line;
        } else if (
          currentQuestion.activeOptionIdx >= 0 &&
          currentQuestion.activeOptionIdx <= 3
        ) {
          const idx = currentQuestion.activeOptionIdx;
          const cleanedExtra = stripOptionPrefix(line);
          if (cleanedExtra) {
            currentQuestion.options[idx] = (
              (currentQuestion.options[idx] || '') +
              ' ' +
              cleanedExtra
            ).trim();
          }
        }
        for (const img of item.images) {
          assignImageToCurrentQuestion(img);
        }
      }
    }

    flushCurrent();

    if (rawQuestions.length === 0) {
      return {
        questions: [],
        warnings: [
          'Không tìm thấy câu hỏi hợp lệ trong file .docx. Vui lòng tải File mẫu .docx của ứng dụng để xem đúng định dạng chuẩn!',
        ],
      };
    }

    return {
      questions: normalizeQuestionVisuals(rawQuestions),
      warnings,
    };
  } catch (err: any) {
    return {
      questions: [],
      warnings: [
        `Không thể đọc file Word (.docx): ${
          err?.message || 'Vui lòng sử dụng đúng định dạng .docx'
        }`,
      ],
    };
  }
}

/**
 * Phân tích định dạng văn bản khi giáo viên sao chép từ file mẫu .docx và dán trực tiếp
 */
export function parseRawUserQuizText(rawText: string): ParsedUserQuizResult {
  const warnings: string[] = [];
  const cleanText = rawText.replace(/^\uFEFF/, '').trim();
  if (!cleanText) {
    return { questions: [], warnings: ['Vui lòng nhập hoặc dán nội dung câu hỏi.'] };
  }

  const lines = cleanText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => !l.startsWith('#'));

  const rawQuestions: Question[] = [];
  let currentQuestion: {
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
    difficulty: 'co_ban' | 'nang_cao';
  } | null = null;

  const flushCurrent = () => {
    if (!currentQuestion) return;
    if (currentQuestion.question.trim()) {
      const cleanOpts = [0, 1, 2, 3].map((idx) =>
        stripOptionPrefix(currentQuestion?.options[idx] || '')
      );
      const qStem = currentQuestion.question.trim();
      const topicKey = detectSemanticTopicKey(qStem);
      const draftQ: Question = {
        id: `user_txt_${Date.now()}_${rawQuestions.length + 1}`,
        question: qStem,
        options: cleanOpts,
        correctIndex: currentQuestion.correctIndex,
        explanation:
          currentQuestion.explanation.trim() ||
          'Giải thích theo nội dung bài học Tiếng Anh cấp Tiểu học.',
        difficulty: currentQuestion.difficulty,
        isAdvanced: currentQuestion.difficulty === 'nang_cao',
        visualKey: topicKey,
      };
      const resolvedMode = resolveVisualDisplayMode(draftQ);
      rawQuestions.push({
        ...draftQ,
        visualDisplayMode: resolvedMode,
        questionSvg:
          resolvedMode === 'options_image'
            ? ''
            : buildTopicSvgMarkup(
                qStem,
                draftQ.explanation,
                cleanOpts,
                cleanOpts[currentQuestion.correctIndex] || ''
              ),
      });
    }
    currentQuestion = null;
  };

  for (const line of lines) {
    if (!line) continue;

    const qMatch = line.match(
      /^(?:Câu(?:\s*hỏi)?\s*\d+|Question\s*\d+|\d+)\s*[:.)]\s*(.+)$/i
    );
    const optMatch =
      line.match(/^(\*?[A-Da-d])\s*[.:)\-]\s*(.*)$/) ||
      (currentQuestion ? line.match(/^(\*?[A-Da-d])()$/) : null);
    const ansMatch = line.match(
      /^(?:Đáp\s*án(?:\s*đúng)?|Answer|Correct(?:\s*answer)?)\s*[:=\-]\s*([A-Da-d1-4])/i
    );
    const expMatch = line.match(
      /^(?:Giải\s*thích|Explanation|Hint|Gợi\s*ý)\s*[:=\-]\s*(.+)$/i
    );
    const diffMatch = line.match(/^(?:Mức\s*độ|Difficulty|Level)\s*[:=\-]\s*(.+)$/i);

    if (qMatch) {
      flushCurrent();
      currentQuestion = {
        question: qMatch[1].trim(),
        options: ['', '', '', ''],
        correctIndex: 0,
        explanation: '',
        difficulty: 'co_ban',
      };
    } else if (optMatch && currentQuestion) {
      const rawPrefix = optMatch[1].toUpperCase();
      const hasLeadingStar = rawPrefix.startsWith('*');
      const optLetter = rawPrefix.replace('*', '');
      const idx = ['A', 'B', 'C', 'D'].indexOf(optLetter);
      const optContent = stripOptionPrefix((optMatch[2] || '').trim());
      if (hasLeadingStar || optContent.endsWith('*')) {
        currentQuestion.options[idx] = optContent.replace(/\*+$/, '').trim();
        currentQuestion.correctIndex = idx;
      } else {
        currentQuestion.options[idx] = optContent;
      }
    } else if (ansMatch && currentQuestion) {
      currentQuestion.correctIndex = parseAnswerIndex(ansMatch[1]);
    } else if (expMatch && currentQuestion) {
      currentQuestion.explanation = expMatch[1].trim();
    } else if (diffMatch && currentQuestion) {
      currentQuestion.difficulty = parseDifficulty(diffMatch[1]);
    } else if (currentQuestion && currentQuestion.options.length === 0) {
      currentQuestion.question += ' ' + line;
    }
  }

  flushCurrent();

  if (rawQuestions.length === 0) {
    warnings.push(
      'Không nhận diện được câu hỏi nào. Vui lòng kiểm tra theo đúng mẫu trong file .docx!'
    );
  }

  return {
    questions: normalizeQuestionVisuals(rawQuestions),
    warnings,
  };
}

/**
 * Đọc file bộ câu hỏi từ giáo viên cung cấp (.docx)
 */
export async function parseUserQuizFile(file: File): Promise<ParsedUserQuizResult> {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (ext === 'docx') {
    return parseDocxQuestions(file);
  }
  const text = await file.text();
  return parseRawUserQuizText(text);
}
