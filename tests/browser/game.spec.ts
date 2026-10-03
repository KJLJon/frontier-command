import { test, expect } from "@playwright/test";
test("menu, skirmish, commander, recruitment, pause, save/load and base path", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./?test=1");
  await expect(
    page.getByRole("button", { name: "New skirmish", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "New skirmish", exact: true }).click();
  await page.getByRole("button", { name: "Begin battle" }).click();
  await expect(page.locator("#gold")).toBeVisible();
  const before = await page.evaluate(() => {
    const s = (window as any).frontier.sim;
    return s.entities.find((e: any) => e.kind === "warlord" && e.team === 0).x;
  });
  await page.keyboard.down("d");
  await page.waitForTimeout(1200);
  await page.keyboard.up("d");
  const after = await page.evaluate(() => {
    const s = (window as any).frontier.sim;
    return s.entities.find((e: any) => e.kind === "warlord" && e.team === 0).x;
  });
  expect(after).not.toBe(before);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const time = await page.evaluate(() => (window as any).frontier.sim.time);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => (window as any).frontier.sim.time)).toBe(
    time,
  );
  await page.evaluate(() => {
    const s = (window as any).frontier.sim,
      p = s.map.spawns[0];
    s.spawn("barracks", 0, p.x + 3, p.y, true);
    s.players[0].gold = 1000;
    s.players[0].wood = 1000;
    s.issue({ type: "Recruit", team: 0, kind: "swordsman" });
  });
  await expect(page.getByText("Tactical pause", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.evaluate(() => {
    const s = (window as any).frontier.sim;
    s.settings.speed = 8;
  });
  await expect.poll(() => page.evaluate(() => (window as any).frontier.sim.stats.recruited)).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByRole("button", { name: "Save battle", exact: true }).click();
  await expect(page.locator("#toast")).toContainText("Battle saved");
  await page.getByRole("button", { name: "Load a save" }).click();
  await page
    .getByRole("button", { name: "Resume", exact: true })
    .first()
    .click();
  await expect(page.locator("#gold")).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "New skirmish", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("campaign, editor, export model, achievements and settings", async ({
  page,
}) => {
  await page.goto("./?test=1");
  await page.getByRole("button", { name: "Campaign", exact: true }).click();
  await page.getByRole("button", { name: "Play", exact: true }).first().click();
  await page.getByRole("button", { name: "Enter the frontier" }).click();
  await expect(page.locator("#objective")).toContainText("territory");
  await page.evaluate(() => (window as any).frontier.setView("editor"));
  await expect(page.getByText("Frontier cartographer")).toBeVisible();
  await page.getByRole("button", { name: "Validate map", exact: true }).click();
  await expect(page.locator("#validation")).toContainText("reachable");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.locator("#toast")).toContainText("Map saved");
  await page.getByRole("button", { name: "Load", exact: true }).click();
  await page.getByRole("button", { name: "Open map" }).click();
  await expect(page.getByText("Frontier cartographer")).toBeVisible();
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByRole("button", { name: "Achievements", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Hall of banners" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page
    .getByRole("button", { name: "Save settings", exact: true })
    .click();
  await expect(page.locator("#toast")).toContainText("Settings saved");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});
test("PWA manifest, scoped worker, offline reload, and offline new match", async ({
  page,
  context,
}) => {
  await page.goto("./?test=1");
  await expect(
    page.getByRole("button", { name: "New skirmish", exact: true }),
  ).toBeVisible();
  const scope = await page.evaluate(async () => {
    const r = await navigator.serviceWorker.ready;
    return r.scope;
  });
  expect(scope).toContain("/frontier-command/");
  const manifest = await page.request.get("manifest.webmanifest");
  expect((await manifest.json()).scope).toBe("/frontier-command/");
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "New skirmish", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "New skirmish", exact: true }).click();
  await page.getByRole("button", { name: "Begin battle" }).click();
  await expect(page.locator("#gold")).toBeVisible();
  await context.setOffline(false);
});
