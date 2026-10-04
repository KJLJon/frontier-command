// Read-only import of an external asset pack into this game's runtime directory.
import {
  readFile,
  writeFile,
  mkdir,
  readdir,
  copyFile,
  access,
} from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
const source = path.resolve(
  process.argv[2] ??
    "C:/Users/micro/OneDrive/Desktop/J5/dev/projects/game-Frontier-Command/theme-assets",
);
const destination = path.resolve("public/themes");
const catalog = JSON.parse(
  await readFile(path.join(source, "catalog.json"), "utf8"),
);
const files = new Set(["catalog.json"]);
async function collect(relative) {
  for (const e of await readdir(path.join(source, relative), {
    withFileTypes: true,
  })) {
    const name = relative + "/" + e.name;
    if (e.isDirectory()) await collect(name);
    else if (/\.(png|svg|wav|gltf)$/.test(name)) files.add(name);
  }
}
await collect("shared");
for (const theme of catalog.themes) {
  const manifest = JSON.parse(
    await readFile(path.join(source, theme.manifest), "utf8"),
  );
  if (
    !manifest.environments?.toon ||
    !manifest.environments?.realistic ||
    !manifest.props ||
    !manifest.audio?.ambientMusic ||
    !manifest.audio?.combatMusic
  )
    throw Error("Incomplete theme: " + theme.id);
  files.add(theme.manifest);
  const extra = theme.id + "/game-assets.json";
  try {
    await access(path.join(source, extra));
    const data = JSON.parse(await readFile(path.join(source, extra), "utf8"));
    if (data.schemaVersion === 1 && data.units && data.resourceSites) {
      files.add(extra);
      theme.gameAssets = extra;
    }
  } catch {
    /* This theme's expanded roster is still being authored. */
  }
  try {
    const arena = theme.id + "/arena-assets.json";
    await access(path.join(source, arena));
    files.add(arena);
    theme.arenaAssets = arena;
  } catch {
    /* Arena art is optional. */
  }
  for (const directory of ["graphics", "audio", "models"])
    await collect(theme.id + "/" + directory);
}
const hash = createHash("sha256"),
  inventory = [];
for (const relative of [...files].sort()) {
  const bytes = await readFile(path.join(source, relative));
  hash.update(relative).update(bytes);
  await mkdir(path.dirname(path.join(destination, relative)), {
    recursive: true,
  });
  await writeFile(path.join(destination, relative), bytes);
  inventory.push({
    file: relative,
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  });
}
catalog.snapshot = hash.digest("hex").slice(0, 16);
await writeFile(
  path.join(destination, "catalog.json"),
  JSON.stringify(catalog, null, 2) + "\n",
);
await mkdir("work", { recursive: true });
await writeFile(
  "work/theme-import.json",
  JSON.stringify(
    { source, snapshot: catalog.snapshot, files: inventory },
    null,
    2,
  ) + "\n",
);
// Validate the imported copy; the external validator is never run in its source folder.
const validator = await readFile(
  path.join(source, "tools/validate.mjs"),
  "utf8",
);
await mkdir("work/theme-validation", { recursive: true });
await writeFile(
  "work/theme-validation/validate.mjs",
  validator.replace(
    "path.resolve(import.meta.dirname,'..')",
    JSON.stringify(destination),
  ),
);
console.log(
  `Imported ${files.size} runtime files (${catalog.snapshot}); source pack untouched.`,
);
