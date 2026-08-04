import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
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
