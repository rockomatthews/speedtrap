import { fileURLToPath } from "node:url";
export default {
  poweredByHeader: false,
  output: "standalone",
  turbopack: { root: fileURLToPath(new URL(".", import.meta.url)) }
};
