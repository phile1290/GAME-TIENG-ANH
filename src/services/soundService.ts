export interface SpeechSegment {
  lang: 'en-US' | 'vi-VN';
  text: string;
  label?: string;
}

export type SpeechPlaybackState = 'idle' | 'playing' | 'paused';

export interface SpeechStatusSnapshot {
  state: SpeechPlaybackState;
  contextKey: string;
  currentIndex: number;
  totalSegments: number;
  currentLabel: string;
}

type SpeechStateListener = (snapshot: SpeechStatusSnapshot) => void;

const VIETNAMESE_DIACRITIC_REGEX =
  /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;

const VIETNAMESE_SYLLABLE_REGEX =
  /^(?:b|c|ch|d|g|gh|gi|h|k|kh|l|m|n|ng|ngh|nh|p|ph|qu|r|s|t|th|tr|v|x)?(?:a|e|i|y|o|u|ai|ao|au|ay|eo|eu|ia|iu|oa|oai|oao|oay|oe|oi|oo|ua|uoi|uou|ui|uo|uu|uy|uya|ich|ach|uch|anh|enh|inh|ynh|ac|ec|ic|oc|uc|am|em|im|om|um|an|en|in|on|un|ang|eng|ong|ung|ap|ep|ip|op|up|at|et|it|ot|ut|ieng|uong|uoc|iec|ien|uyen|oat|oac|oan|oang|oanh|oap|oen|oet|uynh|uyt|uot|uon|iep|iet|ieu)$/i;

const OVERLAPPING_SHORT_EN_VI_WORDS = new Set([
  'a',
  'an',
  'am',
  'in',
  'on',
  'at',
  'to',
  'do',
  'go',
  'no',
  'so',
  'he',
  'me',
  'be',
  'my',
  'by',
  'hi',
  'up',
  'it',
  'ten',
  'pen',
  'hen',
  'men',
  'can',
  'man',
  'pan',
  'van',
  'fan',
  'ban',
  'cat',
  'bat',
  'hat',
  'mat',
  'rat',
  'map',
  'cap',
  'tap',
  'lap',
  'nap',
  'sap',
  'dap',
  'cut',
  'but',
  'nut',
  'hut',
  'hot',
  'pot',
  'lot',
  'not',
  'dot',
  'got',
  'sun',
  'run',
  'fun',
  'bun',
  'gun',
  'cup',
  'may',
  'lay',
  'say',
  'day',
  'way',
  'pay',
  'bay',
  'hay',
  'boy',
  'toy',
]);

const UNAMBIGUOUS_ENGLISH_WORDS = new Set([
  'the',
  'is',
  'are',
  'was',
  'were',
  'been',
  'being',
  'does',
  'did',
  'done',
  'doing',
  'have',
  'has',
  'had',
  'having',
  'could',
  'will',
  'would',
  'shall',
  'should',
  'might',
  'must',
  'you',
  'she',
  'we',
  'they',
  'him',
  'her',
  'us',
  'them',
  'your',
  'his',
  'its',
  'our',
  'their',
  'mine',
  'yours',
  'hers',
  'ours',
  'theirs',
  'this',
  'that',
  'these',
  'those',
  'there',
  'here',
  'what',
  'where',
  'when',
  'who',
  'whom',
  'whose',
  'which',
  'why',
  'how',
  'good',
  'morning',
  'afternoon',
  'evening',
  'night',
  'hello',
  'goodbye',
  'bye',
  'teacher',
  'student',
  'students',
  'class',
  'classroom',
  'school',
  'friend',
  'friends',
  'thank',
  'thanks',
  'please',
  'sorry',
  'excuse',
  'welcome',
  'nice',
  'meet',
  'fine',
  'old',
  'years',
  'year',
  'name',
  'from',
  'live',
  'like',
  'likes',
  'love',
  'loves',
  'want',
  'wants',
  'need',
  'needs',
  'play',
  'plays',
  'playing',
  'goes',
  'going',
  'went',
  'gone',
  'watch',
  'watches',
  'watching',
  'listen',
  'listening',
  'read',
  'reading',
  'write',
  'writing',
  'speak',
  'speaking',
  'sing',
  'singing',
  'dance',
  'dancing',
  'swim',
  'swimming',
  'running',
  'cook',
  'cooking',
  'draw',
  'drawing',
  'paint',
  'painting',
  'skate',
  'skating',
  'skip',
  'skipping',
  'ride',
  'riding',
  'fly',
  'flying',
  'climb',
  'climbing',
  'jump',
  'jumping',
  'walk',
  'walking',
  'talk',
  'talking',
  'eat',
  'eating',
  'drink',
  'drinking',
  'sleep',
  'sleeping',
  'study',
  'studying',
  'book',
  'books',
  'pens',
  'pencil',
  'pencils',
  'ruler',
  'rulers',
  'eraser',
  'rubber',
  'bag',
  'schoolbag',
  'notebook',
  'desk',
  'chair',
  'board',
  'window',
  'door',
  'clock',
  'picture',
  'globe',
  'computer',
  'apple',
  'apples',
  'banana',
  'bananas',
  'orange',
  'oranges',
  'mango',
  'mangoes',
  'grape',
  'grapes',
  'watermelon',
  'strawberry',
  'peach',
  'pear',
  'pineapple',
  'milk',
  'water',
  'juice',
  'bread',
  'rice',
  'meat',
  'fish',
  'chicken',
  'egg',
  'eggs',
  'cake',
  'ice',
  'cream',
  'pizza',
  'noodles',
  'soup',
  'cats',
  'dog',
  'dogs',
  'bird',
  'birds',
  'rabbit',
  'rabbits',
  'monkey',
  'monkeys',
  'tiger',
  'tigers',
  'lion',
  'lions',
  'elephant',
  'elephants',
  'bear',
  'bears',
  'zebra',
  'giraffe',
  'crocodile',
  'snake',
  'horse',
  'cow',
  'pig',
  'sheep',
  'duck',
  'mouse',
  'mice',
  'red',
  'blue',
  'green',
  'yellow',
  'purple',
  'pink',
  'black',
  'white',
  'brown',
  'grey',
  'gray',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'twenty',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
  'january',
  'february',
  'march',
  'april',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
  'sunny',
  'rainy',
  'windy',
  'cloudy',
  'snowy',
  'stormy',
  'cold',
  'warm',
  'cool',
  'father',
  'mother',
  'brother',
  'sister',
  'grandfather',
  'grandmother',
  'parents',
  'family',
  'doctor',
  'nurse',
  'driver',
  'farmer',
  'worker',
  'pilot',
  'police',
  'singer',
  'dancer',
  'football',
  'badminton',
  'basketball',
  'volleyball',
  'tennis',
  'chess',
  'table',
  'guitar',
  'piano',
  'music',
  'science',
  'maths',
  'math',
  'art',
  'history',
  'geography',
  'english',
  'vietnamese',
  'subject',
  'subjects',
  'singular',
  'plural',
  'noun',
  'verb',
  'adjective',
  'pronoun',
  'preposition',
  'present',
  'past',
  'future',
  'continuous',
  'simple',
  'under',
  'behind',
  'between',
  'near',
  'next',
  'front',
  'above',
  'below',
  'with',
  'without',
  'about',
  'for',
  'of',
  'many',
  'much',
  'some',
  'any',
  'every',
  'always',
  'usually',
  'often',
  'sometimes',
  'never',
  'today',
  'yesterday',
  'tomorrow',
  'now',
  'case',
  'bus',
  'tree',
  'bed',
  'box',
]);

const VIETNAMESE_METALANGUAGE_CUES = new Set([
  'từ',
  'cụm',
  'chữ',
  'chọn',
  'dùng',
  'điền',
  'thêm',
  'với',
  'là',
  'thành',
]);

function hasUnmistakableEnglishOrthography(word: string): boolean {
  if (!word) return false;
  if (word.includes("'")) return true;
  if (/[fjwz]/i.test(word)) return true;
  if (!VIETNAMESE_SYLLABLE_REGEX.test(word)) return true;
  return false;
}

class SoundService {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private isMuted: boolean = false;
  private celebrationTimer: number | null = null;
  private currentAudio: HTMLAudioElement | null = null;
  private cachedVoices: SpeechSynthesisVoice[] = [];
  private speechSessionId: number = 0;

  private playbackState: SpeechPlaybackState = 'idle';
  private activeQueue: SpeechSegment[] = [];
  private currentSegmentIndex: number = 0;
  private currentSegmentStartTime: number = 0;
  private currentSegmentBoundaryCharIndex: number = 0;
  private activeContextKey: string = '';
  private activeOnEnd?: () => void;
  private pausedQuestionSnapshot: {
    queue: SpeechSegment[];
    index: number;
    contextKey: string;
    onEnd?: () => void;
  } | null = null;
  private stateListeners: Set<SpeechStateListener> = new Set();

  private readonly ENGLISH_SPEECH_RATE = 0.78;
  private readonly VIETNAMESE_SPEECH_RATE = 0.84;
  private readonly MASTER_AUDIO_BOOST = 2.4;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const loadVoices = () => {
        try {
          this.cachedVoices = window.speechSynthesis.getVoices() || [];
        } catch {}
      };
      loadVoices();
      try {
        window.speechSynthesis.onvoiceschanged = loadVoices;
      } catch {}
    }
  }

  public getSpeechStatus(): SpeechStatusSnapshot {
    const currentSeg = this.activeQueue[this.currentSegmentIndex];
    return {
      state: this.playbackState,
      contextKey: this.activeContextKey,
      currentIndex: this.currentSegmentIndex,
      totalSegments: this.activeQueue.length,
      currentLabel: currentSeg?.label || currentSeg?.text?.slice(0, 28) || '',
    };
  }

  public getPausedQuestionSnapshot(contextKey: string): SpeechStatusSnapshot | null {
    if (
      this.playbackState === 'paused' &&
      this.activeContextKey === contextKey &&
      this.currentSegmentIndex < this.activeQueue.length
    ) {
      return this.getSpeechStatus();
    }
    if (
      this.pausedQuestionSnapshot &&
      this.pausedQuestionSnapshot.contextKey === contextKey &&
      this.pausedQuestionSnapshot.index < this.pausedQuestionSnapshot.queue.length
    ) {
      const seg = this.pausedQuestionSnapshot.queue[this.pausedQuestionSnapshot.index];
      return {
        state: 'paused',
        contextKey,
        currentIndex: this.pausedQuestionSnapshot.index,
        totalSegments: this.pausedQuestionSnapshot.queue.length,
        currentLabel: seg?.label || seg?.text?.slice(0, 28) || '',
      };
    }
    return null;
  }

  public subscribeSpeechState(listener: SpeechStateListener): () => void {
    this.stateListeners.add(listener);
    listener(this.getSpeechStatus());
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  private emitSpeechState(): void {
    const snap = this.getSpeechStatus();
    this.stateListeners.forEach((fn) => {
      try {
        fn(snap);
      } catch {}
    });
  }

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        try {
          this.compressor = this.ctx.createDynamicsCompressor();
          this.compressor.threshold.setValueAtTime(-14, this.ctx.currentTime);
          this.compressor.knee.setValueAtTime(12, this.ctx.currentTime);
          this.compressor.ratio.setValueAtTime(4, this.ctx.currentTime);
          this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
          this.compressor.release.setValueAtTime(0.15, this.ctx.currentTime);

          this.masterGain = this.ctx.createGain();
          this.masterGain.gain.setValueAtTime(this.MASTER_AUDIO_BOOST, this.ctx.currentTime);

          this.masterGain.connect(this.compressor);
          this.compressor.connect(this.ctx.destination);
        } catch {}
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.stopSpeech();
      this.stopCelebrationMusic();
    }
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  private playTone(
    freq: number,
    durationSec: number,
    type: OscillatorType = 'sine',
    gainVal: number = 0.25,
    delaySec: number = 0
  ): void {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const startTime = ctx.currentTime + delaySec;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, startTime);

      const boostedGain = Math.min(0.65, gainVal * 1.45);
      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.exponentialRampToValueAtTime(boostedGain, startTime + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + durationSec);

      osc.connect(gain);
      if (this.masterGain) {
        gain.connect(this.masterGain);
      } else {
        gain.connect(ctx.destination);
      }

      osc.start(startTime);
      osc.stop(startTime + durationSec + 0.02);
    } catch {}
  }

  public playEngineRev(): void {
    this.playCrocodileSwimSplash();
  }

  public playCorrect(): void {
    this.playTone(523.25, 0.1, 'sine', 0.24, 0);
    this.playTone(659.25, 0.1, 'sine', 0.24, 0.08);
    this.playTone(783.99, 0.14, 'sine', 0.26, 0.16);
    this.playTone(1046.5, 0.22, 'sine', 0.28, 0.25);
  }

  public playWrong(): void {
    this.playTone(300, 0.14, 'sawtooth', 0.2, 0);
    this.playTone(220, 0.22, 'sawtooth', 0.2, 0.14);
  }

  public playNitro(): void {
    this.playTone(440, 0.09, 'square', 0.2, 0);
    this.playTone(554.37, 0.09, 'square', 0.2, 0.07);
    this.playTone(659.25, 0.1, 'square', 0.22, 0.14);
    this.playTone(880, 0.2, 'square', 0.24, 0.22);
  }

  public playTick(): void {
    this.playTone(680, 0.05, 'sine', 0.12, 0);
  }

  public playQuack(): void {
    this.playCrocodileSwimSplash();
  }

  public playMouseSqueak(): void {
    this.playCrocodileSwimSplash();
  }

  public playCatCatch(): void {
    this.playCrocodileSnap();
  }

  /**
   * Realistic water swimming & splashing sound when the Crocodile swims in the 3D lake
   */
  public playCrocodileSwimSplash(): void {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const bufferSize = Math.floor(ctx.sampleRate * 0.22);
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * Math.sin((i / bufferSize) * Math.PI);
      }

      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;

      const bandpass = ctx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.setValueAtTime(520, now);
      bandpass.frequency.exponentialRampToValueAtTime(980, now + 0.12);
      bandpass.frequency.exponentialRampToValueAtTime(380, now + 0.22);
      bandpass.Q.setValueAtTime(2.2, now);

      const splashGain = ctx.createGain();
      splashGain.gain.setValueAtTime(0.001, now);
      splashGain.gain.exponentialRampToValueAtTime(0.32, now + 0.05);
      splashGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      whiteNoise.connect(bandpass);
      bandpass.connect(splashGain);
      if (this.masterGain) {
        splashGain.connect(this.masterGain);
      } else {
        splashGain.connect(ctx.destination);
      }

      whiteNoise.start(now);
      whiteNoise.stop(now + 0.23);

      this.playTone(190, 0.09, 'sine', 0.16, 0.02);
      this.playTone(265, 0.11, 'sine', 0.18, 0.08);
    } catch {}
  }

  /**
   * Dramatic Crocodile jaw snap & big water splash when catching a student dipping their leg into the water
   */
  public playCrocodileSnap(): void {
    if (this.isMuted) return;
    this.playCrocodileSwimSplash();
    this.playTone(145, 0.1, 'sawtooth', 0.26, 0);
    this.playTone(587.33, 0.1, 'triangle', 0.26, 0.08);
    this.playTone(783.99, 0.12, 'triangle', 0.28, 0.16);
    this.playTone(1046.5, 0.22, 'sine', 0.3, 0.24);
  }

  public playVictory(): void {
    if (this.isMuted) return;
    this.startCelebrationMusic();
  }

  public startCelebrationMusic(): void {
    if (this.isMuted || typeof window === 'undefined') return;
    this.stopCelebrationMusic();

    const playFanfareBar = () => {
      if (this.isMuted) return;
      const melody = [
        { freq: 523.25, dur: 0.16, delay: 0.0, type: 'triangle' as OscillatorType, gain: 0.22 },
        { freq: 659.25, dur: 0.16, delay: 0.16, type: 'triangle' as OscillatorType, gain: 0.22 },
        { freq: 783.99, dur: 0.16, delay: 0.32, type: 'triangle' as OscillatorType, gain: 0.24 },
        { freq: 1046.5, dur: 0.34, delay: 0.48, type: 'triangle' as OscillatorType, gain: 0.26 },
        { freq: 783.99, dur: 0.16, delay: 0.86, type: 'triangle' as OscillatorType, gain: 0.22 },
        { freq: 1046.5, dur: 0.42, delay: 1.04, type: 'triangle' as OscillatorType, gain: 0.28 },
        { freq: 261.63, dur: 0.3, delay: 0.0, type: 'sine' as OscillatorType, gain: 0.18 },
        { freq: 329.63, dur: 0.3, delay: 0.48, type: 'sine' as OscillatorType, gain: 0.18 },
        { freq: 392.0, dur: 0.4, delay: 1.04, type: 'sine' as OscillatorType, gain: 0.2 },
        { freq: 1318.5, dur: 0.14, delay: 1.5, type: 'sine' as OscillatorType, gain: 0.16 },
        { freq: 1567.98, dur: 0.18, delay: 1.66, type: 'sine' as OscillatorType, gain: 0.18 },
        { freq: 2093.0, dur: 0.35, delay: 1.84, type: 'sine' as OscillatorType, gain: 0.2 },
      ];

      melody.forEach((n) => {
        this.playTone(n.freq, n.dur, n.type, n.gain, n.delay);
      });
    };

    playFanfareBar();
    this.celebrationTimer = window.setInterval(playFanfareBar, 2400);
  }

  public stopCelebrationMusic(): void {
    if (this.celebrationTimer !== null && typeof window !== 'undefined') {
      window.clearInterval(this.celebrationTimer);
      this.celebrationTimer = null;
    }
  }

  private cancelHardwareSpeechOnly(): void {
    this.speechSessionId += 1;
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      } catch {}
      this.currentAudio = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
  }

  public stopSpeech(clearSavedQuestionPause: boolean = true): void {
    this.cancelHardwareSpeechOnly();
    this.playbackState = 'idle';
    this.activeQueue = [];
    this.currentSegmentIndex = 0;
    this.currentSegmentBoundaryCharIndex = 0;
    this.activeContextKey = '';
    this.activeOnEnd = undefined;
    if (clearSavedQuestionPause) {
      this.pausedQuestionSnapshot = null;
    }
    this.emitSpeechState();
  }

  /**
   * Pause currently playing speech and compute the exact next unread content
   * so clicking Resume ("Tiếp tục đọc") reads the next content instead of restarting from the beginning.
   */
  public pauseSpeech(): void {
    if (this.playbackState !== 'playing') return;

    const currentSeg = this.activeQueue[this.currentSegmentIndex];
    const elapsedSec = Math.max(0, (performance.now() - this.currentSegmentStartTime) / 1000);
    const boundaryChar = this.currentSegmentBoundaryCharIndex;

    // Cancel active utterance first after incrementing sessionId so onend won't fire
    this.cancelHardwareSpeechOnly();

    if (currentSeg && currentSeg.text) {
      const fullText = currentSeg.text.trim();
      let slicedRemainder = '';

      if (boundaryChar > 0 && boundaryChar < fullText.length) {
        // Skip the word at boundaryChar that was already being spoken and get the next words
        const afterBoundary = fullText.slice(boundaryChar).trim();
        const firstSpaceIdx = afterBoundary.search(/\s+/);
        if (firstSpaceIdx !== -1 && elapsedSec > 0.25) {
          slicedRemainder = afterBoundary.slice(firstSpaceIdx).trim();
        } else {
          slicedRemainder = afterBoundary;
        }
      } else {
        // Fallback for Chrome network voices (e.g. Google US English) that don't emit onboundary
        const words = fullText.split(/\s+/).filter(Boolean);
        const rateWordsPerSec = currentSeg.lang === 'en-US' ? 2.15 : 2.45;
        const estimatedSpokenWords = Math.max(
          1,
          Math.floor(Math.max(0, elapsedSec - 0.14) * rateWordsPerSec)
        );
        if (words.length >= 4 && estimatedSpokenWords < words.length) {
          slicedRemainder = words.slice(estimatedSpokenWords).join(' ').trim();
        }
      }

      if (slicedRemainder && slicedRemainder.replace(/[.,!?;:]/g, '').trim().length > 0) {
        this.activeQueue[this.currentSegmentIndex] = {
          ...currentSeg,
          text: slicedRemainder,
        };
      } else {
        // Current segment finished or was a short label ("Question 1.", "A. is.") -> advance to the NEXT segment
        this.currentSegmentIndex += 1;
      }
    } else {
      this.currentSegmentIndex += 1;
    }

    this.currentSegmentBoundaryCharIndex = 0;

    if (this.currentSegmentIndex >= this.activeQueue.length) {
      this.playbackState = 'idle';
      this.activeQueue = [];
      this.currentSegmentIndex = 0;
      this.pausedQuestionSnapshot = null;
      this.emitSpeechState();
      return;
    }

    this.playbackState = 'paused';
    if (this.activeContextKey.startsWith('question-')) {
      this.pausedQuestionSnapshot = {
        queue: [...this.activeQueue],
        index: this.currentSegmentIndex,
        contextKey: this.activeContextKey,
        onEnd: this.activeOnEnd,
      };
    }
    this.emitSpeechState();
  }

  /**
   * Resume reading from the exact next unread content ("Tiếp tục đọc nội dung tiếp theo, không đọc lại từ đầu")
   */
  public resumeSpeech(targetContextKey?: string): void {
    if (this.isMuted || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }

    // Restore paused question snapshot if another short sound (like student call) played while paused
    if (
      (this.playbackState !== 'paused' ||
        (targetContextKey && this.activeContextKey !== targetContextKey)) &&
      this.pausedQuestionSnapshot &&
      (!targetContextKey || this.pausedQuestionSnapshot.contextKey === targetContextKey)
    ) {
      this.activeQueue = [...this.pausedQuestionSnapshot.queue];
      this.currentSegmentIndex = this.pausedQuestionSnapshot.index;
      this.activeContextKey = this.pausedQuestionSnapshot.contextKey;
      this.activeOnEnd = this.pausedQuestionSnapshot.onEnd;
      this.playbackState = 'paused';
    }

    if (this.playbackState !== 'paused' || this.currentSegmentIndex >= this.activeQueue.length) {
      return;
    }

    this.cancelHardwareSpeechOnly();
    const sessionId = this.speechSessionId;
    this.playbackState = 'playing';
    this.emitSpeechState();

    try {
      window.speechSynthesis.resume();
    } catch {}

    this.runQueueLoop(sessionId);
  }

  private runQueueLoop(sessionId: number): void {
    const speakAtIndex = (index: number) => {
      if (
        this.speechSessionId !== sessionId ||
        this.isMuted ||
        this.playbackState !== 'playing'
      ) {
        return;
      }

      if (index >= this.activeQueue.length) {
        const finishedContext = this.activeContextKey;
        const doneCb = this.activeOnEnd;
        this.playbackState = 'idle';
        this.activeQueue = [];
        this.currentSegmentIndex = 0;
        this.currentSegmentBoundaryCharIndex = 0;
        if (
          this.pausedQuestionSnapshot &&
          this.pausedQuestionSnapshot.contextKey === finishedContext
        ) {
          this.pausedQuestionSnapshot = null;
        }
        this.emitSpeechState();
        doneCb?.();
        return;
      }

      this.currentSegmentIndex = index;
      this.currentSegmentStartTime = performance.now();
      this.currentSegmentBoundaryCharIndex = 0;
      if (this.activeContextKey.startsWith('question-')) {
        this.pausedQuestionSnapshot = {
          queue: [...this.activeQueue],
          index: this.currentSegmentIndex,
          contextKey: this.activeContextKey,
          onEnd: this.activeOnEnd,
        };
      }
      this.emitSpeechState();

      const seg = this.activeQueue[index];
      try {
        const utter = new SpeechSynthesisUtterance(seg.text);
        if (seg.lang === 'en-US') {
          this.configureEnglishUtterance(utter);
        } else {
          this.configureVietnameseUtterance(utter);
        }

        utter.onboundary = (ev: SpeechSynthesisEvent) => {
          if (this.speechSessionId !== sessionId) return;
          if (typeof ev.charIndex === 'number' && ev.charIndex >= 0) {
            this.currentSegmentBoundaryCharIndex = ev.charIndex;
          }
        };

        utter.onend = () => {
          if (this.speechSessionId !== sessionId || this.playbackState !== 'playing') return;
          speakAtIndex(index + 1);
        };

        utter.onerror = () => {
          if (this.speechSessionId !== sessionId || this.playbackState !== 'playing') return;
          speakAtIndex(index + 1);
        };

        window.speechSynthesis.speak(utter);
      } catch {
        if (this.speechSessionId === sessionId && this.playbackState === 'playing') {
          speakAtIndex(index + 1);
        }
      }
    };

    speakAtIndex(this.currentSegmentIndex);
  }

  private getBestAmericanEnglishVoice(): SpeechSynthesisVoice | null {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
    const voices =
      this.cachedVoices.length > 0
        ? this.cachedVoices
        : window.speechSynthesis.getVoices() || [];
    if (voices.length === 0) return null;

    const usVoices = voices.filter((v) => {
      const lang = String(v.lang || '').replace('_', '-').toLowerCase();
      return lang === 'en-us' || lang.startsWith('en-us');
    });

    const preferredNames = [
      'google us english',
      'microsoft aria online (natural)',
      'microsoft jenny online (natural)',
      'microsoft guy online (natural)',
      'microsoft ana online (natural)',
      'samantha (enhanced)',
      'ava (premium)',
      'ava (enhanced)',
      'allison (enhanced)',
      'samantha',
      'ava',
      'allison',
      'alex',
      'microsoft zira',
      'microsoft david',
    ];

    for (const pref of preferredNames) {
      const found = usVoices.find((v) => v.name.toLowerCase().includes(pref));
      if (found) return found;
    }

    if (usVoices.length > 0) {
      return usVoices[0];
    }

    const anyEnglish = voices.find((v) =>
      String(v.lang || '').toLowerCase().startsWith('en')
    );
    return anyEnglish || null;
  }

  private getBestVietnameseVoice(): SpeechSynthesisVoice | null {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
    const voices =
      this.cachedVoices.length > 0
        ? this.cachedVoices
        : window.speechSynthesis.getVoices() || [];
    if (voices.length === 0) return null;

    const viVoices = voices.filter((v) => {
      const lang = String(v.lang || '').replace('_', '-').toLowerCase();
      return lang.startsWith('vi');
    });

    const preferredVi = ['hoaimy', 'namminh', 'google tiếng việt', 'microsoft', 'linh'];
    for (const pref of preferredVi) {
      const found = viVoices.find((v) => v.name.toLowerCase().includes(pref));
      if (found) return found;
    }

    return viVoices[0] || null;
  }

  private configureEnglishUtterance(utter: SpeechSynthesisUtterance): void {
    utter.lang = 'en-US';
    const usVoice = this.getBestAmericanEnglishVoice();
    if (usVoice) {
      utter.voice = usVoice;
      utter.lang = 'en-US';
    }
    utter.rate = this.ENGLISH_SPEECH_RATE;
    utter.pitch = 1.05;
    utter.volume = 1.0;
  }

  private configureVietnameseUtterance(utter: SpeechSynthesisUtterance): void {
    utter.lang = 'vi-VN';
    const viVoice = this.getBestVietnameseVoice();
    if (viVoice) {
      utter.voice = viVoice;
      utter.lang = viVoice.lang || 'vi-VN';
    }
    utter.rate = this.VIETNAMESE_SPEECH_RATE;
    utter.pitch = 1.05;
    utter.volume = 1.0;
  }

  private preparePureEnglishSpeechText(rawText: string): string {
    return String(rawText || '')
      .replace(
        /\([^)]*[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ][^)]*\)/gi,
        ''
      )
      .replace(/\bV-ing\b/gi, 'verb ing')
      .replace(/_{2,}/g, ' blank ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  public splitIntoBilingualSegments(rawText: string): SpeechSegment[] {
    const cleaned = String(rawText || '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleaned) return [];

    if (!VIETNAMESE_DIACRITIC_REGEX.test(cleaned)) {
      return [{ lang: 'en-US', text: cleaned }];
    }

    const chunks =
      cleaned.match(/("[^"]+"|“[^”]+”|'[^']{2,}'|\([^)]+\)|[^\s"“”()]+)/g) || [cleaned];

    interface ContextToken {
      display: string;
      speech: string;
      bareLower: string;
      hasViDiacritic: boolean;
      isQuotedEn: boolean;
      isDefiniteEn: boolean;
      isOverlappingShortWord: boolean;
    }

    const tokens: ContextToken[] = [];

    for (const chunk of chunks) {
      const trimmed = chunk.trim();
      if (!trimmed) continue;

      const isQuotedOrParen =
        (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith('“') && trimmed.endsWith('”')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length > 3) ||
        (trimmed.startsWith('(') && trimmed.endsWith(')'));

      if (isQuotedOrParen) {
        const inner = trimmed.slice(1, -1).trim();
        if (!inner) continue;
        if (!VIETNAMESE_DIACRITIC_REGEX.test(inner)) {
          tokens.push({
            display: trimmed,
            speech: inner.replace(/\bV-ing\b/gi, 'verb ing').replace(/\+/g, ' plus '),
            bareLower: inner.toLowerCase(),
            hasViDiacritic: false,
            isQuotedEn: true,
            isDefiniteEn: true,
            isOverlappingShortWord: false,
          });
          continue;
        }
        const innerSegs = this.splitIntoBilingualSegments(inner);
        innerSegs.forEach((seg) => {
          tokens.push({
            display: seg.text,
            speech: seg.text,
            bareLower: seg.text.toLowerCase(),
            hasViDiacritic: seg.lang === 'vi-VN',
            isQuotedEn: seg.lang === 'en-US',
            isDefiniteEn: seg.lang === 'en-US',
            isOverlappingShortWord: false,
          });
        });
        continue;
      }

      const bareLower = trimmed
        .replace(/^[^a-zA-Z0-9\u00C0-\u1EF9'+-]+|[^a-zA-Z0-9\u00C0-\u1EF9'+-]+$/g, '')
        .toLowerCase();

      if (!bareLower) {
        continue;
      }

      if (VIETNAMESE_DIACRITIC_REGEX.test(bareLower)) {
        tokens.push({
          display: trimmed,
          speech: trimmed,
          bareLower,
          hasViDiacritic: true,
          isQuotedEn: false,
          isDefiniteEn: false,
          isOverlappingShortWord: false,
        });
        continue;
      }

      if (
        bareLower === 'v-ing' ||
        /^-(?:s|es|ing|ed|er|est)$/i.test(bareLower) ||
        bareLower === '+'
      ) {
        tokens.push({
          display: trimmed,
          speech: bareLower === 'v-ing' ? 'verb ing' : bareLower === '+' ? 'plus' : trimmed,
          bareLower,
          hasViDiacritic: false,
          isQuotedEn: false,
          isDefiniteEn: bareLower !== '+',
          isOverlappingShortWord: bareLower === '+',
        });
        continue;
      }

      const isUnmistakableEn =
        hasUnmistakableEnglishOrthography(bareLower) || UNAMBIGUOUS_ENGLISH_WORDS.has(bareLower);

      if (isUnmistakableEn) {
        tokens.push({
          display: trimmed,
          speech: trimmed,
          bareLower,
          hasViDiacritic: false,
          isQuotedEn: false,
          isDefiniteEn: true,
          isOverlappingShortWord: false,
        });
        continue;
      }

      if (OVERLAPPING_SHORT_EN_VI_WORDS.has(bareLower)) {
        tokens.push({
          display: trimmed,
          speech: trimmed,
          bareLower,
          hasViDiacritic: false,
          isQuotedEn: false,
          isDefiniteEn: false,
          isOverlappingShortWord: true,
        });
        continue;
      }

      tokens.push({
        display: trimmed,
        speech: trimmed,
        bareLower,
        hasViDiacritic: false,
        isQuotedEn: false,
        isDefiniteEn: false,
        isOverlappingShortWord: false,
      });
    }

    const resolvedLangs: ('en-US' | 'vi-VN')[] = tokens.map((tok, i) => {
      if (tok.hasViDiacritic) return 'vi-VN';

      const prev = tokens[i - 1];
      const next = tokens[i + 1];

      if (
        tok.bareLower === 'anh' &&
        prev &&
        (prev.bareLower === 'tiếng' || prev.bareLower === 'môn')
      ) {
        return 'vi-VN';
      }

      if (tok.isDefiniteEn) {
        return 'en-US';
      }

      if (tok.isOverlappingShortWord) {
        if (tok.bareLower === '+') {
          if (prev?.isDefiniteEn || next?.isDefiniteEn) return 'en-US';
          return 'vi-VN';
        }
        const adjEnLeft = prev && prev.isDefiniteEn && !prev.isQuotedEn;
        const adjEnRight = next && next.isDefiniteEn && !next.isQuotedEn;
        if (adjEnLeft || adjEnRight) {
          return 'en-US';
        }
        if (
          prev &&
          VIETNAMESE_METALANGUAGE_CUES.has(prev.bareLower) &&
          ['in', 'on', 'at', 'am', 'an', 'a', 'do', 'to', 'by', 'can', 'he', 'me', 'be', 'my', 'it'].includes(
            tok.bareLower
          ) &&
          (!next || next.hasViDiacritic)
        ) {
          return 'en-US';
        }
        return 'vi-VN';
      }

      return 'vi-VN';
    });

    const mergedSegments: SpeechSegment[] = [];
    tokens.forEach((tok, idx) => {
      const lang = resolvedLangs[idx];
      const textToUse = lang === 'en-US' ? tok.speech : tok.display;
      const last = mergedSegments[mergedSegments.length - 1];
      if (last && last.lang === lang) {
        last.text = `${last.text} ${textToUse}`.replace(/\s+/g, ' ').trim();
      } else {
        mergedSegments.push({ lang, text: textToUse.trim() });
      }
    });

    return mergedSegments;
  }

  public speakSegmentsSequentially(
    segments: SpeechSegment[],
    onEnd?: () => void,
    contextKey: string = 'general',
    preserveQuestionSnapshot: boolean = false
  ): void {
    if (this.isMuted || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      onEnd?.();
      return;
    }

    const validSegments = segments
      .map((s) => ({ lang: s.lang, text: s.text.trim(), label: s.label }))
      .filter((s) => s.text.length > 0);

    if (validSegments.length === 0) {
      onEnd?.();
      return;
    }

    // If a question was currently playing and gets interrupted by a student call or option preview,
    // automatically pause & save the question snapshot so the user can resume it afterwards!
    if (
      preserveQuestionSnapshot &&
      this.playbackState === 'playing' &&
      this.activeContextKey.startsWith('question-')
    ) {
      this.pauseSpeech();
    }

    this.cancelHardwareSpeechOnly();
    const sessionId = this.speechSessionId;

    this.activeQueue = validSegments;
    this.currentSegmentIndex = 0;
    this.currentSegmentBoundaryCharIndex = 0;
    this.activeContextKey = contextKey;
    this.activeOnEnd = onEnd;
    this.playbackState = 'playing';

    if (contextKey.startsWith('question-')) {
      this.pausedQuestionSnapshot = {
        queue: [...validSegments],
        index: 0,
        contextKey,
        onEnd,
      };
    }

    this.emitSpeechState();

    try {
      window.speechSynthesis.resume();
    } catch {}

    this.runQueueLoop(sessionId);
  }

  public speakText(text: string, lang: 'en-US' | 'vi-VN' = 'en-US', onEnd?: () => void): void {
    if (this.isMuted || typeof window === 'undefined') {
      onEnd?.();
      return;
    }

    const preparedText =
      lang === 'en-US' ? this.preparePureEnglishSpeechText(text) : String(text || '').trim();

    if (!preparedText) {
      onEnd?.();
      return;
    }

    this.speakSegmentsSequentially(
      [{ lang, text: preparedText, label: preparedText.slice(0, 24) }],
      onEnd,
      'single-text',
      true
    );
  }

  /**
   * Khi Cá sấu chụp trúng học sinh nào đang thò chân xuống nước thì đọc to, rõ tên học sinh đó bằng Tiếng Việt
   */
  public speakStudentCall(studentName: string, onEnd?: () => void): void {
    const cleanName = String(studentName || '').trim();
    if (!cleanName) {
      onEnd?.();
      return;
    }
    this.speakSegmentsSequentially(
      [
        {
          lang: 'vi-VN',
          text: `Cá sấu đã bắt được bạn ${cleanName}! Xin mời bạn ${cleanName} trả lời câu hỏi!`,
          label: `Student: ${cleanName}`,
        },
      ],
      onEnd,
      'student-call',
      true
    );
  }

  /**
   * Build fine-grained sequential speech segments for Question + 4 Options (A, B, C, D)
   * so that Pausing and Resuming continues smoothly from the next clause / option without repeating from the start.
   */
  public buildQuestionAndOptionsSegments(
    questionNumber: number,
    questionText: string,
    options: string[]
  ): SpeechSegment[] {
    const cleanQ = this.preparePureEnglishSpeechText(questionText);
    const optLabels = ['A', 'B', 'C', 'D'];
    const segments: SpeechSegment[] = [
      {
        lang: 'en-US',
        text: `Question ${questionNumber}.`,
        label: `Question ${questionNumber}`,
      },
    ];

    // Split question stem into natural clauses/sentences so pausing mid-question resumes at the next clause
    const questionClauses = cleanQ
      .split(/(?<=[.?!:;])\s+|\s+-\s+/)
      .map((c) => c.trim())
      .filter((c) => c.length > 0);

    if (questionClauses.length > 0) {
      questionClauses.forEach((clause, cIdx) => {
        segments.push({
          lang: 'en-US',
          text: clause,
          label:
            questionClauses.length > 1
              ? `Question ${questionNumber} (Part ${cIdx + 1})`
              : `Question ${questionNumber} Stem`,
        });
      });
    } else if (cleanQ) {
      segments.push({
        lang: 'en-US',
        text: cleanQ,
        label: `Question ${questionNumber} Stem`,
      });
    }

    (options || []).slice(0, 4).forEach((opt, idx) => {
      const letter = optLabels[idx] || String.fromCharCode(65 + idx);
      const cleanOpt = this.preparePureEnglishSpeechText(opt)
        .replace(
          new RegExp(
            `^(?:option|answer|choice|đáp\\s*án|phương\\s*án|lựa\\s*chọn)\\s*${letter}\\b[.:)\\-–—]*\\s*`,
            'i'
          ),
          ''
        )
        .replace(
          /^(?:option|answer|choice|đáp\s*án|phương\s*án|lựa\s*chọn)\s+[A-D]\b[.:)\-–—]*\s*/i,
          ''
        )
        .replace(/^[A-D]\s*[.:)\-–—]+\s*/i, '')
        .trim();

      const hasRealOptionText =
        Boolean(cleanOpt) &&
        !new RegExp(`^(?:option\\s*)?${letter}[.:)]*$`, 'i').test(cleanOpt) &&
        !/^(?:option\s+[A-D]|answer\s+[A-D]|choice\s+[A-D]|đáp\s*án\s+[A-D]|phương\s*án\s+[A-D]|hình\s*ảnh|image|picture)$/i.test(
          cleanOpt
        );

      segments.push({
        lang: 'en-US',
        text: hasRealOptionText
          ? `Option ${letter}. ${cleanOpt}.`
          : `Option ${letter}.`,
        label: `Option ${letter}`,
      });
    });

    return segments;
  }

  public speakQuestionAndOptions(
    questionNumber: number,
    questionText: string,
    options: string[],
    onEnd?: () => void,
    contextKey?: string
  ): void {
    if (this.isMuted || typeof window === 'undefined') {
      onEnd?.();
      return;
    }

    const segments = this.buildQuestionAndOptionsSegments(
      questionNumber,
      questionText,
      options
    );
    const key = contextKey || `question-${questionNumber}`;

    this.speakSegmentsSequentially(segments, onEnd, key, false);
  }

  public speakExplanation(
    explanationText: string,
    _correctAnswerText?: string,
    _isCorrect?: boolean,
    onEnd?: () => void
  ): void {
    if (this.isMuted || typeof window === 'undefined') {
      onEnd?.();
      return;
    }

    const explanationSegments = this.splitIntoBilingualSegments(explanationText || '');
    if (explanationSegments.length === 0) {
      onEnd?.();
      return;
    }

    const segments: SpeechSegment[] = [
      {
        lang: 'vi-VN',
        text: 'Giải thích:',
        label: 'Giải thích',
      },
      ...explanationSegments.map((seg, i) => ({
        ...seg,
        label: `Explanation Part ${i + 1}`,
      })),
    ];

    this.speakSegmentsSequentially(segments, onEnd, 'explanation', false);
  }

  public speakVictoryResult(
    winnerName: string,
    score: number,
    hookLevel: number,
    onEnd?: () => void
  ): void {
    if (this.isMuted || typeof window === 'undefined') {
      onEnd?.();
      return;
    }

    const segments: SpeechSegment[] = [
      {
        lang: 'en-US',
        text: 'Congratulations! The game is complete!',
        label: 'Congratulations',
      },
      {
        lang: 'vi-VN',
        text: `Chúc mừng quán quân ${winnerName} đã chiến thắng xuất sắc với ${score} điểm tại mốc dây số ${hookLevel}!`,
        label: 'Victory Result',
      },
    ];

    this.speakSegmentsSequentially(segments, onEnd, 'victory', false);
  }
}

export const sound = new SoundService();
