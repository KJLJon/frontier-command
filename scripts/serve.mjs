import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../dist",
);
const base = "/frontier-command/";
const port = Number(process.env.PORT ?? 4180);
const types = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};
const server = http.createServer(async (req, res) => {
  try {
    let pathname = decodeURIComponent(
      new URL(req.url, "http://127.0.0.1").pathname,
    );
    if (pathname === "/frontier-command-recovery/") {
      const bytes = await readFile(path.join(root, "recover.html"));
      res.writeHead(200, {
        "Content-Type": "text/html",
        "Cache-Control": "no-store",
      });
      res.end(bytes);
      return;
    }
    if (pathname === "/") {
      res.writeHead(302, { Location: base });
      res.end();
      return;
    }
    if (!pathname.startsWith(base)) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const relative = pathname.slice(base.length) || "index.html",
      target = path.resolve(root, relative);
    if (!target.startsWith(root + path.sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    const bytes = await readFile(target);
    res.writeHead(200, {
      "Content-Type": types[path.extname(target)] ?? "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    res.end(bytes);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});
server.listen(port, "127.0.0.1", () =>
  console.log(
    `Frontier Command: http://127.0.0.1:${port}${base}\nKeep this window open while playing. Ctrl+C stops the server.`,
  ),
);
server.on("error", (e) => {
  console.error(
    e.code === "EADDRINUSE"
      ? `Port ${port} is already in use. If the game preview is open, use it; otherwise set PORT to another value.`
      : e.message,
  );
  process.exitCode = 1;
});
