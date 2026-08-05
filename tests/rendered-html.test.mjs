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
  assert.match(html, /PJSK 卡面预览器/);
  assert.match(html, /2354/);
  assert.match(html, /筛选卡面/);
  assert.match(html, /卡面花色/);
  assert.match(html, /游戏内星级/);
  assert.match(html, /中文/);
  assert.match(html, /日本語/);
  assert.match(html, /English/);
  assert.match(html, /评分文件/);
  assert.match(html, /\/pjsk_thumbs\//);
  assert.match(html, /\/character-icons\//);
  assert.match(html, /\/filter-icons\/groups\/leo-need\.png/);
  assert.match(html, /\/filter-icons\/attributes\/cool\.svg/);
  assert.match(html, /og\.png/);
  assert.doesNotMatch(html, /static\.wikia\.nocookie\.net/i);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("ships multilingual card data, a fully localized interface, local Wiki icons, and portable ratings", async () => {
  const [cardsSource, browserSource, i18nSource, cssSource, pluginSource, ratingsSource, metadataSource, titlesSource, iconFiles, filterIconFiles] = await Promise.all([
    readFile(new URL("../app/cards.json", import.meta.url), "utf8"),
    readFile(new URL("../app/CardBrowser.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/i18n.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../build/local-card-assets-vite-plugin.ts", import.meta.url), "utf8"),
    readFile(new URL("../data/ratings.json", import.meta.url), "utf8"),
    readFile(new URL("../data/card-metadata.json", import.meta.url), "utf8"),
    readFile(new URL("../data/card-titles.json", import.meta.url), "utf8"),
    readdir(new URL("../public/character-icons/", import.meta.url)),
    readdir(new URL("../public/filter-icons/", import.meta.url), { recursive: true }),
  ]);
  const cards = JSON.parse(cardsSource);
  const ratings = JSON.parse(ratingsSource);
  const metadata = JSON.parse(metadataSource);
  const titles = JSON.parse(titlesSource);
  const attributes = new Set(["cool", "cute", "happy", "mysterious", "pure"]);
  const rarities = new Set(["1", "2", "3", "4", "3-trained", "4-trained", "birthday"]);
  assert.equal(cards.length, 2354);
  assert.equal(new Set(cards.map((card) => card.character)).size, 26);
  assert.ok(cards.every((card) => !("imageUrl" in card)));
  assert.ok(cards.some((card) => card.trained));
  assert.ok(cards.every((card) => attributes.has(card.attribute)));
  assert.ok(cards.every((card) => rarities.has(card.rarity)));
  assert.ok(cards.every((card) => Number.isInteger(card.sekaiId)));
  assert.ok(cards.every((card) => new Set(Object.keys(card.titles)).size === 3));
  assert.deepEqual(cards.find((card) => card.sekaiId === 4)?.titles, {
    zh: "黎明前的倾诉",
    ja: "夜明け前の語らい",
    en: "Words Before Dawn",
  });
  assert.equal(new Set(cards.map((card) => card.attribute)).size, 5);
  assert.equal(new Set(cards.map((card) => card.rarity)).size, 7);
  assert.match(browserSource, /pjsk-card-ratings-v1/);
  assert.match(browserSource, /localStorage\.getItem\(STORAGE_KEY\)/);
  assert.match(browserSource, /localStorage\.setItem\(STORAGE_KEY/);
  assert.match(browserSource, /\/api\/local-ratings/);
  assert.match(browserSource, /\/character-icons\//);
  assert.match(browserSource, /cardTitle\(card, language\)/);
  assert.match(browserSource, /document\.documentElement\.lang = LANGUAGE_TAGS\[language\]/);
  assert.match(browserSource, /card-rarity-icon/);
  assert.match(browserSource, /aria-pressed=/);
  assert.doesNotMatch(browserSource, /view-mode-switch|card-type-badge|setViewMode/);
  assert.match(i18nSource, /カードを絞り込む/);
  assert.match(i18nSource, /Filter Cards/);
  assert.match(i18nSource, /すべてリセット/);
  assert.match(i18nSource, /Reset All/);
  assert.match(cssSource, /\.card-wiki-badges \.card-rarity-icon\.is-trained[\s\S]*?rotate\(-90deg\)/);
  assert.match(pluginSource, /pathname === "\/api\/local-ratings"/);
  assert.equal(ratings.version, 1);
  assert.equal(typeof ratings.ratings, "object");
  assert.equal(metadata.version, 1);
  assert.equal(metadata.source, "https://projectsekai.fandom.com/wiki/Card_List");
  assert.ok(Object.keys(metadata.cards).length >= cards.length);
  assert.ok(cards.every((card) => new Set(Object.keys(metadata.cards[card.id]?.titles ?? {})).size === 3));
  assert.equal(titles.version, 1);
  assert.equal(titles.source, "https://sekai.best/card");
  assert.equal(Object.keys(titles.cards).length, new Set(cards.map((card) => card.sekaiId)).size);
  assert.equal(iconFiles.filter((file) => file.endsWith(".png")).length, 26);
  assert.equal(filterIconFiles.filter((file) => /\.(png|svg)$/i.test(file)).length, 18);
  await access(new URL("../public/og.png", import.meta.url));
  await assert.rejects(access(new URL("../app/_sites-preview", import.meta.url)));
});
