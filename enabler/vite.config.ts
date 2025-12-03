import { resolve } from "path";
import { defineConfig } from "vite";
import cssInjectedByJsPlugin from "vite-plugin-css-injected-by-js";
import { readFileSync } from "fs";

export default defineConfig({
  plugins: [
    cssInjectedByJsPlugin({
      injectCodeFunction: function injectCodeCustomRunTimeFunction(cssCode: string, options) {
        try {
          if (typeof document != "undefined") {
            var elementStyle = document.createElement("style");
            elementStyle.setAttribute("data-ctc-connector-styles", "");
            for (const attribute in options.attributes) {
              elementStyle.setAttribute(attribute, options.attributes[attribute]);
            }
            elementStyle.appendChild(document.createTextNode(cssCode));
            document.head.appendChild(elementStyle);
          }
        } catch (e) {
          console.error("vite-plugin-css-injected-by-js", e);
        }
      },
    }),
    {
      name: "serve-well-known",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === "/.well-known/apple-developer-merchantid-domain-association.txt") {
            try {
              const content = readFileSync(
                resolve(__dirname, "public/.well-known/apple-developer-merchantid-domain-association.txt"),
                "utf-8"
              );
              res.setHeader("Content-Type", "text/plain");
              res.end(content);
            } catch (err) {
              res.statusCode = 404;
              res.end("Not found");
            }
          } else {
            next();
          }
        });
      },
    },
  ],
  server: {
    allowedHosts: ["7838b580e83a.ngrok.app"],
  },
  build: {
    outDir: resolve(__dirname, "public"),
    lib: {
      entry: resolve(__dirname, "src/main.ts"),
      name: "Connector",
      formats: ["es", "umd"],
      fileName: (format) => `connector-enabler.${format}.js`,
    },
  },
});