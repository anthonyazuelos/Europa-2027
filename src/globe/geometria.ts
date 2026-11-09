/** Geometria em lat/lon, sem depender do Cesium. */
import type { LatLon } from "../data/schema";

const RAD = Math.PI / 180;
const R_TERRA = 6_371_000;

export function distancia(a: LatLon, b: LatLon) {
  const dLat = (b[0] - a[0]) * RAD;
  const dLon = (b[1] - a[1]) * RAD;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * RAD) * Math.cos(b[0] * RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * R_TERRA * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function comprimento(pts: LatLon[]) {
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += distancia(pts[i - 1], pts[i]);
  return total;
}

/** Curva de Catmull-Rom passando por todos os pontos: tira as quinas do caminho. */
export function suavizar(pts: LatLon[], porSegmento = 10): LatLon[] {
  if (pts.length < 3) return densificar(pts, porSegmento * 2);
  const saida: LatLon[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 0; k < porSegmento; k++) {
      const t = k / porSegmento;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      saida.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  saida.push(pts[pts.length - 1]);
  return saida;
}

export function densificar(pts: LatLon[], n: number): LatLon[] {
  const saida: LatLon[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    for (let k = 0; k < n; k++) {
      const t = k / n;
      saida.push([pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t]);
    }
  }
  saida.push(pts[pts.length - 1]);
  return saida;
}

/** Distância acumulada (0…1) de cada ponto ao longo do caminho. */
export function fracoes(pts: LatLon[]): number[] {
  const acumulado = [0];
  for (let i = 1; i < pts.length; i++) acumulado.push(acumulado[i - 1] + distancia(pts[i - 1], pts[i]));
  const total = acumulado[acumulado.length - 1] || 1;
  return acumulado.map((d) => d / total);
}

/** Índice (fracionário) do ponto que fica na fração t do caminho. */
export function indiceNaFracao(fr: number[], t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return fr.length - 1;
  let lo = 0;
  let hi = fr.length - 1;
  while (hi - lo > 1) {
    const meio = (lo + hi) >> 1;
    if (fr[meio] <= t) lo = meio;
    else hi = meio;
  }
  const vao = fr[hi] - fr[lo] || 1;
  return lo + (t - fr[lo]) / vao;
}

export function pontoMedio(pts: LatLon[]): LatLon {
  const fr = fracoes(pts);
  const i = indiceNaFracao(fr, 0.5);
  const a = pts[Math.floor(i)];
  const b = pts[Math.min(pts.length - 1, Math.floor(i) + 1)];
  const f = i - Math.floor(i);
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
}

/* ------------------------------------------------------------ polígonos */

export type Anel = [number, number][]; // [lon, lat]
export interface Pais {
  a3: string;
  nome: string;
  poligonos: Anel[][];
  caixa: [number, number, number, number]; // oeste, sul, leste, norte
}

export function caixaDoAnel(anel: Anel): [number, number, number, number] {
  let o = Infinity;
  let s = Infinity;
  let l = -Infinity;
  let n = -Infinity;
  for (const [x, y] of anel) {
    if (x < o) o = x;
    if (x > l) l = x;
    if (y < s) s = y;
    if (y > n) n = y;
  }
  return [o, s, l, n];
}

function dentroDoAnel(lon: number, lat: number, anel: Anel) {
  let dentro = false;
  for (let i = 0, j = anel.length - 1; i < anel.length; j = i++) {
    const [xi, yi] = anel[i];
    const [xj, yj] = anel[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

export function dentroDoPais(lon: number, lat: number, p: Pais) {
  const [o, s, l, n] = p.caixa;
  if (lon < o || lon > l || lat < s || lat > n) return false;
  for (const poligono of p.poligonos) {
    if (!dentroDoAnel(lon, lat, poligono[0])) continue;
    let emBuraco = false;
    for (let i = 1; i < poligono.length; i++) if (dentroDoAnel(lon, lat, poligono[i])) emBuraco = true;
    if (!emBuraco) return true;
  }
  return false;
}

export const suave = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
export const limitar = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

/** Reamostra o caminho em pontos igualmente espaçados (por distância). */
export function reamostrar(pts: LatLon[], passo: number, minimo = 32, maximo = 480): LatLon[] {
  const fr = fracoes(pts);
  const total = comprimento(pts);
  const n = Math.max(minimo, Math.min(maximo, Math.round(total / passo)));
  const saida: LatLon[] = [];
  for (let k = 0; k <= n; k++) {
    const i = indiceNaFracao(fr, k / n);
    const a = Math.floor(i);
    const b = Math.min(pts.length - 1, a + 1);
    const f = i - a;
    saida.push([pts[a][0] + (pts[b][0] - pts[a][0]) * f, pts[a][1] + (pts[b][1] - pts[a][1]) * f]);
  }
  return saida;
}

/** Subdivide um anel [lon, lat] para que nenhum segmento passe de `maxGraus`. */
export function densificarAnel(anel: Anel, maxGraus = 0.12): Anel {
  const saida: Anel = [];
  for (let i = 0; i < anel.length - 1; i++) {
    const [x0, y0] = anel[i];
    const [x1, y1] = anel[i + 1];
    const partes = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) / maxGraus));
    for (let k = 0; k < partes; k++) saida.push([x0 + ((x1 - x0) * k) / partes, y0 + ((y1 - y0) * k) / partes]);
  }
  return saida;
}

export const mistura = (a: number, b: number, t: number) => a + (b - a) * t;
