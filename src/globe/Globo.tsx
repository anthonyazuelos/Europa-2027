import { useEffect, useRef } from "react";
import { FAIXA_PAINEL, useCelular } from "../hooks";
import { trip } from "../data";
import { caminho, navegar, rotaAtual, useRota } from "../router";
import { useApp } from "../store";
import { planoDaRota } from "./cena";
import { Marcadores } from "./Marcadores";

/**
 * Monta o globo. O Cesium (alguns MB) só é baixado aqui, depois que a tela de
 * abertura já está na tela.
 */
export function Globo() {
  const caixa = useRef<HTMLDivElement>(null);
  const creditos = useRef<HTMLDivElement>(null);
  const rota = useRota();
  const celular = useCelular();
  const motor = useApp((s) => s.motor);
  const fase = useApp((s) => s.fase);
  const folha = useApp((s) => s.folha);
  const jaNaEuropa = useRef(false);

  useEffect(() => {
    let cancelado = false;
    let criado: import("./engine").GlobeEngine | null = null;
    const app = useApp.getState();

    (async () => {
      try {
        const { GlobeEngine } = await import("./engine");
        if (cancelado || !caixa.current || !creditos.current) return;
        const m = await GlobeEngine.criar(caixa.current, creditos.current);
        if (cancelado) {
          m.destruir();
          return;
        }
        criado = m;
        if (import.meta.env.DEV) (window as unknown as { __motor: unknown }).__motor = m;
        m.eventos = {
          aoClicarPais: (id) => navegar({ tipo: "pais", id }),
          aoClicarTrecho: (id) => navegar({ tipo: "trecho", id }),
          aoPassarTrecho: (id, x, y) => useApp.setState({ trechoSobCursor: id ? { id, x, y } : null }),
          aoPassarPais: (id) => useApp.setState({ paisSobCursor: id }),
          aoVoar: (duracao) => useApp.setState({ voo: duracao }),
          aoReduzirQualidade: (camadas) => {
            useApp.setState({ camadas });
            useApp.getState().avisar("Cidades em 3D desligadas para manter o mapa fluido");
          },
        };
        m.camadas = { ...useApp.getState().camadas };
        useApp.setState({ motor: m, capacidades: { ...m.capacidades } });

        // A abertura completa só toca quando o link é o da visão geral.
        if (rotaAtual().tipo === "europa") {
          useApp.setState({ fase: "intro" });
          await m.tocarIntro((id) => useApp.getState().alcancar(id));
          jaNaEuropa.current = rotaAtual().tipo === "europa";
        }
        if (!cancelado) {
          for (const c of trip.cidades) useApp.getState().alcancar(c.id);
          useApp.setState({ fase: "pronto" });
        }
      } catch (e) {
        console.error(e);
        if (!cancelado) {
          app.definir({
            fase: "pronto",
            erroGlobo: "Não foi possível iniciar o globo 3D neste navegador. O roteiro continua disponível nos painéis.",
          });
        }
      }
    })();

    return () => {
      cancelado = true;
      criado?.destruir();
      useApp.setState({ motor: null });
    };
  }, []);

  // Área coberta pelos painéis: o alvo da câmera é centralizado no que sobra.
  useEffect(() => {
    if (!motor) return;
    motor.margens = celular
      ? { esquerda: 0, baixo: folha === "peek" ? 0 : Math.max(0, Math.round(window.innerHeight * 0.54) - 150) }
      : { esquerda: FAIXA_PAINEL, baixo: 0 };
  }, [motor, celular, folha]);

  // Cada mudança de rota vira uma cena + um voo de câmera.
  const chave = caminho(rota);
  useEffect(() => {
    if (!motor || fase !== "pronto") return;
    const plano = planoDaRota(rota, motor);
    motor.definirCena(plano.cena);
    motor.definirCaminhoDoDia(plano.caminho);
    motor.definirData(plano.data, plano.alvo.lat, plano.alvo.lon);
    if (jaNaEuropa.current) {
      jaNaEuropa.current = false;
      return;
    }
    void motor.voarPara(plano.alvo, { orbitar: plano.orbitar });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [motor, fase, chave]);

  return (
    <>
      <div ref={caixa} className="globo absolute inset-0" aria-hidden />
      {!motor && fase === "pronto" && !useApp.getState().erroGlobo && (
        <p
          role="status"
          className="vidro absolute left-1/2 top-1/2 z-10 -translate-x-1/2 rounded-full px-4 py-2 text-[13px] text-nevoa md:left-[calc(50%+226px)]"
        >
          Carregando o globo…
        </p>
      )}
      <Marcadores />
      <div
        ref={creditos}
        className="creditos pointer-events-auto absolute right-3 z-10 max-w-[70vw] max-md:bottom-[calc(env(safe-area-inset-bottom)+8.6rem)] md:bottom-1.5"
      />
    </>
  );
}
