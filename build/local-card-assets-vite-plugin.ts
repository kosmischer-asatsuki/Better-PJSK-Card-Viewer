import { createReadStream } from "node:fs";
import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Plugin } from "vite";

const mounts = [
  { prefix: "/pjsk_cards/", directory: "pjsk_cards", contentType: "image/png" },
  { prefix: "/pjsk_thumbs/", directory: "pjsk_thumbs", contentType: "image/webp" },
];

export function localCardAssets(): Plugin {
  return {
    name: "pjsk-local-card-assets",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;

        if (pathname === "/api/local-ratings") {
          const ratingsPath = path.resolve(process.cwd(), "data", "ratings.json");
          response.setHeader("Content-Type", "application/json; charset=utf-8");
          response.setHeader("Cache-Control", "no-store");

          try {
            if (request.method === "GET") {
              response.statusCode = 200;
              response.end(await readFile(ratingsPath, "utf8"));
              return;
            }

            if (request.method === "PUT") {
              const chunks: Buffer[] = [];
              let size = 0;
              for await (const chunk of request) {
                const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
                size += buffer.length;
                if (size > 2 * 1024 * 1024) throw new Error("评分文件过大");
                chunks.push(buffer);
              }

              const payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
              if (!payload || typeof payload.ratings !== "object" || Array.isArray(payload.ratings)) {
                throw new Error("评分文件格式无效");
              }

              const ratings: Record<string, number> = {};
              for (const [cardId, rating] of Object.entries(payload.ratings)) {
                if (Number.isInteger(rating) && Number(rating) >= 1 && Number(rating) <= 5) {
                  ratings[cardId] = Number(rating);
                }
              }

              const saved = {
                version: 1,
                updatedAt: new Date().toISOString(),
                ratings,
              };
              await writeFile(ratingsPath, `${JSON.stringify(saved, null, 2)}\n`, "utf8");
              response.statusCode = 200;
              response.end(JSON.stringify(saved));
              return;
            }

            response.statusCode = 405;
            response.end(JSON.stringify({ error: "Method not allowed" }));
          } catch (error) {
            response.statusCode = 400;
            response.end(JSON.stringify({ error: error instanceof Error ? error.message : "评分文件写入失败" }));
          }
          return;
        }

        const mount = mounts.find(({ prefix }) => pathname.startsWith(prefix));
        if (!mount) return next();

        try {
          const relativeUrl = decodeURIComponent(pathname.slice(mount.prefix.length));
          const root = path.resolve(process.cwd(), mount.directory);
          const requestedPath = path.resolve(root, relativeUrl.replaceAll("/", path.sep));

          if (requestedPath !== root && !requestedPath.startsWith(`${root}${path.sep}`)) {
            response.statusCode = 403;
            response.end("Forbidden");
            return;
          }

          const file = await stat(requestedPath);
          if (!file.isFile()) return next();

          response.statusCode = 200;
          response.setHeader("Content-Type", mount.contentType);
          response.setHeader("Content-Length", file.size);
          response.setHeader("Cache-Control", "private, max-age=86400");
          createReadStream(requestedPath).pipe(response);
        } catch {
          next();
        }
      });
    },
  };
}
