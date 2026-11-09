/** Traduz a rota da URL em cena do globo, alvo de câmera e marcadores. */
import {
  caminhoDoTrecho,
  cidadePorId,
  diaPorData,
  locaisDaCidade,
  locaisDoDia,
  locaisDoPais,
  localPorId,
  numeroDaBase,
  paisPorId,
  trechoPorId,
  trip,
  vizinhosNoDia,
} from "../data";
import type { Categoria, LatLon } from "../data/schema";
import type { Rota } from "../router";
import type { AlvoCamera, Cena, GlobeEngine } from "./engine";
import { pontoMedio, suavizar } from "./geometria";

export interface Plano {
  cena: Cena;
  alvo: AlvoCamera;
  orbitar: boolean;
  caminho: LatLon[] | null;
  /** Dia em evidência: posiciona o sol quando "Dia e noite" está ligado. */
  data: string | null;
}

function alvoDoTrecho(motor: GlobeEngine, pontos: LatLon[], voo: boolean): AlvoCamera {
  const alvo = motor.alvoParaPontos(pontos, voo ? -88 : -62);
  return { ...alvo, range: Math.max(30_000, alvo.range) };
}

export function alvoDaCidade(id: string): AlvoCamera {
  const c = cidadePorId.get(id)!;
  const [lat, lon] = c.camera.alvo ?? c.coords;
  return { lat, lon, heading: c.camera.heading, pitch: c.camera.pitch, range: c.camera.range };
}

const europa = (): AlvoCamera => {
  const c = trip.viagem.camera;
  return { lat: c.alvo[0], lon: c.alvo[1], heading: c.heading, pitch: c.pitch, range: c.range };
};

export function planoDaRota(rota: Rota, motor: GlobeEngine): Plano {
  const plano = planoSemData(rota, motor);
  return { ...plano, data: dataDaRota(rota) };
}

function dataDaRota(rota: Rota): string | null {
  switch (rota.tipo) {
    case "dia":
      return rota.data;
    case "local":
      return localPorId.get(rota.id)!.dia;
    case "cidade":
      return cidadePorId.get(rota.id)!.datas.inicio;
    case "pais":
      return paisPorId.get(rota.id)!.datas.inicio;
    case "trecho": {
      const data = trechoPorId.get(rota.id)!.dataHora.saida.data;
      return diaPorData.has(data) ? data : null;
    }
    default:
      return null;
  }
}

function planoSemData(rota: Rota, motor: GlobeEngine): Omit<Plano, "data"> {
  switch (rota.tipo) {
    case "pais": {
      const p = paisPorId.get(rota.id)!;
      const alvo = { lat: p.camera.alvo[0], lon: p.camera.alvo[1], heading: p.camera.heading, pitch: p.camera.pitch, range: p.camera.range };
      // O Vaticano cabe em uma praça: é tratado como um zoom de cidade.
      if (p.dentroDe) return { cena: { nivel: "cidade" }, alvo, orbitar: true, caminho: null };
      return { cena: { nivel: "pais", paisId: p.id }, alvo, orbitar: false, caminho: null };
    }
    case "cidade":
      return { cena: { nivel: "cidade" }, alvo: alvoDaCidade(rota.id), orbitar: true, caminho: null };
    case "local": {
      const l = localPorId.get(rota.id)!;
      const { dia } = vizinhosNoDia(l);
      const caminho = dia ? locaisDoDia(dia).filter((x) => x.cityId === l.cityId).map((x) => x.coords) : null;
      return {
        cena: { nivel: "local" },
        alvo: { lat: l.coords[0], lon: l.coords[1], ...l.camera },
        orbitar: true,
        caminho,
      };
    }
    case "dia": {
      const d = diaPorData.get(rota.data)!;
      const c = cidadePorId.get(d.cidade)!;
      const caminho = locaisDoDia(d).filter((x) => x.cityId === c.id).map((x) => x.coords);
      // Com locais marcados, o enquadramento é o do roteiro do dia, não o da cidade inteira.
      let alvo = alvoDaCidade(c.id);
      if (caminho.length > 1) {
        const dosLocais = motor.alvoParaPontos(caminho, c.camera.pitch);
        alvo = { ...dosLocais, heading: c.camera.heading, range: Math.min(9000, Math.max(1400, dosLocais.range * 1.15)) };
      }
      return { cena: { nivel: "cidade" }, alvo, orbitar: true, caminho };
    }
    case "trecho": {
      const t = trechoPorId.get(rota.id)!;
      return {
        cena: { nivel: "europa", trechoId: t.id },
        alvo: alvoDoTrecho(motor, caminhoDoTrecho(t), t.modal === "voo"),
        orbitar: false,
        caminho: null,
      };
    }
    default:
      return { cena: { nivel: "europa" }, alvo: europa(), orbitar: false, caminho: null };
  }
}

/* -------------------------------------------------------------- marcadores */

export interface Marcador {
  id: string;
  lat: number;
  lon: number;
  tipo: "base" | "parada" | "batevolta" | "travessia" | "lua" | "local" | "ponto" | "pais" | "blondes";
  /** Para marcadores numéricos (brincadeira das loiras). */
  valor?: number;
  nome: string;
  sub?: string;
  numero?: number;
  categoria?: Categoria;
  ativo?: boolean;
  apagado?: boolean;
  /** Etiqueta sempre visível (senão, só no foco/hover). */
  fixa?: boolean;
  lado?: "dir" | "esq";
  rota: Rota;
}

const LADO_ESQUERDO = new Set(["lisboa", "paris", "kutna-hora", "toledo"]);
const TIPO_CIDADE = { base: "base", parada: "parada", "bate-volta": "batevolta", travessia: "travessia" } as const;

function marcadoresDeCidades(opcoes: { paisId?: string; alcancadas?: Set<string>; comTravessia?: boolean }): Marcador[] {
  const saida: Marcador[] = [];
  for (const c of trip.cidades) {
    if (opcoes.alcancadas && !opcoes.alcancadas.has(c.id)) continue;
    const doPais = opcoes.paisId ? c.countryId === opcoes.paisId : false;
    if (c.tipo === "travessia" && !doPais && !opcoes.comTravessia) continue;
    const foraDoFoco = Boolean(opcoes.paisId) && !doPais;
    saida.push({
      id: `cidade:${c.id}`,
      lat: c.coords[0],
      lon: c.coords[1],
      tipo: foraDoFoco ? "ponto" : TIPO_CIDADE[c.tipo],
      nome: c.nome,
      sub: doPais ? c.datas.rotulo : undefined,
      numero: c.tipo === "base" ? numeroDaBase(c.id) : undefined,
      // Bate-voltas ficam colados na base (Sintra em Lisboa): o nome só no hover.
      fixa: !foraDoFoco && c.tipo !== "bate-volta" && (doPais || c.tipo === "base" || c.tipo === "parada"),
      lado: LADO_ESQUERDO.has(c.id) ? "esq" : "dir",
      rota: { tipo: "cidade", id: c.id },
    });
  }
  return saida;
}

/** Onde cai o nome de cada país: longe das cidades da rota. */
const POSICAO_DO_NOME: Record<string, LatLon> = {
  portugal: [40.9, -7.95],
  espanha: [38.7, -3.6],
  franca: [47.1, 1.4],
  "paises-baixos": [53.05, 6.1],
  alemanha: [50.5, 9.3],
  tchequia: [49.35, 15.7],
  austria: [47.2, 14.4],
  italia: [42.6, 13.9],
};

/** Percentual de loiras sobre cada país (brincadeira), no lugar do nome. */
export function marcadoresBlondes(palpites: Record<string, number | null>): Marcador[] {
  return trip.paises
    .filter((p) => !p.dentroDe && typeof palpites[p.id] === "number")
    .map((p, i) => ({
      id: `blondes:${p.id}`,
      numero: i,
      lat: (POSICAO_DO_NOME[p.id] ?? p.camera.alvo)[0],
      lon: (POSICAO_DO_NOME[p.id] ?? p.camera.alvo)[1],
      tipo: "blondes" as const,
      nome: `${p.nome}: ${palpites[p.id]}% de loiras (brincadeira)`,
      valor: palpites[p.id] as number,
      rota: { tipo: "pais" as const, id: p.id },
    }));
}

/** Nomes dos países da rota, no lugar dos rótulos da imagem de satélite. */
function nomesDosPaises(emFoco?: string): Marcador[] {
  return trip.paises
    .filter((p) => !p.dentroDe)
    .map((p) => ({
      id: `pais:${p.id}`,
      lat: (POSICAO_DO_NOME[p.id] ?? p.camera.alvo)[0],
      lon: (POSICAO_DO_NOME[p.id] ?? p.camera.alvo)[1],
      tipo: "pais" as const,
      nome: p.nome,
      fixa: true,
      ativo: p.id === emFoco,
      apagado: Boolean(emFoco) && p.id !== emFoco,
      rota: { tipo: "pais" as const, id: p.id },
    }));
}

function luas(): Marcador[] {
  return trip.trechos
    .filter((t) => t.modal === "trem-noturno" || t.modal === "onibus-noturno")
    .map((t) => {
      const [lat, lon] = pontoMedio(suavizar(caminhoDoTrecho(t), 12));
      return {
        id: `lua:${t.id}`,
        lat,
        lon,
        tipo: "lua" as const,
        nome: `${t.titulo}, ${t.modal === "trem-noturno" ? "trem noturno" : "ônibus noturno"}`,
        rota: { tipo: "trecho" as const, id: t.id },
      };
    });
}

export function marcadoresDaRota(rota: Rota, alcancadas: Set<string> | null): Marcador[] {
  switch (rota.tipo) {
    case "pais": {
      const p = paisPorId.get(rota.id)!;
      if (p.dentroDe) {
        return locaisDoPais(p.id).map((l) => ({
          id: `local:${l.id}`,
          lat: l.coords[0],
          lon: l.coords[1],
          tipo: "local" as const,
          nome: l.nome,
          categoria: l.categoria,
          fixa: true,
          rota: { tipo: "local" as const, id: l.id },
        }));
      }
      return [...nomesDosPaises(p.id), ...marcadoresDeCidades({ paisId: p.id }), ...luas()];
    }
    case "cidade":
      return locaisDaCidade(rota.id).map((l) => ({
        id: `local:${l.id}`,
        lat: l.coords[0],
        lon: l.coords[1],
        tipo: "local" as const,
        nome: l.nome,
        categoria: l.categoria,
        rota: { tipo: "local" as const, id: l.id },
      }));
    case "local": {
      const atual = localPorId.get(rota.id)!;
      const { dia } = vizinhosNoDia(atual);
      const doDia = new Map((dia ? locaisDoDia(dia) : []).map((l, i) => [l.id, i + 1]));
      return locaisDaCidade(atual.cityId).map((l) => ({
        id: `local:${l.id}`,
        lat: l.coords[0],
        lon: l.coords[1],
        tipo: "local" as const,
        nome: l.nome,
        categoria: l.categoria,
        ativo: l.id === atual.id,
        apagado: l.id !== atual.id && !doDia.has(l.id),
        numero: doDia.get(l.id),
        rota: { tipo: "local" as const, id: l.id },
      }));
    }
    case "dia": {
      const d = diaPorData.get(rota.data)!;
      return locaisDoDia(d).map((l, i) => ({
        id: `local:${l.id}`,
        lat: l.coords[0],
        lon: l.coords[1],
        tipo: "local" as const,
        nome: l.nome,
        categoria: l.categoria,
        numero: i + 1,
        rota: { tipo: "local" as const, id: l.id },
      }));
    }
    case "trecho": {
      const t = trechoPorId.get(rota.id)!;
      const paradas: Marcador[] = t.paradas
        .filter((p) => p.nome)
        .map((p, i) => ({
          id: `parada:${t.id}:${i}`,
          lat: p.coords[0],
          lon: p.coords[1],
          tipo: "ponto" as const,
          nome: p.nome!,
          sub: p.hora,
          fixa: true,
          lado: i % 2 ? ("esq" as const) : ("dir" as const),
          rota,
        }));
      return paradas;
    }
    default:
      return [...nomesDosPaises(), ...marcadoresDeCidades({ alcancadas: alcancadas ?? undefined }), ...(alcancadas ? [] : luas())];
  }
}
