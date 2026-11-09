import { useEffect, useSyncExternalStore } from "react";

export function useMidia(consulta: string) {
  return useSyncExternalStore(
    (cb) => {
      const m = matchMedia(consulta);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => matchMedia(consulta).matches,
  );
}

/** Layout de celular: painel vira folha arrastável na base da tela. */
export const useCelular = () => useMidia("(max-width: 820px)");
export const useMovimentoReduzido = () => useMidia("(prefers-reduced-motion: reduce)");

export function useTecla(aoApertar: (e: KeyboardEvent) => void) {
  useEffect(() => {
    window.addEventListener("keydown", aoApertar);
    return () => window.removeEventListener("keydown", aoApertar);
  }, [aoApertar]);
}

export const espera = (ms: number) => new Promise<void>((ok) => setTimeout(ok, ms));

/** Largura do painel lateral + margens, no desktop. */
export const FAIXA_PAINEL = 452;
