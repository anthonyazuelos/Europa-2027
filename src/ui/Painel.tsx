import { AnimatePresence, animate, motion, useDragControls, useMotionValue, useTransform } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { type ReactNode, useDeferredValue, useEffect, useLayoutEffect, useRef, useState } from "react";
import { cidadePorId, diaPorData, localPorId, paisPorId, trechoPorId } from "../data";
import { useCelular, useMovimentoReduzido } from "../hooks";
import { caminho, migalhas, navegar, type Rota, rotaPai, useRota } from "../router";
import { type AlturaFolha, useApp } from "../store";
import { PainelCidade } from "./paineis/Cidade";
import { PainelDia } from "./paineis/Dia";
import { PainelEuropa } from "./paineis/Europa";
import { PainelLocal } from "./paineis/Local";
import { PainelPais } from "./paineis/Pais";
import { PainelReservas } from "./paineis/Reservas";
import { PainelTrecho } from "./paineis/Trecho";

function Conteudo({ rota }: { rota: Rota }) {
  switch (rota.tipo) {
    case "pais":
      return <PainelPais pais={paisPorId.get(rota.id)!} />;
    case "cidade":
      return <PainelCidade cidade={cidadePorId.get(rota.id)!} />;
    case "local":
      return <PainelLocal local={localPorId.get(rota.id)!} />;
    case "dia":
      return <PainelDia dia={diaPorData.get(rota.data)!} />;
    case "trecho":
      return <PainelTrecho trecho={trechoPorId.get(rota.id)!} />;
    case "reservas":
      return <PainelReservas />;
    default:
      return <PainelEuropa />;
  }
}

function Voltar({ rota }: { rota: Rota }) {
  const pai = rotaPai(rota);
  if (!pai) return null;
  const trilha = migalhas(pai);
  const destino = trilha[trilha.length - 1].rotulo;
  return (
    <button
      type="button"
      onClick={() => navegar(pai)}
      className="item-clicavel -ml-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] font-medium text-nevoa hover:text-papel"
    >
      <ArrowLeft size={15} aria-hidden />
      {destino}
      <kbd className="ml-1 hidden rounded border border-linha px-1 text-[10px] font-normal text-bruma md:inline">Esc</kbd>
    </button>
  );
}

/** Conteúdo com rolagem; troca com fade a cada rota e volta ao topo. */
function Rolavel({ rota, className = "", style }: { rota: Rota; className?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  const chave = caminho(rota);
  const reduzido = useMovimentoReduzido();
  useLayoutEffect(() => {
    ref.current?.scrollTo({ top: 0 });
  }, [chave]);
  return (
    <div ref={ref} className={`rolagem ${className}`} style={style} tabIndex={-1}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={chave}
          initial={{ opacity: 0, y: reduzido ? 0 : 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: reduzido ? 0 : -8 }}
          transition={{ duration: reduzido ? 0.1 : 0.32, ease: [0.22, 1, 0.36, 1] }}
          className="p-5 pb-10"
        >
          <Conteudo rota={rota} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* ---------------------------------------------------------------- desktop */

function PainelLateral({ rota }: { rota: Rota }) {
  return (
    <motion.aside
      aria-label="Roteiro"
      initial={{ opacity: 0, x: -24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="vidro absolute bottom-4 left-4 top-4 z-20 flex w-[420px] flex-col overflow-hidden rounded-[22px]"
    >
      <AnimatePresence initial={false}>
        {rotaPai(rota) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="shrink-0 overflow-hidden border-b border-linha"
          >
            <div className="px-5 py-2">
              <Voltar rota={rota} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <Rolavel rota={rota} className="min-h-0 flex-1" />
    </motion.aside>
  );
}

/* ----------------------------------------------------------------- celular */

const PEEK = 148;
const ALCA = 30;

function alturasDaFolha() {
  const tela = window.innerHeight;
  return { peek: PEEK, meio: Math.round(tela * 0.54), cheio: tela - 164 };
}

/** Folha arrastável com três alturas: peek, metade e cheio. */
function Folha({ rota, children }: { rota: Rota; children?: ReactNode }) {
  const folha = useApp((s) => s.folha);
  const [alturas, setAlturas] = useState(alturasDaFolha);
  const y = useMotionValue(alturas.cheio - alturas[folha]);
  const visivel = useTransform(y, (v) => `${Math.max(PEEK, alturas.cheio - v) - ALCA}px`);
  const controles = useDragControls();
  const reduzido = useMovimentoReduzido();

  useEffect(() => {
    const aoRedimensionar = () => setAlturas(alturasDaFolha());
    window.addEventListener("resize", aoRedimensionar);
    return () => window.removeEventListener("resize", aoRedimensionar);
  }, []);

  useEffect(() => {
    const controle = animate(y, alturas.cheio - alturas[folha], reduzido ? { duration: 0.1 } : { type: "spring", stiffness: 380, damping: 38 });
    return () => controle.stop();
  }, [folha, alturas, y, reduzido]);

  const proxima: Record<AlturaFolha, AlturaFolha> = { peek: "meio", meio: "cheio", cheio: "peek" };
  const rotulos: Record<AlturaFolha, string> = { peek: "recolhido", meio: "pela metade", cheio: "aberto" };

  return (
    <motion.section
      aria-label="Roteiro"
      className="vidro absolute inset-x-0 bottom-0 z-20 flex flex-col rounded-t-[22px] !border-b-0"
      style={{ height: alturas.cheio, y }}
      drag="y"
      dragControls={controles}
      dragListener={false}
      dragConstraints={{ top: 0, bottom: alturas.cheio - alturas.peek }}
      dragElastic={0.06}
      onDragEnd={(_, info) => {
        const projetado = alturas.cheio - (y.get() + info.velocity.y * 0.18);
        const opcoes = (Object.keys(alturas) as AlturaFolha[]).map((k) => ({ k, d: Math.abs(alturas[k] - projetado) }));
        opcoes.sort((a, b) => a.d - b.d);
        const destino = opcoes[0].k;
        useApp.setState({ folha: destino });
        // Mesmo destino: o estado não muda, então reanima à mão.
        if (destino === folha) animate(y, alturas.cheio - alturas[destino], { type: "spring", stiffness: 380, damping: 38 });
      }}
    >
      <button
        type="button"
        aria-label={`Painel ${rotulos[folha]}. Tocar para ${folha === "cheio" ? "recolher" : "abrir mais"}`}
        className="grid h-[30px] w-full shrink-0 touch-none place-items-center"
        onPointerDown={(e) => controles.start(e)}
        onClick={() => useApp.setState({ folha: proxima[folha] })}
      >
        <span className="h-1 w-10 rounded-full bg-white/30" aria-hidden />
      </button>
      {children}
      <Rolavel
        rota={rota}
        style={{ height: visivel as unknown as string, overflowY: folha === "peek" ? "hidden" : undefined }}
      />
    </motion.section>
  );
}

/* ------------------------------------------------------------------- painel */

export function Painel() {
  // A rota do painel anda um passo atrás da URL: o React monta o conteúdo novo
  // em fatias, sem segurar o primeiro quadro do voo da câmera.
  const rota = useDeferredValue(useRota());
  const celular = useCelular();
  const chave = caminho(rota);

  // No celular, abrir um destino levanta a folha; a visão geral a recolhe.
  useEffect(() => {
    if (!celular) return;
    const { folha, tour } = useApp.getState();
    if (tour.ativo) return;
    if (rota.tipo === "europa") useApp.setState({ folha: "peek" });
    else if (folha === "peek") useApp.setState({ folha: "meio" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, celular]);

  return celular ? <Folha rota={rota} /> : <PainelLateral rota={rota} />;
}
