import { chromium } from "@playwright/test";
const browser = await chromium.launch({
  executablePath: process.env.FRONTIER_BROWSER,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://127.0.0.1:4180/frontier-command/?test=1");
await page.getByRole("button", { name: "New skirmish", exact: true }).waitFor();
await page.screenshot({ path: "docs/menu.png" });
await page.getByRole("button", { name: "New skirmish", exact: true }).click();
await page.getByRole("button", { name: "Begin battle" }).click();
await page.waitForTimeout(2000);
await page.evaluate(() => {
  const f = window.frontier,
    s = f.sim,
    p = s.map.spawns[0];
  s.spawn("barracks", 0, p.x + 3, p.y + 1, true);
  s.spawn("house", 0, p.x - 2, p.y - 2, true);
  s.spawn("range", 0, p.x - 1, p.y + 3, true);
  for (let i = 0; i < 6; i++)
    s.spawn(
      i % 2 ? "archer" : "swordsman",
      0,
      p.x + (i % 3),
      p.y + 2 + Math.floor(i / 3),
    );
});
await page.waitForTimeout(300);
await page.screenshot({ path: "docs/battle.png" });
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(400);
await page.screenshot({ path: "docs/mobile.png" });
console.log(
  await page.evaluate(() => ({
    fps: window.frontier.renderer.fps,
    overflow: document.documentElement.scrollWidth > innerWidth,
  })),
);
await browser.close();
