/** Céu estrelado nítido e posição real do sol, sem depender do Cesium. */

/** Gerador determinístico: o céu é o mesmo a cada visita. */
function sorteio(semente: number) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TONS = ["255,255,255", "214,226,255", "255,241,214", "196,214,255", "255,226,196"];

function face(tamanho: number, semente: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = tamanho;
  const g = c.getContext("2d")!;
  g.fillStyle = "#000";
  g.fillRect(0, 0, tamanho, tamanho);
  const r = sorteio(semente);
  const escala = tamanho / 1024;
  const total = Math.round(1900 * escala * escala);
  for (let i = 0; i < total; i++) {
    const x = r() * tamanho;
    const y = r() * tamanho;
    // Muitas estrelas fracas, poucas fortes.
    const brilho = Math.pow(r(), 5);
    const raio = (0.4 + brilho * 0.85) * Math.max(1, escala * 0.75);
    const tom = TONS[Math.floor(r() * TONS.length)];
    g.fillStyle = `rgba(${tom},${(0.28 + brilho * 0.72).toFixed(3)})`;
    g.beginPath();
    g.arc(x, y, raio, 0, Math.PI * 2);
    g.fill();
    // Só as mais fortes ganham um halo curto: ponto nítido, sem virar bolha.
    if (brilho > 0.8) {
      const halo = g.createRadialGradient(x, y, 0, x, y, raio * 3);
      halo.addColorStop(0, `rgba(${tom},0.2)`);
      halo.addColorStop(1, `rgba(${tom},0)`);
      g.fillStyle = halo;
      g.beginPath();
      g.arc(x, y, raio * 3, 0, Math.PI * 2);
      g.fill();
    }
  }
  return c;
}

/** As seis faces do céu, prontas para um SkyBox. */
export function ceuEstrelado(tamanho: number) {
  return {
    positiveX: face(tamanho, 11),
    negativeX: face(tamanho, 23),
    positiveY: face(tamanho, 37),
    negativeY: face(tamanho, 41),
    positiveZ: face(tamanho, 53),
    negativeZ: face(tamanho, 67),
  };
}

/**
 * Hora do pôr do sol (UTC) para uma data e um lugar, pela aproximação da NOAA.
 * Erro de poucos minutos: é para posicionar o sol, não para marcar compromisso.
 */
export function porDoSol(iso: string, lat: number, lon: number): Date {
  const [ano, mes, dia] = iso.split("-").map(Number);
  const inicioDoAno = Date.UTC(ano, 0, 1);
  const meiaNoite = Date.UTC(ano, mes - 1, dia);
  const diaDoAno = Math.round((meiaNoite - inicioDoAno) / 86_400_000) + 1;
  const g = ((2 * Math.PI) / 365) * (diaDoAno - 1);
  const equacaoDoTempo =
    229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const declinacao =
    0.006918 -
    0.399912 * Math.cos(g) +
    0.070257 * Math.sin(g) -
    0.006758 * Math.cos(2 * g) +
    0.000907 * Math.sin(2 * g) -
    0.002697 * Math.cos(3 * g) +
    0.00148 * Math.sin(3 * g);
  const rad = Math.PI / 180;
  const cosH = Math.cos(90.833 * rad) / (Math.cos(lat * rad) * Math.cos(declinacao)) - Math.tan(lat * rad) * Math.tan(declinacao);
  const anguloHorario = Math.acos(Math.min(1, Math.max(-1, cosH))) / rad;
  const minutos = 720 - 4 * (lon - anguloHorario) - equacaoDoTempo;
  return new Date(meiaNoite + minutos * 60_000);
}
