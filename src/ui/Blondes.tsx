import { useEffect, useState } from "react";
import { useApp } from "../store";

/**
 * Brincadeira: "percentual de loiras" por país da rota, mostrado sobre o mapa.
 * Números de boteco, sem fonte séria; o aviso fica ao lado do botão.
 */
export const PALPITES_BLONDES: Record<string, number | null> = {
  portugal: 3,
  espanha: 5,
  franca: 15,
  "paises-baixos": 45,
  alemanha: 35,
  tchequia: 30,
  austria: 30,
  italia: 8,
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

export function BotaoBlondes() {
  const ativo = useApp((s) => s.blondes);
  return (
    <div className="mt-6 flex items-center justify-end gap-3">
      {ativo && <span className="text-[11px] text-bruma">números de boteco, sem fonte séria</span>}
      <button
        type="button"
        aria-pressed={ativo}
        onClick={() => useApp.setState({ blondes: !ativo })}
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium tracking-wide transition-colors ${
          ativo ? "border-[#ffd36b]/60 bg-[#ffd36b]/10 text-[#ffe9a8]" : "border-linha text-bruma hover:border-[#ffd36b]/50 hover:text-[#ffe9a8]"
        }`}
      >
        <span aria-hidden>👱‍♀️</span> blondes
      </button>
    </div>
  );
}
