import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, ChevronDown, Moon, Pause, Play, Square, Star } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cidadePorId, localPorId, numeroDoDia, paisDaCidade, rotuloDoDia, trip } from "../data";
import { useCelular } from "../hooks";
import { navegar, rotaAtual, useRota } from "../router";
import { useApp } from "../store";
import { alternarPausa, diaDaRota, iniciarTour, pararTour } from "../tour";

function ControleDoTour({ compacto }: { compacto: boolean }) {
  const tour = useApp((s) => s.tour);
  const pronto = useApp((s) => Boolean(s.motor));
  if (!tour.ativo) {
    return (
      <button
        type="button"
        disabled={!pronto}
        onClick={() => void iniciarTour()}
        className="flex shrink-0 items-center gap-2 rounded-xl bg-ambar px-3.5 py-2 text-[13px] font-semibold text-noite-950 transition-colors hover:bg-[#ffc56b] disabled:opacity-50"
      >
        <Play size={14} className="fill-current" aria-hidden />
        {compacto ? "Reproduzir" : "Reproduzir viagem"}
      </button>
    );
  }
  return (
    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        onClick={alternarPausa}
        className="flex items-center gap-2 rounded-xl bg-ambar px-3.5 py-2 text-[13px] font-semibold text-noite-950 hover:bg-[#ffc56b]"
      >
        {tour.pausado ? <Play size={14} className="fill-current" aria-hidden /> : <Pause size={14} className="fill-current" aria-hidden />}
        {tour.pausado ? "Continuar" : "Pausar"}
      </button>
      <button type="button" onClick={pararTour} className="botao-icone !h-9 !w-9" aria-label="Encerrar a reprodução">
        <Square size={14} className="fill-current" aria-hidden />
      </button>
    </div>
  );
}

export function Timeline() {
  const rota = useRota();
  const celular = useCelular();
  const [aberta, setAberta] = useState(() => !matchMedia("(max-width: 820px)").matches);
  const tourAtivo = useApp((s) => s.tour.ativo);
  const trilho = useRef<HTMLDivElement>(null);
  const botoes = useRef<(HTMLButtonElement | null)[]>([]);

  const ativo = diaDaRota(rota) ?? (rota.tipo === "local" ? localPorId.get(rota.id)!.dia : null);
  const indiceAtivo = ativo ? trip.dias.findIndex((d) => d.data === ativo) : -1;
  const [foco, setFoco] = useState(0);
  useEffect(() => {
    if (indiceAtivo >= 0) setFoco(indiceAtivo);
  }, [indiceAtivo]);

  // Mantém o dia ativo à vista (a barra rola no celular). O atraso cobre a
  // animação de abrir, quando o trilho ainda não está no DOM.
  useEffect(() => {
    if (indiceAtivo < 0 || !aberta) return;
    const rolar = () => {
      const botao = botoes.current[indiceAtivo];
      const caixa = trilho.current;
      if (botao && caixa) {
        caixa.scrollTo({ left: botao.offsetLeft - caixa.clientWidth / 2 + botao.clientWidth / 2, behavior: "smooth" });
      }
    };
    rolar();
    const relogio = setTimeout(rolar, 320);
    return () => clearTimeout(relogio);
  }, [indiceAtivo, aberta]);

  // No modo dia, ← e → trocam de dia de qualquer lugar da página.
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (rota.tipo !== "dia" || e.altKey || e.metaKey || e.ctrlKey) return;
      const alvo = e.target as HTMLElement;
      if (alvo.closest("input, textarea, [role=tablist], [role=dialog], [data-trilho]")) return;
      const passo = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      // Lê a rota na hora: duas teclas seguidas não podem partir do mesmo dia.
      const agora = rotaAtual();
      const indice = agora.tipo === "dia" ? trip.dias.findIndex((d) => d.data === agora.data) : -1;
      const destino = trip.dias[indice + passo];
      if (!passo || indice < 0 || !destino) return;
      e.preventDefault();
      navegar({ tipo: "dia", data: destino.data });
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [rota]);

  const mostrar = aberta || tourAtivo;

  return (
    <motion.div
      initial={{ opacity: 0, y: celular ? -12 : 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
      className="pointer-events-none absolute inset-x-3 top-[7.1rem] z-[25] flex justify-end md:inset-x-auto md:bottom-7 md:left-[452px] md:right-4 md:top-auto"
    >
      <AnimatePresence mode="wait" initial={false}>
        {mostrar ? (
          <motion.div
            key="aberta"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="vidro pointer-events-auto flex w-full items-center gap-2 rounded-2xl py-1.5 pl-1.5 pr-1 md:gap-3"
          >
            <ControleDoTour compacto={celular} />
            <div
              ref={trilho}
              data-trilho
              role="group"
              aria-label="Linha do tempo: os 21 dias da viagem"
              className="relative flex min-w-0 flex-1 items-stretch overflow-x-auto [scrollbar-width:none]"
              onKeyDown={(e) => {
                const passo = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : e.key === "Home" ? -99 : e.key === "End" ? 99 : 0;
                if (!passo) return;
                e.preventDefault();
                const novo = Math.max(0, Math.min(trip.dias.length - 1, foco + passo));
                setFoco(novo);
                botoes.current[novo]?.focus();
              }}
            >
              {trip.dias.map((d, i) => {
                const atual = i === indiceAtivo;
                const cidade = cidadePorId.get(d.cidade)!;
                const cor = paisDaCidade(cidade).cor;
                const [, mes, dia] = d.data.split("-").map(Number);
                const viraMes = i === 0 || dia === 1;
                return (
                  <button
                    key={d.data}
                    ref={(el) => {
                      botoes.current[i] = el;
                    }}
                    type="button"
                    tabIndex={i === foco ? 0 : -1}
                    aria-current={atual ? "date" : undefined}
                    title={`${rotuloDoDia(d)} · ${d.titulo}`}
                    onClick={() => navegar({ tipo: "dia", data: d.data })}
                    onFocus={() => setFoco(i)}
                    className={`group relative flex min-w-[30px] flex-1 flex-col items-center gap-1 rounded-lg pb-1 pt-1.5 transition-colors hover:bg-white/[0.07] ${
                      atual ? "bg-ambar/[0.16]" : d.fimDeSemana ? "bg-white/[0.045]" : ""
                    }`}
                  >
                    <span className="grid h-4 place-items-center">
                      {d.noiteEmTransporte ? (
                        <Moon size={13} className={atual ? "text-papel" : "text-violeta"} strokeWidth={2.3} aria-hidden />
                      ) : d.destaque ? (
                        <Star size={12} className="fill-ambar text-ambar" aria-hidden />
                      ) : (
                        <span
                          className={`block rounded-full transition-all ${atual ? "h-3 w-3 bg-ambar shadow-[0_0_0_3px_rgb(255_181_71/0.3)]" : "h-[7px] w-[7px] bg-white/55 group-hover:bg-white"}`}
                        />
                      )}
                    </span>
                    <span className={`text-[11px] leading-none tabular-nums ${atual ? "font-bold text-ambar" : d.fimDeSemana ? "font-semibold text-papel" : "text-nevoa"}`}>
                      {dia}
                      {viraMes && <span className="ml-px text-[9px] font-medium text-bruma">{mes === 1 ? "jan" : "fev"}</span>}
                    </span>
                    <span className="sr-only">
                      , dia {numeroDoDia(d.data)} de {trip.dias.length}, {d.diaSemana}: {d.titulo}
                      {d.fimDeSemana ? ", fim de semana" : ""}
                      {d.noiteEmTransporte ? ", noite a bordo" : ""}
                    </span>
                    <span className="absolute inset-x-0 bottom-0 h-0.5 opacity-80" style={{ background: cor }} aria-hidden />
                  </button>
                );
              })}
            </div>
            {!tourAtivo && (
              <button type="button" className="botao-icone !h-9 !w-9 shrink-0" aria-label="Recolher a linha do tempo" aria-expanded onClick={() => setAberta(false)}>
                <ChevronDown size={16} className="max-md:rotate-180" aria-hidden />
              </button>
            )}
          </motion.div>
        ) : (
          <motion.button
            key="fechada"
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setAberta(true)}
            aria-expanded={false}
            className="vidro pointer-events-auto flex items-center gap-2 rounded-2xl px-3.5 py-2.5 text-[13px] font-medium text-nevoa hover:text-papel"
          >
            <CalendarDays size={15} aria-hidden />
            {indiceAtivo >= 0 ? `Dia ${indiceAtivo + 1} de ${trip.dias.length}` : "Linha do tempo"}
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
