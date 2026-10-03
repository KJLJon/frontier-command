import { test, expect } from "@playwright/test";

test("day-night HUD, deposit depletion feedback and saved quantities", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./?test=1");
  await page.getByRole("button", { name: "New skirmish", exact: true }).click();
  await page.getByRole("button", { name: "Begin battle" }).click();
  await expect(page.locator("#time")).toContainText("Day");
  await page.evaluate(() => {
    const s = (window as any).frontier.sim;
    s.players.forEach((p: any) => (p.ai = false));
    s.time = 120;
    const mine = s.map.points.find(
      (p: any) => p.kind === "gold" && p.owner === 0,
    );
    mine.remaining = 0.01;
  });
  await expect(page.locator("#time")).toContainText("Night");
  await expect(page.locator("#toast")).toContainText("depleted");
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as any).frontier.sim.map.points.some(
          (p: any) => p.kind === "gold" && p.owner === 0 && p.remaining === 0,
        ),
      ),
    )
    .toBe(true);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const time = await page.evaluate(() => (window as any).frontier.sim.time);
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => (window as any).frontier.sim.time)).toBe(
    time,
  );
  await page.screenshot({
    path: `test-results/night-${test.info().project.name}.png`,
  });
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByRole("button", { name: "Save battle", exact: true }).click();
  await expect(page.locator("#toast")).toContainText("Battle saved");
  await page.getByRole("button", { name: "Load a save" }).click();
  await page
    .getByRole("button", { name: "Resume", exact: true })
    .first()
    .click();
  await expect(page.locator("#time")).toContainText("Night");
  expect(
    await page.evaluate(() =>
      (window as any).frontier.sim.map.points.some(
        (p: any) => p.kind === "gold" && p.remaining === 0,
      ),
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
