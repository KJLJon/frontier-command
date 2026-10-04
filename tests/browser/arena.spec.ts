import { test, expect } from "@playwright/test";
test("Rush Arena is playable, shows upgrades and results, and retries on desktop and touch", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./?test=1");
  await page.getByRole("button", { name: "Rush Arena", exact: true }).click();
  await page
    .getByRole("button", { name: "Start Rush Arena", exact: true })
    .click();
  await expect(page.locator("#mode-title")).toContainText("Rush Arena");
  await expect
    .poll(() => page.evaluate(() => (window as any).frontier.themes.loading))
    .toBe(false);
  await expect(page.locator(".side-actions")).toHaveCount(0);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const before = await page.evaluate(() => {
    const a = (window as any).frontier.sim;
    return { time: a.time, hero: { x: a.hero(0).x, y: a.hero(0).y } };
  });
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => (window as any).frontier.sim.time)).toBe(
    before.time,
  );
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  if (info.project.name === "mobile") {
    const pad = page.getByRole("button", { name: "Move left", exact: true });
    const box = (await pad.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(650);
    await page.mouse.up();
  } else {
    await page.keyboard.down("a");
    await page.waitForTimeout(650);
    await page.keyboard.up("a");
  }
  const moved = await page.evaluate(() => {
    const a = (window as any).frontier.sim;
    return { x: a.hero(0).x, y: a.hero(0).y };
  });
  expect(
    Math.hypot(moved.x - before.hero.x, moved.y - before.hero.y),
  ).toBeGreaterThan(0.2);
  await page.screenshot({
    path: `test-results/arena-${info.project.name}.png`,
  });
  await page.evaluate(() => {
    const a = (window as any).frontier.sim;
    a.time = 45;
  });
  const upgrade = page.getByRole("dialog", { name: "Choose arena upgrade" });
  await expect(upgrade).toBeVisible();
  await upgrade.getByRole("button", { name: /Fortify squad/ }).click();
  await expect(upgrade).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).frontier.sim.upgrades)).toBe(
    1,
  );
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page
    .getByRole("button", { name: "Return to arena", exact: true })
    .click();
  await page.evaluate(() => {
    const a = (window as any).frontier.sim;
    a.hero(0).hp = 0;
    a.checkVictory();
  });
  await expect(
    page.getByRole("heading", { name: "Your squad has fallen" }),
  ).toBeVisible();
  await page.evaluate(() => {
    const f = (window as any).frontier;
    f.themes.event(
      { type: "hit", source: f.sim.hero(0).id, target: f.sim.hero(0).id },
      f.sim.time,
    );
  });
  await page.getByRole("button", { name: "Retry arena", exact: true }).click();
  expect(
    await page.evaluate(() => {
      const f = (window as any).frontier;
      return [
        ...f.themes.attacks.values(),
        ...[...f.themes.motions.values()].map((m: any) => m.time),
      ].every((time) => time <= f.sim.time);
    }),
  ).toBe(true);
  expect(
    await page.evaluate(() => (window as any).frontier.sim.hero(0).hp),
  ).toBeGreaterThan(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("arena can run inside a strategy battle and return without changing its state or autosave", async ({
  page,
}) => {
  await page.goto("./?test=1");
  await page.getByRole("button", { name: "New skirmish", exact: true }).click();
  await page.getByRole("button", { name: "Begin battle", exact: true }).click();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByRole("button", { name: "Save battle", exact: true }).click();
  const state = await page.evaluate(() =>
    (window as any).frontier.sim.serialize(),
  );
  await page.getByRole("button", { name: "Rush Arena", exact: true }).click();
  await page
    .getByRole("button", { name: "Start Rush Arena", exact: true })
    .click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page
    .getByRole("button", { name: "Return to RTS battle", exact: true })
    .click();
  expect(
    await page.evaluate(() => (window as any).frontier.sim.serialize()),
  ).toBe(state);
  await expect(page.locator("#mode-title")).toContainText("Conquest");
});
