export type AudioSettings = {
  master: number;
  music: number;
  effects: number;
  mute: boolean;
  quality: string;
  reducedMotion: boolean;
  uiScale: number;
};
export const defaultAudio: AudioSettings = {
  master: 0.6,
  music: 0.4,
  effects: 0.7,
  mute: false,
  quality: "High",
  reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
  uiScale: 1,
};
export class AudioSystem {
  context?: AudioContext;
  settings = defaultAudio;
  state = "menu";
  last = 0;
  voices = 0;
  timer?: ReturnType<typeof setInterval>;
  beat = 0;
  start() {
    if (!this.context) {
      this.context = new AudioContext();
      this.timer = setInterval(() => this.music(), 500);
    }
    void this.context.resume();
  }
  tone(
    freq: number,
    duration: number,
    volume: number,
    type: OscillatorType = "sine",
    end?: number,
  ) {
    const c = this.context;
    if (!c || this.settings.mute || this.voices > 14) return;
    const oscillator = c.createOscillator(),
      gain = c.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(freq, c.currentTime);
    if (end)
      oscillator.frequency.exponentialRampToValueAtTime(
        end,
        c.currentTime + duration,
      );
    gain.gain.setValueAtTime(
      Math.max(0.0001, volume * this.settings.master),
      c.currentTime,
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(c.destination);
    oscillator.start();
    oscillator.stop(c.currentTime + duration);
    this.voices++;
    oscillator.onended = () => this.voices--;
  }
  music() {
    if (!this.context || !this.settings.music) return;
    const patterns: Record<string, number[]> = {
      menu: [0, 7, 12, 10, 3, 7, 15, 10],
      peace: [0, 3, 7, 12, 10, 7, 3, 7],
      tension: [0, 1, 7, 8, 0, 3, 1, 7],
      combat: [0, 0, 7, 3, 0, 10, 7, 1],
      victory: [0, 4, 7, 12, 16, 12, 7, 4],
      defeat: [0, 3, 6, 3, -2, 1, 3, 0],
    };
    const a = patterns[this.state] ?? patterns.peace;
    const b = this.beat++;
    const root = this.state === "combat" ? 110 : 146.83;
    const note = root * 2 ** (a[b % a.length] / 12);
    this.tone(note, 0.8, 0.09 * this.settings.music, "triangle");
    if (b % 4 === 0) this.tone(root / 2, 1.8, 0.12 * this.settings.music);
    if (this.state === "combat" && b % 2 === 0)
      this.tone(80, 0.13, 0.14 * this.settings.music, "triangle", 30);
  }
  effect(kind: string) {
    const now = performance.now();
    if (kind === "hit" && now - this.last < 75) return;
    if (kind === "hit") this.last = now;
    const v = this.settings.effects;
    const sounds: Record<string, [number, number, OscillatorType, number]> = {
      hit: [180, 0.1, "sawtooth", 50],
      arrow: [950, 0.14, "sine", 180],
      move: [480, 0.09, "sine", 600],
      build: [220, 0.25, "triangle", 440],
      capture: [440, 0.4, "sine", 880],
      ability: [160, 0.6, "sawtooth", 900],
      death: [110, 0.25, "triangle", 25],
      heal: [600, 0.2, "sine", 900],
      research: [400, 0.4, "triangle", 800],
      ui: [520, 0.08, "sine", 680],
      end: [330, 0.7, "triangle", 660],
    };
    const a = sounds[kind] ?? sounds.ui;
    this.tone(a[0], a[1], 0.15 * v, a[2], a[3]);
  }
}
