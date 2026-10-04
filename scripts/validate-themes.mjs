import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
const root = path.resolve("public/themes");
const json = async (file) => JSON.parse(await readFile(file, "utf8"));
const catalog = await json(path.join(root, "catalog.json"));
let files = 0,
  frames = 0;
const requiredUnits = [
  "swordsman",
  "spearman",
  "archer",
  "cavalry",
  "siege",
  "support",
  "warlord",
  "ranger",
  "engineer",
];
const requiredBuildings = [
  "keep",
  "house",
  "barracks",
  "range",
  "stable",
  "workshop",
  "tower",
  "depot",
  "blacksmith",
  "arcane",
  "wall",
];
for (const theme of catalog.themes) {
  for (const sidecar of [theme.gameAssets, theme.arenaAssets].filter(Boolean)) {
    const base = path.dirname(path.join(root, sidecar));
    const data = await json(path.join(root, sidecar));
    if (sidecar.endsWith("game-assets.json")) {
      for (const id of requiredUnits)
        assert(data.units[id], `${theme.id}: missing unit ${id}`);
      for (const id of requiredBuildings)
        assert(data.buildings[id], `${theme.id}: missing building ${id}`);
      for (const style of ["toon", "realistic", "sticker"]) {
        for (const id of [...requiredUnits, ...requiredBuildings])
          assert(
            (data.units[id] ?? data.buildings[id]).styles[style],
            `${theme.id}/${id}/${style}`,
          );
        for (const kind of ["gold", "wood"])
          for (const state of ["full", "half", "sparse", "empty"])
            assert(
              data.resourceSites[kind].styles[style][state],
              `${theme.id}/${kind}/${style}/${state}`,
            );
      }
    }
    async function scan(value) {
      if (!value || typeof value !== "object") return;
      if (typeof value.file === "string") {
        const target = path.resolve(base, value.file);
        assert(
          target.startsWith(root + path.sep),
          "Asset path escapes runtime folder",
        );
        assert((await stat(target)).size > 0, "Empty asset: " + target);
        files++;
        if (target.endsWith(".png")) {
          const bytes = await readFile(target);
          const width = bytes.readUInt32BE(16),
            height = bytes.readUInt32BE(20);
          assert.equal(bytes.subarray(1, 4).toString(), "PNG");
          if (value.width) assert.equal(width, value.width, target);
          if (value.height) assert.equal(height, value.height, target);
          if (value.pixelRect) {
            const r = value.pixelRect;
            assert(
              r.x >= 0 &&
                r.y >= 0 &&
                r.width > 0 &&
                r.height > 0 &&
                r.x + r.width <= width &&
                r.y + r.height <= height,
              target + ": bad crop",
            );
            frames++;
          }
          if (value.pivot)
            assert(
              value.pivot.length === 2 &&
                value.pivot.every(
                  (n) => Number.isFinite(n) && n >= 0 && n <= 1,
                ),
              target + ": bad pivot",
            );
        }
      }
      for (const [key, child] of Object.entries(value))
        if (key !== "source") await scan(child);
    }
    await scan(data);
  }
}
console.log(
  `Expanded theme assets valid: ${files} references and ${frames} PNG crops; starter fallback preserved for incomplete themes.`,
);
