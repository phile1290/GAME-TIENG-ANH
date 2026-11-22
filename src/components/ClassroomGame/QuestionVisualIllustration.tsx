import React, { useMemo } from 'react';
import { Question } from '../../types';

interface QuestionVisualIllustrationProps {
  question: Question;
  index?: number;
  compact?: boolean;
}

function encodeSvgDataUri(svgString: string): string {
  const clean = svgString.trim();
  return `data:image/svg+xml;utf8,${encodeURIComponent(clean)}`;
}

/**
 * Strict validator for AI-generated SVGs:
 * Rejects any SVG that:
 * - Has fewer than 6 graphic elements (<circle, <path, <polygon, <ellipse, <line, <polyline)
 * - Contains fill-in-the-blank underscores ("___") or question marks repeating the question stem
 * - Is just a text box or prompt description
 */
export function isRichGraphicSvg(svg: string | undefined): boolean {
  if (!svg || !svg.trim().startsWith('<svg')) return false;
  if (/_{2,}|\bprompt\b|\billustration of\b/i.test(svg)) return false;
  const shapeMatches = svg.match(/<(circle|path|polygon|ellipse|line|polyline)\b/gi);
  const count = shapeMatches ? shapeMatches.length : 0;
  return count >= 6;
}

/**
 * Strips any <text> tags inside an AI SVG that contain long sentences or blanks,
 * keeping only short labels (<= 4 chars, like clock numbers 12, 3, 6, 9 or ABC).
 */
function sanitizeAiSvgMarkup(svg: string): string {
  return svg.replace(/<text\b[^>]*>([\s\S]*?)<\/text>/gi, (fullMatch, innerText) => {
    const plain = String(innerText || '').replace(/<[^>]+>/g, '').trim();
    if (plain.length <= 4 && !/[_?]/.test(plain)) {
      return fullMatch;
    }
    return '';
  });
}

/**
 * Detects a semantic Primary English topic key from question text or visualKey.
 */
export function detectSemanticTopicKey(text: string, existingKey?: string): string {
  if (
    existingKey &&
    existingKey !== 'NONE' &&
    existingKey !== 'none' &&
    existingKey !== 'english_classroom_general'
  ) {
    return existingKey;
  }
  const s = String(text || '').toLowerCase();
  if (!s) return 'english_classroom_general';
  if (
    /\bgood morning\b|\bgood afternoon\b|\bgood evening\b|\bgood night\b|\bgreeting\b|\bhello\b|\bhi\b|\bgoodbye\b|\bbye\b|\bhow are you\b|\bhow _____ you\b|\bfine, thank\b|\bnice to meet\b/.test(
      s
    )
  )
    return 'english_greeting';
  if (
    /\bpencil case\b|\bschool bag\b|\bbackpack\b|\bnotebook\b|\bruler\b|\beraser\b|\brubber\b|\bpen\b|\bpencil\b|\bbook\b|\bcrayon\b|\bscissors\b|\bglue\b|\bblackboard\b|\bclassroom\b|\bschool thing/.test(
      s
    )
  )
    return 'english_school_things';
  if (
    /\bmonkey\b|\belephant\b|\btiger\b|\blion\b|\banimal\b|\bzoo\b|\bbird\b|\bcat\b|\bdog\b|\brabbit\b|\bbear\b|\bpanda\b|\bgiraffe\b|\bzebra\b|\bcrocodile\b|\bfish\b|\bduck\b|\bchicken\b|\bcow\b|\bpig\b|\bsheep\b|\bhorse\b|\bfrog\b|\bbutterfly\b|\bbee\b|\bturtle\b/.test(
      s
    )
  )
    return 'english_animals';
  if (
    /\bbadminton\b|\bfootball\b|\bsoccer\b|\bbasketball\b|\bvolleyball\b|\btable tennis\b|\btennis\b|\bskipping\b|\bswimming\b|\bplaying\b|\bschoolyard\b|\bsport\b|\brunning\b|\bcycling\b|\bskating\b|\bkite\b|\bsinging\b|\bdancing\b|\bdrawing\b|\bpainting\b|\breading\b|\bchess\b|\bpiano\b|\bguitar\b/.test(
      s
    )
  )
    return 'english_sports_actions';
  if (
    /\bclock\b|\bo'clock\b|\bwhat time\b|\bget up\b|\bwake up\b|\bbreakfast\b|\blunch\b|\bdinner\b|\bgo to bed\b|\bbrush teeth\b|\bwash face\b|\bdo homework\b/.test(
      s
    )
  )
    return 'english_time_clock';
  if (
    /\bfamily\b|\bmother\b|\bmum\b|\bmom\b|\bfather\b|\bdad\b|\bsister\b|\bbrother\b|\bgrandmother\b|\bgrandma\b|\bgrandfather\b|\bgrandpa\b|\bbaby\b|\bparents\b/.test(
      s
    )
  )
    return 'english_family';
  if (
    /\bfood\b|\bdrink\b|\bapple\b|\bmilk\b|\bbread\b|\brice\b|\bchicken\b|\bjuice\b|\bwater\b|\bbanana\b|\bcake\b|\borange\b|\bmango\b|\bwatermelon\b|\bgrapes\b|\bstrawberry\b|\bnoodles\b|\bpizza\b|\bburger\b|\bsandwich\b|\begg\b|\bice cream\b|\btea\b|\blemonade\b/.test(
      s
    )
  )
    return 'english_food_drinks';
  if (
    /\bweather\b|\bsunny\b|\brainy\b|\bcloudy\b|\bwindy\b|\bsnowy\b|\bstormy\b|\bsummer\b|\bwinter\b|\bspring\b|\bautumn\b|\bfall\b|\brainbow\b|\bhot\b|\bcold\b/.test(
      s
    )
  )
    return 'english_weather_seasons';
  if (
    /\bhouse\b|\bbedroom\b|\bkitchen\b|\bliving room\b|\bbathroom\b|\bdining room\b|\bgarden\b|\bschool\b|\blibrary\b|\bpark\b|\bOSPITAL\b|\bsupermarket\b|\bcinema\b|\bbakery\b|\bbookshop\b|\bbus\b|\bcar\b|\bbike\b|\bbicycle\b|\btrain\b|\bplane\b|\bairplane\b|\bboat\b|\bship\b|\bmotorbike\b|\btruck\b|\btaxi\b/i.test(
      s
    )
  )
    return 'english_places_transport';
  if (
    /\bcolor\b|\bcolour\b|\bred\b|\bblue\b|\byellow\b|\bgreen\b|\borange\b|\bpink\b|\bpurple\b|\bblack\b|\bwhite\b|\bbrown\b|\bnumber\b|\bhow many\b|\bhow old\b|\byears old\b/.test(
      s
    )
  )
    return 'english_colors_numbers';
  if (
    /\bdoctor\b|\bnurse\b|\bdriver\b|\bfarmer\b|\bworker\b|\bpilot\b|\bcook\b|\bchef\b|\bpoliceman\b|\bpolice\b|\bfirefighter\b|\bsinger\b|\bdancer\b|\bdentist\b|\bartist\b|\bjob\b/.test(
      s
    )
  )
    return 'english_jobs';
  if (
    /\bhead\b|\bhair\b|\beye\b|\bear\b|\bnose\b|\bmouth\b|\btooth\b|\bteeth\b|\bhand\b|\barm\b|\bleg\b|\bfoot\b|\bheadache\b|\btoothache\b|\bstomachache\b|\bfever\b/.test(
      s
    )
  )
    return 'english_body_health';
  if (
    /\bt-shirt\b|\bshirt\b|\bdress\b|\bskirt\b|\bcoat\b|\bjacket\b|\bsweater\b|\bjeans\b|\btrousers\b|\bpants\b|\bshorts\b|\bshoes\b|\bsocks\b|\bhat\b|\bcap\b|\bscarf\b|\bglasses\b/.test(
      s
    )
  )
    return 'english_clothes';
  return 'english_classroom_general';
}

/**
 * Returns a 4-element array of option visual keys when `options_image` is active.
 */
export function getUniformOptionVisuals(question: Question): string[] {
  if (Array.isArray(question.optionVisuals) && question.optionVisuals.length === 4) {
    return question.optionVisuals.map((v, idx) =>
      String(v || question.options[idx] || `Option ${idx + 1}`)
    );
  }
  return (question.options || ['Option A', 'Option B', 'Option C', 'Option D']).map((opt) =>
    String(opt || '').trim()
  );
}

/**
 * Helper: Parse hour & minute from any English time string (e.g. "six o'clock", "7:30", "half past nine", "06:00")
 */
function parseTimeFromText(text: string): { hour: number; minute: number } | null {
  const s = text.toLowerCase();
  const colonMatch = s.match(/\b(1[0-2]|0?[1-9]):([0-5][0-9])\b/);
  if (colonMatch) {
    return { hour: parseInt(colonMatch[1], 10), minute: parseInt(colonMatch[2], 10) };
  }

  const wordToHour: Array<[RegExp, number]> = [
    [/\btwelve\b|\b12\b/, 12],
    [/\beleven\b|\b11\b/, 11],
    [/\bten\b|\b10\b/, 10],
    [/\bnine\b|\b9\b/, 9],
    [/\beight\b|\b8\b/, 8],
    [/\bseven\b|\b7\b/, 7],
    [/\bsix\b|\b6\b/, 6],
    [/\bfive\b|\b5\b/, 5],
    [/\bfour\b|\b4\b/, 4],
    [/\bthree\b|\b3\b/, 3],
    [/\btwo\b|\b2\b/, 2],
    [/\bone\b|\b1\b/, 1],
  ];

  if (
    /\bo'clock\b|\bwhat time\b|\bclock\b|\bget up\b|\bgo to school\b|\bgo to bed\b|\bhalf past\b|\bquarter\b/.test(
      s
    )
  ) {
    for (const [regex, h] of wordToHour) {
      if (regex.test(s)) {
        const minute = /\bhalf past\b|\bthirty\b/.test(s)
          ? 30
          : /\bquarter past\b|\bfifteen\b/.test(s)
          ? 15
          : /\bquarter to\b|\bforty-five\b/.test(s)
          ? 45
          : 0;
        return { hour: h, minute };
      }
    }
  }
  return null;
}

/**
 * Helper: Parse number (1..20) from English text
 */
function parseNumberFromText(text: string): number | null {
  const s = text.toLowerCase();
  const wordMap: Array<[RegExp, number]> = [
    [/\btwenty\b|\b20\b/, 20],
    [/\bnineteen\b|\b19\b/, 19],
    [/\beighteen\b|\b18\b/, 18],
    [/\bseventeen\b|\b17\b/, 17],
    [/\bsixteen\b|\b16\b/, 16],
    [/\bfifteen\b|\b15\b/, 15],
    [/\bfourteen\b|\b14\b/, 14],
    [/\bthirteen\b|\b13\b/, 13],
    [/\btwelve\b|\b12\b/, 12],
    [/\beleven\b|\b11\b/, 11],
    [/\bten\b|\b10\b/, 10],
    [/\bnine\b|\b9\b/, 9],
    [/\beight\b|\b8\b/, 8],
    [/\bseven\b|\b7\b/, 7],
    [/\bsix\b|\b6\b/, 6],
    [/\bfive\b|\b5\b/, 5],
    [/\bfour\b|\b4\b/, 4],
    [/\bthree\b|\b3\b/, 3],
    [/\btwo\b|\b2\b/, 2],
    [/\bone\b|\b1\b/, 1],
  ];
  for (const [regex, n] of wordMap) {
    if (regex.test(s)) return n;
  }
  return null;
}

/**
 * Helper: Check if a single option string represents a concrete visualizable entity
 * (rather than a grammar function word like am/is/are/in/on/at/do/does or a generic clause).
 */
function isOptionConcreteVisualizable(optionText: string, questionText: string): boolean {
  const clean = optionText.replace(/^[A-D][\.\)\:\-]\s*/i, '').trim().toLowerCase();
  if (!clean) return false;

  // Grammar function words & pronouns should NEVER be rendered as option images
  const pureGrammarRegex =
    /^(am|is|are|was|were|be|been|do|does|did|don't|doesn't|didn't|have|has|had|can|can't|cannot|will|would|may|might|must|should|in|on|at|under|behind|near|next to|between|in front of|to|for|with|from|by|of|about|a|an|the|my|your|his|her|its|our|their|i|you|he|she|it|we|they|me|him|us|them|this|that|these|those|what|where|when|who|whose|which|how|why|yes|no|not|and|or|but|so|because|very|too|many|much|some|any|there is|there are)$/i;
  if (pureGrammarRegex.test(clean)) return false;

  // Conversational phrases that belong in a dialogue scene on the question stem
  if (
    /\b(thank you|thanks|fine|very well|nice to meet|see you|you're welcome|excuse me|sorry|my name is|i am from|i'm from|yes, i|no, i|yes, he|no, he|yes, she|no, she|yes, it|no, it|yes, they|no, they)\b/i.test(
      clean
    )
  ) {
    return false;
  }

  // Concrete visualizable vocabulary patterns
  const concreteVocabularyRegex =
    /\b(pencil case|school bag|backpack|blackboard|whiteboard|board|book|notebook|pen|pencil|ruler|eraser|rubber|crayon|scissors|glue|desk|chair|table|clock|map|globe|computer|monkey|elephant|tiger|lion|bear|panda|giraffe|zebra|crocodile|hippo|kangaroo|peacock|snake|dog|puppy|cat|kitten|bird|parrot|rabbit|bunny|fish|goldfish|duck|chicken|hen|cow|pig|sheep|horse|frog|butterfly|bee|turtle|tortoise|dolphin|shark|apple|banana|orange|mango|watermelon|grapes|strawberry|pear|pineapple|coconut|lemon|rice|bread|noodles|pizza|hamburger|burger|sandwich|meat|beef|pork|egg|cake|ice cream|chocolate|candy|cookie|biscuit|soup|salad|milk|water|juice|lemonade|tea|coffee|football|soccer|badminton|basketball|volleyball|tennis|table tennis|swimming|swim|skipping|running|run|cycling|bike|bicycle|skating|kite|singing|sing|dancing|dance|drawing|painting|reading|chess|piano|guitar|drum|cooking|cook|watching tv|o'clock|half past|sunny|rainy|cloudy|windy|snowy|stormy|rainbow|spring|summer|autumn|fall|winter|father|dad|mother|mum|mom|grandfather|grandpa|grandmother|grandma|brother|sister|baby|family|doctor|nurse|teacher|driver|farmer|worker|pilot|chef|policeman|police|firefighter|singer|dancer|dentist|artist|living room|bedroom|kitchen|bathroom|dining room|garden|house|school|library|park|zoo|cinema|supermarket|bakery|bookshop|hospital|post office|bus|car|taxi|truck|train|plane|airplane|boat|ship|motorbike|head|hair|eye|eyes|ear|ears|nose|mouth|tooth|teeth|hand|hands|arm|leg|foot|feet|headache|toothache|stomachache|fever|t-shirt|shirt|dress|skirt|coat|jacket|sweater|jeans|trousers|pants|shorts|shoes|socks|hat|cap|scarf|glasses|boots|umbrella|doll|teddy bear|robot|ball|red|blue|yellow|green|pink|purple|black|white|brown)\b/i;

  if (concreteVocabularyRegex.test(clean)) return true;

  // Time pattern in option
  if (parseTimeFromText(`${clean} ${questionText}`) !== null && /\d|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve/i.test(clean)) {
    return true;
  }

  return false;
}

/**
 * Core Graphic Renderer: Draws an unmistakable, vivid SVG illustration for a specific Primary English concept.
 * Works for BOTH full question scenes (420x220) and individual option cards (220x120) with ZERO prompt text!
 */
function renderConceptGraphicMarkup(
  conceptText: string,
  contextText: string,
  mode: 'scene' | 'option',
  optionIndex: number = 0
): string {
  const s = `${conceptText} ${contextText}`.toLowerCase();
  const primary = conceptText.toLowerCase();

  // Check if primary text itself matches a specific concept first; if not, fall back to combined context
  const has = (regex: RegExp) => regex.test(primary) || (mode === 'scene' && regex.test(s));

  const bgColors = ['#eff6ff', '#ecfdf5', '#fef3c7', '#fdf2f8'];
  const borderColors = ['#60a5fa', '#34d399', '#fbbf24', '#f472b6'];
  const cardBg = mode === 'option' ? bgColors[optionIndex % 4] : '#e0f2fe';
  const cardBorder = mode === 'option' ? borderColors[optionIndex % 4] : '#38bdf8';

  const wrapSvg = (inner: string, customBg?: string) => {
    const bgFill = customBg || cardBg;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 220" width="100%" height="100%">
      <rect width="420" height="220" rx="22" fill="${bgFill}" stroke="${cardBorder}" stroke-width="3"/>
      ${inner}
    </svg>`;
  };

  // ============================================================================
  // 1. TELLING THE TIME / CLOCKS (Exact Hour & Minute Hands!)
  // ============================================================================
  const timeSpec = parseTimeFromText(mode === 'option' ? `${primary} clock` : s);
  if (
    timeSpec &&
    (has(/\bo'clock\b|\bclock\b|\bwhat time\b|\bhalf past\b|\bquarter\b/) ||
      (mode === 'option' && /\bo'clock\b|\b\d{1,2}:\d{2}\b/.test(primary)) ||
      (mode === 'scene' && /\bwhat time\b|\bo'clock\b|\bclock\b/.test(s)))
  ) {
    const { hour, minute } = timeSpec;
    const minAngleRad = (minute * 6 - 90) * (Math.PI / 180);
    const hourAngleRad = (((hour % 12) + minute / 60) * 30 - 90) * (Math.PI / 180);
    const hx = Math.round(210 + Math.cos(hourAngleRad) * 44);
    const hy = Math.round(110 + Math.sin(hourAngleRad) * 44);
    const mx = Math.round(210 + Math.cos(minAngleRad) * 62);
    const my = Math.round(110 + Math.sin(minAngleRad) * 62);

    return wrapSvg(
      `
      <circle cx="210" cy="110" r="84" fill="#4f46e5"/>
      <circle cx="210" cy="110" r="74" fill="#ffffff"/>
      <text x="210" y="52" text-anchor="middle" font-family="Arial" font-weight="900" font-size="18" fill="#1e1b4b">12</text>
      <text x="242" y="60" text-anchor="middle" font-family="Arial" font-weight="700" font-size="13" fill="#64748b">1</text>
      <text x="266" y="83" text-anchor="middle" font-family="Arial" font-weight="700" font-size="13" fill="#64748b">2</text>
      <text x="275" y="116" text-anchor="middle" font-family="Arial" font-weight="900" font-size="18" fill="#1e1b4b">3</text>
      <text x="266" y="148" text-anchor="middle" font-family="Arial" font-weight="700" font-size="13" fill="#64748b">4</text>
      <text x="242" y="171" text-anchor="middle" font-family="Arial" font-weight="700" font-size="13" fill="#64748b">5</text>
      <text x="210" y="180" text-anchor="middle" font-family="Arial" font-weight="900" font-size="18" fill="#1e1b4b">6</text>
      <text x="178" y="171" text-anchor="middle" font-family="Arial" font-weight="700" font-size="13" fill="#64748b">7</text>
      <text x="154" y="148" text-anchor="middle" font-family="Arial" font-weight="700" font-size="13" fill="#64748b">8</text>
      <text x="145" y="116" text-anchor="middle" font-family="Arial" font-weight="900" font-size="18" fill="#1e1b4b">9</text>
      <text x="154" y="83" text-anchor="middle" font-family="Arial" font-weight="700" font-size="13" fill="#64748b">10</text>
      <text x="178" y="60" text-anchor="middle" font-family="Arial" font-weight="700" font-size="13" fill="#64748b">11</text>
      <line x1="210" y1="110" x2="${mx}" y2="${my}" stroke="#1e293b" stroke-width="5.5" stroke-linecap="round"/>
      <line x1="210" y1="110" x2="${hx}" y2="${hy}" stroke="#ef4444" stroke-width="7.5" stroke-linecap="round"/>
      <circle cx="210" cy="110" r="7" fill="#1e1b4b"/>
      `,
      '#e0e7ff'
    );
  }

  // ============================================================================
  // 2. SCHOOL THINGS (Pencil case, School bag, Book, Notebook, Pen, Pencil, Ruler, Eraser, Blackboard, Desk, Chair, Scissors, Crayon)
  // ============================================================================
  if (has(/\bpencil case\b/)) {
    return wrapSvg(
      `
      <rect x="75" y="72" width="270" height="88" rx="28" fill="#ec4899" stroke="#9d174d" stroke-width="4.5"/>
      <rect x="75" y="106" width="270" height="12" fill="#fbcfe8"/>
      <circle cx="305" cy="112" r="11" fill="#facc15" stroke="#78350f" stroke-width="2.5"/>
      <g transform="rotate(-16 150 55)">
        <rect x="135" y="22" width="18" height="65" fill="#facc15" stroke="#78350f" stroke-width="2.5"/>
        <polygon points="135,22 144,4 153,22" fill="#fde68a" stroke="#78350f" stroke-width="2"/>
        <polygon points="141,10 144,4 147,10" fill="#1e293b"/>
      </g>
      <g transform="rotate(14 250 55)">
        <rect x="235" y="18" width="28" height="68" rx="4" fill="#38bdf8" stroke="#0369a1" stroke-width="2.5"/>
        <line x1="235" y1="32" x2="247" y2="32" stroke="#0369a1" stroke-width="2.5"/>
        <line x1="235" y1="46" x2="247" y2="46" stroke="#0369a1" stroke-width="2.5"/>
        <line x1="235" y1="60" x2="247" y2="60" stroke="#0369a1" stroke-width="2.5"/>
      </g>
      `,
      '#fdf2f8'
    );
  }

  if (has(/\bschool bag\b|\bbackpack\b|\bbag\b/)) {
    return wrapSvg(
      `
      <path d="M 175 40 Q 210 12 245 40" fill="none" stroke="#1e3a8a" stroke-width="8" stroke-linecap="round"/>
      <rect x="118" y="55" width="24" height="95" rx="10" fill="#1d4ed8"/>
      <rect x="278" y="55" width="24" height="95" rx="10" fill="#1d4ed8"/>
      <rect x="135" y="38" width="150" height="148" rx="34" fill="#3b82f6" stroke="#1e3a8a" stroke-width="4.5"/>
      <path d="M 135 82 Q 210 105 285 82" fill="none" stroke="#93c5fd" stroke-width="4"/>
      <rect x="160" y="102" width="100" height="64" rx="16" fill="#facc15" stroke="#ca8a04" stroke-width="3.5"/>
      <rect x="198" y="78" width="24" height="16" rx="5" fill="#fde047" stroke="#78350f" stroke-width="2"/>
      `,
      '#eff6ff'
    );
  }

  if (has(/\bblackboard\b|\bwhiteboard\b|\bboard\b/)) {
    return wrapSvg(
      `
      <rect x="65" y="28" width="290" height="156" rx="10" fill="#065f46" stroke="#92400e" stroke-width="10"/>
      <rect x="52" y="178" width="316" height="14" rx="5" fill="#78350f"/>
      <rect x="115" y="170" width="32" height="8" rx="2" fill="#ffffff"/>
      <rect x="260" y="166" width="38" height="12" rx="3" fill="#f59e0b"/>
      <text x="210" y="102" text-anchor="middle" font-family="Arial" font-weight="900" font-size="36" fill="#ffffff">A B C</text>
      <path d="M 130 132 L 290 132" stroke="#fde047" stroke-width="4" stroke-dasharray="10 6" stroke-linecap="round"/>
      `,
      '#ecfdf5'
    );
  }

  if (has(/\bruler\b/)) {
    return wrapSvg(
      `
      <g transform="rotate(-12 210 110)">
        <rect x="55" y="72" width="310" height="76" rx="10" fill="#38bdf8" stroke="#0284c7" stroke-width="4.5"/>
        <circle cx="85" cy="110" r="10" fill="#e0f2fe" stroke="#0284c7" stroke-width="3"/>
        <g stroke="#0c4a6e" stroke-width="3.5" stroke-linecap="round">
          <line x1="115" y1="72" x2="115" y2="102"/>
          <line x1="140" y1="72" x2="140" y2="92"/>
          <line x1="165" y1="72" x2="165" y2="102"/>
          <line x1="190" y1="72" x2="190" y2="92"/>
          <line x1="215" y1="72" x2="215" y2="102"/>
          <line x1="240" y1="72" x2="240" y2="92"/>
          <line x1="265" y1="72" x2="265" y2="102"/>
          <line x1="290" y1="72" x2="290" y2="92"/>
          <line x1="315" y1="72" x2="315" y2="102"/>
          <line x1="340" y1="72" x2="340" y2="92"/>
        </g>
      </g>
      `,
      '#f0f9ff'
    );
  }

  if (has(/\beraser\b|\brubber\b/)) {
    return wrapSvg(
      `
      <g transform="rotate(-14 210 110)">
        <rect x="95" y="65" width="150" height="90" rx="16" fill="#f472b6" stroke="#be185d" stroke-width="4"/>
        <rect x="215" y="65" width="110" height="90" rx="16" fill="#38bdf8" stroke="#0369a1" stroke-width="4"/>
        <rect x="190" y="62" width="45" height="96" rx="4" fill="#ffffff" stroke="#cbd5e1" stroke-width="3"/>
      </g>
      `,
      '#fdf2f8'
    );
  }

  if (has(/\bnotebook\b/)) {
    return wrapSvg(
      `
      <rect x="125" y="24" width="170" height="172" rx="14" fill="#a855f7" stroke="#581c87" stroke-width="4"/>
      <rect x="155" y="52" width="115" height="58" rx="8" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
      <line x1="170" y1="72" x2="255" y2="72" stroke="#94a3b8" stroke-width="3"/>
      <line x1="170" y1="90" x2="235" y2="90" stroke="#94a3b8" stroke-width="3"/>
      <g fill="none" stroke="#334155" stroke-width="4" stroke-linecap="round">
        <path d="M 115 44 L 138 44"/><path d="M 115 70 L 138 70"/><path d="M 115 96 L 138 96"/>
        <path d="M 115 122 L 138 122"/><path d="M 115 148 L 138 148"/><path d="M 115 174 L 138 174"/>
      </g>
      `,
      '#faf5ff'
    );
  }

  if (has(/\bbook\b|\btextbook\b/)) {
    return wrapSvg(
      `
      <path d="M 75 52 Q 142 35 210 55 L 210 178 Q 142 158 75 175 Z" fill="#ffffff" stroke="#1e3a8a" stroke-width="4"/>
      <path d="M 210 55 Q 278 35 345 52 L 345 175 Q 278 158 210 178 Z" fill="#fef9c3" stroke="#1e3a8a" stroke-width="4"/>
      <polygon points="195,52 215,52 215,125 205,112 195,125" fill="#ef4444"/>
      <line x1="100" y1="82" x2="185" y2="82" stroke="#3b82f6" stroke-width="4" stroke-linecap="round"/>
      <line x1="100" y1="108" x2="185" y2="108" stroke="#3b82f6" stroke-width="4" stroke-linecap="round"/>
      <line x1="100" y1="134" x2="165" y2="134" stroke="#3b82f6" stroke-width="4" stroke-linecap="round"/>
      <circle cx="278" cy="108" r="28" fill="#38bdf8" stroke="#0284c7" stroke-width="3"/>
      `,
      '#eff6ff'
    );
  }

  if (has(/\bpencil\b/) && !has(/\bpencil case\b/)) {
    return wrapSvg(
      `
      <g transform="rotate(-25 210 110)">
        <rect x="75" y="90" width="42" height="40" rx="8" fill="#f472b6" stroke="#9d174d" stroke-width="3.5"/>
        <rect x="112" y="90" width="18" height="40" fill="#cbd5e1" stroke="#475569" stroke-width="3"/>
        <rect x="130" y="90" width="175" height="40" fill="#facc15" stroke="#ca8a04" stroke-width="3.5"/>
        <line x1="130" y1="103" x2="305" y2="103" stroke="#eab308" stroke-width="2.5"/>
        <line x1="130" y1="117" x2="305" y2="117" stroke="#eab308" stroke-width="2.5"/>
        <polygon points="305,90 360,110 305,130" fill="#fde68a" stroke="#78350f" stroke-width="3.5"/>
        <polygon points="340,103 360,110 340,117" fill="#1e293b"/>
      </g>
      `,
      '#fefce8'
    );
  }

  if (has(/\bpen\b/)) {
    return wrapSvg(
      `
      <g transform="rotate(-25 210 110)">
        <rect x="75" y="94" width="215" height="32" rx="14" fill="#2563eb" stroke="#1e3a8a" stroke-width="3.5"/>
        <path d="M 105 94 L 105 78 L 165 78" fill="none" stroke="#94a3b8" stroke-width="5" stroke-linecap="round"/>
        <rect x="215" y="94" width="12" height="32" fill="#e2e8f0"/>
        <polygon points="286,96 345,110 286,124" fill="#cbd5e1" stroke="#334155" stroke-width="3"/>
        <circle cx="345" cy="110" r="3.5" fill="#1e293b"/>
      </g>
      `,
      '#eff6ff'
    );
  }

  if (has(/\bcrayon\b|\bcolored pencil\b/)) {
    return wrapSvg(
      `
      <g transform="translate(95, 35)">
        <rect x="0" y="35" width="36" height="115" rx="6" fill="#ef4444" stroke="#991b1b" stroke-width="3"/>
        <polygon points="4,35 18,5 32,35" fill="#f87171" stroke="#991b1b" stroke-width="3"/>
        <rect x="65" y="35" width="36" height="115" rx="6" fill="#facc15" stroke="#854d0e" stroke-width="3"/>
        <polygon points="69,35 83,5 97,35" fill="#fde047" stroke="#854d0e" stroke-width="3"/>
        <rect x="130" y="35" width="36" height="115" rx="6" fill="#22c55e" stroke="#166534" stroke-width="3"/>
        <polygon points="134,35 148,5 162,35" fill="#4ade80" stroke="#166534" stroke-width="3"/>
        <rect x="195" y="35" width="36" height="115" rx="6" fill="#3b82f6" stroke="#1e3a8a" stroke-width="3"/>
        <polygon points="199,35 213,5 227,35" fill="#60a5fa" stroke="#1e3a8a" stroke-width="3"/>
      </g>
      `,
      '#fffbeb'
    );
  }

  if (has(/\bdesk\b|\btable\b/)) {
    return wrapSvg(
      `
      <rect x="75" y="68" width="270" height="24" rx="6" fill="#d97706" stroke="#78350f" stroke-width="4"/>
      <rect x="95" y="92" width="230" height="26" fill="#b45309" stroke="#78350f" stroke-width="3"/>
      <rect x="102" y="118" width="18" height="75" rx="4" fill="#92400e"/>
      <rect x="300" y="118" width="18" height="75" rx="4" fill="#92400e"/>
      `,
      '#fef3c7'
    );
  }

  if (has(/\bchair\b/)) {
    return wrapSvg(
      `
      <rect x="155" y="28" width="110" height="76" rx="10" fill="#d97706" stroke="#78350f" stroke-width="4"/>
      <rect x="140" y="104" width="140" height="22" rx="6" fill="#f59e0b" stroke="#78350f" stroke-width="4"/>
      <rect x="155" y="126" width="16" height="68" rx="4" fill="#78350f"/>
      <rect x="249" y="126" width="16" height="68" rx="4" fill="#78350f"/>
      `,
      '#fef3c7'
    );
  }

  // ============================================================================
  // 3. ANIMALS & PETS (+ Prepositions like "in the tree", "under the table")
  // ============================================================================
  if (has(/\bmonkey\b/)) {
    const inTree = /\bin the tree\b|\btree\b/.test(s);
    const underTable = /\bunder the table\b/.test(s);
    return wrapSvg(
      `
      ${
        inTree
          ? `<rect x="75" y="25" width="38" height="175" fill="#78350f"/>
             <circle cx="95" cy="55" r="56" fill="#16a34a"/>
             <circle cx="155" cy="65" r="48" fill="#22c55e"/>
             <path d="M 95 105 L 235 105" stroke="#78350f" stroke-width="16" stroke-linecap="round"/>`
          : underTable
          ? `<rect x="85" y="32" width="250" height="18" rx="5" fill="#d97706" stroke="#78350f" stroke-width="3"/>
             <rect x="105" y="50" width="16" height="145" fill="#78350f"/>
             <rect x="300" y="50" width="16" height="145" fill="#78350f"/>`
          : ''
      }
      <g transform="translate(${inTree ? 225 : 210}, ${inTree ? 75 : underTable ? 128 : 95})">
        <circle cx="-32" cy="-12" r="18" fill="#d97706" stroke="#451a03" stroke-width="3"/>
        <circle cx="32" cy="-12" r="18" fill="#d97706" stroke="#451a03" stroke-width="3"/>
        <circle cx="0" cy="-10" r="32" fill="#92400e" stroke="#451a03" stroke-width="3.5"/>
        <ellipse cx="0" cy="0" rx="22" ry="15" fill="#fde68a"/>
        <circle cx="-10" cy="-16" r="4.5" fill="#1e293b"/>
        <circle cx="10" cy="-16" r="4.5" fill="#1e293b"/>
        <path d="M -10 2 Q 0 12 10 2" stroke="#451a03" stroke-width="3" fill="none" stroke-linecap="round"/>
        <ellipse cx="0" cy="42" rx="24" ry="28" fill="#92400e" stroke="#451a03" stroke-width="3.5"/>
        <path d="M 22 50 Q 65 55 68 15 Q 70 -5 54 -5" stroke="#92400e" stroke-width="8" fill="none" stroke-linecap="round"/>
        <path d="M 42 -28 Q 72 -38 80 -4 Q 62 2 42 -28 Z" fill="#facc15" stroke="#ca8a04" stroke-width="2.5"/>
      </g>
      `,
      '#dcfce7'
    );
  }

  if (has(/\belephant\b/)) {
    return wrapSvg(
      `
      <ellipse cx="145" cy="98" rx="34" ry="48" fill="#94a3b8" stroke="#475569" stroke-width="3.5"/>
      <ellipse cx="275" cy="98" rx="34" ry="48" fill="#94a3b8" stroke="#475569" stroke-width="3.5"/>
      <ellipse cx="210" cy="135" rx="58" ry="44" fill="#cbd5e1" stroke="#475569" stroke-width="3.5"/>
      <circle cx="210" cy="92" r="44" fill="#cbd5e1" stroke="#475569" stroke-width="3.5"/>
      <circle cx="192" cy="82" r="5" fill="#1e293b"/>
      <circle cx="228" cy="82" r="5" fill="#1e293b"/>
      <path d="M 210 98 Q 210 158 242 152 Q 256 148 250 135" stroke="#94a3b8" stroke-width="18" fill="none" stroke-linecap="round"/>
      `,
      '#f1f5f9'
    );
  }

  if (has(/\btiger\b/)) {
    return wrapSvg(
      `
      <circle cx="168" cy="52" r="18" fill="#f97316" stroke="#9a3412" stroke-width="3.5"/>
      <circle cx="252" cy="52" r="18" fill="#f97316" stroke="#9a3412" stroke-width="3.5"/>
      <circle cx="210" cy="98" r="50" fill="#fb923c" stroke="#9a3412" stroke-width="4"/>
      <path d="M 164 82 L 184 86 M 162 98 L 184 98 M 256 82 L 236 86 M 258 98 L 236 98 M 210 48 L 210 68" stroke="#1e293b" stroke-width="5" stroke-linecap="round"/>
      <ellipse cx="210" cy="112" rx="26" ry="20" fill="#ffedd5"/>
      <circle cx="192" cy="88" r="5.5" fill="#1e293b"/>
      <circle cx="228" cy="88" r="5.5" fill="#1e293b"/>
      <polygon points="202,104 218,104 210,114" fill="#ec4899"/>
      `,
      '#ffedd5'
    );
  }

  if (has(/\blion\b/)) {
    return wrapSvg(
      `
      <circle cx="210" cy="105" r="68" fill="#b45309" stroke="#78350f" stroke-width="4"/>
      <circle cx="174" cy="64" r="15" fill="#f59e0b"/>
      <circle cx="246" cy="64" r="15" fill="#f59e0b"/>
      <circle cx="210" cy="105" r="46" fill="#fbbf24" stroke="#92400e" stroke-width="3"/>
      <circle cx="194" cy="95" r="5" fill="#1e293b"/>
      <circle cx="226" cy="95" r="5" fill="#1e293b"/>
      <polygon points="203,108 217,108 210,117" fill="#78350f"/>
      <path d="M 198 124 Q 210 132 222 124" stroke="#78350f" stroke-width="3" fill="none" stroke-linecap="round"/>
      `,
      '#fef3c7'
    );
  }

  if (has(/\brabbit\b|\bbunny\b/)) {
    return wrapSvg(
      `
      <ellipse cx="188" cy="52" rx="14" ry="38" fill="#ffffff" stroke="#94a3b8" stroke-width="3.5"/>
      <ellipse cx="188" cy="54" rx="7" ry="26" fill="#fbcfe8"/>
      <ellipse cx="232" cy="52" rx="14" ry="38" fill="#ffffff" stroke="#94a3b8" stroke-width="3.5"/>
      <ellipse cx="232" cy="54" rx="7" ry="26" fill="#fbcfe8"/>
      <circle cx="210" cy="116" r="44" fill="#ffffff" stroke="#94a3b8" stroke-width="3.5"/>
      <circle cx="194" cy="106" r="5" fill="#ef4444"/>
      <circle cx="226" cy="106" r="5" fill="#ef4444"/>
      <polygon points="204,118 216,118 210,126" fill="#f472b6"/>
      <polygon points="275,135 335,110 295,165" fill="#f97316" stroke="#c2410c" stroke-width="3"/>
      `,
      '#fdf2f8'
    );
  }

  if (has(/\bdog\b|\bpuppy\b/)) {
    return wrapSvg(
      `
      <ellipse cx="158" cy="96" rx="18" ry="34" fill="#92400e" transform="rotate(18 158 96)"/>
      <ellipse cx="262" cy="96" rx="18" ry="34" fill="#92400e" transform="rotate(-18 262 96)"/>
      <circle cx="210" cy="104" r="46" fill="#d97706" stroke="#78350f" stroke-width="3.5"/>
      <ellipse cx="210" cy="118" rx="24" ry="18" fill="#fef3c7"/>
      <circle cx="194" cy="92" r="5.5" fill="#1e293b"/>
      <circle cx="226" cy="92" r="5.5" fill="#1e293b"/>
      <ellipse cx="210" cy="110" rx="8" ry="6" fill="#1e293b"/>
      <path d="M 204 124 Q 210 136 216 124" fill="#f43f5e"/>
      `,
      '#fef3c7'
    );
  }

  if (has(/\bcat\b|\bkitten\b/)) {
    return wrapSvg(
      `
      <polygon points="162,78 175,34 202,64" fill="#fb923c" stroke="#9a3412" stroke-width="3.5"/>
      <polygon points="258,78 245,34 218,64" fill="#fb923c" stroke="#9a3412" stroke-width="3.5"/>
      <circle cx="210" cy="110" r="46" fill="#fdba74" stroke="#9a3412" stroke-width="3.5"/>
      <circle cx="193" cy="100" r="5.5" fill="#166534"/>
      <circle cx="227" cy="100" r="5.5" fill="#166534"/>
      <polygon points="205,112 215,112 210,119" fill="#f472b6"/>
      <line x1="145" y1="108" x2="182" y2="112" stroke="#78350f" stroke-width="2.5"/>
      <line x1="145" y1="120" x2="182" y2="118" stroke="#78350f" stroke-width="2.5"/>
      <line x1="275" y1="108" x2="238" y2="112" stroke="#78350f" stroke-width="2.5"/>
      <line x1="275" y1="120" x2="238" y2="118" stroke="#78350f" stroke-width="2.5"/>
      `,
      '#ffedd5'
    );
  }

  if (has(/\bfish\b|\bgoldfish\b|\bdolphin\b|\bshark\b/)) {
    return wrapSvg(
      `
      <polygon points="285,110 340,72 328,110 340,148" fill="#f97316" stroke="#c2410c" stroke-width="3.5"/>
      <ellipse cx="205" cy="110" rx="82" ry="48" fill="#fb923c" stroke="#c2410c" stroke-width="4"/>
      <path d="M 185 62 Q 215 35 235 64" fill="#f97316" stroke="#c2410c" stroke-width="3.5"/>
      <circle cx="155" cy="98" r="7" fill="#ffffff"/>
      <circle cx="153" cy="98" r="4" fill="#1e293b"/>
      <circle cx="105" cy="82" r="6" fill="none" stroke="#38bdf8" stroke-width="2.5"/>
      <circle cx="92" cy="62" r="9" fill="none" stroke="#38bdf8" stroke-width="2.5"/>
      `,
      '#e0f2fe'
    );
  }

  if (has(/\bbird\b|\bparrot\b/)) {
    return wrapSvg(
      `
      <ellipse cx="210" cy="118" rx="52" ry="40" fill="#38bdf8" stroke="#0284c7" stroke-width="3.5"/>
      <circle cx="172" cy="84" r="30" fill="#38bdf8" stroke="#0284c7" stroke-width="3.5"/>
      <polygon points="142,84 115,92 142,100" fill="#facc15" stroke="#ca8a04" stroke-width="2.5"/>
      <circle cx="164" cy="78" r="5" fill="#1e293b"/>
      <ellipse cx="222" cy="116" rx="28" ry="18" fill="#0ea5e9" transform="rotate(-15 222 116)"/>
      `,
      '#f0f9ff'
    );
  }

  if (has(/\bduck\b/)) {
    return wrapSvg(
      `
      <ellipse cx="210" cy="172" rx="135" ry="22" fill="#38bdf8"/>
      <ellipse cx="220" cy="135" rx="56" ry="34" fill="#facc15" stroke="#ca8a04" stroke-width="3.5"/>
      <circle cx="172" cy="88" r="28" fill="#facc15" stroke="#ca8a04" stroke-width="3.5"/>
      <polygon points="145,88 118,95 145,103" fill="#f97316" stroke="#c2410c" stroke-width="2.5"/>
      <circle cx="165" cy="82" r="4.5" fill="#1e293b"/>
      `,
      '#e0f2fe'
    );
  }

  // ============================================================================
  // 4. FOOD, DRINKS & FRUIT (Apple, Banana, Milk, Bread, Rice, Chicken, Juice, Cake, Ice cream, Noodles, Pizza, Water, Egg, Watermelon, Orange)
  // ============================================================================
  if (has(/\bapple\b/) && !has(/\bjuice\b|\bpineapple\b/)) {
    return wrapSvg(
      `
      <path d="M 210 62 C 175 42, 130 70, 138 122 C 145 168, 185 188, 210 176 C 235 188, 275 168, 282 122 C 290 70, 245 42, 210 62 Z" fill="#ef4444" stroke="#991b1b" stroke-width="4"/>
      <path d="M 210 62 Q 214 35 224 28" stroke="#78350f" stroke-width="6" fill="none" stroke-linecap="round"/>
      <path d="M 216 44 Q 248 28 256 48 Q 236 62 216 44 Z" fill="#22c55e" stroke="#15803d" stroke-width="2.5"/>
      `,
      '#fef2f2'
    );
  }

  if (has(/\bbanana\b/)) {
    return wrapSvg(
      `
      <path d="M 125 145 Q 195 195 295 85 Q 312 62 298 48 Q 282 65 245 105 Q 185 155 125 125 Z" fill="#facc15" stroke="#ca8a04" stroke-width="4"/>
      <circle cx="300" cy="48" r="6" fill="#78350f"/>
      `,
      '#fefce8'
    );
  }

  if (has(/\bwatermelon\b/)) {
    return wrapSvg(
      `
      <path d="M 95 75 A 115 115 0 0 0 325 75 Z" fill="#16a34a" stroke="#14532d" stroke-width="4"/>
      <path d="M 110 75 A 100 100 0 0 0 310 75 Z" fill="#ef4444"/>
      <circle cx="175" cy="110" r="4" fill="#1e293b"/><circle cx="210" cy="125" r="4" fill="#1e293b"/>
      <circle cx="245" cy="110" r="4" fill="#1e293b"/><circle cx="192" cy="145" r="4" fill="#1e293b"/>
      <circle cx="228" cy="145" r="4" fill="#1e293b"/>
      `,
      '#f0fdf4'
    );
  }

  if (has(/\bmilk\b/)) {
    return wrapSvg(
      `
      <rect x="145" y="68" width="90" height="118" rx="8" fill="#ffffff" stroke="#0284c7" stroke-width="4"/>
      <polygon points="145,68 190,32 235,68" fill="#38bdf8" stroke="#0284c7" stroke-width="4"/>
      <rect x="145" y="102" width="90" height="36" fill="#38bdf8"/>
      <rect x="255" y="102" width="46" height="84" rx="6" fill="#ffffff" stroke="#94a3b8" stroke-width="3.5"/>
      <rect x="259" y="122" width="38" height="60" rx="4" fill="#e0f2fe"/>
      `,
      '#f0f9ff'
    );
  }

  if (has(/\bjuice\b|\blemonade\b|\bwater\b/)) {
    const isOrange = /\borange\b/.test(s);
    const liquidColor = isOrange ? '#fb923c' : /\bwater\b/.test(s) ? '#38bdf8' : '#facc15';
    return wrapSvg(
      `
      <path d="M 225 95 L 255 28 L 280 28" fill="none" stroke="#ec4899" stroke-width="6" stroke-linecap="round"/>
      <polygon points="155,58 265,58 250,185 170,185" fill="#ffffff" stroke="#64748b" stroke-width="4"/>
      <polygon points="162,88 258,88 246,179 174,179" fill="${liquidColor}"/>
      <circle cx="265" cy="58" r="22" fill="#f97316" stroke="#ea580c" stroke-width="3"/>
      `,
      '#fffbeb'
    );
  }

  if (has(/\bbread\b|\bsandwich\b/)) {
    return wrapSvg(
      `
      <path d="M 115 95 C 95 55, 155 38, 210 42 C 265 38, 325 55, 305 95 L 295 175 L 125 175 Z" fill="#d97706" stroke="#78350f" stroke-width="4"/>
      <path d="M 132 98 C 118 68, 165 55, 210 58 C 255 55, 302 68, 288 98 L 280 164 L 140 164 Z" fill="#fde68a"/>
      `,
      '#fef3c7'
    );
  }

  if (has(/\brice\b|\bnoodles\b|\bsoup\b/)) {
    return wrapSvg(
      `
      <path d="M 125 105 C 125 60, 295 60, 295 105 Z" fill="#ffffff" stroke="#cbd5e1" stroke-width="3"/>
      <path d="M 110 105 L 310 105 C 300 168, 255 185, 210 185 C 165 185, 120 168, 110 105 Z" fill="#3b82f6" stroke="#1d4ed8" stroke-width="4"/>
      <line x1="185" y1="35" x2="315" y2="85" stroke="#78350f" stroke-width="5" stroke-linecap="round"/>
      <line x1="185" y1="52" x2="315" y2="95" stroke="#78350f" stroke-width="5" stroke-linecap="round"/>
      `,
      '#eff6ff'
    );
  }

  if (has(/\bcake\b|\bbirthday\b|\bhow old\b|\byears old\b/)) {
    const numCandles = Math.min(10, Math.max(3, parseNumberFromText(s) || 5));
    const candleSpacing = 120 / (numCandles + 1);
    const candlesSvg = Array.from({ length: numCandles }, (_, i) => {
      const cx = Math.round(150 + (i + 1) * candleSpacing);
      return `<rect x="${cx - 4}" y="46" width="8" height="32" rx="2" fill="#38bdf8" stroke="#0284c7" stroke-width="1.5"/>
              <ellipse cx="${cx}" cy="36" rx="5" ry="9" fill="#facc15"/>`;
    }).join('');
    return wrapSvg(
      `
      ${candlesSvg}
      <rect x="135" y="78" width="150" height="46" rx="10" fill="#fbcfe8" stroke="#db2777" stroke-width="3.5"/>
      <rect x="105" y="124" width="210" height="58" rx="12" fill="#f472b6" stroke="#be185d" stroke-width="4"/>
      <path d="M 105 142 Q 130 158 155 142 Q 182 158 210 142 Q 238 158 265 142 Q 290 158 315 142" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round"/>
      `,
      '#fdf2f8'
    );
  }

  if (has(/\bice cream\b/)) {
    return wrapSvg(
      `
      <polygon points="168,108 252,108 210,192" fill="#f59e0b" stroke="#b45309" stroke-width="3.5"/>
      <circle cx="185" cy="92" r="28" fill="#f472b6" stroke="#db2777" stroke-width="3"/>
      <circle cx="235" cy="92" r="28" fill="#fde047" stroke="#ca8a04" stroke-width="3"/>
      <circle cx="210" cy="64" r="30" fill="#a7f3d0" stroke="#10b981" stroke-width="3"/>
      <circle cx="210" cy="32" r="9" fill="#ef4444"/>
      `,
      '#fdf2f8'
    );
  }

  // ============================================================================
  // 5. SPORTS, HOBBIES & ACTIONS (Badminton, Football, Basketball, Swimming, Skipping, Cycling, Flying a kite, Reading, Singing, Drawing)
  // ============================================================================
  if (has(/\bbadminton\b/)) {
    return wrapSvg(
      `
      <rect x="20" y="165" width="380" height="35" rx="8" fill="#4ade80"/>
      <line x1="210" y1="85" x2="210" y2="185" stroke="#475569" stroke-width="5"/>
      <rect x="204" y="90" width="12" height="45" fill="none" stroke="#ffffff" stroke-width="2"/>
      <!-- Player Left with Racket -->
      <circle cx="115" cy="88" r="20" fill="#fde68a" stroke="#78350f" stroke-width="2.5"/>
      <rect x="99" y="108" width="32" height="44" rx="8" fill="#ef4444"/>
      <ellipse cx="168" cy="70" rx="18" ry="24" fill="none" stroke="#2563eb" stroke-width="4" transform="rotate(25 168 70)"/>
      <line x1="130" y1="115" x2="156" y2="88" stroke="#1e293b" stroke-width="4"/>
      <!-- Player Right with Racket -->
      <circle cx="305" cy="88" r="20" fill="#fde68a" stroke="#78350f" stroke-width="2.5"/>
      <rect x="289" y="108" width="32" height="44" rx="8" fill="#3b82f6"/>
      <ellipse cx="252" cy="70" rx="18" ry="24" fill="none" stroke="#ea580c" stroke-width="4" transform="rotate(-25 252 70)"/>
      <line x1="290" y1="115" x2="264" y2="88" stroke="#1e293b" stroke-width="4"/>
      <!-- Shuttlecock -->
      <polygon points="210,48 198,28 222,28" fill="#ffffff" stroke="#64748b" stroke-width="2"/>
      <circle cx="210" cy="50" r="5" fill="#facc15"/>
      `,
      '#dcfce7'
    );
  }

  if (has(/\bfootball\b|\bsoccer\b/)) {
    return wrapSvg(
      `
      <rect x="25" y="20" width="370" height="180" rx="16" fill="#22c55e" stroke="#ffffff" stroke-width="4"/>
      <circle cx="210" cy="110" r="40" fill="none" stroke="#ffffff" stroke-width="4"/>
      <line x1="210" y1="20" x2="210" y2="200" stroke="#ffffff" stroke-width="4"/>
      <circle cx="135" cy="85" r="18" fill="#fde68a" stroke="#1e293b" stroke-width="2.5"/>
      <rect x="121" y="103" width="28" height="38" rx="6" fill="#ef4444"/>
      <circle cx="285" cy="85" r="18" fill="#fde68a" stroke="#1e293b" stroke-width="2.5"/>
      <rect x="271" y="103" width="28" height="38" rx="6" fill="#3b82f6"/>
      <circle cx="210" cy="145" r="22" fill="#ffffff" stroke="#1e293b" stroke-width="3.5"/>
      <polygon points="210,132 221,140 217,153 203,153 199,140" fill="#1e293b"/>
      `,
      '#bbf7d0'
    );
  }

  if (has(/\bswimming\b|\bswim\b|\bpool\b/)) {
    return wrapSvg(
      `
      <rect x="20" y="95" width="380" height="105" rx="16" fill="#0ea5e9"/>
      <path d="M 40 125 Q 90 108 140 125 T 240 125 T 340 125" fill="none" stroke="#bae6fd" stroke-width="5" stroke-linecap="round"/>
      <path d="M 40 162 Q 90 145 140 162 T 240 162 T 340 162" fill="none" stroke="#bae6fd" stroke-width="5" stroke-linecap="round"/>
      <circle cx="195" cy="88" r="22" fill="#fde68a" stroke="#78350f" stroke-width="2.5"/>
      <path d="M 173 84 Q 195 62 217 84 Z" fill="#facc15"/>
      <circle cx="187" cy="86" r="5" fill="#38bdf8" stroke="#1e293b" stroke-width="2"/>
      <circle cx="203" cy="86" r="5" fill="#38bdf8" stroke="#1e293b" stroke-width="2"/>
      <path d="M 215 98 Q 250 70 275 95" fill="none" stroke="#fde68a" stroke-width="9" stroke-linecap="round"/>
      `,
      '#e0f2fe'
    );
  }

  if (has(/\bbicycle\b|\bbike\b|\bcycling\b/)) {
    return wrapSvg(
      `
      <circle cx="135" cy="138" r="38" fill="none" stroke="#1e293b" stroke-width="8"/>
      <circle cx="285" cy="138" r="38" fill="none" stroke="#1e293b" stroke-width="8"/>
      <path d="M 135 138 L 190 78 L 265 78 L 285 138 M 190 78 L 210 138 L 135 138" fill="none" stroke="#ef4444" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
      <line x1="175" y1="62" x2="205" y2="62" stroke="#1e293b" stroke-width="7" stroke-linecap="round"/>
      <path d="M 265 78 L 258 54 L 282 54" fill="none" stroke="#1e293b" stroke-width="6" stroke-linecap="round"/>
      `,
      '#fef2f2'
    );
  }

  if (has(/\bbus\b/)) {
    return wrapSvg(
      `
      <rect x="65" y="55" width="290" height="105" rx="18" fill="#facc15" stroke="#ca8a04" stroke-width="4.5"/>
      <rect x="85" y="72" width="48" height="40" rx="6" fill="#bae6fd" stroke="#0284c7" stroke-width="3"/>
      <rect x="148" y="72" width="48" height="40" rx="6" fill="#bae6fd" stroke="#0284c7" stroke-width="3"/>
      <rect x="211" y="72" width="48" height="40" rx="6" fill="#bae6fd" stroke="#0284c7" stroke-width="3"/>
      <rect x="275" y="72" width="62" height="48" rx="6" fill="#bae6fd" stroke="#0284c7" stroke-width="3"/>
      <circle cx="125" cy="162" r="24" fill="#1e293b" stroke="#94a3b8" stroke-width="6"/>
      <circle cx="295" cy="162" r="24" fill="#1e293b" stroke="#94a3b8" stroke-width="6"/>
      `,
      '#fefce8'
    );
  }

  if (has(/\bcar\b|\btaxi\b/)) {
    return wrapSvg(
      `
      <path d="M 125 92 L 160 52 L 265 52 L 300 92 Z" fill="#ef4444" stroke="#991b1b" stroke-width="4"/>
      <rect x="85" y="92" width="250" height="58" rx="18" fill="#ef4444" stroke="#991b1b" stroke-width="4"/>
      <polygon points="138,88 165,58 205,58 205,88" fill="#bae6fd"/>
      <polygon points="215,88 215,58 258,58 285,88" fill="#bae6fd"/>
      <circle cx="140" cy="152" r="24" fill="#1e293b" stroke="#cbd5e1" stroke-width="6"/>
      <circle cx="280" cy="152" r="24" fill="#1e293b" stroke="#cbd5e1" stroke-width="6"/>
      `,
      '#fef2f2'
    );
  }

  if (has(/\bplane\b|\bairplane\b|\bpilot\b/)) {
    return wrapSvg(
      `
      <ellipse cx="210" cy="110" rx="125" ry="26" fill="#ffffff" stroke="#0284c7" stroke-width="4"/>
      <polygon points="190,110 145,35 178,35 235,110" fill="#38bdf8" stroke="#0284c7" stroke-width="3.5"/>
      <polygon points="190,110 145,185 178,185 235,110" fill="#38bdf8" stroke="#0284c7" stroke-width="3.5"/>
      <polygon points="88,105 65,62 95,62 118,105" fill="#ef4444"/>
      `,
      '#e0f2fe'
    );
  }

  // ============================================================================
  // 6. WEATHER & SEASONS (Sunny, Rainy, Cloudy, Windy, Snowy, Rainbow)
  // ============================================================================
  if (has(/\bsunny\b|\bsun\b|\bhot\b|\bsummer\b/)) {
    return wrapSvg(
      `
      <circle cx="210" cy="110" r="52" fill="#facc15" stroke="#eab308" stroke-width="5"/>
      <g stroke="#f59e0b" stroke-width="6" stroke-linecap="round">
        <line x1="210" y1="32" x2="210" y2="16"/><line x1="210" y1="188" x2="210" y2="204"/>
        <line x1="132" y1="110" x2="116" y2="110"/><line x1="288" y1="110" x2="304" y2="110"/>
        <line x1="155" y1="55" x2="142" y2="42"/><line x1="265" y1="165" x2="278" y2="178"/>
        <line x1="265" y1="55" x2="278" y2="42"/><line x1="155" y1="165" x2="142" y2="178"/>
      </g>
      `,
      '#fef9c3'
    );
  }

  if (has(/\brainy\b|\brain\b/)) {
    return wrapSvg(
      `
      <path d="M 135 115 A 35 35 0 0 1 170 62 A 45 45 0 0 1 255 62 A 35 35 0 0 1 285 115 Z" fill="#94a3b8" stroke="#475569" stroke-width="4"/>
      <g stroke="#0284c7" stroke-width="5" stroke-linecap="round">
        <line x1="155" y1="132" x2="142" y2="168"/>
        <line x1="190" y1="132" x2="177" y2="168"/>
        <line x1="225" y1="132" x2="212" y2="168"/>
        <line x1="260" y1="132" x2="247" y2="168"/>
      </g>
      `,
      '#e0f2fe'
    );
  }

  if (has(/\bcloudy\b|\bcloud\b|\bwindy\b/)) {
    return wrapSvg(
      `
      <path d="M 125 135 A 38 38 0 0 1 165 78 A 50 50 0 0 1 258 78 A 38 38 0 0 1 295 135 Z" fill="#ffffff" stroke="#64748b" stroke-width="4"/>
      <path d="M 95 162 Q 160 148 220 162 T 325 162" fill="none" stroke="#38bdf8" stroke-width="5" stroke-linecap="round"/>
      `,
      '#f1f5f9'
    );
  }

  // ============================================================================
  // 7. COLORS (Red, Blue, Yellow, Green, Orange, Pink, Purple, Black, Brown)
  // ============================================================================
  const colorMatch = primary.match(
    /\b(red|blue|yellow|green|orange|pink|purple|black|white|brown)\b/i
  );
  if (colorMatch && (mode === 'option' || /\bcolor\b|\bcolour\b/.test(s))) {
    const colorMap: Record<string, string> = {
      red: '#ef4444',
      blue: '#2563eb',
      yellow: '#facc15',
      green: '#16a34a',
      orange: '#f97316',
      pink: '#ec4899',
      purple: '#9333ea',
      black: '#1e293b',
      white: '#ffffff',
      brown: '#92400e',
    };
    const hex = colorMap[colorMatch[1].toLowerCase()] || '#3b82f6';
    return wrapSvg(
      `
      <circle cx="210" cy="110" r="64" fill="${hex}" stroke="#1e293b" stroke-width="4.5"/>
      <circle cx="188" cy="88" r="14" fill="#ffffff" opacity="0.35"/>
      `
    );
  }

  // ============================================================================
  // 8. GREETINGS, CONVERSATIONS & FAMILY
  // ============================================================================
  if (
    has(
      /\bhow _____ you\b|\bhow are you\b|\bfine, thank\b|\bnice to meet\b|\bwhat's your name\b|\bmy name is\b|\bhello\b|\bhi\b/
    )
  ) {
    return wrapSvg(
      `
      <circle cx="365" cy="44" r="26" fill="#facc15"/>
      <ellipse cx="210" cy="202" rx="195" ry="26" fill="#86efac"/>
      <!-- Student Left Waving -->
      <g transform="translate(125, 118)">
        <circle cx="0" cy="-24" r="24" fill="#fde68a" stroke="#78350f" stroke-width="2.8"/>
        <path d="M -24 -28 Q 0 -50 24 -28 Z" fill="#3b82f6"/>
        <circle cx="-8" cy="-24" r="3" fill="#1e293b"/>
        <circle cx="8" cy="-24" r="3" fill="#1e293b"/>
        <path d="M -8 -14 Q 0 -6 8 -14" stroke="#b45309" stroke-width="2.8" fill="none" stroke-linecap="round"/>
        <rect x="-20" y="0" width="40" height="48" rx="12" fill="#2563eb"/>
        <path d="M 20 12 L 46 -14" stroke="#fde68a" stroke-width="8" stroke-linecap="round"/>
      </g>
      <!-- Student Right Waving -->
      <g transform="translate(295, 118)">
        <circle cx="0" cy="-24" r="24" fill="#fde68a" stroke="#78350f" stroke-width="2.8"/>
        <path d="M -24 -28 Q 0 -50 24 -28 Z" fill="#ec4899"/>
        <circle cx="-8" cy="-24" r="3" fill="#1e293b"/>
        <circle cx="8" cy="-24" r="3" fill="#1e293b"/>
        <path d="M -8 -14 Q 0 -6 8 -14" stroke="#b45309" stroke-width="2.8" fill="none" stroke-linecap="round"/>
        <rect x="-20" y="0" width="40" height="48" rx="12" fill="#db2777"/>
        <path d="M -20 12 L -46 -14" stroke="#fde68a" stroke-width="8" stroke-linecap="round"/>
      </g>
      <!-- Friendly Heart & Smile Icon Between Them -->
      <path d="M 210 58 C 202 46 184 50 184 64 C 184 78 210 92 210 92 C 210 92 236 78 236 64 C 236 50 218 46 210 58 Z" fill="#f43f5e"/>
      `,
      '#e0f2fe'
    );
  }

  if (has(/\bgood morning\b|\bmorning\b|\bgreeting\b|\bteacher\b/)) {
    return wrapSvg(
      `
      <circle cx="82" cy="56" r="34" fill="#facc15" stroke="#eab308" stroke-width="4"/>
      <g stroke="#f59e0b" stroke-width="4" stroke-linecap="round">
        <line x1="82" y1="10" x2="82" y2="2"/><line x1="82" y1="102" x2="82" y2="110"/>
        <line x1="36" y1="56" x2="28" y2="56"/><line x1="128" y1="56" x2="136" y2="56"/>
      </g>
      <ellipse cx="210" cy="202" rx="200" ry="32" fill="#4ade80"/>
      <rect x="255" y="72" width="125" height="98" rx="8" fill="#fef08a" stroke="#ca8a04" stroke-width="3.5"/>
      <polygon points="245,72 317,32 390,72" fill="#ef4444"/>
      <rect x="302" y="122" width="30" height="48" rx="4" fill="#92400e"/>
      <circle cx="165" cy="112" r="22" fill="#fde68a" stroke="#78350f" stroke-width="2.5"/>
      <rect x="147" y="134" width="36" height="44" rx="8" fill="#2563eb"/>
      <path d="M 183 142 L 208 118" stroke="#fde68a" stroke-width="7" stroke-linecap="round"/>
      `,
      '#bae6fd'
    );
  }

  if (has(/\bgood night\b|\bgo to bed\b|\bsleep\b/)) {
    return wrapSvg(
      `
      <path d="M 95 42 A 28 28 0 1 0 125 82 A 22 22 0 1 1 95 42 Z" fill="#fde047"/>
      <circle cx="295" cy="48" r="4" fill="#fef08a"/><circle cx="345" cy="72" r="3.5" fill="#fef08a"/>
      <rect x="105" y="125" width="210" height="52" rx="10" fill="#a855f7" stroke="#6b21a8" stroke-width="3.5"/>
      <rect x="115" y="105" width="52" height="24" rx="8" fill="#ffffff"/>
      <circle cx="142" cy="108" r="18" fill="#fde68a"/>
      `,
      '#1e1b4b'
    );
  }

  if (
    has(
      /\bfamily\b|\bmother\b|\bmum\b|\bfather\b|\bdad\b|\bsister\b|\bbrother\b|\bgrandmother\b|\bgrandfather\b|\bparents\b/
    )
  ) {
    return wrapSvg(
      `
      <ellipse cx="210" cy="202" rx="190" ry="28" fill="#fbcfe8"/>
      <circle cx="125" cy="82" r="22" fill="#fde68a" stroke="#78350f" stroke-width="2.5"/>
      <rect x="103" y="106" width="44" height="62" rx="10" fill="#2563eb"/>
      <circle cx="210" cy="86" r="21" fill="#fde68a" stroke="#78350f" stroke-width="2.5"/>
      <rect x="188" y="109" width="44" height="58" rx="10" fill="#ec4899"/>
      <circle cx="295" cy="104" r="17" fill="#fde68a" stroke="#78350f" stroke-width="2.5"/>
      <rect x="278" y="122" width="34" height="45" rx="8" fill="#10b981"/>
      <path d="M 210 32 C 202 20 184 24 184 38 C 184 52 210 64 210 64 C 210 64 236 52 236 38 C 236 24 218 20 210 32 Z" fill="#f43f5e"/>
      `,
      '#fce7f3'
    );
  }

  if (has(/\bdoctor\b|\bnurse\b|\bhospital\b/)) {
    return wrapSvg(
      `
      <rect x="125" y="42" width="170" height="145" rx="14" fill="#ffffff" stroke="#0284c7" stroke-width="4"/>
      <rect x="196" y="65" width="28" height="84" rx="4" fill="#ef4444"/>
      <rect x="168" y="93" width="84" height="28" rx="4" fill="#ef4444"/>
      `,
      '#f0f9ff'
    );
  }

  // Additional Animals: Bear / Panda / Crocodile / Pig / Cow / Chicken / Frog / Butterfly / Turtle
  if (has(/\bpanda\b/)) {
    return wrapSvg(
      `
      <circle cx="165" cy="58" r="20" fill="#1e293b"/>
      <circle cx="255" cy="58" r="20" fill="#1e293b"/>
      <circle cx="210" cy="112" r="52" fill="#ffffff" stroke="#1e293b" stroke-width="4"/>
      <ellipse cx="188" cy="102" rx="14" ry="18" fill="#1e293b" transform="rotate(-15 188 102)"/>
      <ellipse cx="232" cy="102" rx="14" ry="18" fill="#1e293b" transform="rotate(15 232 102)"/>
      <circle cx="190" cy="100" r="4.5" fill="#ffffff"/>
      <circle cx="230" cy="100" r="4.5" fill="#ffffff"/>
      <ellipse cx="210" cy="122" rx="9" ry="6" fill="#1e293b"/>
      `,
      '#f0fdf4'
    );
  }

  if (has(/\bbear\b|\bteddy bear\b/)) {
    return wrapSvg(
      `
      <circle cx="165" cy="58" r="20" fill="#92400e" stroke="#451a03" stroke-width="3.5"/>
      <circle cx="255" cy="58" r="20" fill="#92400e" stroke="#451a03" stroke-width="3.5"/>
      <circle cx="210" cy="112" r="52" fill="#b45309" stroke="#451a03" stroke-width="4"/>
      <ellipse cx="210" cy="124" rx="22" ry="17" fill="#fde68a"/>
      <circle cx="190" cy="98" r="5.5" fill="#1e293b"/>
      <circle cx="230" cy="98" r="5.5" fill="#1e293b"/>
      <ellipse cx="210" cy="118" rx="8" ry="6" fill="#451a03"/>
      `,
      '#fef3c7'
    );
  }

  if (has(/\bpig\b/)) {
    return wrapSvg(
      `
      <polygon points="158,72 170,38 198,62" fill="#f472b6" stroke="#be185d" stroke-width="3.5"/>
      <polygon points="262,72 250,38 222,62" fill="#f472b6" stroke="#be185d" stroke-width="3.5"/>
      <circle cx="210" cy="112" r="50" fill="#fbcfe8" stroke="#be185d" stroke-width="4"/>
      <ellipse cx="210" cy="122" rx="22" ry="15" fill="#f472b6" stroke="#be185d" stroke-width="3"/>
      <circle cx="203" cy="122" r="4" fill="#831843"/>
      <circle cx="217" cy="122" r="4" fill="#831843"/>
      <circle cx="188" cy="96" r="5.5" fill="#1e293b"/>
      <circle cx="232" cy="96" r="5.5" fill="#1e293b"/>
      `,
      '#fdf2f8'
    );
  }

  if (has(/\bcow\b|\bsheep\b|\bhorse\b|\bgiraffe\b|\bzebra\b/)) {
    return wrapSvg(
      `
      <path d="M 162 62 Q 148 38 168 38" fill="none" stroke="#d97706" stroke-width="8" stroke-linecap="round"/>
      <path d="M 258 62 Q 272 38 252 38" fill="none" stroke="#d97706" stroke-width="8" stroke-linecap="round"/>
      <rect x="165" y="58" width="90" height="96" rx="36" fill="#ffffff" stroke="#1e293b" stroke-width="4"/>
      <circle cx="188" cy="84" r="14" fill="#1e293b"/>
      <circle cx="235" cy="98" r="12" fill="#1e293b"/>
      <rect x="162" y="114" width="96" height="46" rx="22" fill="#fbcfe8" stroke="#be185d" stroke-width="3.5"/>
      <circle cx="190" cy="88" r="5" fill="#ffffff"/>
      <circle cx="230" cy="88" r="5" fill="#1e293b"/>
      <circle cx="195" cy="136" r="4.5" fill="#831843"/>
      <circle cx="225" cy="136" r="4.5" fill="#831843"/>
      `,
      '#f0fdf4'
    );
  }

  if (has(/\bchicken\b|\bhen\b/)) {
    return wrapSvg(
      `
      <path d="M 195 48 C 198 32 212 32 212 46 C 218 32 230 36 226 52 Z" fill="#ef4444"/>
      <ellipse cx="215" cy="122" rx="54" ry="42" fill="#fde047" stroke="#ca8a04" stroke-width="4"/>
      <circle cx="178" cy="86" r="28" fill="#fde047" stroke="#ca8a04" stroke-width="4"/>
      <polygon points="150,86 128,94 150,102" fill="#f97316" stroke="#c2410c" stroke-width="2.5"/>
      <circle cx="170" cy="80" r="4.5" fill="#1e293b"/>
      `,
      '#fefce8'
    );
  }

  if (has(/\bcrocodile\b|\bfrog\b|\bturtle\b|\btortoise\b/)) {
    return wrapSvg(
      `
      <ellipse cx="210" cy="122" rx="88" ry="34" fill="#16a34a" stroke="#14532d" stroke-width="4"/>
      <circle cx="165" cy="86" r="14" fill="#16a34a" stroke="#14532d" stroke-width="3.5"/>
      <circle cx="215" cy="86" r="14" fill="#16a34a" stroke="#14532d" stroke-width="3.5"/>
      <circle cx="165" cy="86" r="6" fill="#facc15"/>
      <circle cx="215" cy="86" r="6" fill="#facc15"/>
      <polygon points="145,124 153,134 161,124 175,124 183,134 191,124 205,124 213,134 221,124" fill="#ffffff"/>
      `,
      '#dcfce7'
    );
  }

  if (has(/\bbutterfly\b|\bbee\b/)) {
    return wrapSvg(
      `
      <ellipse cx="165" cy="86" rx="44" ry="32" fill="#f472b6" stroke="#be185d" stroke-width="3.5"/>
      <ellipse cx="255" cy="86" rx="44" ry="32" fill="#f472b6" stroke="#be185d" stroke-width="3.5"/>
      <ellipse cx="172" cy="138" rx="34" ry="26" fill="#facc15" stroke="#ca8a04" stroke-width="3.5"/>
      <ellipse cx="248" cy="138" rx="34" ry="26" fill="#facc15" stroke="#ca8a04" stroke-width="3.5"/>
      <rect x="202" y="58" width="16" height="104" rx="8" fill="#1e293b"/>
      <path d="M 206 58 Q 190 32 178 36 M 214 58 Q 230 32 242 36" fill="none" stroke="#1e293b" stroke-width="3.5" stroke-linecap="round"/>
      `,
      '#fdf2f8'
    );
  }

  // Additional Fruit & Food: Orange / Mango / Strawberry / Grapes / Egg / Pizza / Burger
  if (has(/\borange\b|\bmango\b|\bpear\b|\blemon\b/)) {
    return wrapSvg(
      `
      <circle cx="210" cy="116" r="56" fill="#f97316" stroke="#c2410c" stroke-width="4"/>
      <path d="M 210 60 Q 236 36 248 52 Q 228 68 210 60 Z" fill="#22c55e" stroke="#15803d" stroke-width="2.5"/>
      <circle cx="192" cy="96" r="4" fill="#ffedd5"/>
      <circle cx="225" cy="108" r="4" fill="#ffedd5"/>
      <circle cx="204" cy="132" r="4" fill="#ffedd5"/>
      `,
      '#fff7ed'
    );
  }

  if (has(/\bstrawberry\b|\bgrapes\b|\bpineapple\b|\bcoconut\b/)) {
    return wrapSvg(
      `
      <path d="M 160 76 C 160 48 260 48 260 76 C 260 128 228 176 210 182 C 192 176 160 128 160 76 Z" fill="#ef4444" stroke="#991b1b" stroke-width="4"/>
      <polygon points="180,62 210,38 240,62 222,72 210,58 198,72" fill="#22c55e" stroke="#15803d" stroke-width="2.5"/>
      <circle cx="192" cy="96" r="3.5" fill="#fde047"/>
      <circle cx="228" cy="96" r="3.5" fill="#fde047"/>
      <circle cx="210" cy="118" r="3.5" fill="#fde047"/>
      <circle cx="196" cy="142" r="3.5" fill="#fde047"/>
      <circle cx="224" cy="142" r="3.5" fill="#fde047"/>
      `,
      '#fef2f2'
    );
  }

  if (has(/\bpizza\b|\bburger\b|\bhamburger\b|\begg\b|\bmeat\b|\bbeef\b|\bpork\b/)) {
    return wrapSvg(
      `
      <polygon points="135,56 285,56 210,184" fill="#facc15" stroke="#ca8a04" stroke-width="4"/>
      <path d="M 130 56 Q 210 36 290 56" fill="none" stroke="#d97706" stroke-width="16" stroke-linecap="round"/>
      <circle cx="188" cy="88" r="11" fill="#ef4444"/>
      <circle cx="232" cy="94" r="11" fill="#ef4444"/>
      <circle cx="210" cy="128" r="11" fill="#ef4444"/>
      `,
      '#fefce8'
    );
  }

  // Clothes: T-shirt / Dress / Hat / Shoes / Glasses
  if (has(/\bt-shirt\b|\bshirt\b|\bcoat\b|\bjacket\b|\bsweater\b/)) {
    return wrapSvg(
      `
      <path d="M 155 46 L 185 46 Q 210 66 235 46 L 265 46 L 305 84 L 278 112 L 258 92 L 258 182 L 162 182 L 162 92 L 142 112 L 115 84 Z" fill="#3b82f6" stroke="#1d4ed8" stroke-width="4"/>
      <circle cx="210" cy="112" r="18" fill="#facc15"/>
      `,
      '#eff6ff'
    );
  }

  if (has(/\bdress\b|\bskirt\b/)) {
    return wrapSvg(
      `
      <path d="M 180 42 L 240 42 L 252 92 L 295 182 L 125 182 L 168 92 Z" fill="#ec4899" stroke="#9d174d" stroke-width="4"/>
      <line x1="168" y1="92" x2="252" y2="92" stroke="#fbcfe8" stroke-width="6"/>
      `,
      '#fdf2f8'
    );
  }

  if (has(/\bhat\b|\bcap\b/)) {
    return wrapSvg(
      `
      <path d="M 135 128 C 135 58 285 58 285 128 Z" fill="#f59e0b" stroke="#b45309" stroke-width="4"/>
      <ellipse cx="210" cy="128" rx="115" ry="20" fill="#fbbf24" stroke="#b45309" stroke-width="4"/>
      <rect x="138" y="108" width="144" height="14" fill="#ef4444"/>
      `,
      '#fef3c7'
    );
  }

  if (has(/\bshoes\b|\bsocks\b|\bboots\b|\bjeans\b|\btrousers\b|\bpants\b|\bshorts\b/)) {
    return wrapSvg(
      `
      <path d="M 125 78 L 185 78 L 195 118 L 285 125 C 305 128 308 162 285 162 L 125 162 Z" fill="#ef4444" stroke="#991b1b" stroke-width="4"/>
      <rect x="125" y="152" width="172" height="14" rx="6" fill="#ffffff" stroke="#64748b" stroke-width="3"/>
      <line x1="188" y1="96" x2="215" y2="96" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/>
      <line x1="195" y1="112" x2="225" y2="112" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/>
      `,
      '#fef2f2'
    );
  }

  // Toys, Music & Objects: Ball / Kite / Doll / Robot / Guitar / Piano / House / Rooms
  if (has(/\bkite\b/)) {
    return wrapSvg(
      `
      <polygon points="210,32 275,98 210,164 145,98" fill="#f43f5e" stroke="#881337" stroke-width="4"/>
      <line x1="210" y1="32" x2="210" y2="164" stroke="#fde047" stroke-width="3.5"/>
      <line x1="145" y1="98" x2="275" y2="98" stroke="#fde047" stroke-width="3.5"/>
      <path d="M 210 164 Q 235 188 265 202" fill="none" stroke="#475569" stroke-width="3.5"/>
      `,
      '#e0f2fe'
    );
  }

  if (has(/\bball\b|\bbasketball\b|\bvolleyball\b|\btennis\b/)) {
    return wrapSvg(
      `
      <circle cx="210" cy="110" r="64" fill="#f97316" stroke="#9a3412" stroke-width="4.5"/>
      <path d="M 146 110 L 274 110 M 210 46 L 210 174 M 164 64 Q 210 110 164 156 M 256 64 Q 210 110 256 156" fill="none" stroke="#451a03" stroke-width="3.5"/>
      `,
      '#fff7ed'
    );
  }

  if (has(/\brobot\b|\bdoll\b/)) {
    return wrapSvg(
      `
      <line x1="210" y1="24" x2="210" y2="48" stroke="#475569" stroke-width="5"/>
      <circle cx="210" cy="22" r="8" fill="#ef4444"/>
      <rect x="160" y="48" width="100" height="72" rx="14" fill="#38bdf8" stroke="#0369a1" stroke-width="4"/>
      <circle cx="186" cy="78" r="10" fill="#fde047"/>
      <circle cx="234" cy="78" r="10" fill="#fde047"/>
      <rect x="182" y="100" width="56" height="8" rx="4" fill="#ffffff"/>
      <rect x="148" y="126" width="124" height="64" rx="12" fill="#0284c7" stroke="#0c4a6e" stroke-width="4"/>
      `,
      '#f0f9ff'
    );
  }

  if (has(/\bhouse\b|\bbedroom\b|\bkitchen\b|\bliving room\b|\bbathroom\b|\bdining room\b|\bgarden\b|\bschool\b/)) {
    return wrapSvg(
      `
      <polygon points="105,96 210,28 315,96" fill="#ef4444" stroke="#991b1b" stroke-width="4"/>
      <rect x="125" y="96" width="170" height="94" rx="6" fill="#fef08a" stroke="#ca8a04" stroke-width="4"/>
      <rect x="192" y="132" width="36" height="58" rx="4" fill="#92400e"/>
      <rect x="142" y="114" width="32" height="32" rx="4" fill="#38bdf8" stroke="#0284c7" stroke-width="3"/>
      <rect x="246" y="114" width="32" height="32" rx="4" fill="#38bdf8" stroke="#0284c7" stroke-width="3"/>
      `,
      '#ecfdf5'
    );
  }

  // Numbers 1..20 in Option Mode
  const parsedNum = parseNumberFromText(primary);
  if (parsedNum !== null && mode === 'option') {
    return wrapSvg(
      `
      <circle cx="210" cy="110" r="68" fill="#4f46e5" stroke="#312e81" stroke-width="5"/>
      <text x="210" y="132" text-anchor="middle" font-family="Arial" font-weight="900" font-size="64" fill="#ffffff">${parsedNum}</text>
      `,
      '#e0e7ff'
    );
  }

  // ============================================================================
  // 9. DEFAULT PURE GRAPHICAL CLASSROOM ILLUSTRATION (Zero Prompt Text!)
  // ============================================================================
  return wrapSvg(
    `
    <circle cx="72" cy="52" r="28" fill="#facc15"/>
    <ellipse cx="210" cy="202" rx="195" ry="28" fill="#86efac"/>
    <!-- Classroom Blackboard & Book Scene -->
    <rect x="115" y="34" width="190" height="105" rx="10" fill="#065f46" stroke="#92400e" stroke-width="7"/>
    <path d="M 155 75 L 265 75 M 155 102 L 235 102" stroke="#fef08a" stroke-width="5" stroke-linecap="round"/>
    <!-- Smiling Student with Open Book -->
    <circle cx="105" cy="122" r="20" fill="#fde68a" stroke="#78350f" stroke-width="2.5"/>
    <rect x="88" y="144" width="34" height="42" rx="8" fill="#3b82f6"/>
    <circle cx="315" cy="122" r="20" fill="#fde68a" stroke="#78350f" stroke-width="2.5"/>
    <rect x="298" y="144" width="34" height="42" rx="8" fill="#ec4899"/>
    `,
    '#e0f2fe'
  );
}

/**
 * Generates a rich, kid-friendly, colorful SVG illustration for Primary School English
 * based on all available question & answer context.
 */
export function buildTopicSvgMarkup(
  questionOrKey: string,
  visualHintOrPrompt?: string,
  options?: string[],
  correctOptionText?: string
): string {
  const combinedContext = `${questionOrKey || ''} ${visualHintOrPrompt || ''} ${
    correctOptionText || ''
  } ${(options || []).join(' ')}`;
  return renderConceptGraphicMarkup(
    `${questionOrKey || ''} ${correctOptionText || ''}`,
    combinedContext,
    'scene',
    0
  );
}

/**
 * Generates a dedicated, vivid SVG illustration for an individual Option (A, B, C, or D)
 * when `visualDisplayMode === 'options_image'`.
 */
export function buildOptionItemSvgMarkup(
  optionText: string,
  optionIndex: number,
  questionText: string,
  customOptionSvg?: string
): string {
  if (customOptionSvg && isRichGraphicSvg(customOptionSvg)) {
    return sanitizeAiSvgMarkup(customOptionSvg);
  }
  const cleanOpt = optionText.replace(/^[A-D][\.\)\:\-]\s*/i, '').trim();
  return renderConceptGraphicMarkup(cleanOpt, questionText, 'option', optionIndex);
}

/**
 * Resolves whether a question should display its visual illustration in the Question stem
 * (`'question_image'`) or inside each of the 4 Options A, B, C, D (`'options_image'`).
 *
 * Ensures dynamic, content-accurate alternation across questions AND 100% accurate support
 * for uploaded question sets (.docx / text) that have images in the answer options A, B, C, D!
 */
export function resolveVisualDisplayMode(question: Question): 'question_image' | 'options_image' {
  const opts = Array.isArray(question.options) ? question.options : [];
  const qText = String(question.question || '');

  // Rule 0 (Highest priority): If the question has uploaded bitmap images in the options (optionImages from .docx)
  // or explicit rich SVGs for options, ALWAYS display images in the options ('options_image')!
  if (
    Array.isArray(question.optionImages) &&
    question.optionImages.some((img) => Boolean(img && String(img).trim()))
  ) {
    return 'options_image';
  }
  if (
    Array.isArray(question.optionSvgs) &&
    question.optionSvgs.filter((s) => isRichGraphicSvg(s)).length >= 3
  ) {
    return 'options_image';
  }

  // Count how many of the 4 options are concrete visualizable entities
  const concreteCount = opts.filter((opt) => isOptionConcreteVisualizable(opt, qText)).length;

  // Rule 1: If the question stem explicitly refers to pictures/clocks/images in the options
  // (e.g., "Look at the 4 pictures in the options below", "Look at the 4 clocks in the options below", "Which picture...", etc.),
  // ALWAYS return 'options_image' (even for uploaded .docx questions)!
  if (
    /\b(in the options|options below|4 pictures|four pictures|4 clocks|four clocks|4 images|four images|which picture|which clock|which image|which one is a|which one is an)\b|hình ảnh ở các đáp án|4 hình|bốn hình|hình nào dưới đây|đáp án nào dưới đây/i.test(
      qText
    ) &&
    concreteCount >= 2
  ) {
    return 'options_image';
  }

  // Rule 2: If fewer than 3 options are concrete visualizable items (e.g., grammar options like is/am/are/do or dialogue sentences),
  // it MUST be 'question_image' so the scene is illustrated on the question stem with 100% accuracy!
  if (concreteCount < 3) {
    return 'question_image';
  }

  // Rule 3: If the question explicitly has visualDisplayMode === 'options_image' and concrete options, use 'options_image'
  if (question.visualDisplayMode === 'options_image') {
    return 'options_image';
  }

  // Rule 4: If this is a user-uploaded .docx question with a single embedded bitmap image specifically on the question stem
  // (and not an option-image question), show the user's uploaded .docx image on the question stem
  if (
    String(question.id || '').startsWith('docx_') &&
    question.visualData &&
    question.visualData.startsWith('data:image/')
  ) {
    return 'question_image';
  }

  // Rule 5: All 4 options are concrete visualizable items (e.g., Pencil case / School bag / Blackboard / Bicycle, or 4 clocks, or 4 animals/foods).
  // If the question stem is a fill-in-the-blank ("_____") where a specific scene is described in the stem, alternate deterministically;
  // otherwise display the 4 visual illustrations directly on options A, B, C, D!
  if (!/_____/.test(qText)) {
    return 'options_image';
  }

  // Deterministic hash so fill-in-the-blank questions with 4 concrete nouns naturally alternate between question_image and options_image
  let hash = 0;
  for (let i = 0; i < qText.length; i++) {
    hash = (hash * 31 + qText.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 2 === 0 ? 'options_image' : 'question_image';
}

export const QuestionVisualIllustration: React.FC<QuestionVisualIllustrationProps> = ({
  question,
  compact = false,
}) => {
  const imageSrc = useMemo(() => {
    // Priority 1: Exact bitmap image from uploaded .docx
    if (
      question.visualData &&
      (question.visualData.startsWith('data:image/') ||
        question.visualData.startsWith('http') ||
        question.visualData.startsWith('/'))
    ) {
      return question.visualData;
    }

    // Priority 2: Validated rich graphical AI SVG (stripped of any long text/prompts)
    if (question.questionSvg && isRichGraphicSvg(question.questionSvg)) {
      return encodeSvgDataUri(sanitizeAiSvgMarkup(question.questionSvg));
    }

    // Priority 3: Precision contextual Primary English SVG illustration based on question + correct answer
    const correctOptionText =
      Array.isArray(question.options) && typeof question.correctIndex === 'number'
        ? question.options[question.correctIndex] || ''
        : '';
    const svgMarkup = buildTopicSvgMarkup(
      question.question,
      question.explanation,
      question.options,
      correctOptionText
    );
    return encodeSvgDataUri(svgMarkup);
  }, [
    question.id,
    question.visualData,
    question.questionSvg,
    question.question,
    question.explanation,
    question.options,
    question.correctIndex,
  ]);

  return (
    <div
      className={`w-full rounded-2xl overflow-hidden border-2 border-indigo-400/40 bg-gradient-to-br from-slate-900/95 via-indigo-950/85 to-slate-900/95 shadow-lg ${
        compact ? 'p-1.5' : 'p-2 sm:p-2.5'
      }`}
    >
      <div
        className={`relative w-full ${
          compact ? 'h-24 sm:h-28' : 'h-36 sm:h-44 md:h-48'
        } rounded-xl overflow-hidden bg-slate-950/90 border border-white/15 flex items-center justify-center shadow-inner`}
      >
        <img
          src={imageSrc}
          alt="Visual Illustration"
          className="w-full h-full object-contain p-1 select-none"
        />
      </div>
    </div>
  );
};

interface OptionVisualIllustrationProps {
  question?: Question;
  optionIndex: number;
  optionText: string;
  visualSpec?: string;
  optionSvg?: string;
  optionImage?: string;
  visualType?: string;
  questionText?: string;
  compact?: boolean;
}

export const OptionVisualIllustration: React.FC<OptionVisualIllustrationProps> = ({
  question,
  optionIndex,
  optionText,
  visualSpec,
  optionSvg,
  optionImage,
  questionText,
  compact = false,
}) => {
  const optionImgSrc = useMemo(() => {
    // Priority 1: Exact uploaded bitmap image for this option (from uploaded .docx optionImages)
    const directUploadedImage =
      optionImage || question?.optionImages?.[optionIndex] || '';
    if (
      directUploadedImage &&
      (directUploadedImage.startsWith('data:image/') ||
        directUploadedImage.startsWith('http') ||
        directUploadedImage.startsWith('/'))
    ) {
      return directUploadedImage;
    }

    // If optionText itself is a data:image URI
    if (optionText && optionText.trim().startsWith('data:image/')) {
      return optionText.trim();
    }

    // Priority 2 & 3: Custom SVG or precision concept SVG illustration for this option
    const customSvg = optionSvg || question?.optionSvgs?.[optionIndex];
    const effectiveQText = questionText || question?.question || '';
    const effectiveOptText =
      optionText && !/^Option\s+[A-D]$/i.test(optionText.trim())
        ? optionText
        : visualSpec || optionText || `Option ${optionIndex + 1}`;
    const svgMarkup = buildOptionItemSvgMarkup(
      effectiveOptText,
      optionIndex,
      effectiveQText,
      customSvg
    );
    return encodeSvgDataUri(svgMarkup);
  }, [
    question,
    optionIndex,
    optionText,
    visualSpec,
    optionSvg,
    optionImage,
    questionText,
  ]);

  return (
    <div className="w-full flex flex-col items-center mt-1.5">
      <div
        className={`w-full ${
          compact ? 'h-20 sm:h-24' : 'h-28 sm:h-34 md:h-40'
        } rounded-xl overflow-hidden bg-slate-950/85 border-2 border-indigo-400/35 flex items-center justify-center p-1.5 shadow-inner`}
      >
        <img
          src={optionImgSrc}
          alt={optionText || `Option ${String.fromCharCode(65 + optionIndex)}`}
          className="w-full h-full object-contain select-none rounded-lg"
        />
      </div>
    </div>
  );
};
export default QuestionVisualIllustration;
