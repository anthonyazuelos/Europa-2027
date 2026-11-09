/**
 * "Reproduzir viagem": percorre os 21 dias em sequência. A câmera voa até a
 * cidade do dia, o painel mostra o roteiro e cada deslocamento se desenha no
 * mapa. Pode ser pausado; qualquer navegação manual encerra o tour.
 */
import { diaPorData, trechoPorId, trip } from "./data";
import { espera } from "./hooks";
import { caminho, navegar, type Rota, rotaAtual } from "./router";
import { useApp } from "./store";

let execucao = 0;
let esperada = "";

const ativo = (id: number) => id === execucao && useApp.getState().tour.ativo;

async function dormir(id: number, ms: number) {
  let resto = ms;
  while (resto > 0 && ativo(id)) {
    await espera(100);
    if (!useApp.getState().tour.pausado) resto -= 100;
  }
  return ativo(id);
}

function ir(rota: Rota) {
  esperada = caminho(rota);
  navegar(rota);
}

async function tocarTrecho(id: number, trechoId: string) {
  ir({ tipo: "trecho", id: trechoId });
  await espera(90); // deixa a rota aplicar a cena antes de assumir a câmera
  if (!ativo(id)) return false;
  const motor = useApp.getState().motor;
  if (motor) await motor.tocarTrecho(trechoId);
  return dormir(id, 700);
}

export async function iniciarTour() {
  const id = ++execucao;
  const app = useApp.getState();
  const rota = rotaAtual();
  let inicio = rota.tipo === "dia" ? trip.dias.findIndex((d) => d.data === rota.data) : 0;
  if (inicio < 0 || inicio >= trip.dias.length - 1) inicio = 0;

  app.definir({ tour: { ativo: true, pausado: false }, folha: "peek" });
  app.motor?.definirPausa(false);

  if (inicio === 0 && !(await tocarTrecho(id, "voo-ida"))) return;

  for (let i = inicio; i < trip.dias.length; i++) {
    const dia = trip.dias[i];
    const trechos = (dia.trechos ?? []).map((t) => trechoPorId.get(t)!);
    // Trechos que chegam à cidade do dia tocam antes; os que partem dela, depois.
    const corte = trechos.findIndex((t) => t.de === dia.cidade);
    const antes = corte < 0 ? trechos : trechos.slice(0, corte);
    const depois = corte < 0 ? [] : trechos.slice(corte);

    for (const t of antes) if (!(await tocarTrecho(id, t.id))) return;
    ir({ tipo: "dia", data: dia.data });
    if (!(await dormir(id, 5600))) return;
    for (const t of depois) if (!(await tocarTrecho(id, t.id))) return;
  }

  if (!ativo(id)) return;
  useApp.getState().definir({ tour: { ativo: false, pausado: false } });
  ir({ tipo: "europa" });
  useApp.getState().avisar("Fim da viagem: de volta ao Brasil");
}

export function alternarPausa() {
  const { tour, motor, definir } = useApp.getState();
  if (!tour.ativo) return;
  const pausado = !tour.pausado;
  definir({ tour: { ativo: true, pausado } });
  motor?.definirPausa(pausado);
}

export function pararTour() {
  execucao++;
  const { tour, motor, definir } = useApp.getState();
  if (!tour.ativo) return;
  definir({ tour: { ativo: false, pausado: false } });
  motor?.definirPausa(false);
}

// Navegação manual (clique, Esc, botão voltar do navegador) encerra o tour.
window.addEventListener("hashchange", () => {
  if (useApp.getState().tour.ativo && caminho(rotaAtual()) !== esperada) pararTour();
});

/** Dia em evidência na linha do tempo para a rota atual. */
export function diaDaRota(rota: Rota): string | null {
  if (rota.tipo === "dia") return rota.data;
  if (rota.tipo === "trecho") {
    const t = trechoPorId.get(rota.id)!;
    return diaPorData.has(t.dataHora.saida.data) ? t.dataHora.saida.data : trip.dias[0].data;
  }
  return null;
}
