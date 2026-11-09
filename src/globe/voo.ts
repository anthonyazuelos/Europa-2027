/**
 * Matemática do voo de câmera, sem depender do Cesium.
 *
 * O caminho de zoom + deslocamento é o de van Wijk e Nuij ("Smooth and
 * efficient zooming and panning", 2003): a câmera sobe em arco, tanto mais
 * alto quanto maior a distância, e a velocidade percebida fica constante.
 * É a curva que dá a sensação de Google Earth.
 */

export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Cubic com o pouso um pouco mais longo que a decolagem. */
export const suavizarVoo = (t: number) => easeInOutCubic(1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 1.16));

export interface Zoom {
  /** Comprimento do caminho no espaço (deslocamento, zoom). */
  comprimento: number;
  /** Para uma fração f do caminho: quanto já andou no chão (0–1) e a distância da câmera. */
  em: (f: number) => { andado: number; distancia: number };
  /** Maior distância atingida no caminho (o topo do arco). */
  topo: number;
}

/**
 * @param chao distância no chão entre o alvo inicial e o final (m)
 * @param d0 distância inicial da câmera ao alvo (m)
 * @param d1 distância final (m)
 * @param rho curvatura: maior = arco mais baixo
 */
export function criarZoom(chao: number, d0: number, d1: number, rho = 1.35): Zoom {
  const rho2 = rho * rho;
  const rho4 = rho2 * rho2;

  if (chao < Math.min(d0, d1) * 1e-3) {
    // Mesmo lugar: só zoom, exponencial.
    const comprimento = Math.abs(Math.log(d1 / d0)) / rho;
    return {
      comprimento,
      topo: Math.max(d0, d1),
      em: (f) => ({ andado: f, distancia: d0 * Math.pow(d1 / d0, f) }),
    };
  }

  const b0 = (d1 * d1 - d0 * d0 + rho4 * chao * chao) / (2 * d0 * rho2 * chao);
  const b1 = (d1 * d1 - d0 * d0 - rho4 * chao * chao) / (2 * d1 * rho2 * chao);
  const r0 = Math.log(Math.sqrt(b0 * b0 + 1) - b0);
  const r1 = Math.log(Math.sqrt(b1 * b1 + 1) - b1);
  const comprimento = (r1 - r0) / rho;
  const coshR0 = Math.cosh(r0);
  const sinhR0 = Math.sinh(r0);

  const em = (f: number) => {
    const s = f * comprimento;
    const u = (d0 / rho2) * (coshR0 * Math.tanh(rho * s + r0) - sinhR0);
    return { andado: Math.min(1, Math.max(0, u / chao)), distancia: (d0 * coshR0) / Math.cosh(rho * s + r0) };
  };
  // O topo do arco fica onde rho*s + r0 = 0 (se cair dentro do caminho).
  const sTopo = -r0 / rho;
  const topo = sTopo > 0 && sTopo < comprimento ? d0 * coshR0 : Math.max(d0, d1);
  return { comprimento, em, topo };
}

/** Diferença angular mais curta de a até b, em radianos (-π…π). */
export function menorGiro(a: number, b: number) {
  let d = (b - a) % (2 * Math.PI);
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d < -Math.PI) d += 2 * Math.PI;
  return d;
}
