/** Original 2.5D models, baked into reusable, palette-aware animation atlases.
 * No simulation state is mutated here. Faction materials and team accents are independent.
 */
export type ArtPalette = {
  stone: string;
  shadow: string;
  roof: string;
  timber: string;
  metal: string;
  trim: string;
  cloth: string;
  skin: string;
  team: string;
  glow: string;
  style: "castle" | "woodland" | "arcane";
};
export const factionArt: Record<string, Omit<ArtPalette, "team">> = {
  ironhold: {
    stone: "#c8c7af",
    shadow: "#7c8e88",
    roof: "#304f63",
    timber: "#735543",
    metal: "#c6d5df",
    trim: "#d9b76e",
    cloth: "#263b50",
    skin: "#e4c29b",
    glow: "#88e1ff",
    style: "castle",
  },
  wildborn: {
    stone: "#b79c77",
    shadow: "#756c50",
    roof: "#56683b",
    timber: "#7c4d31",
    metal: "#bea074",
    trim: "#d5c797",
    cloth: "#526545",
    skin: "#d4a478",
    glow: "#a3ed9a",
    style: "woodland",
  },
  arcanists: {
    stone: "#d1cadd",
    shadow: "#807499",
    roof: "#66538b",
    timber: "#5e526d",
    metal: "#e5d8ef",
    trim: "#edcc85",
    cloth: "#584975",
    skin: "#e1c5b2",
    glow: "#b8e9ff",
    style: "arcane",
  },
};
export const teamColors = [
  "#50c4ed",
  "#ed8659",
  "#b798f0",
  "#e9c768",
  "#9cc978",
  "#e690bd",
];
const mix = (a: string, b: string, t: number) => {
  const aa = parseInt(a.slice(1), 16),
    bb = parseInt(b.slice(1), 16);
  return (
    "#" +
    [16, 8, 0]
      .map((shift) =>
        Math.round(((aa >> shift) & 255) * (1 - t) + ((bb >> shift) & 255) * t)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
};
type XY = [number, number];
class Paint {
  constructor(
    public c: CanvasRenderingContext2D,
    public p: ArtPalette,
  ) {}
  poly(points: XY[], fill: string, stroke = "#162f3560", width = 0.7) {
    const c = this.c;
    c.beginPath();
    points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.closePath();
    c.fillStyle = fill;
    c.fill();
    if (stroke) {
      c.strokeStyle = stroke;
      c.lineWidth = width;
      c.stroke();
    }
  }
  line(points: XY[], color: string, width = 1) {
    const c = this.c;
    c.beginPath();
    points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.strokeStyle = color;
    c.lineWidth = width;
    c.lineCap = "round";
    c.stroke();
  }
  oval(
    x: number,
    y: number,
    rx: number,
    ry: number,
    fill: string,
    stroke?: string,
  ) {
    const c = this.c;
    c.beginPath();
    c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    c.fillStyle = fill;
    c.fill();
    if (stroke) {
      c.strokeStyle = stroke;
      c.lineWidth = 0.8;
      c.stroke();
    }
  }
  iso(x: number, y: number, h = 0): XY {
    return [(x - y) * 0.76, (x + y) * 0.38 - h];
  }
  box(
    x: number,
    y: number,
    w: number,
    d: number,
    h: number,
    color = this.p.stone,
  ) {
    const a = this.iso(x, y),
      b = this.iso(x + w, y),
      cc = this.iso(x + w, y + d),
      dd = this.iso(x, y + d);
    const up = (v: XY): XY => [v[0], v[1] - h];
    this.poly([a, b, up(b), up(a)], mix(color, "#ffffff", 0.08));
    this.poly([b, cc, up(cc), up(b)], mix(color, this.p.shadow, 0.45));
    this.poly([cc, dd, up(dd), up(cc)], mix(color, this.p.shadow, 0.23));
    this.poly([up(a), up(b), up(cc), up(dd)], mix(color, "#ffffff", 0.2));
  }
  roof(x: number, y: number, w: number, d: number, h: number, rise: number) {
    const a = this.iso(x - 2, y - 2, h),
      b = this.iso(x + w + 2, y - 2, h),
      cc = this.iso(x + w + 2, y + d + 2, h),
      dd = this.iso(x - 2, y + d + 2, h),
      r1 = this.iso(x + w / 2, y - 2, h + rise),
      r2 = this.iso(x + w / 2, y + d + 2, h + rise);
    this.poly([a, r1, r2, dd], mix(this.p.roof, "#ffffff", 0.12));
    this.poly([r1, b, cc, r2], this.p.roof);
    this.poly([dd, r2, cc], this.p.timber);
    for (let i = 1; i < 5; i++) {
      const t = i / 5;
      this.line(
        [
          [a[0] * (1 - t) + r1[0] * t, a[1] * (1 - t) + r1[1] * t],
          [dd[0] * (1 - t) + r2[0] * t, dd[1] * (1 - t) + r2[1] * t],
        ],
        "#ffffff22",
        0.65,
      );
      this.line(
        [
          [b[0] * (1 - t) + r1[0] * t, b[1] * (1 - t) + r1[1] * t],
          [cc[0] * (1 - t) + r2[0] * t, cc[1] * (1 - t) + r2[1] * t],
        ],
        "#00000025",
        0.65,
      );
    }
    this.line([r1, r2], this.p.trim, 1.1);
  }
  flag(x: number, y: number, h: number, phase = 0) {
    const a = this.iso(x, y, h);
    this.line([this.iso(x, y), a], this.p.timber, 1.8);
    const wave = Math.sin(phase) * 2;
    this.poly(
      [
        a,
        [a[0] + 15, a[1] + 2 + wave],
        [a[0] + 13, a[1] + 12],
        [a[0], a[1] + 10],
      ],
      this.p.team,
    );
    this.line(
      [
        [a[0] + 3, a[1] + 4],
        [a[0] + 10, a[1] + 5],
      ],
      this.p.trim,
      0.8,
    );
  }
  crystal(x: number, y: number, r: number, color = this.p.glow) {
    this.poly(
      [
        [x, y - r],
        [x + r * 0.55, y],
        [x, y + r],
        [x - r * 0.55, y],
      ],
      color,
    );
    this.poly(
      [
        [x, y - r],
        [x, y + r],
        [x - r * 0.55, y],
      ],
      mix(color, this.p.roof, 0.4),
    );
    this.line(
      [
        [x, y - r],
        [x + r * 0.55, y],
      ],
      "#efffff",
      1,
    );
  }
  window(x: number, y: number, h: number) {
    const a = this.iso(x, y, h);
    this.poly(
      [
        [a[0] - 2, a[1] - 4],
        [a[0] + 2, a[1] - 4],
        [a[0] + 2, a[1] + 3],
        [a[0] - 2, a[1] + 3],
      ],
      "#243e45",
    );
    this.line(
      [
        [a[0], a[1] - 3],
        [a[0], a[1] + 2],
      ],
      "#f3d994",
      0.8,
    );
  }
  barrel(x: number, y: number) {
    this.oval(x, y, 5, 2.7, this.p.timber);
    this.poly(
      [
        [x - 5, y],
        [x - 4, y - 9],
        [x + 4, y - 9],
        [x + 5, y],
      ],
      mix(this.p.timber, "#ddae79", 0.35),
    );
    this.oval(x, y - 9, 4, 2, this.p.timber);
    this.line(
      [
        [x - 4, y - 3],
        [x + 4, y - 3],
      ],
      this.p.metal,
      1,
    );
    this.line(
      [
        [x - 4, y - 7],
        [x + 4, y - 7],
      ],
      this.p.metal,
      1,
    );
  }
  tower(x: number, y: number, h = 48, w = 13) {
    this.box(x, y, w, w, h);
    for (let k = 0; k < 4; k++) this.box(x + (k * w) / 4, y, w / 7, 3, h + 4);
    for (let k = 0; k < 4; k++)
      this.box(x + w - 3, y + (k * w) / 4, 3, w / 7, h + 4);
    for (let k = 0; k < 4; k++)
      this.box(x + (k * w) / 4, y + w - 3, w / 7, 3, h + 4);
    this.window(x + w, y + w / 2, h * 0.6);
    if (this.p.style === "arcane") {
      const q = this.iso(x + w / 2, y + w / 2, h + 11);
      this.crystal(q[0], q[1], 9);
    }
    if (this.p.style === "woodland") this.roof(x, y, w, w, h, 11);
  }
  masonry(x: number, y: number, w: number, d: number, h: number) {
    if (this.p.style === "woodland") {
      for (let i = 0; i < w; i += 6)
        this.line(
          [this.iso(x + i, y + d), this.iso(x + i, y + d, h)],
          this.p.timber,
          1.5,
        );
      for (let v = 8; v < h; v += 10)
        this.line(
          [this.iso(x, y + d, v), this.iso(x + w, y + d, v)],
          "#d9bd8060",
          1,
        );
    } else {
      for (let v = 7; v < h; v += 7) {
        this.line(
          [this.iso(x, y + d, v), this.iso(x + w, y + d, v)],
          "#213c3930",
          0.6,
        );
        for (let i = v % 14 ? 3 : 0; i < w; i += 9)
          this.line(
            [this.iso(x + i, y + d, v), this.iso(x + i, y + d, v + 6)],
            "#213c3930",
            0.6,
          );
        this.line(
          [this.iso(x + w, y, v), this.iso(x + w, y + d, v)],
          "#213c3930",
          0.6,
        );
      }
    }
  }
}
export function paintBuilding(
  c: CanvasRenderingContext2D,
  kind: string,
  p: ArtPalette,
  phase = 0,
) {
  const a = new Paint(c, p);
  c.save();
  c.translate(96, 155);
  a.oval(7, 7, 48, 23, "#0b20294d");
  a.poly(
    [
      [-50, 0],
      [0, -25],
      [50, 0],
      [0, 25],
    ],
    "#a6ac8545",
    "#d0d6ad50",
  );
  if (kind === "keep") {
    a.box(-27, -24, 54, 48, 6, mix(p.stone, p.shadow, 0.2));
    a.box(-22, -20, 44, 40, 35);
    a.masonry(-22, -20, 44, 40, 35);
    a.box(-14, -16, 28, 28, 62);
    a.roof(-14, -16, 28, 28, 62, 18);
    for (const [x, y] of [
      [-29, -25],
      [16, -25],
      [-29, 15],
      [16, 15],
    ] as XY[])
      a.tower(x, y, 46, 14);
    const gate = a.iso(0, 20);
    a.poly(
      [
        [gate[0] - 7, gate[1]],
        [gate[0] - 7, gate[1] - 19],
        [gate[0], gate[1] - 24],
        [gate[0] + 7, gate[1] - 19],
        [gate[0] + 7, gate[1]],
      ],
      "#263a3b",
      p.trim,
      1.5,
    );
    for (let i = -4; i <= 4; i += 2)
      a.line(
        [
          [gate[0] + i, gate[1] - 18],
          [gate[0] + i, gate[1]],
        ],
        p.metal,
        0.8,
      );
    a.flag(-4, 0, 98, phase);
    a.window(14, 0, 53);
    a.window(14, 7, 53);
  } else if (kind === "tower") {
    a.box(-14, -14, 28, 28, 6);
    a.tower(-10, -10, 69, 20);
    a.flag(-2, 0, 94, phase);
    a.box(-16, 10, 32, 4, 10, p.timber);
  } else if (kind === "wall") {
    for (let i = -26; i < 27; i += 6) {
      a.box(i, 0, 5, 9, 27, p.style === "castle" ? p.stone : p.timber);
      const tip = a.iso(i + 2.5, 4, 32);
      a.poly([[tip[0] - 3, tip[1] + 5], tip, [tip[0] + 3, tip[1] + 5]], p.trim);
    }
    a.box(-28, 4, 56, 4, 10, p.timber);
    a.box(-28, 4, 56, 4, 23, p.timber);
  } else if (kind === "arcane") {
    a.box(-24, -20, 48, 40, 7);
    a.box(-16, -14, 32, 28, 42);
    a.masonry(-16, -14, 32, 28, 42);
    a.roof(-16, -14, 32, 28, 42, 18);
    a.tower(-7, -7, 72, 14);
    const q = a.iso(0, 0, 92 + Math.sin(phase) * 2);
    a.crystal(q[0], q[1], 14);
    for (const [x, y] of [
      [-26, 20],
      [23, 18],
    ] as XY[]) {
      a.box(x, y, 5, 5, 28, p.roof);
      const pp = a.iso(x + 2, y + 2, 35);
      a.crystal(pp[0], pp[1], 7);
    }
    a.flag(17, -10, 54, phase);
  } else if (kind === "depot") {
    a.box(-24, -16, 37, 31, 23);
    a.masonry(-24, -16, 37, 31, 23);
    a.roof(-24, -16, 37, 31, 23, 15);
    for (let i = 0; i < 4; i++) {
      const q = a.iso(22 - i * 4, 15);
      a.line(
        [
          [q[0] - 8, q[1]],
          [q[0] - 8, q[1] - 7],
        ],
        p.timber,
        10,
      );
      a.oval(q[0] - 8, q[1] - 7, 5, 2.5, "#d5ac75");
    }
    a.barrel(22, 15);
    a.barrel(30, 10);
    a.flag(4, -13, 48, phase);
  } else {
    const w = kind === "house" ? 30 : 42,
      d = kind === "house" ? 28 : 34,
      h = kind === "stable" ? 25 : kind === "blacksmith" ? 28 : 32;
    a.box(-w / 2, -d / 2, w, d, h);
    a.masonry(-w / 2, -d / 2, w, d, h);
    a.roof(-w / 2, -d / 2, w, d, h, kind === "house" ? 18 : 22);
    const door = a.iso(-2, d / 2);
    a.poly(
      [
        [door[0] - 4, door[1]],
        [door[0] - 4, door[1] - 14],
        [door[0] + 4, door[1] - 14],
        [door[0] + 4, door[1]],
      ],
      p.timber,
      p.trim,
      0.8,
    );
    a.window(w / 2, 0, h * 0.5);
    a.window(w / 2, 9, h * 0.5);
    a.flag(-w / 2, -d / 2, h + 27, phase);
    if (kind === "house") {
      a.box(6, -7, 5, 6, h + 21, p.shadow);
      a.box(-w / 2 - 2, d / 2 - 1, 8, 3, 15, p.timber);
    }
    if (kind === "barracks") {
      for (let i = 0; i < 4; i++) {
        const q = a.iso(-18 + i * 7, 22);
        a.line(
          [
            [q[0], q[1]],
            [q[0] + 2, q[1] - 22],
          ],
          p.timber,
          1.8,
        );
        a.poly(
          [
            [q[0] + 2, q[1] - 25],
            [q[0] + 5, q[1] - 20],
            [q[0], q[1] - 20],
          ],
          p.metal,
        );
      }
      a.line([a.iso(-23, 23, 10), a.iso(6, 23, 10)], p.timber, 3);
      const q = a.iso(16, 20);
      a.poly(
        [
          [q[0] - 6, q[1] - 19],
          [q[0] + 6, q[1] - 19],
          [q[0] + 5, q[1] - 5],
          [q[0], q[1]],
          [q[0] - 5, q[1] - 5],
        ],
        p.team,
        p.trim,
      );
    }
    if (kind === "range") {
      for (let i = 0; i < 2; i++) {
        const q = a.iso(-12 + i * 23, 25);
        a.line(
          [
            [q[0] - 5, q[1] + 2],
            [q[0], q[1] - 17],
            [q[0] + 5, q[1] + 2],
          ],
          p.timber,
          2,
        );
        a.oval(q[0], q[1] - 13, 8, 10, "#e5d4a4", p.trim);
        a.oval(q[0], q[1] - 13, 5, 6, p.team);
        a.oval(q[0], q[1] - 13, 2, 2.5, "#eadfc1");
      }
      a.barrel(-34, 5);
    }
    if (kind === "stable") {
      a.box(-15, 18, 31, 4, 6, p.timber);
      for (const x of [-15, -1, 14]) a.box(x, 18, 2, 4, 13, p.timber);
      const q = a.iso(19, 12);
      a.oval(q[0], q[1] - 8, 10, 6, "#986e4c");
      a.oval(q[0] + 9, q[1] - 16, 3.5, 6, "#a17b53");
      a.line(
        [
          [q[0] - 6, q[1] - 6],
          [q[0] - 7, q[1] + 2],
        ],
        "#463b32",
        2,
      );
      a.line(
        [
          [q[0] + 5, q[1] - 6],
          [q[0] + 5, q[1] + 2],
        ],
        "#463b32",
        2,
      );
      a.poly(
        [
          [q[0] - 5, q[1] - 13],
          [q[0] + 4, q[1] - 13],
          [q[0] + 4, q[1] - 6],
          [q[0] - 5, q[1] - 6],
        ],
        p.team,
      );
    }
    if (kind === "workshop") {
      a.box(10, -9, 7, 8, h + 26, p.shadow);
      const q = a.iso(-13, 25);
      a.line(
        [
          [q[0] - 12, q[1]],
          [q[0] + 12, q[1]],
        ],
        p.timber,
        5,
      );
      a.line(
        [
          [q[0] - 3, q[1]],
          [q[0] + 7, q[1] - 23],
        ],
        p.trim,
        4,
      );
      a.oval(q[0] + 8, q[1] - 23, 7, 3, p.timber);
      for (const x of [-10, 10]) {
        a.oval(q[0] + x, q[1] + 2, 5, 5, p.timber, p.metal);
        a.line(
          [
            [q[0] + x - 3, q[1] + 2],
            [q[0] + x + 3, q[1] + 2],
          ],
          p.trim,
          1,
        );
      }
    }
    if (kind === "blacksmith") {
      a.box(9, -8, 9, 9, h + 26, p.shadow);
      const q = a.iso(-12, 22);
      a.box(-18, 18, 10, 7, 6, p.timber);
      a.poly(
        [
          [q[0] - 7, q[1] - 7],
          [q[0] + 8, q[1] - 7],
          [q[0] + 4, q[1] - 13],
          [q[0] - 4, q[1] - 13],
        ],
        p.metal,
      );
      a.oval(19, -6, 6, 7, "#fa9f51");
      a.poly(
        [
          [14, -3],
          [18, -19],
          [22, -9],
          [25, -16],
          [26, -3],
        ],
        "#ffcf76",
      );
    }
  }
  if (p.style === "woodland") {
    for (const [x, y] of [
      [-33, 0],
      [31, -3],
    ] as XY[]) {
      a.line(
        [
          [x, y],
          [x, y - 20],
        ],
        p.timber,
        2,
      );
      a.poly(
        [
          [x - 6, y - 16],
          [x, y - 25],
          [x + 6, y - 16],
        ],
        "#6e8a49",
      );
    }
  }
  if (p.style === "arcane" && kind !== "wall") {
    const q = a.iso(20, 10, 25);
    a.crystal(q[0], q[1], 5);
  }
  c.restore();
}

export function paintUnit(
  c: CanvasRenderingContext2D,
  kind: string,
  p: ArtPalette,
  state: number,
  frame: number,
  back = false,
) {
  const a = new Paint(c, p);
  c.save();
  c.translate(36, 71);
  const walking = state === 1,
    attacking = state === 2;
  const swing = walking ? Math.sin((frame / 8) * Math.PI * 2) : 0;
  const attack = attacking ? Math.sin((frame / 8) * Math.PI) : 0;
  const hero = ["warlord", "ranger", "engineer"].includes(kind);
  const scale = hero ? 1.12 : 1;
  c.scale(scale, scale);
  const bob = walking
    ? Math.abs(swing) * 1.1
    : Math.sin((frame / 8) * Math.PI * 2) * 0.35;
  c.translate(0, -bob);
  if (kind === "siege") {
    a.poly(
      [
        [-18, -2],
        [2, -12],
        [21, -3],
        [0, 8],
      ],
      p.timber,
    );
    for (const x of [-14, 14]) {
      a.oval(x, 2, 6, 6, p.shadow, p.trim);
      a.line(
        [
          [x - 4, 2],
          [x + 4, 2],
        ],
        p.timber,
        1.4,
      );
      a.line(
        [
          [x, -2],
          [x, 6],
        ],
        p.timber,
        1.4,
      );
    }
    a.line(
      [
        [-8, -1],
        [0, -23],
        [11, -2],
      ],
      p.trim,
      3,
    );
    a.line(
      [
        [0, -4],
        [7 + attack * 12, -30 + attack * 12],
      ],
      p.timber,
      4,
    );
    a.oval(7 + attack * 12, -30 + attack * 12, 7, 3, p.metal);
    a.poly(
      [
        [-7, -7],
        [5, -10],
        [12, -6],
        [0, -3],
      ],
      p.team,
    );
    c.restore();
    return;
  }
  if (kind === "cavalry") {
    for (const [x, t] of [
      [-12, swing],
      [9, -swing],
    ] as [number, number][]) {
      a.line(
        [
          [x, -9],
          [x + t * 3, 2],
          [x + t * 3 + 3, 2],
        ],
        "#584130",
        3.5,
      );
    }
    a.oval(0, -14, 17, 8, mix(p.timber, "#c48b59", 0.35));
    a.poly(
      [
        [7, -17],
        [14, -33],
        [20, -28],
        [15, -12],
      ],
      "#ad815b",
    );
    a.oval(18, -29, 4, 7, "#b89269");
    a.line(
      [
        [14, -32],
        [12, -20],
      ],
      "#4c3b31",
      3,
    );
    a.poly(
      [
        [-10, -19],
        [4, -22],
        [9, -11],
        [-6, -7],
      ],
      p.team,
      p.trim,
    );
    a.line(
      [
        [20, -28],
        [4, -22],
      ],
      p.trim,
      0.8,
    );
    c.translate(-2, -17);
  }
  const leg = Math.max(-1, Math.min(1, swing));
  for (const [x, v] of [
    [-4, leg],
    [4, -leg],
  ] as [number, number][]) {
    a.line(
      [
        [x, -17],
        [x + v * 3, -8],
        [x + v * 4, 0],
      ],
      p.cloth,
      4.5,
    );
    a.line(
      [
        [x + v * 4, -3],
        [x + v * 4 + 3, 0],
      ],
      p.timber,
      4,
    );
    if (kind === "swordsman" || kind === "warlord")
      a.line(
        [
          [x, -13],
          [x + v * 3, -7],
        ],
        p.metal,
        3.5,
      );
  }
  const cloak = back ? mix(p.team, p.cloth, 0.3) : p.cloth;
  a.poly(
    [
      [-7, -32],
      [7, -32],
      [10 + swing * 2, -8],
      [-10, -9],
    ],
    cloak,
    p.trim,
    0.6,
  );
  a.poly(
    [
      [-6, -33],
      [5, -33],
      [8, -20],
      [4, -15],
      [-5, -15],
      [-8, -23],
    ],
    p.style === "woodland" ? p.cloth : p.metal,
  );
  a.poly(
    [
      [-5, -32],
      [1, -32],
      [1, -18],
      [-5, -18],
    ],
    mix(p.metal, "#ffffff", 0.2),
  );
  a.poly(
    [
      [-5, -25],
      [6, -25],
      [5, -17],
      [-5, -17],
    ],
    p.team,
  );
  a.line(
    [
      [-6, -19],
      [6, -19],
    ],
    p.trim,
    2,
  );
  a.oval(0, -19, 1, 1, p.trim);
  const arm = attack * 11;
  a.line(
    [
      [-7, -29],
      [-11, -21],
      [-10, -15],
    ],
    p.style === "woodland" ? p.skin : p.metal,
    4,
  );
  a.line(
    [
      [6, -29],
      [10 + arm * 0.3, -23 - arm * 0.3],
      [11 + arm * 0.55, -17 - arm * 0.8],
    ],
    p.style === "woodland" ? p.skin : p.metal,
    4,
  );
  a.oval(0, -39, 4.5, 5.5, p.skin);
  if (back) {
    a.poly(
      [
        [-5, -44],
        [4, -44],
        [6, -35],
        [-5, -35],
      ],
      p.style === "woodland" ? p.cloth : p.metal,
    );
  } else if (kind === "ranger" || kind === "archer" || p.style === "woodland") {
    a.poly(
      [
        [-6, -37],
        [-4, -45],
        [1, -47],
        [6, -40],
        [5, -35],
        [3, -42],
        [-2, -42],
        [-3, -36],
      ],
      p.cloth,
    );
    a.line(
      [
        [-2, -38],
        [1, -38],
      ],
      "#283438",
      1,
    );
  } else {
    a.poly(
      [
        [-5, -39],
        [-5, -43],
        [-2, -47],
        [3, -47],
        [6, -43],
        [5, -38],
      ],
      p.metal,
    );
    a.line(
      [
        [-4, -39],
        [4, -39],
      ],
      "#2a3b41",
      1.8,
    );
    a.line(
      [
        [0, -43],
        [0, -36],
      ],
      p.trim,
      1,
    );
    a.poly(
      [
        [-1, -47],
        [0, -53],
        [3, -51],
        [3, -45],
      ],
      p.team,
    );
  }
  if (kind === "warlord") {
    a.poly(
      [
        [-5, -43],
        [-6, -49],
        [-3, -47],
        [0, -51],
        [2, -47],
        [5, -49],
        [5, -43],
      ],
      p.trim,
    );
    a.poly(
      [
        [-14, -26],
        [-3, -25],
        [-4, -12],
        [-8, -8],
        [-13, -13],
      ],
      p.team,
      p.trim,
      1.2,
    );
    a.line(
      [
        [-8, -23],
        [-8, -14],
      ],
      p.trim,
      0.9,
    );
  }
  if (kind === "swordsman") {
    a.poly(
      [
        [-14, -26],
        [-7, -27],
        [-6, -16],
        [-10, -10],
        [-14, -16],
      ],
      p.team,
      p.metal,
      1,
    );
    a.line(
      [
        [-11, -23],
        [-9, -15],
      ],
      p.trim,
      1,
    );
  }
  const wx = 12 + arm * 0.55,
    wy = -18 - arm * 0.8;
  if (["archer", "ranger"].includes(kind)) {
    const c = a.c;
    c.strokeStyle = p.timber;
    c.lineWidth = 1.8;
    c.beginPath();
    c.arc(wx, wy - 5, 11, -1.4, 1.4);
    c.stroke();
    a.line(
      [
        [wx + 2, wy - 16],
        [wx + 2, wy + 6],
      ],
      p.trim,
      0.7,
    );
    a.line(
      [
        [wx - 7, wy - 5],
        [wx + 13, wy - 5],
      ],
      p.metal,
      1,
    );
    a.poly(
      [
        [wx + 13, wy - 5],
        [wx + 9, wy - 7],
        [wx + 9, wy - 3],
      ],
      p.metal,
    );
    a.line(
      [
        [-5, -31],
        [-9, -16],
      ],
      p.timber,
      3,
    );
  } else if (kind === "spearman") {
    a.line(
      [
        [wx - 1, wy + 10],
        [wx + 5, wy - 33],
      ],
      p.timber,
      1.8,
    );
    a.poly(
      [
        [wx + 5, wy - 39],
        [wx + 8, wy - 30],
        [wx + 2, wy - 31],
      ],
      p.metal,
      p.trim,
      0.6,
    );
  } else if (kind === "support") {
    a.line(
      [
        [wx, wy + 14],
        [wx + 2, wy - 22],
      ],
      p.timber,
      2,
    );
    a.crystal(wx + 2, wy - 25, 6);
    a.poly(
      [
        [-8, -20],
        [8, -20],
        [11, -2],
        [-10, -2],
      ],
      p.cloth,
      p.trim,
      0.7,
    );
    a.line(
      [
        [0, -18],
        [0, -4],
      ],
      p.team,
      2,
    );
  } else if (kind === "engineer") {
    a.line(
      [
        [wx, wy + 8],
        [wx + 3, wy - 14],
      ],
      p.timber,
      2.5,
    );
    a.poly(
      [
        [wx - 3, wy - 15],
        [wx + 10, wy - 15],
        [wx + 10, wy - 8],
        [wx - 3, wy - 8],
      ],
      p.metal,
      p.trim,
    );
    a.poly(
      [
        [-12, -20],
        [-7, -21],
        [-6, -9],
        [-12, -8],
      ],
      p.timber,
      p.trim,
    );
  } else {
    a.line(
      [
        [wx, wy + 7],
        [wx + 4 + attack * 8, wy - 15],
      ],
      p.metal,
      2.5,
    );
    a.line(
      [
        [wx - 4, wy + 1],
        [wx + 5, wy - 1],
      ],
      p.trim,
      1.5,
    );
  }
  if (p.style === "arcane") a.crystal(-7, -28, 2.5);
  if (p.style === "woodland")
    a.poly(
      [
        [-9, -29],
        [-6, -33],
        [-3, -29],
        [-5, -25],
      ],
      p.trim,
    );
  c.restore();
}

type Atlas = {
  canvas: HTMLCanvasElement;
  w: number;
  h: number;
  frames: number;
  states: number;
  anchorX: number;
  anchorY: number;
};
export class SpriteLibrary {
  private cache = new Map<string, Atlas>();
  maxAtlases = 64;
  palette(faction: string, team: number): ArtPalette {
    return {
      ...(factionArt[faction] ?? factionArt.ironhold),
      team: team < 0 ? "#d7bd85" : teamColors[team % teamColors.length],
    };
  }
  atlas(
    kind: string,
    faction: string,
    team: number,
    building: boolean,
    back = false,
  ) {
    const key = [kind, faction, team, building, back].join(":");
    const existing = this.cache.get(key);
    if (existing) {
      this.cache.delete(key);
      this.cache.set(key, existing);
      return existing;
    }
    const w = building ? 192 : 72,
      h = building ? 184 : 80,
      frames = building ? 4 : 8,
      states = building ? 1 : 3,
      ratio = 1.5;
    const canvas = document.createElement("canvas");
    canvas.width = w * frames * ratio;
    canvas.height = h * states * ratio;
    const c = canvas.getContext("2d")!;
    c.scale(ratio, ratio);
    const palette = this.palette(faction, team);
    for (let state = 0; state < states; state++)
      for (let frame = 0; frame < frames; frame++) {
        c.save();
        c.translate(frame * w, state * h);
        c.beginPath();
        c.rect(0, 0, w, h);
        c.clip();
        if (building)
          paintBuilding(c, kind, palette, (frame / frames) * Math.PI * 2);
        else paintUnit(c, kind, palette, state, frame, back);
        c.restore();
      }
    const atlas = {
      canvas,
      w,
      h,
      frames,
      states,
      anchorX: building ? 96 : 36,
      anchorY: building ? 155 : 71,
    };
    this.cache.set(key, atlas);
    if (this.cache.size > this.maxAtlases) {
      const oldest = this.cache.keys().next().value!;
      const removed = this.cache.get(oldest)!;
      removed.canvas.width = 0;
      this.cache.delete(oldest);
    }
    return atlas;
  }
  draw(
    c: CanvasRenderingContext2D,
    kind: string,
    faction: string,
    team: number,
    building: boolean,
    x: number,
    y: number,
    scale: number,
    state: number,
    frame: number,
    mirror = false,
    back = false,
  ) {
    const a = this.atlas(kind, faction, team, building, back);
    const ratio = 1.5;
    const f = ((Math.floor(frame) % a.frames) + a.frames) % a.frames,
      s = Math.min(a.states - 1, state);
    c.save();
    c.translate(x, y);
    if (mirror) c.scale(-1, 1);
    c.drawImage(
      a.canvas,
      f * a.w * ratio,
      s * a.h * ratio,
      a.w * ratio,
      a.h * ratio,
      -a.anchorX * scale,
      -a.anchorY * scale,
      a.w * scale,
      a.h * scale,
    );
    c.restore();
  }
  get atlasCount() {
    return this.cache.size;
  }
}
