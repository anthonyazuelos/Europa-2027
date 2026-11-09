import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, ChevronRight, ExternalLink, Moon, Star } from "lucide-react";
import { Children, type ReactNode, useState } from "react";
import {
  blocosDoDia,
  cidadePorId,
  localPorId,
  rotuloDaData,
  rotuloDoDia,
  trechoPorId,
} from "../../data";
import type { Day, Leg, Place, Reservation } from "../../data/schema";
import type { Rota } from "../../router";
import { useApp } from "../../store";
import { AConfirmar, CATEGORIA, Foto, Ir, MODAL, TracoModal } from "../comuns";

/* ------------------------------------------------------------- animações */


const item = {
  oculto: { opacity: 0, y: 10 },
  visivel: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const } },
};

/**
 * Lista cujos filhos entram em sequência, no compasso do voo da câmera: o
 * primeiro sai logo depois da decolagem e o último chega junto com o pouso.
 */
export function Cascata({ children, className = "" }: { children: ReactNode; className?: string }) {
  // Lido uma vez, na montagem: é a duração do voo que trouxe este painel.
  const [voo] = useState(() => useApp.getState().voo);
  const n = Math.max(1, Children.count(children));
  const lista = {
    visivel: {
      transition: {
        delayChildren: Math.min(0.9, 0.08 + voo * 0.22),
        staggerChildren: Math.min(0.12, Math.max(0.04, (voo * 0.6) / n)),
      },
    },
  };
  return (
    <motion.div variants={lista} initial="oculto" animate="visivel" className={className}>
      {children}
    </motion.div>
  );
}
export function Degrau({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <motion.div variants={item} className={className}>
      {children}
    </motion.div>
  );
}

/* --------------------------------------------------------------- reservas */

/** Botão que marca a reserva como feita; o estado fica salvo no navegador. */
export function StatusReserva({ id, verbo = "reservar" }: { id: string; verbo?: "reservar" | "comprar" }) {
  const feita = useApp((s) => Boolean(s.reservasFeitas[id]));
  const alternar = useApp((s) => s.alternarReserva);
  const rotulos = verbo === "comprar" ? ["A comprar", "Comprado"] : ["A reservar", "Reservado"];
  return (
    <button
      type="button"
      role="switch"
      aria-checked={feita}
      onClick={() => alternar(id)}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
        feita ? "border-verde/50 bg-verde/15 text-verde" : "border-white/20 text-nevoa hover:border-white/40 hover:text-papel"
      }`}
    >
      <span className={`grid h-3.5 w-3.5 place-items-center rounded-full border ${feita ? "border-verde bg-verde text-noite-950" : "border-current"}`}>
        {feita && <Check size={10} strokeWidth={3.5} aria-hidden />}
      </span>
      {rotulos[feita ? 1 : 0]}
    </button>
  );
}

export const rotaDaReserva = (r: Reservation): Rota =>
  r.local
    ? { tipo: "local", id: r.local }
    : r.trecho
      ? { tipo: "trecho", id: r.trecho }
      : r.cidade
        ? { tipo: "cidade", id: r.cidade }
        : { tipo: "reservas" };

export function LinhaReserva({ r, mostrarPrazo = true }: { r: Reservation; mostrarPrazo?: boolean }) {
  return (
    <div className="flex items-start gap-3 py-3">
      <div className="min-w-0 flex-1">
        <Ir para={rotaDaReserva(r)} className="text-sm font-medium text-papel underline-offset-4 hover:underline">
          {r.item}
        </Ir>
        {r.detalhe && <p className="mt-0.5 text-[13px] leading-snug text-nevoa">{r.detalhe}</p>}
        <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-bruma">
          {mostrarPrazo && <span className={r.prazo.urgente ? "font-medium text-ambar" : ""}>{r.prazo.rotulo}</span>}
          {r.links.map((l) => (
            <a
              key={l.url}
              href={l.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-azul underline-offset-4 hover:underline"
            >
              {l.rotulo}
              <ExternalLink size={11} aria-hidden />
              <span className="sr-only">(abre em nova aba)</span>
            </a>
          ))}
        </p>
      </div>
      <StatusReserva id={r.id} />
    </div>
  );
}

/* ------------------------------------------------------------------ locais */

export function CartaoLocal({ local, compacto = false }: { local: Place; compacto?: boolean }) {
  const cat = CATEGORIA[local.categoria];
  return (
    <Ir
      para={{ tipo: "local", id: local.id }}
      className="item-clicavel group flex items-center gap-3 rounded-2xl border border-linha p-2 pr-3"
    >
      <Foto
        imagem={local.imagem}
        alt=""
        Icone={cat.Icone}
        cor={cat.cor}
        credito={false}
        className={`shrink-0 rounded-xl ${compacto ? "h-12 w-12" : "h-16 w-16"}`}
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-papel">{local.nome}</span>
          {local.opcional && <span className="shrink-0 text-[11px] text-bruma">opcional</span>}
        </span>
        <span className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-nevoa">{local.porQueVale}</span>
        {!local.confirmado && <AConfirmar className="mt-1.5 !py-0.5 !text-[11px]" nota={local.aConfirmar} />}
      </span>
      <ChevronRight size={16} className="shrink-0 text-bruma transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Ir>
  );
}

/* ----------------------------------------------------------------- trechos */

export function CartaoTrecho({ trecho, papel }: { trecho: Leg; papel?: string }) {
  const m = MODAL[trecho.modal];
  const { saida, chegada } = trecho.dataHora;
  return (
    <Ir
      para={{ tipo: "trecho", id: trecho.id }}
      className="item-clicavel group block rounded-2xl border border-linha p-3.5"
    >
      <span className="flex items-center gap-2 text-xs text-bruma">
        <m.Icone size={14} style={{ color: m.cor }} aria-hidden />
        <span>{papel ? `${papel} · ${m.rotulo}` : m.rotulo}</span>
        <TracoModal modal={trecho.modal} largura={34} />
        {!trecho.confirmado && <AConfirmar className="ml-auto !py-0.5 !text-[11px]" nota={trecho.aConfirmar} />}
      </span>
      <span className="mt-1.5 flex items-center justify-between gap-3">
        <span className="text-[15px] font-semibold text-papel">{trecho.titulo}</span>
        <ChevronRight size={16} className="shrink-0 text-bruma transition-transform group-hover:translate-x-0.5" aria-hidden />
      </span>
      <span className="mt-1 block text-[13px] text-nevoa">
        {rotuloDaData(saida.data)}, {saida.hora}
        {chegada.data !== saida.data ? ` → ${rotuloDaData(chegada.data)}, ${chegada.hora}` : ` → ${chegada.hora}`}
        <span className="text-bruma"> · {trecho.duracao}</span>
      </span>
    </Ir>
  );
}

/* ------------------------------------------------------------------ roteiro */

const INTENSIDADE = { leve: 1, média: 2, alta: 3 } as const;

export function Intensidade({ nivel }: { nivel: Day["intensidadeNoite"] }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-nevoa" title={`Noite ${nivel}`}>
      <span className="flex gap-0.5" aria-hidden>
        {[1, 2, 3].map((n) => (
          <span key={n} className={`h-2.5 w-1 rounded-full ${n <= INTENSIDADE[nivel] ? "bg-violeta" : "bg-white/15"}`} />
        ))}
      </span>
      Noite {nivel}
    </span>
  );
}

/** Manhã, tarde, pôr do sol e noite de um dia; cada item com local é clicável. */
export function RoteiroDoDia({ dia, soCidade }: { dia: Day; soCidade?: string }) {
  return (
    <div className="space-y-4">
      {blocosDoDia(dia).map(({ chave, rotulo, bloco }) => {
        if (!bloco) return null;
        return (
          <div key={chave} className="grid grid-cols-[4.6rem_1fr] gap-x-3">
            <div className="pt-0.5 text-[13px] font-medium text-bruma">
              {rotulo}
              {bloco.hora && <span className="block text-xs font-normal text-ambar/90">{bloco.hora}</span>}
            </div>
            <ol className="space-y-1.5 border-l border-linha pl-3.5">
              {bloco.itens.map((it, i) => {
                const local = it.local ? localPorId.get(it.local) : undefined;
                const trecho = !local && it.trecho ? trechoPorId.get(it.trecho) : undefined;
                const fora = soCidade && local && local.cityId !== soCidade;
                const Icone = local ? CATEGORIA[local.categoria].Icone : trecho ? MODAL[trecho.modal].Icone : null;
                const cor = local ? CATEGORIA[local.categoria].cor : trecho ? MODAL[trecho.modal].cor : undefined;
                const conteudo = (
                  <>
                    {Icone && <Icone size={14} className="mt-[3px] shrink-0" style={{ color: cor }} aria-hidden />}
                    <span>
                      {it.texto}
                      {it.opcional && <span className="text-bruma"> (opcional)</span>}
                      {fora && <span className="text-bruma"> · {cidadePorId.get(local.cityId)!.nome}</span>}
                    </span>
                  </>
                );
                return (
                  <li key={i} className="text-sm leading-snug">
                    {local || trecho ? (
                      <Ir
                        para={local ? { tipo: "local", id: local.id } : { tipo: "trecho", id: trecho!.id }}
                        className="item-clicavel -mx-2 flex gap-2 rounded-lg px-2 py-1 text-papel"
                      >
                        {conteudo}
                      </Ir>
                    ) : (
                      <span className="flex gap-2 py-1 text-nevoa">{conteudo}</span>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        );
      })}
    </div>
  );
}

export function CabecalhoDoDia({ dia }: { dia: Day }) {
  return (
    <Ir
      para={{ tipo: "dia", data: dia.data }}
      className="item-clicavel group -mx-2 mb-3 flex items-center gap-2 rounded-xl px-2 py-1.5"
    >
      <span className="text-[13px] font-semibold text-ambar">{rotuloDoDia(dia)}</span>
      <span className="truncate text-sm font-medium text-papel">{dia.titulo}</span>
      {dia.destaque && <Star size={13} className="shrink-0 fill-ambar text-ambar" aria-label="Dia de destaque" />}
      {dia.noiteEmTransporte && <Moon size={13} className="shrink-0 text-violeta" aria-label="Noite em transporte" />}
      <ChevronRight size={15} className="ml-auto shrink-0 text-bruma transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Ir>
  );
}

/* ------------------------------------------------------------- navegação */

/** Par "anterior / próximo" no rodapé do painel. */
export function AnteriorProximo({
  anterior,
  proximo,
  meio,
}: {
  anterior?: { rota: Rota; rotulo: string };
  proximo?: { rota: Rota; rotulo: string };
  meio?: ReactNode;
}) {
  const classe = "item-clicavel flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-linha px-3 py-2.5 text-sm";
  return (
    <nav className="mt-7" aria-label="Sequência do roteiro">
      {meio && <p className="mb-2 text-center text-xs text-bruma">{meio}</p>}
      <div className="flex gap-2">
        {anterior ? (
          <Ir para={anterior.rota} className={classe} aria-label={`Anterior: ${anterior.rotulo}`}>
            <ArrowLeft size={15} className="shrink-0 text-bruma" aria-hidden />
            <span className="truncate">{anterior.rotulo}</span>
          </Ir>
        ) : (
          <span className="flex-1" />
        )}
        {proximo ? (
          <Ir para={proximo.rota} className={`${classe} justify-end text-right`} aria-label={`Próximo: ${proximo.rotulo}`}>
            <span className="truncate">{proximo.rotulo}</span>
            <ArrowRight size={15} className="shrink-0 text-bruma" aria-hidden />
          </Ir>
        ) : (
          <span className="flex-1" />
        )}
      </div>
    </nav>
  );
}
