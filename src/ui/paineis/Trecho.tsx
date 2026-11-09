import { Armchair, Eye, Sparkles } from "lucide-react";
import { reservaPorId, rotuloDaData } from "../../data";
import type { Leg } from "../../data/schema";
import { AConfirmar, Etiqueta, MODAL, Secao, TracoModal } from "../comuns";
import { LinhaReserva } from "./partes";

function Ponta({ rotulo, estacao, data, hora }: { rotulo: string; estacao?: string; data: string; hora: string }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="rotulo">{rotulo}</p>
      <p className="titulo mt-0.5 text-[1.5rem] leading-tight">{hora}</p>
      <p className="text-[13px] text-nevoa">{rotuloDaData(data)}</p>
      {estacao && <p className="mt-1 text-[13px] leading-snug text-papel">{estacao}</p>}
    </div>
  );
}

export function PainelTrecho({ trecho }: { trecho: Leg }) {
  const m = MODAL[trecho.modal];
  const reserva = trecho.reserva ? reservaPorId.get(trecho.reserva) : undefined;
  const paradas = trecho.paradas.filter((p) => p.nome);

  return (
    <article>
      <p className="flex items-center gap-2 text-[13px] font-medium" style={{ color: m.cor }}>
        <m.Icone size={15} aria-hidden />
        {m.rotulo}
        <TracoModal modal={trecho.modal} />
      </p>
      <h1 className="titulo mt-1.5 text-[2.05rem] leading-[1.05]">{trecho.titulo}</h1>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {trecho.tipo === "experiência" ? (
          <Etiqueta cor="var(--color-ambar)">
            <Sparkles size={12} aria-hidden />
            Trecho-experiência
          </Etiqueta>
        ) : (
          <Etiqueta>Deslocamento</Etiqueta>
        )}
        {trecho.opcional && <Etiqueta>Opcional</Etiqueta>}
        {!trecho.confirmado && <AConfirmar />}
      </div>

      {!trecho.confirmado && trecho.aConfirmar && (
        <p className="mt-3 rounded-xl border border-dashed border-ambar/45 bg-ambar/[0.07] px-3.5 py-2.5 text-[13px] leading-snug text-papel">
          <span className="font-semibold text-ambar">Ainda não é oficial. </span>
          {trecho.aConfirmar}
        </p>
      )}

      <div className="mt-5 flex gap-4 rounded-2xl border border-linha p-4">
        <Ponta rotulo="Saída" estacao={trecho.estacoes?.de} {...trecho.dataHora.saida} />
        <div className="w-px bg-linha" aria-hidden />
        <Ponta rotulo="Chegada" estacao={trecho.estacoes?.para} {...trecho.dataHora.chegada} />
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 px-1 text-sm">
        <div>
          <dt className="rotulo">Duração</dt>
          <dd className="mt-0.5 text-papel">{trecho.duracao}</dd>
        </div>
        <div>
          <dt className="rotulo">Operador</dt>
          <dd className="mt-0.5 text-papel">{trecho.operador}</dd>
        </div>
        {trecho.preco && (
          <div>
            <dt className="rotulo">Preço</dt>
            <dd className="mt-0.5 text-papel">{trecho.preco}</dd>
          </div>
        )}
      </dl>

      {trecho.destaqueJanela && (
        <Secao titulo="Pela janela">
          <p className="flex gap-3 rounded-2xl bg-white/[0.05] p-4 text-[15px] leading-relaxed text-papel">
            <Eye size={17} className="mt-1 shrink-0 text-ambar" aria-hidden />
            {trecho.destaqueJanela}
          </p>
        </Secao>
      )}

      {trecho.dicas.length > 0 && (
        <Secao titulo="Antes de embarcar">
          <ul className="space-y-2 text-sm leading-relaxed text-papel">
            {trecho.dicas.map((d) => (
              <li key={d} className="flex gap-2.5">
                <Armchair size={14} className="mt-1 shrink-0 text-bruma" aria-hidden />
                {d}
              </li>
            ))}
          </ul>
        </Secao>
      )}

      {paradas.length > 2 && (
        <Secao titulo="Caminho">
          <ol className="relative ml-1 space-y-3 border-l border-linha pl-5">
            {paradas.map((p, i) => (
              <li key={`${p.nome}-${i}`} className="relative text-sm">
                <span
                  className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full border-2 bg-noite-900"
                  style={{ borderColor: m.cor }}
                  aria-hidden
                />
                <span className="text-papel">{p.nome}</span>
                {p.hora && <span className="ml-2 text-[13px] text-nevoa">{p.hora}</span>}
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-bruma">O traçado no mapa é aproximado.</p>
        </Secao>
      )}

      {reserva && (
        <Secao titulo="Reserva">
          <div className="rounded-2xl border border-linha px-3.5">
            <LinhaReserva r={reserva} />
          </div>
        </Secao>
      )}
    </article>
  );
}
