import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("https://pjsk-card-viewer.example/", {
      headers: { accept: "text/html", host: "pjsk-card-viewer.example" },
    }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the finished PJSK card gallery", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>PJSK 卡面档案室｜SEKAI ARCHIVE<\/title>/i);
  assert.match(html, /PJSK CARD VIEWER/);
  assert.match(html, /2354/);
  assert.match(html, /筛选卡面/);
  assert.match(html, /评分文件/);
  assert.match(html, /\/pjsk_thumbs\//);
  assert.match(html, /\/character-icons\//);
  assert.match(html, /og\.png/);
  assert.doesNotMatch(html, /static\.wikia\.nocookie\.net/i);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("ships the complete manifest, Wiki icons, and portable rating file", async () => {
  const [cardsSource, browserSource, pluginSource, ratingsSource, iconFiles] = await Promise.all([
    readFile(new URL("../app/cards.json", import.meta.url), "utf8"),
    readFile(new URL("../app/CardBrowser.tsx", import.meta.url), "utf8"),
    readFile(new URL("../build/local-card-assets-vite-plugin.ts", import.meta.url), "utf8"),
    readFile(new URL("../data/ratings.json", import.meta.url), "utf8"),
    readdir(new URL("../public/character-icons/", import.meta.url)),
  ]);
  const cards = JSON.parse(cardsSource);
  const ratings = JSON.parse(ratingsSource);
  assert.equal(cards.length, 2354);
  assert.equal(new Set(cards.map((card) => card.character)).size, 26);
  assert.ok(cards.every((card) => !("imageUrl" in card)));
  assert.ok(cards.some((card) => card.trained));
  assert.match(browserSource, /pjsk-card-ratings-v1/);
  assert.match(browserSource, /localStorage\.getItem\(STORAGE_KEY\)/);
  assert.match(browserSource, /localStorage\.setItem\(STORAGE_KEY/);
  assert.match(browserSource, /\/api\/local-ratings/);
  assert.match(browserSource, /\/character-icons\//);
  assert.match(pluginSource, /pathname === "\/api\/local-ratings"/);
  assert.equal(ratings.version, 1);
  assert.equal(typeof ratings.ratings, "object");
  assert.equal(iconFiles.filter((file) => file.endsWith(".png")).length, 26);
  await access(new URL("../public/og.png", import.meta.url));
  await assert.rejects(access(new URL("../app/_sites-preview", import.meta.url)));
});
