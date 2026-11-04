import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { app } from "./app.js";

const port = Number(process.env.PORT) || 5000;
const isProduction = process.env.NODE_ENV === "production";
const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

if (isProduction) {
  const staticDirectory = path.resolve(currentDirectory, "public");
  app.use(express.static(staticDirectory));
  app.get("*", (_request, response) => {
    response.sendFile(path.join(staticDirectory, "index.html"));
  });
} else {
  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({
    configFile: path.resolve(process.cwd(), "vite.config.ts"),
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
}

app.listen(port, "0.0.0.0", () => {
  console.log(`Wanderlist is listening on port ${port}`);
});
