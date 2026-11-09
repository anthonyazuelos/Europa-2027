import { useMemo } from "react";
import { trip } from "../../data";
import type { Reservation } from "../../data/schema";
import { useApp } from "../../store";
import { LinhaReserva } from "./partes";

export function PainelReservas() {
  const feitas = useApp((s) => s.reservasFeitas);
  const grupos = useMemo(() => {
    const ordenadas = [...trip.reservas].sort((a, b) => a.prazo.ate.localeCompare(b.prazo.ate));
    const saida: { rotulo: string; urgente: boolean; itens: Reservation[] }[] = [];
    for (const r of ordenadas) {
      const ultimo = saida[saida.length - 1];
      if (ultimo && ultimo.rotulo === r.prazo.rotulo) ultimo.itens.push(r);
      else saida.push({ rotulo: r.prazo.rotulo, urgente: r.prazo.urgente, itens: [r] });
    }
    return saida;
  }, []);
  const total = trip.reservas.length;
  const prontas = trip.reservas.filter((r) => feitas[r.id]).length;

  return (
    <div>
      <p className="text-[13px] font-medium text-ambar">Em ordem de prazo</p>
      <h1 className="titulo mt-1 text-[2.2rem] leading-none">Reservas</h1>
      <p className="mt-3 text-sm leading-relaxed text-nevoa">
        O que precisa ser comprado antes da viagem, do mais urgente ao que pode esperar. Marque o que já foi feito: fica
        salvo neste navegador.
      </p>

      <div className="mt-5" aria-live="polite">
        <div className="flex items-baseline justify-between text-[13px]">
          <span className="font-medium text-papel">
            {prontas} de {total} feitas
          </span>
          <span className="text-bruma">{total - prontas} por fazer</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={prontas} aria-label="Reservas feitas">
          <div className="h-full rounded-full bg-verde transition-[width] duration-500" style={{ width: `${(prontas / total) * 100}%` }} />
        </div>
      </div>

      {grupos.map((g, i) => (
        <section key={`${g.rotulo}-${i}`} className="mt-6">
          <h2 className={`mb-1 text-[13px] font-semibold ${g.urgente ? "text-ambar" : "text-nevoa"}`}>{g.rotulo}</h2>
          <div className="divide-y divide-linha rounded-2xl border border-linha px-3.5">
            {g.itens.map((r) => (
              <LinhaReserva key={r.id} r={r} mostrarPrazo={false} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
