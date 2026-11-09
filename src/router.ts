/**
 * Rotas no hash: #/ · #/pais/:id · #/cidade/:id · #/local/:id · #/dia/:data ·
 * #/trecho/:id · #/reservas. Cada link abre direto no ponto, com o voo de câmera.
 */
import { useSyncExternalStore } from "react";
import {
  cidadeDoLocal,
  cidadePorId,
  diaPorData,
  localPorId,
  paisDaCidade,
  paisDoLocal,
  paisPorId,
  rotuloDoDia,
  trechoPorId,
} from "./data";

export type Rota =
  | { tipo: "europa" }
  | { tipo: "pais"; id: string }
  | { tipo: "cidade"; id: string }
  | { tipo: "local"; id: string }
  | { tipo: "dia"; data: string }
  | { tipo: "trecho"; id: string }
  | { tipo: "reservas" };

const EUROPA: Rota = { tipo: "europa" };

export function lerRota(hash: string): Rota {
  const [, tipo, id] = decodeURIComponent(hash.replace(/^#/, "")).split("/");
  switch (tipo) {
    case "pais":
      return paisPorId.has(id) ? { tipo, id } : EUROPA;
    case "cidade":
      return cidadePorId.has(id) ? { tipo, id } : EUROPA;
    case "local":
      return localPorId.has(id) ? { tipo, id } : EUROPA;
    case "dia":
      return diaPorData.has(id) ? { tipo, data: id } : EUROPA;
    case "trecho":
      return trechoPorId.has(id) ? { tipo, id } : EUROPA;
    case "reservas":
      return { tipo };
    default:
      return EUROPA;
  }
}

export function caminho(r: Rota): string {
  switch (r.tipo) {
    case "europa":
      return "/";
    case "reservas":
      return "/reservas";
    case "dia":
      return `/dia/${r.data}`;
    default:
      return `/${r.tipo}/${r.id}`;
  }
}

export const href = (r: Rota | string) => `#${typeof r === "string" ? r : caminho(r)}`;

export function navegar(r: Rota | string) {
  const destino = href(r);
  if (location.hash !== destino) location.hash = destino;
}

/** Um nível acima: é o que o Esc e o botão Voltar fazem. */
export function rotaPai(r: Rota): Rota | null {
  switch (r.tipo) {
    case "europa":
      return null;
    case "local": {
      const local = localPorId.get(r.id)!;
      return { tipo: "cidade", id: local.cityId };
    }
    case "cidade": {
      const cidade = cidadePorId.get(r.id)!;
      return { tipo: "pais", id: cidade.countryId };
    }
    case "dia":
      return { tipo: "cidade", id: diaPorData.get(r.data)!.cidade };
    default:
      return EUROPA;
  }
}

export interface Migalha {
  rotulo: string;
  rota: Rota;
}

export function migalhas(r: Rota): Migalha[] {
  const trilha: Migalha[] = [{ rotulo: "Europa", rota: EUROPA }];
  const pais = (id: string) => trilha.push({ rotulo: paisPorId.get(id)!.nome, rota: { tipo: "pais", id } });
  const cidade = (id: string) => {
    const c = cidadePorId.get(id)!;
    pais(paisDaCidade(c).id);
    trilha.push({ rotulo: c.nome, rota: { tipo: "cidade", id } });
  };
  switch (r.tipo) {
    case "pais":
      pais(r.id);
      break;
    case "cidade":
      cidade(r.id);
      break;
    case "local": {
      const local = localPorId.get(r.id)!;
      const c = cidadeDoLocal(local);
      pais(paisDaCidade(c).id);
      trilha.push({ rotulo: c.nome, rota: { tipo: "cidade", id: c.id } });
      if (paisDoLocal(local).id !== c.countryId) {
        const p = paisDoLocal(local);
        trilha.push({ rotulo: p.nome, rota: { tipo: "pais", id: p.id } });
      }
      trilha.push({ rotulo: local.nome, rota: r });
      break;
    }
    case "dia": {
      const dia = diaPorData.get(r.data)!;
      cidade(dia.cidade);
      trilha.push({ rotulo: rotuloDoDia(dia), rota: r });
      break;
    }
    case "trecho":
      trilha.push({ rotulo: trechoPorId.get(r.id)!.titulo, rota: r });
      break;
    case "reservas":
      trilha.push({ rotulo: "Reservas", rota: r });
      break;
  }
  return trilha;
}

function assinar(cb: () => void) {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
}

let cacheHash = "";
let cacheRota: Rota = EUROPA;
function instantaneo(): Rota {
  if (location.hash !== cacheHash) {
    cacheHash = location.hash;
    cacheRota = lerRota(cacheHash);
  }
  return cacheRota;
}

export const useRota = () => useSyncExternalStore(assinar, instantaneo);
export const rotaAtual = instantaneo;
