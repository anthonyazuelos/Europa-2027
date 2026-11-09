import { Moon, Star } from "lucide-react";
import { cidadePorId, numeroDoDia, paisDaCidade, rotuloDoDia, rotuloLongoDoDia, trechoPorId, trip } from "../../data";
import type { Day } from "../../data/schema";
import { Bandeira, Etiqueta, Ir, Secao } from "../comuns";
import { AnteriorProximo, CartaoTrecho, Intensidade, RoteiroDoDia } from "./partes";

export function PainelDia({ dia }: { dia: Day }) {
  const i = trip.dias.findIndex((d) => d.data === dia.data);
  const anterior = trip.dias[i - 1];
  const proximo = trip.dias[i + 1];
  const cidades = [dia.cidade, ...(dia.cidadesExtras ?? [])].map((id) => cidadePorId.get(id)!);
  const trechos = (dia.trechos ?? []).map((id) => trechoPorId.get(id)!);

  return (
    <article>
      <p className="text-[13px] font-medium text-ambar">
        Dia {numeroDoDia(dia.data)} de {trip.dias.length} · {rotuloLongoDoDia(dia)}
      </p>
      <h1 className="titulo mt-1 text-[2rem] leading-[1.08]">{dia.titulo}</h1>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {cidades.map((c) => (
          <Ir key={c.id} para={{ tipo: "cidade", id: c.id }} className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.07] px-2.5 py-1 text-xs font-medium text-papel hover:bg-white/[0.12]">
            <Bandeira pais={paisDaCidade(c).id} largura={15} />
            {c.nome}
          </Ir>
        ))}
        {dia.fimDeSemana && <Etiqueta>Fim de semana</Etiqueta>}
        {dia.destaque && (
          <Etiqueta cor="var(--color-ambar)">
            <Star size={11} className="fill-current" aria-hidden />
            Dia-âncora
          </Etiqueta>
        )}
        {dia.noiteEmTransporte && (
          <Etiqueta cor="var(--color-violeta)">
            <Moon size={11} aria-hidden />
            Noite a bordo
          </Etiqueta>
        )}
      </div>
      <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-nevoa">
        {dia.ritmo && <span>{dia.ritmo}</span>}
        <Intensidade nivel={dia.intensidadeNoite} />
      </p>

      <Secao>
        <RoteiroDoDia dia={dia} />
      </Secao>

      {trechos.length > 0 && (
        <Secao titulo={trechos.length === 1 ? "Deslocamento do dia" : "Deslocamentos do dia"}>
          <div className="space-y-2">
            {trechos.map((t) => (
              <CartaoTrecho key={t.id} trecho={t} />
            ))}
          </div>
        </Secao>
      )}

      {dia.observacoes.length > 0 && (
        <Secao titulo="Para não esquecer">
          <ul className="space-y-2 text-sm leading-relaxed text-nevoa">
            {dia.observacoes.map((o) => (
              <li key={o} className="flex gap-2.5">
                <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-ambar" aria-hidden />
                {o}
              </li>
            ))}
          </ul>
        </Secao>
      )}

      <AnteriorProximo
        anterior={anterior && { rota: { tipo: "dia", data: anterior.data }, rotulo: rotuloDoDia(anterior) }}
        proximo={proximo && { rota: { tipo: "dia", data: proximo.data }, rotulo: rotuloDoDia(proximo) }}
      />
    </article>
  );
}
