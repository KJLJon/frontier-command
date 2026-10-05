import { test, expect } from "@playwright/test";
test("guided planning freezes time, validates placement and preserves manual pause", async ({
  page,
  isMobile,
}) => {
  await page.goto("./?test=1");
  await page.getByRole("button", { name: "New skirmish", exact: true }).click();
  await expect(page.locator('[name="difficulty"]')).toHaveValue("Easy");
  await expect(
    page.getByText("More match options", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Begin battle" }).click();
  await expect(
    page.getByText("1. Build a Barracks", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Attack-move", exact: true }),
  ).not.toBeVisible();
  await page
    .getByRole("button", { name: "Choose building", exact: true })
    .click();
  const time = await page.evaluate(() => (window as any).frontier.sim.time);
  await page.waitForTimeout(350);
  expect(await page.evaluate(() => (window as any).frontier.sim.time)).toBe(
    time,
  );
  expect(await page.evaluate(() => (window as any).frontier.sim.paused)).toBe(
    true,
  );
  await expect(page.locator(".catalog-card canvas").first()).toBeVisible();
  await page.getByText("All buildings · 10", { exact: true }).click();
  await expect(page.getByRole("button", { name: /^Workshop/ })).toBeDisabled();
  await expect(
    page
      .getByRole("button", { name: "Build Barracks first", exact: true })
      .first(),
  ).toBeVisible();
  await page.getByRole("button", { name: /^Barracks/ }).click();
  const gold = await page.evaluate(
    () => (window as any).frontier.sim.players[0].gold,
  );
  const base = await page.evaluate(() => {
    const f = (window as any).frontier,
      p = f.sim.map.spawns[0];
    return f.renderer.project(p.x, p.y);
  });
  if (isMobile) await page.touchscreen.tap(base.x, base.y);
  else await page.mouse.click(base.x, base.y);
  expect(
    await page.evaluate(() => (window as any).frontier.sim.players[0].gold),
  ).toBe(gold);
  expect(await page.evaluate(() => (window as any).frontier.sim.paused)).toBe(
    true,
  );
  await expect(
    page.getByRole("button", { name: "Cancel", exact: true }),
  ).toBeVisible();
  const target = await page.evaluate(() => {
    const f = (window as any).frontier,
      p = f.sim.map.spawns[0];
    return f.renderer.project(p.x - 3, p.y + 2);
  });
  if (isMobile) await page.touchscreen.tap(target.x, target.y);
  else await page.mouse.click(target.x, target.y);
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as any).frontier.sim.entities.some(
          (e: any) => e.team === 0 && e.kind === "barracks",
        ),
      ),
    )
    .toBeTruthy();
  expect(await page.evaluate(() => (window as any).frontier.sim.paused)).toBe(
    false,
  );
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.locator('[data-action="panel:build"]').click();
  await page
    .getByRole("button", { name: "Back to battle", exact: true })
    .click();
  expect(await page.evaluate(() => (window as any).frontier.sim.paused)).toBe(
    true,
  );
});

test("recruitment planning shows troop art and resumes after a paid training order", async ({
  page,
}) => {
  await page.goto("./?test=1");
  await page.getByRole("button", { name: "New skirmish", exact: true }).click();
  await page.getByRole("button", { name: "Begin battle" }).click();
  await page.evaluate(() => {
    const s = (window as any).frontier.sim,
      p = s.map.spawns[0];
    s.spawn("barracks", 0, p.x + 3, p.y, true);
  });
  await page.locator('[data-action="panel:recruit"]').click();
  const time = await page.evaluate(() => (window as any).frontier.sim.time);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => (window as any).frontier.sim.time)).toBe(
    time,
  );
  await expect(page.locator('[data-preview="swordsman"]')).toBeVisible();
  const gold = await page.evaluate(
    () => (window as any).frontier.sim.players[0].gold,
  );
  await page.getByRole("button", { name: /^Swordsman/ }).click();
  expect(await page.evaluate(() => (window as any).frontier.sim.paused)).toBe(
    false,
  );
  expect(
    await page.evaluate(() => (window as any).frontier.sim.players[0].gold),
  ).toBeLessThan(gold);
  expect(
    await page.evaluate(() =>
      (window as any).frontier.sim.entities.some(
        (e: any) =>
          e.team === 0 &&
          e.kind === "barracks" &&
          e.queue.some((q: any) => q.kind === "swordsman"),
      ),
    ),
  ).toBe(true);
  await page.getByText("More", { exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Attack-move", exact: true }),
  ).toBeVisible();
});
