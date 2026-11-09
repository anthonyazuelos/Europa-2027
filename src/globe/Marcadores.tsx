import { Moon } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { useRota, navegar } from "../router";
import { useApp } from "../store";
import { CATEGORIA } from "../ui/comuns";
import { type Marcador, marcadoresDaRota } from "./cena";

/**
 * Marcadores em HTML por cima do globo. O motor informa, a cada quadro
 * desenhado, onde cada ponto cai na tela; aqui só movemos os elementos.
 */
export function Marcadores() {
  const rota = useRota();
  const motor = useApp((s) => s.motor);
  const fase = useApp((s) => s.fase);
  const alcancadas = useApp((s) => s.alcancadas);
  const voo = useApp((s) => s.voo);
  const elementos = useRef(new Map<string, HTMLElement>());
  const ultimas = useRef(new Map<string, string>());

  const marcadores = useMemo(
    () => (fase === "carregando" ? [] : marcadoresDaRota(rota, fase === "intro" ? alcancadas : null)),
    [rota, fase, alcancadas],
  );

  useEffect(() => {
    if (!motor) return;
    const ponto = { x: 0, y: 0 };
    return motor.aoQuadro(() => {
      for (const m of marcadores) {
        const el = elementos.current.get(m.id);
        if (!el) continue;
        // Só toca no DOM quando a posição muda de fato.
        const nova = motor.projetar(m.lat, m.lon, ponto) ? `translate3d(${ponto.x.toFixed(1)}px, ${ponto.y.toFixed(1)}px, 0)` : "";
        if (ultimas.current.get(m.id) === nova) continue;
        ultimas.current.set(m.id, nova);
        if (nova) {
          el.style.transform = nova;
          el.style.visibility = "visible";
        } else {
          el.style.visibility = "hidden";
        }
      }
    });
  }, [motor, marcadores]);

  return (
    // Os marcadores surgem em sequência, na ordem da viagem, no fim do voo.
    <div
      className="marcadores"
      aria-label="Pontos do mapa"
      style={{ ["--atraso" as string]: `${Math.round(voo * 520)}ms`, ["--passo" as string]: `${marcadores.length > 14 ? 28 : 55}ms` }}
    >
      {marcadores.map((m, i) => (
        <Ponto
          key={m.id}
          m={m}
          ordem={i}
          registrar={(el) => {
            if (el) elementos.current.set(m.id, el);
            else {
              elementos.current.delete(m.id);
              ultimas.current.delete(m.id);
            }
          }}
        />
      ))}
    </div>
  );
}

function Ponto({ m, ordem, registrar }: { m: Marcador; ordem: number; registrar: (el: HTMLElement | null) => void }) {
  const Icone = m.categoria ? CATEGORIA[m.categoria].Icone : null;
  const folga = m.tipo === "base" ? 21 : m.tipo === "local" ? 24 : 14;
  return (
    <button
      ref={registrar}
      type="button"
      className={`marcador m-${m.tipo}`}
      style={{ visibility: "hidden", ["--ordem" as string]: ordem }}
      data-ativo={m.ativo || undefined}
      data-apagado={m.apagado || undefined}
      data-categoria={m.categoria}
      aria-current={m.ativo ? "true" : undefined}
      onClick={() => navegar(m.rota)}
    >
      <span className="corpo" aria-hidden={m.tipo === "base" || m.numero ? undefined : true}>
        {m.tipo === "base" && <span>{m.numero}</span>}
        {m.tipo === "lua" && <Moon size={13} strokeWidth={2.2} aria-hidden />}
        {m.tipo === "local" && Icone && <Icone size={m.ativo ? 18 : 15} strokeWidth={1.9} aria-hidden />}
        {m.tipo === "local" && m.numero && !m.apagado && <span className="ordem">{m.numero}</span>}
      </span>
      <span
        className="etiqueta"
        data-lado={m.lado ?? "dir"}
        data-quando={m.fixa ? "sempre" : "foco"}
        style={{ ["--folga" as string]: `${folga}px` }}
      >
        {" "}
        {m.nome}
        {m.sub && <small> {m.sub}</small>}
      </span>
    </button>
  );
}
