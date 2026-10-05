import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
await writeFile(
  "dist/LICENSE.txt",
  (await readFile("LICENSE", "utf8")) +
    "\n\n" +
    (await readFile("THIRD_PARTY_NOTICES.md", "utf8")),
);
const walk = async (dir) => {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = dir + "/" + e.name;
    if (e.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
};
const files = (await walk("dist")).filter((p) => !p.endsWith("sw.js"));
const hash = createHash("sha256");
hash.update(await readFile("scripts/sw.mjs"));
for (const f of files) hash.update(await readFile(f));
const version = hash.digest("hex").slice(0, 12);
// Large art/music packs are cached on demand by ThemeManager. The shell and manifests
// remain small so updates do not require downloading every world before activation.
const paths = files
  .filter(
    (p) =>
      !p.includes("/themes/") ||
      p.endsWith("/catalog.json") ||
      p.endsWith("/theme.json"),
  )
  .map((p) => "/frontier-command/" + p.slice(5));
paths.push("/frontier-command/");
await writeFile(
  "dist/sw.js",
  `const CACHE='frontier-command:${version}';const SHELL='/frontier-command/';const ASSETS=${JSON.stringify(paths)};
self.addEventListener('install',event=>event.waitUntil((async()=>{const cache=await caches.open(CACHE);await cache.addAll(ASSETS);})()));
self.addEventListener('message',event=>{if(event.data?.type==='APPLY_UPDATE')event.waitUntil(self.skipWaiting());});
self.addEventListener('activate',event=>event.waitUntil((async()=>{await self.clients.claim();const keys=await caches.keys();const old=keys.filter(k=>k.startsWith('frontier-command:')&&k!==CACHE);/* Keep one prior shell as a fallback. Saves are in IndexedDB and never touched. */for(const key of old.slice(0,-1))await caches.delete(key);})()));
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin||!url.pathname.startsWith(SHELL))return;/* Versioned theme downloads use a separate IndexedDB store in ThemeManager. Keep shell reads out of those concurrent writes. */if(url.pathname.startsWith(SHELL+'themes/')&&url.searchParams.has('v'))return;event.respondWith((async()=>{const cache=await caches.open(CACHE);if(url.pathname===SHELL+'recover.html'){try{const response=await fetch(event.request);if(response.ok)return response;}catch{}return await cache.match(SHELL+'recover.html')??Response.error();}const cached=await cache.match(event.request,{ignoreSearch:event.request.mode==='navigate',ignoreVary:true});if(cached)return cached;if(event.request.mode==='navigate')return await cache.match(SHELL+'index.html')??fetch(event.request);for(const key of (await caches.keys()).filter(key=>key.startsWith('frontier-command:')&&key!==CACHE)){const previous=await (await caches.open(key)).match(event.request,{ignoreVary:true});if(previous)return previous;}return fetch(event.request);})());});
`,
);
console.log(
  "Offline shell " + version + " precaches " + paths.length + " local assets.",
);
