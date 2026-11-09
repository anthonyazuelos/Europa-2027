import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

// Workers, texturas e dados que o Cesium carrega em tempo de execução.
// O código do Cesium em si entra num chunk separado, carregado sob demanda.
const CESIUM = "node_modules/cesium/Build/Cesium";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    // "./" funciona na Vercel e no GitHub Pages (as rotas ficam no hash).
    // Para forçar um caminho, defina VITE_BASE, ex.: VITE_BASE=/meu-repo/
    base: env.VITE_BASE || "./",
    plugins: [
      react(),
      tailwindcss(),
      viteStaticCopy({
        targets: ["Workers", "ThirdParty", "Assets"].map((pasta) => ({
          src: `${CESIUM}/${pasta}/**/*`,
          dest: `cesium/${pasta}`,
          rename: { stripBase: 5 },
        })),
      }),
    ],
    build: {
      chunkSizeWarningLimit: 6000,
      sourcemap: false,
    },
    server: { port: 5173 },
  };
});
