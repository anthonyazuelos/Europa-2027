import { create } from "zustand";
import type { Camadas, Capacidades, GlobeEngine } from "./globe/engine";
import { lerRota } from "./router";

const CHAVE_RESERVAS = "europa2027:reservas";

function lerReservas(): Record<string, boolean> {
  try {
    const bruto = localStorage.getItem(CHAVE_RESERVAS);
    const dados = bruto ? JSON.parse(bruto) : {};
    return dados && typeof dados === "object" ? dados : {};
  } catch {
    return {};
  }
}

function gravarReservas(feitas: Record<string, boolean>) {
  try {
    localStorage.setItem(CHAVE_RESERVAS, JSON.stringify(feitas));
  } catch {
    // Sem armazenamento (aba privada, site bloqueado): o status vale só nesta visita.
  }
}

export type Fase = "carregando" | "intro" | "pronto";
export type AlturaFolha = "peek" | "meio" | "cheio";

interface Estado {
  motor: GlobeEngine | null;
  fase: Fase;
  erroGlobo: string | null;
  capacidades: Capacidades | null;
  camadas: Camadas;
  /** Cidades já tocadas pela animação de abertura. */
  alcancadas: Set<string>;

  buscaAberta: boolean;
  infoAberta: boolean;
  folha: AlturaFolha;
  aviso: string | null;

  trechoSobCursor: { id: string; x: number; y: number } | null;
  paisSobCursor: string | null;

  tour: { ativo: boolean; pausado: boolean };
  /** Duração (s) do voo de câmera em curso: as entradas da UI terminam junto com o pouso. */
  voo: number;

  /** id da reserva → já feita? (salvo no navegador) */
  reservasFeitas: Record<string, boolean>;

  definir: (parcial: Partial<Estado>) => void;
  alcancar: (cidadeId: string) => void;
  alternarReserva: (id: string) => void;
  definirCamadas: (c: Camadas) => void;
  avisar: (texto: string) => void;
}

let relogioAviso: ReturnType<typeof setTimeout> | undefined;

export const useApp = create<Estado>((set, get) => ({
  motor: null,
  // A abertura completa só existe na visão geral; um link direto já mostra o painel.
  fase: lerRota(location.hash).tipo === "europa" ? "carregando" : "pronto",
  erroGlobo: null,
  capacidades: null,
  camadas: { rotulos: true, relevo: true, predios: true, luz: false },
  alcancadas: new Set(),

  buscaAberta: false,
  infoAberta: false,
  folha: "peek",
  aviso: null,

  trechoSobCursor: null,
  paisSobCursor: null,

  tour: { ativo: false, pausado: false },
  voo: 0,

  reservasFeitas: lerReservas(),

  definir: (parcial) => set(parcial),
  alcancar: (cidadeId) => {
    if (get().alcancadas.has(cidadeId)) return;
    set({ alcancadas: new Set(get().alcancadas).add(cidadeId) });
  },
  alternarReserva: (id) => {
    const feitas = { ...get().reservasFeitas, [id]: !get().reservasFeitas[id] };
    set({ reservasFeitas: feitas });
    gravarReservas(feitas);
  },
  definirCamadas: (camadas) => {
    set({ camadas });
    get().motor?.definirCamadas(camadas);
  },
  avisar: (texto) => {
    set({ aviso: texto });
    clearTimeout(relogioAviso);
    relogioAviso = setTimeout(() => set({ aviso: null }), 2600);
  },
}));
