import Phaser from "phaser";
import { daylight } from "./daylight";
import { biomes, commanders, factions, buildings, units } from "./content";
import { type Simulation, type Entity, type Event } from "./simulation";
import { type MapData, type Point, index, dist } from "./map";
export class Renderer {
  game: Phaser.Game;
  scene?: Phaser.Scene;
  texture?: Phaser.Textures.CanvasTexture;
  ctx?: CanvasRenderingContext2D;
  image?: Phaser.GameObjects.Image;
  width = 0;
  height = 0;
  camera: Point = { x: 0, y: 0 };
  zoom = 1;
  tile = 48;
  selected: number[] = [];
  world?: Simulation;
  editor?: MapData;
  reveal = false;
  reducedMotion = false;
  quality = "High";
  fps = 60;
  particles: {
    x: number;
    y: number;
    life: number;
    color: string;
    kind: string;
    target?: Point;
  }[] = [];
  onTap?: (p: Point, button: number, shift: boolean) => void;
  onBox?: (a: Point, b: Point) => void;
  onFrame?: (dt: number) => void;
  pointerStart?: { x: number; y: number; button: number; time: number };
  dragged = false;
  follow = true;
  placement?: string;
  constructor() {
    const self = this;
    this.game = new Phaser.Game({
      type: Phaser.CANVAS,
      parent: "battlefield",
      transparent: true,
      scale: {
        mode: Phaser.Scale.RESIZE,
        width: window.innerWidth,
        height: window.innerHeight,
      },
      fps: { target: 60 },
      audio: { noAudio: true },
      scene: {
        create() {
          self.scene = this;
          self.resize();
          this.scale.on("resize", () => self.resize());
          this.input.mouse?.disableContextMenu();
          this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
            self.pointerStart = {
              x: p.x,
              y: p.y,
              button: p.button,
              time: performance.now(),
            };
            self.dragged = false;
          });
          this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
            if (!p.isDown || !self.pointerStart) return;
            const start = self.pointerStart;
            if (Math.hypot(p.x - start.x, p.y - start.y) > 8)
              self.dragged = true;
            if (
              (start.button === 1 || p.event instanceof TouchEvent) &&
              self.dragged
            ) {
              const dx = p.x - p.prevPosition.x,
                dy = p.y - p.prevPosition.y;
              self.camera.x -=
                dx / (self.tile * self.zoom) +
                dy / (self.tile * 0.5 * self.zoom);
              self.camera.y -=
                -dx / (self.tile * self.zoom) +
                dy / (self.tile * 0.5 * self.zoom);
              self.follow = false;
            }
          });
          this.input.on("pointerup", (p: Phaser.Input.Pointer) => {
            const start = self.pointerStart;
            if (!start) return;
            if (
              self.dragged &&
              start.button === 0 &&
              !(p.event instanceof TouchEvent)
            )
              self.onBox?.(
                self.unproject(start.x, start.y),
                self.unproject(p.x, p.y),
              );
            else if (!self.dragged)
              self.onTap?.(
                self.unproject(p.x, p.y),
                p.button,
                (p.event as MouseEvent).shiftKey,
              );
            self.pointerStart = undefined;
          });
          this.input.on(
            "wheel",
            (_p: unknown, _g: unknown, _dx: number, dy: number) =>
              (self.zoom = Math.max(
                0.45,
                Math.min(1.7, self.zoom - dy * 0.001),
              )),
          );
        },
        update(_t: number, delta: number) {
          self.fps = self.game.loop.actualFps;
          self.onFrame?.(Math.min(delta / 1000, 0.1));
          self.draw();
        },
      },
    });
  }
  resize() {
    if (!this.scene) return;
    this.width = this.scene.scale.width;
    this.height = this.scene.scale.height;
    this.image?.destroy();
    this.texture?.destroy();
    this.texture = this.scene.textures.createCanvas(
      "world",
      this.width,
      this.height,
    )!;
    this.ctx = this.texture.context;
    this.image = this.scene.add.image(0, 0, "world").setOrigin(0);
  }
  project(x: number, y: number) {
    return {
      x:
        this.width / 2 +
        (x - y - this.camera.x + this.camera.y) * this.tile * 0.5 * this.zoom,
      y:
        this.height * 0.46 +
        (x + y - this.camera.x - this.camera.y) * this.tile * 0.25 * this.zoom,
    };
  }
  unproject(x: number, y: number) {
    const a = (x - this.width / 2) / (this.tile * 0.5 * this.zoom),
      b = (y - this.height * 0.46) / (this.tile * 0.25 * this.zoom);
    return { x: (a + b) / 2 + this.camera.x, y: (b - a) / 2 + this.camera.y };
  }
  center(p: Point) {
    this.camera = { ...p };
  }
  events(events: Event[]) {
    for (const e of events) {
      if (
        this.world &&
        !this.reveal &&
        e.x !== undefined &&
        e.y !== undefined &&
        !this.world.visible[0][index(this.world.map, e.x, e.y)]
      )
        continue;
      if (e.x === undefined || e.y === undefined || this.reducedMotion)
        continue;
      const target = this.world?.entities.find((v) => v.id === e.target);
      if (this.quality === "Low" && e.type === "hit") continue;
      this.particles.push({
        x: e.x,
        y: e.y,
        life: 1,
        color:
          e.type === "heal"
            ? "#9effca"
            : e.type === "capture"
              ? "#f7d680"
              : e.type === "ability"
                ? "#e0bbff"
                : "#ffe5a3",
        kind: e.type,
        target: target ? { x: target.x, y: target.y } : undefined,
      });
    }
    if (this.particles.length > 100)
      this.particles.splice(0, this.particles.length - 100);
  }
  polygon(points: Point[], fill: string, stroke?: string) {
    const c = this.ctx!;
    c.beginPath();
    points.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
    c.closePath();
    c.fillStyle = fill;
    c.fill();
    if (stroke) {
      c.strokeStyle = stroke;
      c.lineWidth = 1;
      c.stroke();
    }
  }
  diamond(
    x: number,
    y: number,
    w: number,
    h: number,
    fill: string,
    stroke?: string,
  ) {
    this.polygon(
      [
        { x, y: y - h },
        { x: x + w, y },
        { x, y: y + h },
        { x: x - w, y },
      ],
      fill,
      stroke,
    );
  }
  draw() {
    const c = this.ctx;
    if (!c) return;
    c.clearRect(0, 0, this.width, this.height);
    const gradient = c.createLinearGradient(0, 0, 0, this.height);
    gradient.addColorStop(0, "#173844");
    gradient.addColorStop(1, "#0b2029");
    c.fillStyle = gradient;
    c.fillRect(0, 0, this.width, this.height);
    const map = this.editor ?? this.world?.map;
    if (!map) {
      this.drawBackdrop();
      this.texture?.refresh();
      return;
    }
    const s = this.world;
    const n = map.settings.size,
      b = biomes[map.settings.biome],
      z = this.zoom;
    const commander = s?.entities.find(
      (e) => e.team === 0 && commanders[e.kind] && e.hp > 0,
    );
    if (this.follow && commander && !this.editor) {
      this.camera.x += (commander.x - this.camera.x) * 0.08;
      this.camera.y += (commander.y - this.camera.y) * 0.08;
    }
    for (let sum = 0; sum < n * 2; sum++)
      for (let x = Math.max(0, sum - n + 1); x <= Math.min(n - 1, sum); x++) {
        const y = sum - x,
          p = this.project(x + 0.5, y + 0.5);
        if (
          p.x < -70 ||
          p.x > this.width + 70 ||
          p.y < -90 ||
          p.y > this.height + 70
        )
          continue;
        const i = y * n + x,
          t = map.tiles[i];
        const explored = this.editor || this.reveal || s?.explored[0][i],
          visible = this.editor || this.reveal || s?.visible[0][i];
        const fill = !explored
          ? "#1b3438"
          : t === 3
            ? b.water
            : t === 4
              ? "#69766d"
              : t === 1
                ? b.forest
                : t === 2
                  ? "#858761"
                  : (x * 13 + y * 7) % 5 === 0
                    ? b.light
                    : b.ground;
        this.diamond(p.x, p.y, 24 * z, 12 * z, fill, "#0000000c");
        if (explored) {
          if (t === 1) this.tree(p.x, p.y, z, b.forest, (x + y) % 3);
          if (t === 4) {
            this.diamond(p.x, p.y - 4 * z, 14 * z, 10 * z, "#91a19a");
            this.polygon(
              [
                { x: p.x - 14 * z, y: p.y - 4 * z },
                { x: p.x, y: p.y - 23 * z },
                { x: p.x + 14 * z, y: p.y - 4 * z },
              ],
              "#778e84",
            );
          }
          if (t === 3 && this.quality !== "Low") {
            c.strokeStyle = "#c6f5ef35";
            c.beginPath();
            c.moveTo(p.x - 10 * z, p.y);
            c.lineTo(p.x + 3 * z, p.y);
            c.stroke();
          }
          if (!visible) this.diamond(p.x, p.y, 24 * z, 12 * z, "#09232a99");
        }
      }
    for (const point of map.points) {
      const p = this.project(point.x, point.y);
      if (
        !this.editor &&
        !this.reveal &&
        !s?.explored[0][index(map, point.x, point.y)]
      )
        continue;
      if (point.remaining === 0 && !this.editor) {
        this.diamond(p.x, p.y, 13 * z, 6 * z, "#766b55", "#b5a58a");
        c.fillStyle = "#eee2cb";
        c.font = `${10 * z}px sans-serif`;
        c.textAlign = "center";
        c.fillText("Exhausted", p.x, p.y - 10 * z);
        c.textAlign = "start";
        continue;
      }
      const color =
        point.owner < 0 ? "#e6cd89" : point.owner === 0 ? "#65d7f4" : "#ffad7d";
      this.diamond(p.x, p.y, 18 * z, 9 * z, "#173b36aa", color);
      c.strokeStyle = color;
      c.lineWidth = 2 * z;
      c.beginPath();
      c.moveTo(p.x, p.y);
      c.lineTo(p.x, p.y - 36 * z);
      c.stroke();
      this.polygon(
        [
          { x: p.x, y: p.y - 36 * z },
          { x: p.x + 16 * z, y: p.y - 30 * z },
          { x: p.x, y: p.y - 22 * z },
        ],
        color,
      );
      if (point.kind === "relic") {
        this.diamond(
          p.x - 8 * z,
          p.y - 12 * z,
          6 * z,
          13 * z,
          "#b1f7e0",
          "#eefee2",
        );
      } else {
        c.font = `${16 * z}px sans-serif`;
        c.fillStyle = color;
        c.fillText(
          point.kind === "gold" ? "◆" : point.kind === "wood" ? "♣" : "⚔",
          p.x - 20 * z,
          p.y - 7 * z,
        );
      }
      if (point.progress > 0) {
        c.strokeStyle = "#fff0b8";
        c.beginPath();
        c.arc(p.x, p.y, 23 * z, 0, (Math.PI * 2 * point.progress) / 6);
        c.stroke();
      }
      if (point.remaining !== undefined && point.capacity && !this.editor) {
        c.fillStyle = "#102b35";
        c.fillRect(p.x - 19 * z, p.y + 10 * z, 38 * z, 4 * z);
        c.fillStyle = point.kind === "gold" ? "#efc95f" : "#9bc567";
        c.fillRect(
          p.x - 19 * z,
          p.y + 10 * z,
          38 * z * Math.min(1, point.remaining / point.capacity),
          4 * z,
        );
        c.font = `${10 * z}px sans-serif`;
        c.fillStyle = "#fff3d3";
        c.textAlign = "center";
        c.fillText(`${Math.ceil(point.remaining)}`, p.x, p.y + 26 * z);
        c.textAlign = "start";
      }
    }
    const night = this.editor ? 0 : daylight(s?.time ?? 0).night;
    if (night > 0) {
      c.fillStyle = `rgba(15, 24, 68, ${night * 0.3})`;
      c.fillRect(0, 0, this.width, this.height);
    }
    const entities = (
      this.editor ? this.editorEntities(map) : (s?.entities ?? [])
    )
      .filter(
        (e) =>
          e.hp > 0 &&
          (this.editor ||
            e.team === 0 ||
            this.reveal ||
            s?.visible[0][index(map, e.x, e.y)]),
      )
      .sort((a, b) => a.x + a.y - (b.x + b.y));
    for (const e of entities) {
      const p = this.project(e.x, e.y);
      if (
        p.x < -100 ||
        p.x > this.width + 100 ||
        p.y < -100 ||
        p.y > this.height + 100
      )
        continue;
      this.entity(e, p, z);
      if (night > 0 && e.building && e.build === 0) {
        c.save();
        c.globalAlpha = night * 0.8;
        const glow = c.createRadialGradient(
          p.x,
          p.y - 12 * z,
          0,
          p.x,
          p.y - 12 * z,
          19 * z,
        );
        glow.addColorStop(0, "#ffdc8788");
        glow.addColorStop(1, "#ffdc8700");
        c.fillStyle = glow;
        c.fillRect(p.x - 19 * z, p.y - 31 * z, 38 * z, 38 * z);
        c.restore();
      }
    }
    for (const particle of this.particles) {
      particle.life -= 0.025;
      const p = this.project(particle.x, particle.y);
      c.globalAlpha = Math.max(0, particle.life);
      c.strokeStyle = particle.color;
      c.fillStyle = particle.color;
      if (particle.kind === "hit" && particle.target) {
        const q = this.project(particle.target.x, particle.target.y);
        c.lineWidth = 2 * z;
        c.beginPath();
        c.moveTo(p.x, p.y - 12 * z);
        c.lineTo(q.x, q.y - 14 * z);
        c.stroke();
        this.diamond(
          q.x,
          q.y - 14 * z,
          5 * z * (1 - particle.life),
          8 * z * (1 - particle.life),
          particle.color,
        );
      } else {
        c.lineWidth = 2 * z;
        c.beginPath();
        c.ellipse(
          p.x,
          p.y,
          Math.max(1, (1 - particle.life) * 60 * z),
          Math.max(1, (1 - particle.life) * 30 * z),
          0,
          0,
          Math.PI * 2,
        );
        c.stroke();
      }
      c.globalAlpha = 1;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    if (this.placement) {
      const p = this.project(this.camera.x, this.camera.y);
      c.strokeStyle = "#f2d48a";
      c.setLineDash([5, 5]);
      this.diamond(p.x, p.y, 26 * z, 13 * z, "#e5cd7622", "#e5cd76");
      c.setLineDash([]);
    }
    this.texture?.refresh();
  }
  tree(x: number, y: number, z: number, color: string, variation: number) {
    const c = this.ctx!;
    c.fillStyle = "#19362c50";
    c.beginPath();
    c.ellipse(x + 4 * z, y + 4 * z, 13 * z, 6 * z, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#79583b";
    c.fillRect(x - 2 * z, y - 23 * z, 4 * z, 26 * z);
    for (let k = 0; k < 3; k++) {
      const w = (14 - k * 3 + variation) * z,
        h = (16 + k * 9) * z;
      this.polygon(
        [
          { x: x - w, y: y - h + 10 * z },
          { x, y: y - h - 14 * z },
          { x: x + w, y: y - h + 10 * z },
        ],
        k === 2 ? "#467657" : color,
      );
    }
  }
  entity(e: Entity, p: Point, z: number) {
    const c = this.ctx!,
      selected = this.selected.includes(e.id),
      friend = e.team === 0;
    const color = e.team === -1 ? "#dfc18b" : friend ? "#6cdcf0" : "#ffa373";
    const faction = this.world?.players[e.team]?.faction ?? "ironhold";
    c.fillStyle = "#07232666";
    c.beginPath();
    c.ellipse(
      p.x + 4 * z,
      p.y + 3 * z,
      (e.building ? 22 : 9) * z,
      (e.building ? 10 : 5) * z,
      0,
      0,
      Math.PI * 2,
    );
    c.fill();
    if (selected)
      this.diamond(
        p.x,
        p.y,
        (e.building ? 29 : 14) * z,
        (e.building ? 15 : 7) * z,
        "#6cdcf018",
        "#aff3df",
      );
    if (e.building) {
      const h =
          (e.kind === "keep"
            ? 50
            : e.kind === "tower"
              ? 55
              : e.kind === "wall"
                ? 18
                : 28) * z,
        w = (e.kind === "keep" ? 28 : e.kind === "wall" ? 15 : 22) * z;
      const stone =
        faction === "arcanists"
          ? "#9388a4"
          : faction === "wildborn"
            ? "#a78960"
            : "#b8c2b4";
      this.polygon(
        [
          { x: p.x - w, y: p.y - h },
          { x: p.x, y: p.y - h + 12 * z },
          { x: p.x, y: p.y + 12 * z },
          { x: p.x - w, y: p.y },
        ],
        stone,
      );
      this.polygon(
        [
          { x: p.x, y: p.y - h + 12 * z },
          { x: p.x + w, y: p.y - h },
          { x: p.x + w, y: p.y },
          { x: p.x, y: p.y + 12 * z },
        ],
        faction === "arcanists" ? "#695978" : "#788e86",
      );
      this.diamond(
        p.x,
        p.y - h,
        w,
        12 * z,
        e.kind === "arcane" ? "#b590d2" : friend ? "#36717b" : "#96583d",
        "#d1d9bf66",
      );
      if (e.kind === "keep" || e.kind === "tower") {
        for (const side of [-1, 1]) {
          const tx = p.x + side * w * 0.7;
          c.fillStyle = stone;
          c.fillRect(tx - 5 * z, p.y - h - 9 * z, 10 * z, 18 * z);
          c.fillStyle = color;
          c.fillRect(tx - 5 * z, p.y - h - 12 * z, 3 * z, 5 * z);
          c.fillRect(tx + 2 * z, p.y - h - 12 * z, 3 * z, 5 * z);
        }
      } else {
        this.polygon(
          [
            { x: p.x - w - 3 * z, y: p.y - h - 2 * z },
            { x: p.x, y: p.y - h - 20 * z },
            { x: p.x + w + 3 * z, y: p.y - h - 2 * z },
            { x: p.x, y: p.y - h + 8 * z },
          ],
          e.kind === "arcane" ? "#9772b2" : friend ? "#315f69" : "#87533c",
        );
      }
      c.fillStyle = "#213e40";
      c.fillRect(p.x + 4 * z, p.y - 15 * z, 8 * z, 17 * z);
      c.strokeStyle = color;
      c.lineWidth = 2 * z;
      c.beginPath();
      c.moveTo(p.x - 7 * z, p.y - h);
      c.lineTo(p.x - 7 * z, p.y - h - 20 * z);
      c.stroke();
      this.polygon(
        [
          { x: p.x - 7 * z, y: p.y - h - 20 * z },
          { x: p.x + 10 * z, y: p.y - h - 16 * z },
          { x: p.x - 7 * z, y: p.y - h - 10 * z },
        ],
        color,
      );
      if (selected || e.build > 0) {
        c.fillStyle = "#ecf6de";
        c.font = `${Math.max(11, 12 * z)}px system-ui`;
        c.textAlign = "center";
        c.fillText(buildings[e.kind].name, p.x, p.y - h - 26 * z);
        c.textAlign = "left";
      }
      if (e.build > 0) {
        c.fillStyle = "#142c35aa";
        c.fillRect(p.x - w, p.y - h, w * 2, h);
        c.strokeStyle = "#f2d287";
        c.strokeRect(p.x - w, p.y - h, w * 2, h);
      }
    } else {
      const commander = !!commanders[e.kind];
      const size = commander ? 1.3 : 1;
      const bob = this.reducedMotion
        ? 0
        : e.route.length
          ? Math.sin((this.world?.time ?? 0) * 12 + e.id) * 1.5 * z
          : 0;
      const y = p.y + bob;
      const zz = z * size;
      if (e.kind === "cavalry") {
        c.fillStyle = "#72503c";
        c.beginPath();
        c.ellipse(p.x, y - 8 * zz, 12 * zz, 6 * zz, 0, 0, Math.PI * 2);
        c.fill();
        c.fillRect(p.x - 9 * zz, y - 6 * zz, 3 * zz, 10 * zz);
        c.fillRect(p.x + 6 * zz, y - 6 * zz, 3 * zz, 10 * zz);
      }
      if (e.kind === "siege") {
        c.strokeStyle = "#bc9863";
        c.lineWidth = 5 * zz;
        c.beginPath();
        c.moveTo(p.x - 10 * zz, y - 3 * zz);
        c.lineTo(p.x + 10 * zz, y - 3 * zz);
        c.moveTo(p.x, y - 5 * zz);
        c.lineTo(p.x + 4 * zz, y - 26 * zz);
        c.stroke();
        c.fillStyle = "#465d5e";
        for (const dx of [-9, 9]) {
          c.beginPath();
          c.arc(p.x + dx * zz, y, 4 * zz, 0, 7);
          c.fill();
        }
      } else {
        c.fillStyle = friend ? "#244d65" : "#633c34";
        c.fillRect(p.x - 5 * zz, y - 14 * zz, 4 * zz, 12 * zz);
        c.fillRect(p.x + 1 * zz, y - 14 * zz, 4 * zz, 12 * zz);
        this.polygon(
          [
            { x: p.x - 7 * zz, y: y - 25 * zz },
            { x: p.x + 6 * zz, y: y - 25 * zz },
            { x: p.x + 8 * zz, y: y - 10 * zz },
            { x: p.x - 8 * zz, y: y - 10 * zz },
          ],
          color,
          "#17363b",
        );
        c.fillStyle = "#ead6b0";
        c.beginPath();
        c.arc(p.x, y - 29 * zz, 4 * zz, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = faction === "arcanists" ? "#af8bcf" : "#d5e3dc";
        this.polygon(
          [
            { x: p.x - 5 * zz, y: y - 30 * zz },
            { x: p.x, y: y - 36 * zz },
            { x: p.x + 5 * zz, y: y - 30 * zz },
          ],
          c.fillStyle as string,
        );
        c.strokeStyle = "#f5e4b6";
        c.lineWidth = 2 * zz;
        c.beginPath();
        if (e.kind === "archer" || e.kind === "ranger") {
          c.arc(p.x + 10 * zz, y - 20 * zz, 7 * zz, -1.3, 1.3);
        } else {
          c.moveTo(p.x + 8 * zz, y - 14 * zz);
          c.lineTo(p.x + 10 * zz, y - (e.kind === "spearman" ? 42 : 31) * zz);
        }
        c.stroke();
        if (e.kind === "support" || e.kind === "engineer") {
          this.diamond(p.x + 10 * zz, y - 30 * zz, 4 * zz, 6 * zz, "#d4aeff");
        }
        if (commander) {
          c.strokeStyle = "#f7d578";
          c.lineWidth = 2 * zz;
          c.beginPath();
          c.arc(p.x, y - 32 * zz, 9 * zz, Math.PI, Math.PI * 2);
          c.stroke();
        }
      }
      c.fillStyle = friend ? "#113c54" : "#6b3324";
      c.font = `bold ${9 * zz}px system-ui`;
      c.textAlign = "center";
      c.fillText(e.team === -1 ? "•" : friend ? "◆" : "▲", p.x, y - 17 * zz);
      c.textAlign = "left";
    }
    if (selected || e.hp < e.maxHp || commanders[e.kind]) {
      const h = (e.building ? (e.kind === "keep" ? 80 : 60) : 45) * z,
        w = (e.building ? 38 : 25) * z;
      c.fillStyle = "#102a30";
      c.fillRect(p.x - w / 2, p.y - h, w, 4 * z);
      c.fillStyle = friend ? "#8adcc6" : "#eeb388";
      c.fillRect(p.x - w / 2, p.y - h, w * Math.max(0, e.hp / e.maxHp), 4 * z);
    }
  }
  editorEntities(map: MapData): Entity[] {
    return (map.placements ?? []).map((e, i) => ({
      ...e,
      id: i + 100,
      building: e.building,
      hp: 100,
      maxHp: 100,
      cooldown: 0,
      build: 0,
      queue: [],
      route: [],
      order: "Hold",
      buff: 0,
      slow: 0,
      abilities: [],
    }));
  }
  drawBackdrop() {
    const n = 26;
    const b = biomes.grassland;
    this.camera = { x: 13, y: 13 };
    this.zoom = Math.max(0.7, this.width / 1500);
    for (let sum = 0; sum < n * 2; sum++)
      for (let x = Math.max(0, sum - n + 1); x <= Math.min(n - 1, sum); x++) {
        const y = sum - x,
          p = this.project(x, y);
        this.diamond(
          p.x,
          p.y,
          24 * this.zoom,
          12 * this.zoom,
          (x * 7 + y * 13) % 5 === 0 ? b.light : b.ground,
          "#00000012",
        );
        if (
          (x * 13 + y * 7) % 17 === 0 &&
          !(x > 8 && x < 17 && y > 8 && y < 17)
        )
          this.tree(p.x, p.y, this.zoom, b.forest, 0);
      }
    for (const [kind, x, y, team] of [
      ["keep", 13, 11, 0],
      ["barracks", 10, 14, 0],
      ["tower", 17, 14, 0],
      ["house", 15, 9, 0],
      ["house", 9, 12, 0],
    ] as [string, number, number, number][]) {
      const e = {
        kind,
        x,
        y,
        team,
        building: true,
        hp: 100,
        maxHp: 100,
        build: 0,
        id: -1,
      } as Entity;
      this.entity(e, this.project(x, y), this.zoom);
    }
    for (let i = 0; i < 12; i++) {
      const x = 13 + (i % 4),
        y = 16 + Math.floor(i / 4);
      this.entity(
        {
          kind: i % 3 ? "swordsman" : "spearman",
          x,
          y,
          team: 0,
          building: false,
          hp: 100,
          maxHp: 100,
          id: -1,
          route: [],
        } as unknown as Entity,
        this.project(x, y),
        this.zoom,
      );
    }
  }
  minimap(canvas: HTMLCanvasElement) {
    const c = canvas.getContext("2d")!,
      map = this.world?.map ?? this.editor;
    if (!map) return;
    const n = map.settings.size,
      k = canvas.width / n,
      b = biomes[map.settings.biome];
    c.fillStyle = "#142c35";
    c.fillRect(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const i = y * n + x;
        c.fillStyle =
          this.reveal || this.editor || this.world?.explored[0][i]
            ? map.tiles[i] === 3
              ? b.water
              : map.tiles[i] === 1
                ? b.forest
                : b.ground
            : "#19363b";
        c.fillRect(x * k, y * k, k + 0.2, k + 0.2);
      }
    for (const p of map.points) {
      if (
        !this.reveal &&
        !this.editor &&
        !this.world?.explored[0][index(map, p.x, p.y)]
      )
        continue;
      c.fillStyle = p.kind === "relic" ? "#f4d68b" : "#e6debc";
      c.fillRect(p.x * k - 2, p.y * k - 2, 4, 4);
    }
    for (const e of this.world?.entities ?? []) {
      if (
        e.hp <= 0 ||
        (e.team !== 0 &&
          !this.reveal &&
          !this.world?.visible[0][index(map, e.x, e.y)])
      )
        continue;
      c.fillStyle = e.team === 0 ? "#82edff" : "#ffae80";
      const size = e.building ? 4 : 2;
      c.fillRect(e.x * k - size / 2, e.y * k - size / 2, size, size);
    }
    c.strokeStyle = "#e9efd6";
    c.strokeRect(
      (this.camera.x - 4) * k,
      (this.camera.y - 4) * k,
      8 * k,
      8 * k,
    );
  }
}
