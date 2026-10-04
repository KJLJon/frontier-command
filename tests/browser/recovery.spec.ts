import { test, expect } from "@playwright/test";
import { writeFile, unlink } from "node:fs/promises";
test("recover a legacy blank cached shell without losing a saved battle", async ({
  page,
  context,
}, info) => {
  const filename = `legacy-${info.project.name}.js`,
    file = "dist/" + filename;
  const html =
    '<!doctype html><html><head><title>Legacy broken shell</title><script type="module" src="/frontier-command/assets/deleted-version.js"></script></head><body></body></html>';
  await writeFile(
    file,
    `self.addEventListener('install',e=>e.waitUntil(self.skipWaiting()));self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));self.addEventListener('fetch',e=>{if(e.request.mode==='navigate'&&new URL(e.request.url).pathname.startsWith('/frontier-command/'))e.respondWith(Promise.resolve(new Response(${JSON.stringify(html)},{headers:{'Content-Type':'text/html'}})));});`,
  );
  try {
    await page.goto("./?test=1");
    await page
      .getByRole("button", { name: "New skirmish", exact: true })
      .click();
    await page.getByRole("button", { name: "Begin battle" }).click();
    await expect(page.locator("#gold")).toBeVisible();
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    await page
      .getByRole("button", { name: "Save battle", exact: true })
      .click();
    await expect(page.locator("#toast")).toContainText("Battle saved");
    await page.evaluate(async (filename) => {
      await navigator.serviceWorker.ready;
      const change = new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          () => resolve(),
          { once: true },
        ),
      );
      await navigator.serviceWorker.register("/frontier-command/" + filename, {
        scope: "/frontier-command/",
      });
      await change;
    }, filename);
    await page.reload();
    await expect(page).toHaveTitle("Legacy broken shell");
    await expect(
      page.getByRole("button", { name: "New skirmish", exact: true }),
    ).toHaveCount(0);
    await page.goto("/frontier-command-recovery/");
    await page
      .getByRole("button", { name: "Repair & open game", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Continue", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(page.getByText(/Manual save/)).toBeVisible();
    await page
      .getByRole("button", { name: "Resume", exact: true })
      .first()
      .click();
    await expect(page.locator("#gold")).toBeVisible();
    await page.reload();
    await context.setOffline(true);
    await page.reload();
    await expect(
      page.getByRole("button", { name: "New skirmish", exact: true }),
    ).toBeVisible();
    await context.setOffline(false);
  } finally {
    await unlink(file);
  }
});
test("missing startup bundle displays a recovery action instead of a blank screen", async ({
  page,
}) => {
  await page.route("**/assets/*.js", (route) => route.abort());
  await page.goto("./");
  await expect(
    page.getByRole("button", { name: "Repair & restart", exact: true }),
  ).toBeVisible();
  await expect(page.locator("#boot-status")).toContainText(
    "saves will be preserved",
  );
});
