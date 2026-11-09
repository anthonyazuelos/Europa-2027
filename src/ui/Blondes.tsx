import { ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { useApp } from "../store";

/**
 * Índice de loiras por país da rota, mostrado sobre o mapa.
 *
 * Não há censo de cor de cabelo; os números vêm das faixas do mapa de cabelo
 * claro da Europa, baseado em dados antropológicos, como resumido em
 * brilliantmaps.com/blond-hair-map e vividmaps.com. A definição de "loiro"
 * varia entre as fontes (inclui castanho-claro em algumas): por isso cada país
 * mostra a faixa, e o número grande é o meio dela.
 */
export const INDICE_BLONDES: Record<string, { valor: number; faixa: string }> = {
  portugal: { valor: 12, faixa: "5–20%" },
  espanha: { valor: 12, faixa: "5–20%" },
  franca: { valor: 25, faixa: "20–30%" },
  "paises-baixos": { valor: 38, faixa: "25–50%" },
  alemanha: { valor: 45, faixa: "25–60%" },
  tchequia: { valor: 38, faixa: "25–50%" },
  austria: { valor: 30, faixa: "20–40%" },
  italia: { valor: 15, faixa: "5–30%" },
};

export const FONTE_BLONDES = {
  rotulo: "Brilliant Maps · Vivid Maps",
  url: "https://brilliantmaps.com/blond-hair-map/",
};

/** Número que cresce de 0 até o alvo, com um atraso por ordem. */
export function useContador(alvo: number, ativo: boolean, atrasoMs: number) {
  const [valor, setValor] = useState(0);
  useEffect(() => {
    if (!ativo) {
      setValor(0);
      return;
    }
    let quadro = 0;
    let inicio = 0;
    const duracao = 1500;
    const passo = (t: number) => {
      if (!inicio) inicio = t;
      const x = Math.min(1, (t - inicio - atrasoMs) / duracao);
      if (x >= 0) setValor(alvo * (1 - Math.pow(1 - x, 3)));
      if (x < 1) quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
  }, [alvo, ativo, atrasoMs]);
  return valor;
}

export function Contador({ alvo, ordem }: { alvo: number; ordem: number }) {
  const valor = useContador(alvo, true, ordem * 140);
  return <>{Math.round(valor)}%</>;
}

/** Botão da barra superior: liga e desliga os números sobre o mapa. */
export function BotaoBlondes() {
  const ativo = useApp((s) => s.blondes);
  return (
    <button
      type="button"
      className="botao-icone !w-auto px-3 text-[13px] font-medium tracking-wide"
      aria-label="Índice de loiras por país"
      aria-pressed={ativo}
      title="Índice de loiras por país"
      onClick={() => useApp.setState({ blondes: !ativo })}
    >
      blondes
    </button>
  );
}

/** Nota de fonte, mostrada enquanto os números estão no mapa. */
export function NotaBlondes() {
  const ativo = useApp((s) => s.blondes);
  if (!ativo) return null;
  return (
    <p className="vidro pointer-events-auto mt-2 inline-flex max-w-full items-center gap-2 self-start rounded-2xl px-3 py-1.5 text-[11.5px] leading-snug text-nevoa">
      <span>
        Cabelo loiro por país: faixas de mapas antropológicos (a definição de “loiro” varia; o número é o meio da faixa).
      </span>
      <a
        href={FONTE_BLONDES.url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex shrink-0 items-center gap-1 text-azul underline-offset-2 hover:underline"
      >
        Fonte
        <ExternalLink size={11} aria-hidden />
      </a>
    </p>
  );
}
