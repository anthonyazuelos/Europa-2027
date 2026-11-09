/**
 * Acesso aos dados do roteiro: índices por id e consultas derivadas.
 * A UI e o globo importam daqui; o conteúdo em si fica em trip.ts.
 */
import { trip as bruto } from "./trip";
import { IMAGENS } from "./imagens";
import type { City, Country, Day, ItemRoteiro, LatLon, Leg, Place, Reservation, Trip } from "./schema";

export type * from "./schema";

export const trip: Trip = {
  ...bruto,
  cidades: bruto.cidades.map((c) => ({ ...c, imagem: c.imagem ?? IMAGENS.cidades[c.id] })),
  locais: bruto.locais.map((l) => ({ ...l, imagem: l.imagem ?? IMAGENS.locais[l.id] })),
};

if (import.meta.env?.DEV) {
  // Em desenvolvimento, valida a cada recarga e mostra os erros no console.
  import("./schema").then(({ TripSchema }) => {
    const r = TripSchema.safeParse(bruto);
    if (!r.success) {
      console.error(
        "trip.ts tem problemas:\n" + r.error.issues.map((i) => `• ${i.path.join(".")}: ${i.message}`).join("\n"),
      );
    }
  });
}

const indice = <T, K extends string>(itens: T[], chave: (t: T) => K) => new Map(itens.map((i) => [chave(i), i]));

export const paisPorId = indice(trip.paises, (p) => p.id);
export const cidadePorId = indice(trip.cidades, (c) => c.id);
export const localPorId = indice(trip.locais, (l) => l.id);
export const trechoPorId = indice(trip.trechos, (t) => t.id);
export const diaPorData = indice(trip.dias, (d) => d.data);
export const reservaPorId = indice(trip.reservas, (r) => r.id);
const pontoPorId = indice(trip.viagem.pontos, (p) => p.id);

/** Cidades-base na ordem da viagem: é a numeração dos marcadores. */
export const bases: City[] = trip.cidades.filter((c) => c.tipo === "base");
export const numeroDaBase = (id: string) => bases.findIndex((c) => c.id === id) + 1;

export const paisDaCidade = (c: City): Country => paisPorId.get(c.countryId)!;
export const paisDoLocal = (l: Place): Country => paisPorId.get(l.countryId ?? cidadePorId.get(l.cityId)!.countryId)!;
export const cidadeDoLocal = (l: Place): City => cidadePorId.get(l.cityId)!;

export const cidadesDoPais = (id: string): City[] => trip.cidades.filter((c) => c.countryId === id);
export const locaisDaCidade = (id: string): Place[] => trip.locais.filter((l) => l.cityId === id);
export const locaisDoPais = (id: string): Place[] => trip.locais.filter((l) => paisDoLocal(l).id === id);

export const blocosDoDia = (d: Day) =>
  [
    { chave: "manha", rotulo: "Manhã", bloco: d.manha },
    { chave: "tarde", rotulo: "Tarde", bloco: d.tarde },
    { chave: "porDoSol", rotulo: "Pôr do sol", bloco: d.porDoSol },
    { chave: "noite", rotulo: "Noite", bloco: d.noite },
  ] as const;

export const itensDoDia = (d: Day): ItemRoteiro[] => blocosDoDia(d).flatMap((b) => b.bloco?.itens ?? []);

/** Locais do dia na ordem do roteiro, sem repetição. */
export function locaisDoDia(d: Day): Place[] {
  const vistos = new Set<string>();
  const saida: Place[] = [];
  for (const item of itensDoDia(d)) {
    if (item.local && !vistos.has(item.local)) {
      vistos.add(item.local);
      saida.push(localPorId.get(item.local)!);
    }
  }
  return saida;
}

/** Dias em que a cidade aparece (principal, extra ou via algum local). */
export function diasDaCidade(id: string): Day[] {
  return trip.dias.filter(
    (d) =>
      d.cidade === id ||
      d.cidadesExtras?.includes(id) ||
      itensDoDia(d).some((i) => i.local && localPorId.get(i.local)?.cityId === id),
  );
}

/** Vizinhos do local na sequência do seu dia. */
export function vizinhosNoDia(l: Place): { dia?: Day; anterior?: Place; proximo?: Place; posicao: number; total: number } {
  const dia =
    trip.dias.find((d) => d.data === l.dia && itensDoDia(d).some((i) => i.local === l.id)) ??
    trip.dias.find((d) => itensDoDia(d).some((i) => i.local === l.id));
  if (!dia) return { posicao: 0, total: 0 };
  const lista = locaisDoDia(dia);
  const i = lista.findIndex((x) => x.id === l.id);
  return { dia, anterior: lista[i - 1], proximo: lista[i + 1], posicao: i + 1, total: lista.length };
}

export const nomeDaPonta = (id: string) => cidadePorId.get(id)?.nome ?? pontoPorId.get(id)?.nome ?? id;
export const caminhoDoTrecho = (t: Leg): LatLon[] => t.paradas.map((p) => p.coords);

/** Trechos que chegam ou partem da cidade, em ordem cronológica. */
export function trechosDaCidade(id: string): { chegada: Leg[]; saida: Leg[] } {
  return {
    chegada: trip.trechos.filter((t) => t.para === id && t.modal !== "bate-volta"),
    saida: trip.trechos.filter((t) => t.de === id),
  };
}

/** Países tocados por um trecho (pontas + cidades de travessia no caminho). */
export function paisesDoTrecho(t: Leg): string[] {
  const ids = new Set<string>();
  for (const ponta of [t.de, t.para]) {
    const c = cidadePorId.get(ponta);
    if (c) ids.add(c.countryId);
  }
  if (t.id === "sleeper-amsterda-praga") ids.add("alemanha");
  return [...ids];
}

export const reservasDaCidade = (id: string): Reservation[] => trip.reservas.filter((r) => r.cidade === id);

/* ---------------------------------------------------------------- datas */

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const SEMANA_LONGA: Record<string, string> = {
  seg: "segunda",
  ter: "terça",
  qua: "quarta",
  qui: "quinta",
  sex: "sexta",
  sáb: "sábado",
  dom: "domingo",
};

/** "2027-01-30" → "30/jan" */
export function dataCurta(iso: string) {
  const [, m, d] = iso.split("-").map(Number);
  return `${d}/${MESES[m - 1]}`;
}

/** Dia do roteiro → "sáb 30/jan" */
export const rotuloDoDia = (d: Day) => `${d.diaSemana} ${dataCurta(d.data)}`;
export const rotuloLongoDoDia = (d: Day) => `${SEMANA_LONGA[d.diaSemana]}, ${dataCurta(d.data)}`;

/** Rótulo de uma data qualquer, com dia da semana se ela fizer parte do roteiro. */
export function rotuloDaData(iso: string) {
  const d = diaPorData.get(iso);
  return d ? rotuloDoDia(d) : dataCurta(iso);
}

export const numeroDoDia = (iso: string) => trip.dias.findIndex((d) => d.data === iso) + 1;
