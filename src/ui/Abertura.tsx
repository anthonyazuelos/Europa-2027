import { AnimatePresence, motion } from "framer-motion";
import { SkipForward } from "lucide-react";
import { bases, trip } from "../data";
import { useApp } from "../store";

/**
 * Tela de abertura. Fica opaca enquanto o globo carrega; durante a animação
 * de câmera vira só uma legenda discreta, e qualquer clique pula a intro.
 */
export function Abertura() {
  const fase = useApp((s) => s.fase);
  const motor = useApp((s) => s.motor);
  const alcancadas = useApp((s) => s.alcancadas);
  const v = trip.viagem;
  const trilha = bases.filter((c) => alcancadas.has(c.id));

  return (
    <AnimatePresence>
      {fase === "carregando" && (
        <motion.div
          key="carregando"
          className="absolute inset-0 z-[60] grid place-items-center text-center"
          style={{ background: "radial-gradient(120% 90% at 50% 110%, #16223a 0%, #070b14 55%, #04070d 100%)" }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.1, ease: "easeInOut" }}
        >
          <div className="px-6">
            <h1 className="titulo text-[clamp(2.8rem,10vw,6rem)] leading-none">{v.titulo}</h1>
            <p className="titulo mt-3 text-[clamp(1.2rem,3.4vw,1.9rem)] italic text-ambar">15 jan → 4 fev</p>
            <p className="mt-4 text-[clamp(0.95rem,2.4vw,1.15rem)] text-nevoa">{v.subtitulo}</p>
            <div className="mx-auto mt-10 h-px w-40 overflow-hidden bg-white/15" role="status" aria-label="Carregando o globo">
              <motion.div
                className="h-full w-1/3 bg-ambar"
                animate={{ x: ["-100%", "300%"] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>
          </div>
        </motion.div>
      )}

      {fase === "intro" && (
        <motion.div
          key="intro"
          className="absolute inset-0 z-[60] cursor-pointer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          onClick={() => motor?.pularIntro()}
        >
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-6 pb-9 pt-24 text-center">
            <p className="titulo text-[clamp(1.5rem,4vw,2.4rem)] leading-tight">{v.subtitulo}</p>
            <p className="mx-auto mt-2 min-h-[1.5rem] max-w-3xl text-sm text-nevoa" aria-live="off">
              {trilha.length === 0 ? "Saindo de Fortaleza…" : trilha.map((c) => c.nome).join("  ›  ")}
            </p>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              motor?.pularIntro();
            }}
            className="vidro absolute right-4 top-4 flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-medium text-papel hover:bg-white/10"
          >
            Pular
            <SkipForward size={14} aria-hidden />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
