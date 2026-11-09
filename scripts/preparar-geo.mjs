/**
 * Baixa as fronteiras do Natural Earth (1:50m para a Europa e vizinhos, 1:110m
 * para o resto do mundo) e grava um GeoJSON enxuto em public/geo/. Só precisa rodar de novo se quiser
 * atualizar as fronteiras: o app lê o arquivo local, sem CDN.
 *
 *   npm run geo
 */
import { writeFile, mkdir } from "node:fs/promises";

const FONTE =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson";
const SAIDA = new URL("../public/geo/paises-50m.geojson", import.meta.url);

// Janela: Europa com margem (norte da África, Turquia, Islândia).
const J = { oeste: -32, leste: 50, sul: 24, norte: 74 };

const DA_VIAGEM = ["PRT", "ESP", "FRA", "NLD", "DEU", "CZE", "AUT", "ITA", "VAT"];

const arredonda = (n) => Math.round(n * 1000) / 1000;

function caixa(anel) {
  let o = Infinity, l = -Infinity, s = Infinity, n = -Infinity;
  for (const [x, y] of anel) {
    if (x < o) o = x;
    if (x > l) l = x;
    if (y < s) s = y;
    if (y > n) n = y;
  }
  return { o, l, s, n };
}

function limpa(anel) {
  const saida = [];
  for (const [x, y] of anel) {
    const p = [arredonda(x), arredonda(y)];
    const ultimo = saida[saida.length - 1];
    if (!ultimo || ultimo[0] !== p[0] || ultimo[1] !== p[1]) saida.push(p);
  }
  return saida.length >= 4 ? saida : null;
}

const baixar = async (url) => {
  const resposta = await fetch(url);
  if (!resposta.ok) throw new Error(`Falha ao baixar ${url}: ${resposta.status}`);
  return resposta.json();
};
const poligonosDe = (f) => (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates);
const naJanela = (anel) => {
  const c = caixa(anel);
  return !(c.l < J.oeste || c.o > J.leste || c.n < J.sul || c.s > J.norte);
};
const area = (anel) => {
  const c = caixa(anel);
  return (c.l - c.o) * (c.n - c.s);
};

console.log("Baixando Natural Earth 1:50m e 1:110m…");
const [detalhado, simples] = await Promise.all([baixar(FONTE), baixar(FONTE.replace("ne_50m", "ne_110m"))]);

// Países que tocam a janela da Europa entram em 1:50m (inteiros, para o
// escurecimento não ter borda reta); o resto do mundo, em 1:110m.
const features = [];
const detalhados = new Set();
const monta = (f, poligonos) => {
  const mantidos = poligonos.map((p) => p.map(limpa).filter(Boolean)).filter((p) => p.length);
  if (!mantidos.length) return;
  features.push({
    type: "Feature",
    properties: { a3: f.properties.ADM0_A3, nome: f.properties.NAME_PT || f.properties.NAME },
    geometry: { type: "MultiPolygon", coordinates: mantidos },
  });
};
for (const f of detalhado.features) {
  const poligonos = poligonosDe(f);
  if (!poligonos.some((p) => naJanela(p[0]))) continue;
  detalhados.add(f.properties.ADM0_A3);
  // Fora da janela, ilhas minúsculas não fazem falta.
  monta(f, poligonos.filter((p) => naJanela(p[0]) || area(p[0]) > 4));
}
for (const f of simples.features) {
  const a3 = f.properties.ADM0_A3;
  if (a3 === "ATA") continue;
  if (!detalhados.has(a3)) {
    monta(f, poligonosDe(f));
    continue;
  }
  // Países da viagem levam também o contorno 1:110m: é o que a visão geral
  // desenha. O 1:50m entra só quando o país está em foco.
  if (!DA_VIAGEM.includes(a3)) continue;
  const alvo = features.find((x) => x.properties.a3 === a3);
  alvo.properties.simples = poligonosDe(f)
    .filter((p) => naJanela(p[0]))
    .map((p) => limpa(p[0]))
    .filter(Boolean);
}

await mkdir(new URL("../public/geo/", import.meta.url), { recursive: true });
const texto = JSON.stringify({ type: "FeatureCollection", features });
await writeFile(SAIDA, texto);
console.log(`${features.length} países, ${(texto.length / 1024).toFixed(0)} kB → public/geo/paises-50m.geojson`);
for (const a3 of DA_VIAGEM) {
  const f = features.find((x) => x.properties.a3 === a3);
  const pts = (aneis) => aneis.reduce((n, a) => n + a.length, 0);
  console.log(a3, f ? `1:50m ${pts(f.geometry.coordinates.map((p) => p[0]))} pts · 1:110m ${f.properties.simples ? pts(f.properties.simples) : "—"} pts` : "AUSENTE");
}
