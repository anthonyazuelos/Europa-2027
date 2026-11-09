import { AnimatePresence, motion } from "framer-motion";
import { useCallback } from "react";
import { Globo } from "./globe/Globo";
import { useTecla } from "./hooks";
import { navegar, rotaAtual, rotaPai } from "./router";
import { useApp } from "./store";
import { pararTour } from "./tour";
import { Abertura } from "./ui/Abertura";
import { BarraSuperior } from "./ui/BarraSuperior";
import { Busca } from "./ui/Busca";
import { DicaTrecho } from "./ui/DicaTrecho";
import { Info } from "./ui/Info";
import { Painel } from "./ui/Painel";
import { Timeline } from "./ui/Timeline";

function Aviso() {
  const aviso = useApp((s) => s.aviso);
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-24 z-50 flex justify-center px-4" aria-live="polite">
      <AnimatePresence>
        {aviso && (
          <motion.p
            key={aviso}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className="vidro rounded-full px-4 py-2 text-[13px] font-medium text-papel"
          >
            {aviso}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  const fase = useApp((s) => s.fase);
  const erro = useApp((s) => s.erroGlobo);

  useTecla(
    useCallback((e: KeyboardEvent) => {
      const app = useApp.getState();
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !(e.target as HTMLElement).closest("input, textarea"))) {
        e.preventDefault();
        app.definir({ buscaAberta: true });
        return;
      }
      if (e.key !== "Escape" || app.buscaAberta || app.infoAberta) return;
      if (app.fase === "intro") {
        app.motor?.pularIntro();
        return;
      }
      if (app.tour.ativo) {
        pararTour();
        return;
      }
      const pai = rotaPai(rotaAtual());
      if (pai) navegar(pai);
    }, []),
  );

  return (
    <div className="fixed inset-0 overflow-hidden bg-noite-950 text-papel">
      {/* Botão, não link: o hash da URL é a rota do mapa. */}
      <button
        type="button"
        onClick={() => document.getElementById("conteudo")?.focus()}
        className="vidro absolute left-4 top-4 z-[70] -translate-y-20 rounded-xl px-4 py-2 text-sm font-medium focus:translate-y-0"
      >
        Pular para o roteiro
      </button>
      <main className="absolute inset-0">
        <Globo />
        {fase === "pronto" && (
          <>
            <BarraSuperior />
            <div id="conteudo" tabIndex={-1} className="outline-none">
              <Painel />
            </div>
            <Timeline />
            <DicaTrecho />
          </>
        )}
        {erro && fase === "pronto" && (
          <p role="alert" className="vidro absolute left-1/2 top-20 z-30 max-w-md -translate-x-1/2 rounded-2xl px-4 py-3 text-sm text-papel md:left-[calc(50%+226px)]">
            {erro}
          </p>
        )}
      </main>
      <Abertura />
      <Busca />
      <Info />
      <Aviso />
    </div>
  );
}
