import type { LoadedTheme, Sound } from "./themes";
export type AudioSettings = {
  master: number;
  music: number;
  effects: number;
  mute: boolean;
  quality: string;
  reducedMotion: boolean;
  uiScale: number;
  theme: string;
  style: "toon" | "realistic" | "sticker";
};
export const defaultAudio: AudioSettings = {
  master: 0.6,
  music: 0.35,
  effects: 0.65,
  mute: false,
  quality: "High",
  reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
  uiScale: 1,
  theme: "space",
  style: "toon",
};
export class AudioSystem {
  context?: AudioContext;
  settings = defaultAudio;
  state = "menu";
  last = 0;
  voices = 0;
  timer?: ReturnType<typeof setInterval>;
  beat = 0;
  theme?: LoadedTheme;
  musicMode = "";
  private musicSource?: AudioBufferSourceNode;
  private musicGain?: GainNode;
  private effectBus?: GainNode;
  private musicToken = 0;
  private decoding = new Map<string, Promise<AudioBuffer>>();
  private effectTimes = new Map<string, number>();
  private sources = new Set<AudioBufferSourceNode>();
  private combatUntil = 0;
  private duckUntil = 0;
  useTheme(theme?: LoadedTheme) {
    if (this.theme === theme) return;
    this.theme = theme;
    this.musicMode = "";
    this.decoding.clear();
    this.musicToken++;
    for (const source of this.sources) source.stop();
    this.sources.clear();
    this.refreshVolumes();
    if (this.context) void this.themedMusic();
  }
  refreshVolumes() {
    const c = this.context;
    if (!c) return;
    const muted = this.settings.mute ? 0 : this.settings.master;
    this.effectBus?.gain.setTargetAtTime(
      muted * this.settings.effects,
      c.currentTime,
      0.025,
    );
    this.musicGain?.gain.setTargetAtTime(
      muted *
        this.settings.music *
        (performance.now() < this.duckUntil ? 0.35 : 0.8),
      c.currentTime,
      0.08,
    );
  }
  private decode(name: string): Promise<AudioBuffer> {
    const data = this.theme?.audio[name],
      c = this.context;
    if (!data || !c) return Promise.reject(Error("Themed audio unavailable"));
    const key = this.theme!.manifest.id + ":" + name;
    let promise = this.decoding.get(key);
    if (!promise) {
      promise = c.decodeAudioData(data.slice(0));
      this.decoding.set(key, promise);
    }
    return promise;
  }
  private async themedMusic() {
    const c = this.context;
    if (!c) return;
    if (this.state === "combat") this.combatUntil = performance.now() + 4000;
    const mode =
      this.state === "combat" || performance.now() < this.combatUntil
        ? "combat"
        : "ambient";
    if (!this.theme) {
      if (this.musicSource) {
        this.musicSource.stop();
        this.musicSource = undefined;
        this.musicGain = undefined;
      }
      return;
    }
    if (this.musicMode === mode) return;
    this.musicMode = mode;
    const token = ++this.musicToken,
      theme = this.theme;
    try {
      const buffer = await this.decode(mode);
      if (token !== this.musicToken) return;
      const source = c.createBufferSource(),
        gain = c.createGain();
      source.buffer = buffer;
      source.loop = true;
      const metadata: Sound =
        mode === "combat"
          ? (theme.manifest.audio.combatMusic ?? theme.manifest.audio.music)
          : (theme.manifest.audio.ambientMusic ?? theme.manifest.audio.music);
      // Metadata counts decoded frames, including stereo; never divide by channel count.
      const sourceRate = metadata.sampleRate ?? 44100;
      source.loopStart = (metadata.loopStartSample ?? 0) / sourceRate;
      source.loopEnd = Math.min(
        buffer.duration,
        metadata.loopEndSample === undefined
          ? buffer.duration
          : metadata.loopEndSample / sourceRate,
      );
      gain.gain.setValueAtTime(0, c.currentTime);
      gain.gain.linearRampToValueAtTime(
        this.settings.mute
          ? 0
          : this.settings.master * this.settings.music * 0.8,
        c.currentTime + 1.2,
      );
      source.connect(gain);
      gain.connect(c.destination);
      source.start();
      const old = this.musicSource,
        oldGain = this.musicGain;
      if (old && oldGain) {
        oldGain.gain.cancelScheduledValues(c.currentTime);
        oldGain.gain.setValueAtTime(oldGain.gain.value, c.currentTime);
        oldGain.gain.linearRampToValueAtTime(0, c.currentTime + 1.2);
        old.stop(c.currentTime + 1.25);
      }
      this.musicSource = source;
      this.musicGain = gain;
    } catch {
      this.musicMode = "fallback";
    }
  }
  private async themedEffect(
    name: string,
    spatial?: { x: number; y: number; listener: { x: number; y: number } },
  ) {
    const c = this.context;
    if (
      !c ||
      this.settings.mute ||
      this.settings.effects === 0 ||
      this.sources.size >= 12
    )
      return;
    const now = performance.now();
    const category = name.split(":")[0];
    if (now - (this.effectTimes.get(category) ?? -Infinity) < 75) return;
    this.effectTimes.set(category, now);
    if (["victory", "defeat"].includes(name)) {
      this.duckUntil = now + 3000;
      this.refreshVolumes();
    }
    try {
      const theme = this.theme,
        buffer = await this.decode(name);
      if (theme !== this.theme || this.sources.size >= 12 || this.settings.mute)
        return;
      const source = c.createBufferSource(),
        gain = c.createGain();
      source.buffer = buffer;
      source.playbackRate.value = ["attack", "impact", "move"].includes(name)
        ? 0.97 + Math.random() * 0.06
        : 1;
      gain.gain.value =
        (theme?.manifest.audio.effects[name]?.gain ?? 0.65) * 0.7;
      source.connect(gain);
      let pan: StereoPannerNode | undefined;
      if (spatial) {
        const dx = spatial.x - spatial.listener.x,
          dy = spatial.y - spatial.listener.y;
        gain.gain.value *= 1 / (1 + Math.hypot(dx, dy) * 0.08);
        pan = c.createStereoPanner();
        pan.pan.value = Math.max(-0.9, Math.min(0.9, (dx - dy) / 18));
        gain.connect(pan);
        pan.connect(this.effectBus!);
      } else gain.connect(this.effectBus!);
      this.sources.add(source);
      source.onended = () => {
        this.sources.delete(source);
        gain.disconnect();
        source.disconnect();
        pan?.disconnect();
      };
      source.start();
    } catch {}
  }
  start() {
    if (!this.context) {
      this.context = new AudioContext();
      this.effectBus = this.context.createGain();
      this.effectBus.connect(this.context.destination);
      this.refreshVolumes();
      this.timer = setInterval(() => this.music(), 500);
    }
    void this.context.resume();
    if (this.theme) void this.themedMusic();
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
    this.refreshVolumes();
    if (this.theme && this.musicMode !== "fallback") {
      void this.themedMusic();
      return;
    }
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
  effect(
    kind: string,
    spatial?: { x: number; y: number; listener: { x: number; y: number } },
  ) {
    if (this.theme) {
      const categories: Record<string, string> = {
        hit: "melee-impact",
        arrow: "ranged-impact",
        capture: "capture",
        depleted: "resource-depleted",
        research: "research-complete",
        build: "construction-start",
        spawn: "construction-complete",
        death: "unit-defeat",
        heal: "heal",
      };
      const variants =
        this.theme.audioVariants[kind] ??
        this.theme.audioVariants[categories[kind]];
      if (variants?.length) {
        void this.themedEffect(
          variants[Math.floor(Math.random() * variants.length)],
          spatial,
        );
        return;
      }
      const names: Record<string, string> = {
        hit: "impact",
        arrow: "attack",
        move: "move",
        select: "select",
        build: "spawn",
        spawn: "spawn",
        capture: "collect",
        depleted: "collect",
        research: "ui-confirm",
        ability: "attack",
        death: "impact",
        heal: "collect",
        ui: "ui-confirm",
        back: "ui-back",
        victory: "victory",
        defeat: "defeat",
        end: this.state === "victory" ? "victory" : "defeat",
      };
      const name = names[kind] ?? "ui-confirm";
      if (this.theme.audio[name]) {
        void this.themedEffect(name, spatial);
        return;
      }
    }
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
