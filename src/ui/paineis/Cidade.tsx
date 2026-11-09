import { BedDouble, Landmark, Luggage, TramFront, TriangleAlert } from "lucide-react";
import { useRef, useState } from "react";
import { diasDaCidade, locaisDaCidade, localPorId, paisDaCidade, reservasDaCidade, rotuloDoDia, trechosDaCidade } from "../../data";
import type { Categoria, City } from "../../data/schema";
import { Bandeira, CATEGORIA, Foto, Ir, LinhaInfo, Secao } from "../comuns";
import { CabecalhoDoDia, CartaoLocal, CartaoTrecho, Cascata, Degrau, Intensidade, LinhaReserva, RoteiroDoDia } from "./partes";

const ABAS = [
  { id: "roteiro", rotulo: "Roteiro" },
  { id: "lugares", rotulo: "Lugares" },
  { id: "comer", rotulo: "Comer & noite" },
  { id: "pratico", rotulo: "Prático" },
] as const;
type Aba = (typeof ABAS)[number]["id"];

const ORDEM_LUGARES: Categoria[] = ["ancora", "classico", "mirante", "bate-volta", "transporte", "hostel"];
const TIPO: Record<City["tipo"], string> = {
  base: "base",
  parada: "parada sem pernoite",
  "bate-volta": "bate-volta",
  travessia: "vista do trem",
};

function Abas({ ativa, aoTrocar }: { ativa: Aba; aoTrocar: (a: Aba) => void }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  return (
    <div
      role="tablist"
      aria-label="Seções da cidade"
      className="sticky top-0 z-10 -mx-5 mt-5 flex gap-1 border-b border-linha bg-noite-900/85 px-4 backdrop-blur-md"
      onKeyDown={(e) => {
        const i = ABAS.findIndex((a) => a.id === ativa);
        const passo = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
        if (!passo) return;
        e.preventDefault();
        const novo = (i + passo + ABAS.length) % ABAS.length;
        aoTrocar(ABAS[novo].id);
        refs.current[novo]?.focus();
      }}
    >
      {ABAS.map((a, i) => (
        <button
          key={a.id}
          ref={(el) => {
            refs.current[i] = el;
          }}
          role="tab"
          type="button"
          id={`aba-${a.id}`}
          aria-selected={ativa === a.id}
          aria-controls={`conteudo-${a.id}`}
          tabIndex={ativa === a.id ? 0 : -1}
          onClick={() => aoTrocar(a.id)}
          className={`relative whitespace-nowrap px-2.5 py-3 text-[13px] font-medium transition-colors ${
            ativa === a.id ? "text-papel" : "text-bruma hover:text-nevoa"
          }`}
        >
          {a.rotulo}
          {ativa === a.id && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-ambar" />}
        </button>
      ))}
    </div>
  );
}

export function PainelCidade({ cidade }: { cidade: City }) {
  const [aba, setAba] = useState<Aba>("roteiro");
  const pais = paisDaCidade(cidade);
  const dias = diasDaCidade(cidade.id);
  const locais = locaisDaCidade(cidade.id);
  const { chegada, saida } = trechosDaCidade(cidade.id);
  const reservas = reservasDaCidade(cidade.id);
  const comida = locais.filter((l) => l.categoria === "comida");
  const hostel = localPorId.get(`hostel-${cidade.id}`);

  return (
    <div>
      <Foto
        imagem={cidade.imagem}
        alt={`Vista de ${cidade.nome}`}
        Icone={Landmark}
        prioridade
        className="-mx-5 -mt-5 h-40 md:h-44"
      />
      <p className="mt-4 flex flex-wrap items-center gap-x-1.5 text-[13px] text-ambar">
        <Bandeira pais={pais.id} largura={18} className="mr-0.5" />
        {cidade.datas.rotulo}
        <span className="text-bruma">
          {"· "}
          {cidade.noites > 0 ? `${cidade.noites} ${cidade.noites === 1 ? "noite" : "noites"}` : TIPO[cidade.tipo]}
          {cidade.opcional ? " · opcional" : ""}
        </span>
      </p>
      <h1 className="titulo mt-1 text-[2.3rem] leading-none">{cidade.nome}</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-nevoa">
        <span className="font-medium text-papel">Por que estamos aqui: </span>
        {cidade.porQue}
      </p>

      <Abas ativa={aba} aoTrocar={setAba} />

      <div role="tabpanel" id={`conteudo-${aba}`} aria-labelledby={`aba-${aba}`} className="pt-5">
        {aba === "roteiro" && (
          <Cascata className="space-y-6">
            {dias.length === 0 && <p className="text-sm text-nevoa">Sem programação própria: passamos de trem.</p>}
            {dias.map((d) => (
              <Degrau key={d.data}>
                <CabecalhoDoDia dia={d} />
                <RoteiroDoDia dia={d} soCidade={cidade.id} />
              </Degrau>
            ))}
          </Cascata>
        )}

        {aba === "lugares" && (
          <div>
            {ORDEM_LUGARES.map((cat) => {
              const grupo = locais.filter((l) => l.categoria === cat);
              if (!grupo.length) return null;
              return (
                <Secao key={cat} titulo={CATEGORIA[cat].plural}>
                  <Cascata className="space-y-2">
                    {grupo.map((l) => (
                      <Degrau key={l.id}>
                        <CartaoLocal local={l} />
                      </Degrau>
                    ))}
                  </Cascata>
                </Secao>
              );
            })}
            {locais.length === 0 && <p className="text-sm text-nevoa">Nenhum local marcado nesta cidade.</p>}
          </div>
        )}

        {aba === "comer" && (
          <div>
            {comida.length > 0 && (
              <Secao titulo="Onde comer o típico">
                <Cascata className="space-y-2">
                  {comida.map((l) => (
                    <Degrau key={l.id}>
                      <CartaoLocal local={l} />
                    </Degrau>
                  ))}
                </Cascata>
              </Secao>
            )}
            <Secao titulo="O plano de cada noite">
              <div className="space-y-4">
                {dias
                  .filter((d) => d.noite)
                  .map((d) => (
                    <div key={d.data} className="rounded-2xl border border-linha p-3.5">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <Ir para={{ tipo: "dia", data: d.data }} className="text-[13px] font-semibold text-ambar underline-offset-4 hover:underline">
                          {rotuloDoDia(d)}
                        </Ir>
                        <Intensidade nivel={d.intensidadeNoite} />
                      </div>
                      <ol className="space-y-1.5">
                        {d.noite!.itens.map((it, i) => {
                          const l = it.local ? localPorId.get(it.local) : undefined;
                          return (
                            <li key={i} className="text-sm leading-snug">
                              {l ? (
                                <Ir para={{ tipo: "local", id: l.id }} className="item-clicavel -mx-2 block rounded-lg px-2 py-1 text-papel">
                                  {it.texto}
                                </Ir>
                              ) : (
                                <span className="block py-1 text-nevoa">{it.texto}</span>
                              )}
                            </li>
                          );
                        })}
                      </ol>
                    </div>
                  ))}
                {dias.every((d) => !d.noite) && <p className="text-sm text-nevoa">Sem noite nesta cidade.</p>}
              </div>
            </Secao>
          </div>
        )}

        {aba === "pratico" && (
          <div>
            {cidade.hostel && (
              <Secao titulo="Hostel sugerido">
                <div className="rounded-2xl border border-linha p-4">
                  <p className="flex items-center gap-2 text-[15px] font-semibold">
                    <BedDouble size={16} className="text-azul" aria-hidden />
                    {hostel ? (
                      <Ir para={{ tipo: "local", id: hostel.id }} className="underline-offset-4 hover:underline">
                        {cidade.hostel.nome}
                      </Ir>
                    ) : (
                      cidade.hostel.nome
                    )}
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-nevoa">{cidade.hostel.porQue}</p>
                  {cidade.hostel.alternativas && (
                    <p className="mt-2 text-[13px] text-bruma">Alternativas: {cidade.hostel.alternativas.join(" · ")}</p>
                  )}
                </div>
              </Secao>
            )}

            {(chegada.length > 0 || saida.length > 0) && (
              <Secao titulo="Como chegar e sair">
                <div className="space-y-2">
                  {chegada.map((t) => (
                    <CartaoTrecho key={t.id} trecho={t} papel="Chegada" />
                  ))}
                  {saida.map((t) => (
                    <CartaoTrecho key={t.id} trecho={t} papel={t.modal === "bate-volta" ? "Ida e volta" : "Saída"} />
                  ))}
                </div>
              </Secao>
            )}

            <Secao titulo="No dia a dia">
              <dl className="divide-y divide-linha rounded-2xl border border-linha px-3.5">
                <LinhaInfo Icone={TramFront} rotulo="Transporte local">{cidade.transporteLocal}</LinhaInfo>
                <LinhaInfo Icone={Luggage} rotulo="Guarda-volumes">{cidade.guardaVolumes}</LinhaInfo>
              </dl>
            </Secao>

            {reservas.length > 0 && (
              <Secao titulo="Reservas desta cidade">
                <div className="divide-y divide-linha rounded-2xl border border-linha px-3.5">
                  {reservas.map((r) => (
                    <LinhaReserva key={r.id} r={r} />
                  ))}
                </div>
              </Secao>
            )}

            {cidade.alertas.length > 0 && (
              <Secao titulo="Atenção">
                <ul className="space-y-2">
                  {cidade.alertas.map((a) => (
                    <li key={a} className="flex gap-2.5 rounded-xl bg-ambar/[0.08] px-3.5 py-2.5 text-sm leading-snug text-papel">
                      <TriangleAlert size={15} className="mt-0.5 shrink-0 text-ambar" aria-hidden />
                      {a}
                    </li>
                  ))}
                </ul>
              </Secao>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
