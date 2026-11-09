import { AnimatePresence, motion } from "framer-motion";
import { Moon, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { trip } from "../data";
import { useApp } from "../store";
import { AConfirmar, CATEGORIA, Secao, TracoModal } from "./comuns";

const euro = (n: number) => `€${n.toLocaleString("pt-BR")}`;

function Custos() {
  const c = trip.viagem.custos;
  const teto = Math.max(...c.itens.map((i) => i.max));
  return (
    <div>
      <p className="titulo text-[1.9rem] leading-none">
        {euro(c.totalMin)}–{c.totalMax.toLocaleString("pt-BR")}
      </p>
      <p className="mt-1.5 text-[13px] text-nevoa">{c.rotulo}</p>
      <ul className="mt-4 space-y-3">
        {c.itens.map((i) => (
          <li key={i.item}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-papel">{i.item}</span>
              <span className="tabular-nums text-nevoa">
                {euro(i.min)}–{i.max.toLocaleString("pt-BR")}
              </span>
            </div>
            <div className="relative mt-1.5 h-1.5 rounded-full bg-white/[0.08]" aria-hidden>
              <span
                className="absolute inset-y-0 rounded-full bg-gradient-to-r from-ambar/60 to-ambar"
                style={{ left: `${(i.min / teto) * 100}%`, width: `${((i.max - i.min) / teto) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-bruma">Cada barra vai do mínimo ao máximo estimado.</p>
    </div>
  );
}

function Legenda() {
  return (
    <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
      <div>
        <p className="rotulo mb-2">Trechos</p>
        <ul className="space-y-2.5">
          {trip.viagem.legenda.map((l) => (
            <li key={l.modal} className="flex items-center gap-3 text-sm">
              <TracoModal modal={l.modal} />
              <span>
                <span className="text-papel">{l.rotulo}</span>
                <span className="block text-xs text-bruma">{l.descricao}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <p className="rotulo mb-2">Pontos</p>
        <ul className="space-y-2.5 text-sm text-papel">
          <li className="flex items-center gap-3">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-ambar font-display text-[11px] font-semibold text-noite-950">1</span>
            Cidade-base, na ordem da viagem
          </li>
          <li className="flex items-center gap-3">
            <span className="mx-[3px] h-3.5 w-3.5 rounded-full border-2 border-ambar" />
            Parada sem pernoite
          </li>
          <li className="flex items-center gap-3">
            <span className="mx-[5px] h-2.5 w-2.5 rounded-full bg-[#ffe2a8]" />
            Bate-volta
          </li>
          <li className="flex items-center gap-3">
            <span className="grid h-5 w-5 place-items-center rounded-full border border-violeta/60 bg-[#12102c] text-violeta">
              <Moon size={11} aria-hidden />
            </span>
            Noite em transporte
          </li>
          {(["ancora", "classico", "mirante", "comida", "noite", "transporte", "hostel", "bate-volta"] as const).map((c) => {
            const { Icone, rotulo, cor } = CATEGORIA[c];
            return (
              <li key={c} className="flex items-center gap-3">
                <span className="grid h-5 w-5 place-items-center rounded-full border border-white/25 bg-noite-900" style={{ color: cor }}>
                  <Icone size={11} aria-hidden />
                </span>
                {rotulo}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

export function Info() {
  const aberta = useApp((s) => s.infoAberta);
  const fechar = () => useApp.setState({ infoAberta: false });
  const botao = useRef<HTMLButtonElement>(null);
  const anterior = useRef<Element | null>(null);
  const v = trip.viagem;

  useEffect(() => {
    if (aberta) {
      anterior.current = document.activeElement;
      requestAnimationFrame(() => botao.current?.focus());
    } else if (anterior.current instanceof HTMLElement) {
      anterior.current.focus();
    }
  }, [aberta]);

  return (
    <AnimatePresence>
      {aberta && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 backdrop-blur-[3px] md:items-center md:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onPointerDown={(e) => e.target === e.currentTarget && fechar()}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="info-titulo"
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 16, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="vidro flex max-h-[88dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[22px] md:rounded-[22px]"
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                fechar();
              }
              if (e.key === "Tab") {
                // Mantém o foco dentro do diálogo.
                const focaveis = e.currentTarget.querySelectorAll<HTMLElement>("button, a[href], [tabindex='0']");
                const primeiro = focaveis[0];
                const ultimo = focaveis[focaveis.length - 1];
                if (e.shiftKey && document.activeElement === primeiro) {
                  e.preventDefault();
                  ultimo.focus();
                } else if (!e.shiftKey && document.activeElement === ultimo) {
                  e.preventDefault();
                  primeiro.focus();
                }
              }
            }}
          >
            <header className="flex shrink-0 items-center justify-between border-b border-linha px-6 py-4">
              <h2 id="info-titulo" className="titulo text-[1.6rem] leading-none">
                Informações da viagem
              </h2>
              <button ref={botao} type="button" className="botao-icone" aria-label="Fechar" onClick={fechar}>
                <X size={18} aria-hidden />
              </button>
            </header>

            <div className="rolagem px-6 pb-8 pt-5" tabIndex={0}>
              <Secao titulo="Documentos">
                <dl className="divide-y divide-linha rounded-2xl border border-linha px-4">
                  {v.documentos.map((d) => (
                    <div key={d.titulo} className="flex items-start justify-between gap-4 py-3">
                      <div>
                        <dt className="text-sm font-semibold text-papel">{d.titulo}</dt>
                        <dd className="mt-0.5 text-sm leading-relaxed text-nevoa">{d.texto}</dd>
                      </div>
                      {!d.confirmado && <AConfirmar className="shrink-0" />}
                    </div>
                  ))}
                </dl>
              </Secao>

              <Secao titulo="Custos estimados">
                <Custos />
              </Secao>

              <Secao titulo="Clima e pôr do sol em janeiro">
                <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
                  <dl className="space-y-2 text-sm">
                    {v.clima.map((c) => (
                      <div key={c.onde} className="flex justify-between gap-3">
                        <dt className="text-papel">{c.onde}</dt>
                        <dd className="text-right text-nevoa">{c.texto}</dd>
                      </div>
                    ))}
                  </dl>
                  <dl className="space-y-2 text-sm">
                    {v.porDoSol.map((p) => (
                      <div key={p.onde} className="flex justify-between gap-3">
                        <dt className="text-papel">{p.onde}</dt>
                        <dd className="tabular-nums text-nevoa">{p.hora}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </Secao>

              <Secao titulo="Riscos e planos B">
                <dl className="space-y-2">
                  {v.riscos.map((r) => (
                    <div key={r.risco} className="rounded-2xl border border-linha px-4 py-3">
                      <dt className="text-sm font-semibold text-papel">{r.risco}</dt>
                      <dd className="mt-1 text-sm leading-relaxed text-nevoa">{r.planoB}</dd>
                    </div>
                  ))}
                </dl>
              </Secao>

              <Secao titulo="Legenda do mapa">
                <Legenda />
              </Secao>

              <Secao titulo="Ainda a confirmar">
                <ul className="space-y-1.5 text-sm text-nevoa">
                  {trip.trechos
                    .filter((t) => t.modal === "voo")
                    .map((t) => (
                      <li key={t.id}>
                        <span className="text-papel">{t.titulo}:</span> {t.aConfirmar}
                      </li>
                    ))}
                  {trip.locais
                    .filter((l) => !l.confirmado)
                    .map((l) => (
                      <li key={l.id}>
                        <a href={`#/local/${l.id}`} onClick={fechar} className="text-papel underline-offset-4 hover:underline">
                          {l.nome}
                        </a>
                        : {l.aConfirmar}
                      </li>
                    ))}
                </ul>
              </Secao>

              <p className="mt-8 text-xs leading-relaxed text-bruma">
                Fotos do Wikimedia Commons, com autor e licença em cada imagem. Fronteiras: Natural Earth. O traçado dos
                trechos no mapa é aproximado.
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
