import { chromium } from "@playwright/test";
const browser = await chromium.launch({
  executablePath: process.env.FRONTIER_BROWSER,
});
const context = await browser.newContext();
const page = await context.newPage();
page.on("pageerror", (e) => console.log("ERROR " + e.message));
page.on("requestfailed", (r) =>
  console.log("FAILED " + r.url() + " " + r.failure()?.errorText),
);
page.on("console", (m) => {
  if (m.type() === "error") console.log("CONSOLE " + m.text());
});
await page.goto("http://127.0.0.1:4180/frontier-command/?test=1");
await page.getByRole("button", { name: "New skirmish", exact: true }).waitFor();
await page.evaluate(async () => await navigator.serviceWorker.ready);
await page.reload();
await page.getByRole("button", { name: "New skirmish", exact: true }).waitFor();
console.log(
  await page.evaluate(async () => ({
    controller: !!navigator.serviceWorker.controller,
    caches: await Promise.all(
      (await caches.keys()).map(async (k) => ({
        key: k,
        urls: (await (await caches.open(k)).keys()).map((r) => r.url),
      })),
    ),
  })),
);
await context.setOffline(true);
await page.reload();
await page.waitForTimeout(1000);
console.log("OFFLINE HTML " + (await page.content()).slice(0, 1700));
await browser.close();
