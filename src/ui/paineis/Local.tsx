import { CalendarDays, Clock, DoorOpen, ExternalLink, Hourglass, Navigation, Ticket } from "lucide-react";
import { diaPorData, rotuloDoDia, vizinhosNoDia } from "../../data";
import type { Place } from "../../data/schema";
import { AConfirmar, CATEGORIA, Etiqueta, Foto, Ir, LinhaInfo, Secao } from "../comuns";
import { AnteriorProximo, StatusReserva } from "./partes";

export function PainelLocal({ local }: { local: Place }) {
  const cat = CATEGORIA[local.categoria];
  const dia = diaPorData.get(local.dia);
  const { anterior, proximo, posicao, total, dia: diaDaSequencia } = vizinhosNoDia(local);
  const ing = local.ingresso;

  return (
    <article>
      <Foto
        imagem={local.imagem}
        alt={local.nome}
        Icone={cat.Icone}
        cor={cat.cor}
        prioridade
        className="-mx-5 -mt-5 h-44 md:h-52"
      />

      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        <Etiqueta cor={cat.cor}>
          <cat.Icone size={12} aria-hidden />
          {cat.rotulo}
        </Etiqueta>
        {local.opcional && <Etiqueta>Opcional</Etiqueta>}
        {!local.confirmado && <AConfirmar />}
      </div>

      <h1 className="titulo mt-2.5 text-[2.05rem] leading-[1.05]">{local.nome}</h1>

      <p className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-nevoa">
        {dia && (
          <Ir para={{ tipo: "dia", data: dia.data }} className="inline-flex items-center gap-1.5 text-ambar underline-offset-4 hover:underline">
            <CalendarDays size={13} aria-hidden />
            {rotuloDoDia(dia)}
          </Ir>
        )}
        <span className="inline-flex items-center gap-1.5">
          <Clock size={13} aria-hidden />
          {local.horario}
        </span>
      </p>

      {!local.confirmado && local.aConfirmar && (
        <p className="mt-3 rounded-xl border border-dashed border-ambar/45 bg-ambar/[0.07] px-3.5 py-2.5 text-[13px] leading-snug text-papel">
          <span className="font-semibold text-ambar">Ainda não é oficial. </span>
          {local.aConfirmar}
        </p>
      )}

      <Secao titulo="O que é">
        <p className="text-[15px] leading-[1.65] text-papel">{local.oQueE}</p>
      </Secao>

      <Secao titulo="Por que vale a pena">
        <p className="titulo border-l-2 border-ambar pl-4 text-[1.18rem] italic leading-snug text-papel">{local.porQueVale}</p>
      </Secao>

      <Secao titulo="Dicas do roteiro">
        <dl className="divide-y divide-linha rounded-2xl border border-linha px-3.5">
          <LinhaInfo Icone={Clock} rotulo="Horário ideal">{local.dicas.horarioIdeal}</LinhaInfo>
          <LinhaInfo Icone={DoorOpen} rotulo="Entrar ou ver de fora">{local.dicas.entrar}</LinhaInfo>
          <LinhaInfo Icone={Hourglass} rotulo="Quanto tempo reservar">{local.dicas.tempo}</LinhaInfo>
        </dl>
      </Secao>

      <Secao titulo="Ingresso">
        <div className="rounded-2xl border border-linha p-4">
          <div className="flex items-start justify-between gap-3">
            <p className="flex items-start gap-2.5 text-[15px] font-semibold leading-snug text-papel">
              <Ticket size={16} className="mt-0.5 shrink-0 text-ambar" aria-hidden />
              {ing.preco}
            </p>
            {ing.reservaId && <StatusReserva id={ing.reservaId} verbo="comprar" />}
          </div>
          <p className="mt-2 text-[13px] text-nevoa">
            {ing.reservaObrigatoria ? "Exige reserva com hora marcada." : "Não exige reserva."}
            {ing.nota ? ` ${ing.nota}` : ""}
          </p>
          {ing.link && (
            <a
              href={ing.link}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-azul underline-offset-4 hover:underline"
            >
              Site oficial: {new URL(ing.link).hostname.replace(/^www\./, "")}
              <ExternalLink size={12} aria-hidden />
              <span className="sr-only">(abre em nova aba)</span>
            </a>
          )}
        </div>
      </Secao>

      <Secao titulo="Como chegar">
        <p className="flex gap-2.5 text-sm leading-relaxed text-papel">
          <Navigation size={15} className="mt-1 shrink-0 text-bruma" aria-hidden />
          {local.comoChegar}
        </p>
      </Secao>

      {total > 1 && (
        <AnteriorProximo
          meio={diaDaSequencia ? `${posicao} de ${total} no roteiro de ${rotuloDoDia(diaDaSequencia)}` : undefined}
          anterior={anterior && { rota: { tipo: "local", id: anterior.id }, rotulo: anterior.nome }}
          proximo={proximo && { rota: { tipo: "local", id: proximo.id }, rotulo: proximo.nome }}
        />
      )}
    </article>
  );
}
