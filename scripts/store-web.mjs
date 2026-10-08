import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await cp(join(root, "css"), join(dist, "css"), { recursive: true });
await cp(join(root, "js"), join(dist, "js"), { recursive: true });
await cp(join(root, "assets"), join(dist, "assets"), { recursive: true });

let html = await readFile(join(root, "index.html"), "utf8");
html = html.replace(/<p\s+class="fine"\s+data-portal>[\s\S]*?<\/p>\s*/g, "");
html = html.replace(/<a\b[^>]*\sdata-portal\b[^>]*>[\s\S]*?<\/a>\s*/g, "");
html = html.replace(
  '<script type="module" src="js/game.js"></script>',
  `<script>
      window.__CRAWLER_API = "https://crawler.tabyen.workers.dev";
      window.__CRAWLER_STORE = true;
      window.__CRAWLER_EDITION = "paid";
    </script>
    <script type="module" src="js/game.js"></script>`
);
await writeFile(join(dist, "index.html"), html);
