import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ChevronRight, Info, Layers, ListChecks, Search, Share2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { trip } from "../data";
import { useCelular } from "../hooks";
import { caminho, href, migalhas, navegar, rotaPai, useRota } from "../router";
import { useApp } from "../store";

function Migalhas() {
  const rota = useRota();
  const trilha = migalhas(rota);
  const lista = useRef<HTMLOListElement>(null);
  useEffect(() => {
    if (lista.current) lista.current.scrollLeft = lista.current.scrollWidth;
  }, [rota]);
  return (
    <nav aria-label="Você está em" className="vidro min-w-0 rounded-2xl">
      <ol ref={lista} className="flex items-center overflow-x-auto px-1.5 py-1 [scrollbar-width:none]">
        {trilha.map((m, i) => {
          const ultimo = i === trilha.length - 1;
          return (
            <motion.li
              key={caminho(m.rota)}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: i * 0.09, ease: [0.22, 1, 0.36, 1] }}
              className="flex shrink-0 items-center"
            >
              {i > 0 && <ChevronRight size={13} className="text-bruma" aria-hidden />}
              {ultimo ? (
                <span aria-current="page" className="max-w-[46vw] truncate px-2 py-1.5 text-[13px] font-semibold text-papel md:max-w-[22rem]">
                  {m.rotulo}
                </span>
              ) : (
                <a href={href(m.rota)} className="rounded-lg px-2 py-1.5 text-[13px] font-medium text-nevoa transition-colors hover:bg-white/[0.08] hover:text-papel">
                  {m.rotulo}
                </a>
              )}
            </motion.li>
          );
        })}
      </ol>
    </nav>
  );
}

function Interruptor({ rotulo, nota, ligado, aoMudar, desativado }: { rotulo: string; nota?: string; ligado: boolean; aoMudar: (v: boolean) => void; desativado?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado && !desativado}
      disabled={desativado}
      onClick={() => aoMudar(!ligado)}
      className="item-clicavel flex w-full items-center justify-between gap-4 rounded-xl px-3 py-2.5 text-left disabled:cursor-not-allowed disabled:opacity-55"
    >
      <span>
        <span className="block text-sm font-medium text-papel">{rotulo}</span>
        {nota && <span className="block text-xs text-bruma">{nota}</span>}
      </span>
      <span className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${ligado && !desativado ? "bg-ambar" : "bg-white/20"}`} aria-hidden>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-[left] ${ligado && !desativado ? "left-[18px]" : "left-0.5"}`} />
      </span>
    </button>
  );
}

function Camadas() {
  const [aberto, setAberto] = useState(false);
  const camadas = useApp((s) => s.camadas);
  const cap = useApp((s) => s.capacidades);
  const definir = useApp((s) => s.definirCamadas);
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: PointerEvent) => {
      if (!caixa.current?.contains(e.target as Node)) setAberto(false);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setAberto(false);
      }
    };
    window.addEventListener("pointerdown", fora);
    window.addEventListener("keydown", tecla, true);
    return () => {
      window.removeEventListener("pointerdown", fora);
      window.removeEventListener("keydown", tecla, true);
    };
  }, [aberto]);

  const semToken = cap && !cap.token;
  return (
    <div ref={caixa} className="relative">
      <button type="button" className="botao-icone" aria-label="Camadas do mapa" aria-expanded={aberto} aria-haspopup="true" onClick={() => setAberto((v) => !v)}>
        <Layers size={18} aria-hidden />
      </button>
      <AnimatePresence>
        {aberto && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="vidro solido absolute right-0 top-12 z-40 w-72 rounded-2xl p-1.5"
            role="group"
            aria-label="Camadas do mapa"
          >
            <Interruptor rotulo="Rótulos" nota="Nomes de cidades e países" ligado={camadas.rotulos} aoMudar={(v) => definir({ ...camadas, rotulos: v })} />
            <Interruptor
              rotulo="Relevo"
              nota={cap?.relevo ? "Alpes e Pirineus em 3D" : "Precisa do token do Cesium ion"}
              ligado={camadas.relevo}
              desativado={!cap?.relevo}
              aoMudar={(v) => definir({ ...camadas, relevo: v })}
            />
            <Interruptor
              rotulo="Prédios 3D"
              nota={cap?.predios ? "Nos zooms de cidade e de local" : "Precisa do token do Cesium ion"}
              ligado={camadas.predios}
              desativado={!cap?.predios}
              aoMudar={(v) => definir({ ...camadas, predios: v })}
            />
            <Interruptor rotulo="Dia e noite" nota="Luz de um fim de tarde de janeiro" ligado={camadas.luz} aoMudar={(v) => definir({ ...camadas, luz: v })} />
            {semToken && (
              <p className="mx-3 mb-2 mt-1 border-t border-linha pt-2 text-xs leading-relaxed text-bruma">
                Sem token do Cesium ion: o mapa usa a imagem de satélite da Esri. O README explica como ativar relevo e prédios.
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

async function compartilhar() {
  const { avisar } = useApp.getState();
  const url = location.href;
  try {
    await navigator.clipboard.writeText(url);
    avisar("Link copiado");
  } catch {
    try {
      if (navigator.share) await navigator.share({ title: document.title, url });
      else avisar("Copie o endereço da barra do navegador");
    } catch {
      // A pessoa fechou a folha de compartilhamento.
    }
  }
}

export function BarraSuperior() {
  const rota = useRota();
  const celular = useCelular();
  const feitas = useApp((s) => s.reservasFeitas);
  const pendentes = trip.reservas.filter((r) => !feitas[r.id]).length;
  const pai = rotaPai(rota);

  return (
    <motion.header
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
      className="pointer-events-none absolute inset-x-3 top-3 z-30 flex flex-col-reverse gap-2 md:left-[452px] md:right-4 md:top-4 md:flex-row md:items-start md:justify-between"
    >
      <div className="pointer-events-auto flex min-w-0 self-start max-md:max-w-full">
        <Migalhas />
      </div>

      <div className="flex shrink-0 items-center justify-between gap-2">
        {celular && pai ? (
          <button type="button" className="vidro botao-icone pointer-events-auto shrink-0 !rounded-2xl" aria-label="Voltar um nível" onClick={() => navegar(pai)}>
            <ArrowLeft size={18} aria-hidden />
          </button>
        ) : (
          <span />
        )}
      <div className="vidro pointer-events-auto flex shrink-0 items-center rounded-2xl p-0.5">
        <button type="button" className="botao-icone" aria-label="Buscar (Ctrl ou ⌘ + K)" onClick={() => useApp.setState({ buscaAberta: true })}>
          <Search size={18} aria-hidden />
        </button>
        <a href={href({ tipo: "reservas" })} className="botao-icone relative" aria-label={`Reservas: ${pendentes} por fazer`} aria-current={rota.tipo === "reservas" ? "page" : undefined}>
          <ListChecks size={18} aria-hidden />
          {pendentes > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-ambar ring-2 ring-noite-900" aria-hidden />}
        </a>
        <button type="button" className="botao-icone" aria-label="Informações da viagem" onClick={() => useApp.setState({ infoAberta: true })}>
          <Info size={18} aria-hidden />
        </button>
        <Camadas />
        <button type="button" className="botao-icone" aria-label="Copiar o link desta visão" onClick={compartilhar}>
          <Share2 size={18} aria-hidden />
        </button>
      </div>
      </div>
    </motion.header>
  );
}
