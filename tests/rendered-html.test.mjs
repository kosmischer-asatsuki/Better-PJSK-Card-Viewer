import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
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
  assert.match(html, /og\.png/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("ships the complete manifest and social preview", async () => {
  const cards = JSON.parse(await readFile(new URL("../app/cards.json", import.meta.url), "utf8"));
  assert.equal(cards.length, 2354);
  assert.equal(new Set(cards.map((card) => card.character)).size, 26);
  assert.ok(cards.every((card) => card.imageUrl.startsWith("https://")));
  assert.ok(cards.some((card) => card.trained));
  await access(new URL("../public/og.png", import.meta.url));
  await assert.rejects(access(new URL("../app/_sites-preview", import.meta.url)));
});
