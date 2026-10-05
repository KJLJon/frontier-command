import { test, expect } from "@playwright/test";
import { readFile, writeFile, unlink } from "node:fs/promises";

test("storage migration and worker caches stay isolated from another same-origin PWA", async ({
  page,
}, info) => {
  const filename = `namespace-${info.project.name}.txt`,
    file = "dist/" + filename;
  await writeFile(file, "Frontier own response");
  try {
    await page.goto("./recover.html");
    const catalog = JSON.parse(
      await readFile("public/themes/catalog.json", "utf8"),
    );
    const inventory = JSON.parse(
      await readFile("public/themes/space/game-assets.json", "utf8"),
    );
    const asset = `themes/space/${inventory.units.swordsman.styles.toon.file}?v=${catalog.snapshot}`;
    const migrated = await page.evaluate(
      async ({ asset, filename }) => {
        const url = new URL(asset, location.href).href;
        const bytes = await (await fetch(url)).arrayBuffer();
        const create = async (
          name: string,
          store: string,
          key: string,
          value: unknown,
        ) => {
          const db = await new Promise<IDBDatabase>((resolve, reject) => {
            const r = indexedDB.open(name, 1);
            r.onupgradeneeded = () => r.result.createObjectStore(store);
            r.onsuccess = () => resolve(r.result);
            r.onerror = () => reject(r.error);
          });
          await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(store, "readwrite");
            tx.objectStore(store).put(value, key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
          });
          db.close();
        };
        await create("frontier-theme-art", "assets", url, bytes);
        await create("other-pwa:storage", "settings", "sentinel", "untouched");
        localStorage.setItem("other-pwa:settings", "untouched");
        const foreign = await caches.open("other-pwa:shell");
        await foreign.put(
          new URL(filename, location.href).href,
          new Response("Foreign response"),
        );
        return { url, length: bytes.byteLength };
      },
      { asset, filename },
    );
    await page.route(migrated.url, (route) => route.abort());
    await page.goto("./?test=1");
    await page.evaluate(async () => await navigator.serviceWorker.ready);
    await page.reload();
    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              Object.keys((window as any).frontier?.themes?.active?.exact ?? {})
                .length,
          ),
        { timeout: 30000 },
      )
      .toBe(20);
    await expect
      .poll(() =>
        page.evaluate(async (url) => {
          const bytes = await (window as any).frontier.themes.coreStore.get(
            url,
          );
          return bytes?.byteLength;
        }, migrated.url),
      )
      .toBe(migrated.length);
    const result = await page.evaluate(async (filename) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const r = indexedDB.open("frontier-command:theme-art");
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
      const assetKeys = await new Promise<IDBValidKey[]>((resolve, reject) => {
        const r = db.transaction("assets").objectStore("assets").getAllKeys();
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
      db.close();
      const dbNames = (await indexedDB.databases()).map((d) => d.name);
      return {
        own: await (await fetch(new URL(filename, location.href))).text(),
        foreign: await (
          await (
            await caches.open("other-pwa:shell")
          ).match(new URL(filename, location.href))
        )?.text(),
        setting: localStorage.getItem("other-pwa:settings"),
        dbNames,
        assetKeys,
      };
    }, filename);
    expect(result.own).toBe("Frontier own response");
    expect(result.foreign).toBe("Foreign response");
    expect(result.setting).toBe("untouched");
    expect(result.dbNames).toContain("other-pwa:storage");
    expect(result.dbNames).toContain("frontier-command:storage");
    expect(result.dbNames).toContain("frontier-command:theme-art");
    expect(result.assetKeys).toContain(migrated.url);
  } finally {
    await unlink(file);
  }
});

test("reconnecting downloads an update without reloading an active battle", async ({
  page,
  context,
}, info) => {
  const filename = `online-${info.project.name}.js`,
    file = "dist/" + filename;
  const source = await readFile("dist/sw.js", "utf8");
  const version = (n: number) =>
    source.replace(
      /const CACHE='([^']+)'/,
      `const CACHE='frontier-command:online-${info.project.name}-${n}'`,
    );
  await writeFile(file, version(1));
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
        updateViaCache: "none",
      });
    }, filename);
    await expect(
      page.getByRole("button", { name: "Update & Restart" }),
    ).toBeVisible();
    await page.evaluate(async () => {
      (window as any).oldWaiting =
        (await navigator.serviceWorker.getRegistration())!.waiting;
      (window as any).controllerChanges = 0;
      navigator.serviceWorker.addEventListener(
        "controllerchange",
        () => (window as any).controllerChanges++,
      );
    });
    await context.setOffline(true);
    await writeFile(file, version(2));
    await context.setOffline(false);
    await expect
      .poll(
        () =>
          page.evaluate(async () => {
            const r = await navigator.serviceWorker.getRegistration();
            return (
              r?.waiting?.state === "installed" &&
              (window as any).oldWaiting.state === "redundant"
            );
          }),
        { timeout: 30000 },
      )
      .toBe(true);
    expect(await page.evaluate(() => caches.keys())).toContain(
      `frontier-command:online-${info.project.name}-2`,
    );
    const time = await page.evaluate(() => (window as any).frontier.sim.time);
    await expect
      .poll(() => page.evaluate(() => (window as any).frontier.sim.time))
      .toBeGreaterThan(time);
    expect(await page.evaluate(() => (window as any).controllerChanges)).toBe(
      0,
    );
    await expect(
      page.getByRole("button", { name: "Update & Restart" }),
    ).toBeVisible();
  } finally {
    await context.setOffline(false);
    await unlink(file);
  }
});
