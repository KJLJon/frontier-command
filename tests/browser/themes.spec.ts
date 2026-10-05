import { test, expect } from "@playwright/test";

const worlds = [
  "space",
  "mythic",
  "old-time",
  "christmas",
  "halloween",
  "street-kids",
];
test("all eighteen presentations apply through settings and work offline", async ({
  page,
  context,
}, info) => {
  test.setTimeout(600000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./?test=1");
  await page.getByRole("button", { name: "New skirmish", exact: true }).click();
  await page.getByRole("button", { name: "Begin battle" }).click();
  await expect
    .poll(() => page.evaluate(() => (window as any).frontier.themes.loading), {
      timeout: 30000,
    })
    .toBe(false);
  await page.evaluate(() => {
    const f = (window as any).frontier,
      s = f.sim,
      p = s.map.spawns[0];
    s.players.forEach((p: any) => (p.ai = false));
    for (let i = 0; i < 8; i++)
      s.spawn(
        i % 2 ? "archer" : "swordsman",
        0,
        p.x + (i % 4),
        p.y + 2 + Math.floor(i / 4),
      );
    s.spawn("barracks", 0, p.x - 3, p.y + 1, true);
    f.renderer.reveal = true;
  });
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  for (const id of worlds)
    for (const style of ["toon", "realistic", "sticker"]) {
      await page.getByRole("button", { name: "Menu", exact: true }).click();
      await page.getByRole("button", { name: "Settings", exact: true }).click();
      await page.getByLabel("World theme", { exact: true }).selectOption(id);
      await page.getByLabel("Art style", { exact: true }).selectOption(style);
      await page
        .getByRole("button", { name: "Save settings", exact: true })
        .click();
      await expect
        .poll(
          () =>
            page.evaluate(() => {
              const t = (window as any).frontier.themes;
              return t.loading
                ? "Loading: " + t.status
                : t.active
                  ? `${t.active.manifest.id}:${t.active.style}`
                  : "Fallback: " + t.lastError;
            }),
          { timeout: 60000 },
        )
        .toBe(id + ":" + style);
      await page.getByRole("button", { name: "Back", exact: true }).click();
      await expect(page.locator(".theme-controls")).toHaveCount(0);
      expect(
        await page.evaluate(
          () =>
            Object.keys((window as any).frontier.themes.active.units).length,
        ),
      ).toBe(4);
      expect(
        await page.evaluate(
          () =>
            Object.keys((window as any).frontier.themes.active.props).length,
        ),
      ).toBe(6);
      // Switching/offline behavior is independent of Chromium's compositor
      // capture path. Visual proof is saved from the live in-app preview.
      const canvas = await page
        .locator("#battlefield canvas[data-world-surface]")
        .evaluate((node) => ({
          width: (node as HTMLCanvasElement).width,
          height: (node as HTMLCanvasElement).height,
          displayWidth: node.getBoundingClientRect().width,
          density: Math.min(
            matchMedia("(pointer: coarse)").matches ? 1.25 : 2,
            window.devicePixelRatio || 1,
          ),
        }));
      expect(canvas.width).toBeGreaterThan(300);
      expect(canvas.height).toBeGreaterThan(300);
      expect(canvas.width).toBe(
        Math.ceil(canvas.displayWidth * canvas.density),
      );
      console.info("Theme switched:", id, style);
    }
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const before = await page.evaluate(() => (window as any).frontier.sim.time);
  await expect
    .poll(() => page.evaluate(() => (window as any).frontier.sim.time))
    .toBeGreaterThan(before);
  await context.setOffline(true);
  for (const id of worlds) {
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.getByLabel("World theme", { exact: true }).selectOption(id);
    await page
      .getByRole("button", { name: "Save settings", exact: true })
      .click();
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const t = (window as any).frontier.themes;
            return t.loading
              ? "Loading: " + t.status
              : (t.active?.manifest.id ?? "Fallback") +
                  (t.lastError ? " · " + t.lastError : "");
          }),
        { timeout: 60000 },
      )
      .toBe(id);
    await page.getByRole("button", { name: "Back", exact: true }).click();
    expect(
      await page.evaluate(() => {
        const active = (window as any).frontier.themes.active;
        return {
          roster: Object.keys(active.exact).length,
          resources: Object.values(active.resources).reduce(
            (count: number, states: any) => count + Object.keys(states).length,
            0,
          ),
        };
      }),
    ).toEqual({ roster: 20, resources: 14 });
  }
  await page.reload();
  await expect(
    page.getByRole("button", { name: "New skirmish", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).frontier.themes.active?.manifest.id),
    )
    .toBe("street-kids");
  expect(
    await page.evaluate(() => (window as any).frontier.themes.active.style),
  ).toBe("sticker");
  expect(errors).toEqual([]);
});

test.describe("uncached failure", () => {
  test.use({ serviceWorkers: "block" });
  test("missing art keeps a working presentation; audio preferences and reduced motion persist", async ({
    page,
  }) => {
    await page.goto("./?test=1");
    await expect
      .poll(
        () => page.evaluate(() => (window as any).frontier.themes.loading),
        { timeout: 30000 },
      )
      .toBe(false);
    await expect
      .poll(() =>
        page.evaluate(
          () => (window as any).frontier.themes.active?.manifest.id,
        ),
      )
      .toBe("space");
    await page.route("**/themes/christmas/graphics/props-toon.png*", (route) =>
      route.abort(),
    );
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page
      .getByLabel("World theme", { exact: true })
      .selectOption("christmas");
    await page.getByLabel("Mute all audio").check();
    await page.getByLabel("Reduced motion").check();
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(page.locator("[data-theme-status]")).toContainText(
      "Theme unavailable",
    );
    expect(
      await page.evaluate(
        () => (window as any).frontier.themes.active.manifest.id,
      ),
    ).toBe("space");
    await page
      .getByLabel("World theme", { exact: true })
      .selectOption("mythic");
    await page
      .getByLabel("Art style", { exact: true })
      .selectOption("realistic");
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect
      .poll(() =>
        page.evaluate(
          () => (window as any).frontier.themes.active?.manifest.id,
        ),
      )
      .toBe("mythic");
    await page.reload();
    await expect
      .poll(() =>
        page.evaluate(
          () => (window as any).frontier.themes.active?.manifest.id,
        ),
      )
      .toBe("mythic");
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await expect(page.getByLabel("Mute all audio")).toBeChecked();
    await expect(page.getByLabel("Reduced motion")).toBeChecked();
    expect(
      await page.evaluate(
        () => (window as any).frontier.renderer.reducedMotion,
      ),
    ).toBe(true);
  });
});

test("four faction shapes, bounded effects and audio, and a 200-unit field remain playable", async ({
  page,
}, info) => {
  await page.goto("./?test=1");
  await page.getByRole("button", { name: "New skirmish", exact: true }).click();
  await page.getByRole("button", { name: "Begin battle" }).click();
  await expect
    .poll(() => page.evaluate(() => (window as any).frontier.themes.loading), {
      timeout: 30000,
    })
    .toBe(false);
  const result = await page.evaluate(async () => {
    const f = (window as any).frontier,
      s = f.sim,
      p = s.map.spawns[0];
    s.players.forEach((p: any) => (p.ai = false));
    const markers = [0, 1, 2, 3].map((i) => f.themes.faction(i));
    for (let i = 0; i < 200; i++) {
      const e = s.spawn(
        ["swordsman", "spearman", "archer", "cavalry"][i % 4],
        0,
        p.x - 4 + (i % 12) * 0.5,
        p.y + 1 + Math.floor(i / 12) * 0.3,
      );
      e.order = "Hold";
    }
    f.renderer.reveal = true;
    for (let i = 0; i < 300; i++) {
      f.audio.effect("hit");
      f.renderer.events([
        { type: "hit", x: p.x, y: p.y, target: s.entities[0].id, team: 0 },
      ]);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return {
      markers,
      voices: f.audio.sources.size,
      particles: f.renderer.particles.length,
      loop: f.audio.musicSource?.loop,
      loopEnd: f.audio.musicSource?.loopEnd,
      duration: f.audio.musicSource?.buffer?.duration,
    };
  });
  expect(new Set(result.markers.map((m: any) => m.emblem)).size).toBe(4);
  expect(result.voices).toBeLessThanOrEqual(12);
  expect(result.particles).toBeLessThanOrEqual(100);
  expect(result.loop).toBe(true);
  expect(Math.abs(result.loopEnd - result.duration)).toBeLessThan(0.01);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(page.getByText("Tactical pause", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  await page.screenshot({
    path: `test-results/theme-gallery/${info.project.name}-army.png`,
  });
});
