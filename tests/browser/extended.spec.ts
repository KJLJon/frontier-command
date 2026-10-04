import { test, expect } from "@playwright/test";
import { readFile, writeFile, unlink } from "node:fs/promises";
test("touch movement, building placement and recruitment through actual controls", async ({
  page,
  isMobile,
}) => {
  await page.goto("./?test=1");
  await page.getByRole("button", { name: "New skirmish", exact: true }).click();
  await page.getByRole("button", { name: "Begin battle" }).click();
  await expect(page.locator("#gold")).toBeVisible();
  const before = await page.evaluate(
    () =>
      (window as any).frontier.sim.entities.find(
        (e: any) => e.team === 0 && e.kind === "warlord",
      ).y,
  );
  if (isMobile) {
    const b = page.getByRole("button", { name: "Move up", exact: true }),
      rect = await b.boundingBox();
    const touch = await page.context().newCDPSession(page);
    await touch.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [
        { x: rect!.x + rect!.width / 2, y: rect!.y + rect!.height / 2 },
      ],
    });
    await page.waitForTimeout(700);
    await touch.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await touch.detach();
    expect(rect?.width).toBeGreaterThanOrEqual(42);
  } else {
    await page.keyboard.down("w");
    await page.waitForTimeout(700);
    await page.keyboard.up("w");
  }
  expect(
    await page.evaluate(
      () =>
        (window as any).frontier.sim.entities.find(
          (e: any) => e.team === 0 && e.kind === "warlord",
        ).y,
    ),
  ).not.toBe(before);
  await page.getByRole("button", { name: /^Build/ }).click();
  await page.getByRole("button", { name: /^Barracks/ }).click();
  const target = await page.evaluate(() => {
    const f = (window as any).frontier,
      s = f.sim,
      p = s.map.spawns[0];
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
  await page.evaluate(() => ((window as any).frontier.sim.settings.speed = 8));
  await expect
    .poll(
      () =>
        page.evaluate(() => (window as any).frontier.sim.has(0, "barracks")),
      { timeout: 12000 },
    )
    .toBeTruthy();
  await page.getByRole("button", { name: /^Recruit/ }).click();
  await page.getByRole("button", { name: /^Swordsman/ }).click();
  await expect
    .poll(
      () => page.evaluate(() => (window as any).frontier.sim.stats.recruited),
      { timeout: 10000 },
    )
    .toBeGreaterThan(0);
});
test("expedition route persists and original content screens remain offline", async ({
  page,
  context,
}) => {
  await page.goto("./?test=1");
  await page.evaluate(async () => await navigator.serviceWorker.ready);
  await page.reload();
  await context.setOffline(true);
  await page.getByRole("button", { name: "Expedition", exact: true }).click();
  await page
    .getByRole("button", { name: "Choose route", exact: true })
    .first()
    .click();
  await expect(page.locator("#gold")).toBeVisible();
  await page.evaluate(async () => {
    const f = (window as any).frontier;
    f.sim.finish(0);
  });
  await expect(
    page.getByRole("heading", { name: "The frontier is yours" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Expedition map" }).click();
  await expect(page.getByText("Village shelter")).toBeVisible();
  await page
    .getByRole("button", { name: "Choose route", exact: true })
    .first()
    .click();
  await expect(page.getByText("Border battle")).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Expedition", exact: true }).click();
  await expect(page.getByText("Border battle")).toBeVisible();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.getByRole("button", { name: "Level editor" }).click();
  await expect(page.getByText("Frontier cartographer")).toBeVisible();
  await context.setOffline(false);
});
test("waiting PWA update leaves a match running and saves before explicit restart", async ({
  page,
}, info) => {
  const filename = `sw-test-${info.project.name}.js`,
    file = "dist/" + filename;
  const worker = await readFile("dist/sw.js", "utf8");
  await writeFile(
    file,
    worker.replace(
      /const CACHE='([^']+)'/,
      `const CACHE='frontier-command:test-${info.project.name}'`,
    ),
  );
  try {
    await page.goto("./?test=1");
    await page.evaluate(async () => await navigator.serviceWorker.ready);
    await page.reload();
    await page
      .getByRole("button", { name: "New skirmish", exact: true })
      .click();
    await page.getByRole("button", { name: "Begin battle" }).click();
    await expect(page.locator("#gold")).toBeVisible();
    await page.evaluate(async (filename) => {
      await navigator.serviceWorker.register("/frontier-command/" + filename, {
        scope: "/frontier-command/",
      });
    }, filename);
    await expect(
      page.getByRole("button", { name: "Update & Restart" }),
    ).toBeVisible();
    const before = await page.evaluate(() => (window as any).frontier.sim.time);
    await page.waitForTimeout(400);
    expect(
      await page.evaluate(() => (window as any).frontier.sim.time),
    ).toBeGreaterThan(before);
    await page.getByRole("button", { name: "Update & Restart" }).click();
    await expect(
      page.getByRole("button", { name: "Continue", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL),
    ).toMatch(new RegExp("/(?:" + filename.replace(".", "\\.") + "|sw\\.js)$"));
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page
      .getByRole("button", { name: "Resume", exact: true })
      .first()
      .click();
    await expect(page.locator("#gold")).toBeVisible();
    expect(
      await page.evaluate(() => (window as any).frontier.sim.time),
    ).toBeGreaterThanOrEqual(before);
  } finally {
    await unlink(file);
  }
});

test("an unresponsive waiting worker recovers after saving and later updates still wait", async ({
  page,
}, info) => {
  const filename = `sw-idle-${info.project.name}.js`,
    file = "dist/" + filename;
  const source = await readFile("dist/sw.js", "utf8");
  const variant = (version: number) =>
    source.replace(
      /const CACHE='([^']+)'/,
      `const CACHE='frontier-command:idle-${info.project.name}-${version}'`,
    );
  await writeFile(file, variant(1));
  try {
    await page.goto("./?test=1");
    await page.evaluate(async () => await navigator.serviceWorker.ready);
    await page.reload();
    await page
      .getByRole("button", { name: "New skirmish", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Begin battle", exact: true })
      .click();
    await page.evaluate(async (filename) => {
      await navigator.serviceWorker.register("/frontier-command/" + filename, {
        scope: "/frontier-command/",
      });
      // Reproduce the observed idle-worker failure without altering storage or gameplay.
      const post = ServiceWorker.prototype.postMessage;
      ServiceWorker.prototype.postMessage = function (
        message: any,
        ...rest: any[]
      ) {
        if (message?.type === "APPLY_UPDATE") return;
        return (post as any).call(this, message, ...rest);
      };
    }, filename);
    await expect(
      page.getByRole("button", { name: "Update & Restart" }),
    ).toBeVisible();
    const before = await page.evaluate(() => (window as any).frontier.sim.time);
    await page.getByRole("button", { name: "Update & Restart" }).click();
    await expect(
      page.getByRole("button", { name: "Continue", exact: true }),
    ).toBeVisible({ timeout: 30000 });
    const applied = await page.evaluate(
      () => navigator.serviceWorker.controller?.scriptURL,
    );
    expect(applied).toContain("/frontier-command/sw.js");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page
      .getByRole("button", { name: "Resume", exact: true })
      .first()
      .click();
    await expect(page.locator("#gold")).toBeVisible();
    expect(
      await page.evaluate(() => (window as any).frontier.sim.time),
    ).toBeGreaterThanOrEqual(before);
    // A later background update must still wait for a new explicit restart.
    await page.evaluate(() => {
      (window as any).automaticControllerChanges = 0;
      navigator.serviceWorker.addEventListener(
        "controllerchange",
        () => (window as any).automaticControllerChanges++,
      );
    });
    await writeFile(file, variant(2));
    await page.evaluate(
      async (filename) =>
        await navigator.serviceWorker.register(
          "/frontier-command/" + filename,
          {
            scope: "/frontier-command/",
            updateViaCache: "none",
          },
        ),
      filename,
    );
    await expect
      .poll(
        () =>
          page.evaluate(async (filename) => {
            const r = await navigator.serviceWorker.getRegistration();
            return (
              r?.waiting?.scriptURL.endsWith(filename) &&
              r?.waiting?.state === "installed"
            );
          }, filename),
        { timeout: 30000 },
      )
      .toBe(true);
    const time = await page.evaluate(() => (window as any).frontier.sim.time);
    await expect
      .poll(() => page.evaluate(() => (window as any).frontier.sim.time))
      .toBeGreaterThan(time);
    expect(
      await page.evaluate(() => (window as any).automaticControllerChanges),
    ).toBe(0);
  } finally {
    await unlink(file);
  }
});
