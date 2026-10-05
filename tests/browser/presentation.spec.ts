import { test, expect } from "@playwright/test";
test("authored frames, mirrors, building states and effects are loaded and remain cosmetic", async ({
  page,
}) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("./?test=1");
  await page.getByRole("button", { name: "New skirmish", exact: true }).click();
  await page.getByRole("button", { name: "Begin battle" }).click();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect
    .poll(
      () =>
        page.evaluate(
          () => (window as any).frontier.themes.active?.extrasReady,
        ),
      { timeout: 120000 },
    )
    .toBe(true);
  const result = await page.evaluate(() => {
    const f = (window as any).frontier,
      t = f.themes,
      a = t.active,
      s = f.sim;
    const e = s.entities.find((e: any) => e.team === 0 && !e.building),
      b = s.entities.find((e: any) => e.team === 0 && e.building);
    const original = JSON.stringify(s.serialize());
    const copy = {
      ...e,
      route: [{ x: e.x + 1, y: e.y + 1 }],
      steer: { dx: 1, dy: 1, remaining: 1 },
    };
    const ctx = document.createElement("canvas").getContext("2d")!,
      draws: unknown[] = [];
    ctx.drawImage = ((image: unknown) => {
      draws.push(image);
    }) as any;
    t.entity(ctx, copy, 100, 100, 1, 1, false, false);
    const frames = a.extra.units[e.kind].styles[a.style].animations.move.frames;
    const moving = frames.SE.some((frame: any) =>
      draws.includes(t.frame(frame)?.canvas),
    );
    const mirror = t.frame(frames.SW[0]),
      east = t.frame(frames.SE[0]);
    const damaged = { ...b, hp: b.maxHp * 0.2 };
    draws.length = 0;
    t.entity(ctx, damaged, 100, 100, 1, 1, false, false, 1);
    const damage = draws.includes(t.overlay(b.kind, "damaged")?.canvas),
      night = draws.includes(t.overlay(b.kind, "night")?.canvas);
    draws.length = 0;
    t.entity(ctx, { ...b, build: 5 }, 100, 100, 1, 1, false, false);
    const foundation = draws.includes(t.overlay(b.kind, "foundation")?.canvas);
    draws.length = 0;
    t.entity(ctx, copy, 100, 100, 1, 2, false, true);
    const reduced = draws.includes(a.exact[e.kind].canvas);
    return {
      moving,
      mirror: mirror.flipX === true && mirror.canvas === east.canvas,
      damage,
      night,
      foundation,
      reduced,
      cosmetic: JSON.stringify(s.serialize()) === original,
      units: Object.keys(a.exact).length,
      terrain: a.terrain.size,
      effects: Object.keys(a.extra.effects).length,
      sounds: Object.keys(a.audioVariants).length,
      warnings: a.warnings,
    };
  });
  expect(result).toMatchObject({
    moving: true,
    mirror: true,
    damage: true,
    night: true,
    foundation: true,
    reduced: true,
    cosmetic: true,
    units: 20,
    terrain: 20,
  });
  expect(result.effects).toBeGreaterThanOrEqual(25);
  expect(result.sounds).toBeGreaterThanOrEqual(20);
  expect(result.warnings).toEqual([]);
  expect(errors).toEqual([]);
});
test("Street Kids sticker art and arena combat music persist without changing rules", async ({
  page,
}) => {
  test.setTimeout(180000);
  await page.goto("./?test=1");
  await page.getByRole("button", { name: "Rush Arena", exact: true }).click();
  await page.getByRole("button", { name: "Start Rush Arena" }).click();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page
    .getByRole("button", { name: "World settings", exact: true })
    .click();
  await page
    .getByLabel("World theme", { exact: true })
    .selectOption("street-kids");
  await page.getByLabel("Art style", { exact: true }).selectOption("sticker");
  await page
    .getByRole("button", { name: "Save settings", exact: true })
    .click();
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const a = (window as any).frontier.themes.active;
          return a?.manifest.id + ":" + a?.style;
        }),
      { timeout: 60000 },
    )
    .toBe("street-kids:sticker");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect
    .poll(
      () =>
        page.evaluate(() => (window as any).frontier.themes.active.extrasReady),
      { timeout: 120000 },
    )
    .toBe(true);
  const result = await page.evaluate(() => {
    const f = (window as any).frontier;
    return {
      mode: f.audio.musicMode,
      track: f.audio.theme.manifest.audio.combatMusic.file,
      units: Object.keys(f.themes.active.exact).length,
      paused: f.sim.paused,
      warnings: f.themes.active.warnings,
    };
  });
  expect(result.mode).toBe("combat");
  expect(result.track).toContain("combat");
  expect(result.units).toBe(20);
  expect(result.paused).toBe(true);
  expect(result.warnings).toEqual([]);
  await page.reload();
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const a = (window as any).frontier.themes.active;
          return a?.manifest.id + ":" + a?.style;
        }),
      { timeout: 60000 },
    )
    .toBe("street-kids:sticker");
});
