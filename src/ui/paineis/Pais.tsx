import {
  ChevronRight,
  Coins,
  HandCoins,
  Languages,
  MessageCircle,
  Moon,
  Plug,
  ShieldCheck,
  Sunset,
  Thermometer,
} from "lucide-react";
import { cidadePorId, cidadesDoPais, locaisDoPais, localPorId, paisesDoTrecho, trechoPorId, trip } from "../../data";
import type { City, Country } from "../../data/schema";
import { Bandeira, Foto, Ir, LinhaInfo, Secao } from "../comuns";
import { Landmark } from "lucide-react";
import { CartaoLocal, CartaoTrecho, Cascata, Degrau } from "./partes";

const TIPO: Record<City["tipo"], string> = {
  base: "Base",
  parada: "Parada sem pernoite",
  "bate-volta": "Bate-volta",
  travessia: "Vista do trem",
};

function CartaoCidade({ cidade }: { cidade: City }) {
  return (
    <Ir para={{ tipo: "cidade", id: cidade.id }} className="item-clicavel group block overflow-hidden rounded-2xl border border-linha">
      <Foto imagem={cidade.imagem} alt={`Vista de ${cidade.nome}`} Icone={Landmark} className="h-32 w-full" />
      <div className="p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="titulo text-[1.45rem] leading-tight">{cidade.nome}</h3>
          <ChevronRight size={16} className="shrink-0 text-bruma transition-transform group-hover:translate-x-0.5" aria-hidden />
        </div>
        <p className="mt-0.5 text-[13px] text-ambar">
          {cidade.datas.rotulo}
          <span className="text-bruma">
            {" · "}
            {cidade.noites > 0 ? `${cidade.noites} ${cidade.noites === 1 ? "noite" : "noites"}` : TIPO[cidade.tipo].toLowerCase()}
            {cidade.opcional ? " · opcional" : ""}
          </span>
        </p>
        <p className="mt-2 text-sm leading-relaxed text-nevoa">{cidade.porQue}</p>
        <ul className="mt-3 space-y-1 text-[13px] text-papel">
          {cidade.destaques.map((d) => (
            <li key={d} className="flex gap-2">
              <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-ambar" aria-hidden />
              {d}
            </li>
          ))}
        </ul>
      </div>
    </Ir>
  );
}

function Essencial({ pais }: { pais: Country }) {
  const e = pais.essencial;
  return (
    <dl className="divide-y divide-linha rounded-2xl border border-linha px-3.5">
      <LinhaInfo Icone={Coins} rotulo="Moeda">{e.moeda}</LinhaInfo>
      <LinhaInfo Icone={Plug} rotulo="Tomada">{e.tomada}</LinhaInfo>
      <LinhaInfo Icone={Languages} rotulo="Idioma">{e.idioma}</LinhaInfo>
      <LinhaInfo Icone={HandCoins} rotulo="Gorjeta">{e.gorjeta}</LinhaInfo>
      <LinhaInfo Icone={ShieldCheck} rotulo="Segurança">{e.seguranca}</LinhaInfo>
      <LinhaInfo Icone={MessageCircle} rotulo="Frase útil">
        <span className="titulo text-[1.05rem] italic" lang={pais.id === "portugal" ? "pt-PT" : undefined}>
          “{e.fraseUtil.frase}”
        </span>
        <span className="mt-0.5 block text-[13px] text-nevoa">{e.fraseUtil.traducao}</span>
      </LinhaInfo>
      <LinhaInfo Icone={Thermometer} rotulo="Clima em janeiro">{e.clima}</LinhaInfo>
      <LinhaInfo Icone={Sunset} rotulo="Pôr do sol">{e.porDoSol}</LinhaInfo>
    </dl>
  );
}

export function PainelPais({ pais }: { pais: Country }) {
  const cidades = cidadesDoPais(pais.id);
  const trechos = trip.trechos.filter((t) => paisesDoTrecho(t).includes(pais.id));
  const hospedeira = pais.dentroDe ? cidadePorId.get(pais.dentroDe) : undefined;
  const locais = pais.dentroDe ? locaisDoPais(pais.id) : [];

  return (
    <div>
      <div className="flex items-start gap-4">
        <Bandeira pais={pais.id} largura={60} className="mt-1 !rounded-md" />
        <div className="min-w-0">
          <h1 className="titulo text-[2.2rem] leading-none">{pais.nome}</h1>
          <p className="mt-1.5 text-[13px] text-ambar">
            {pais.datas.rotulo}
            <span className="text-bruma">
              {" · "}
              {pais.status === "atravessado"
                ? "atravessada, sem descer"
                : pais.noites > 0
                  ? `${pais.noites} ${pais.noites === 1 ? "noite" : "noites"}`
                  : "sem pernoite"}
            </span>
          </p>
        </div>
      </div>
      <p className="mt-4 text-[15px] leading-relaxed text-nevoa">{pais.resumo}</p>

      {pais.travessia && (
        <Secao>
          <div className="rounded-2xl border border-violeta/30 bg-gradient-to-br from-[#1a2350]/70 to-[#2a1d55]/50 p-4">
            <p className="flex items-center gap-2 text-[13px] font-semibold text-violeta">
              <Moon size={15} aria-hidden />
              {pais.travessia.titulo}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-papel">{pais.travessia.texto}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-[13px] font-medium">
              <Ir para={{ tipo: "trecho", id: pais.travessia.trecho }} className="rounded-full bg-white/10 px-3 py-1.5 hover:bg-white/15">
                Ver o trecho {trechoPorId.get(pais.travessia.trecho)!.titulo}
              </Ir>
              {pais.travessia.local && (
                <Ir para={{ tipo: "local", id: pais.travessia.local }} className="rounded-full bg-white/10 px-3 py-1.5 hover:bg-white/15">
                  {localPorId.get(pais.travessia.local)!.nome}
                </Ir>
              )}
            </div>
          </div>
        </Secao>
      )}

      {hospedeira && (
        <Secao titulo={`Dentro de ${hospedeira.nome}`}>
          <p className="mb-3 text-sm leading-relaxed text-nevoa">
            É um país, mas no roteiro funciona como um bairro de {hospedeira.nome}: entramos a pé, na terça de manhã.
          </p>
          <Cascata className="space-y-2">
            {locais.map((l) => (
              <Degrau key={l.id}>
                <CartaoLocal local={l} />
              </Degrau>
            ))}
            <Degrau>
              <Ir para={{ tipo: "cidade", id: hospedeira.id }} className="item-clicavel flex items-center justify-between rounded-2xl border border-linha px-4 py-3 text-sm font-medium">
                Ver {hospedeira.nome} inteira
                <ChevronRight size={16} className="text-bruma" aria-hidden />
              </Ir>
            </Degrau>
          </Cascata>
        </Secao>
      )}

      <Secao titulo="Essencial do país">
        <Essencial pais={pais} />
      </Secao>

      {trechos.length > 0 && (
        <Secao titulo={pais.status === "atravessado" ? "A travessia" : "A rota no país"}>
          <ol className="relative space-y-2 before:absolute before:bottom-6 before:left-[7px] before:top-6 before:w-px before:bg-linha">
            {trechos.map((t) => (
              <li key={t.id} className="relative pl-6">
                <span className="absolute left-0 top-5 h-[15px] w-[15px] rounded-full border-2 border-ambar bg-noite-900" aria-hidden />
                <CartaoTrecho trecho={t} />
              </li>
            ))}
          </ol>
        </Secao>
      )}

      {!pais.dentroDe && cidades.length > 0 && (
        <Secao titulo={pais.status === "atravessado" ? "Pela janela" : cidades.length === 1 ? "Cidade" : "Cidades"}>
          <Cascata className="space-y-3">
            {cidades.map((c) => (
              <Degrau key={c.id}>
                <CartaoCidade cidade={c} />
              </Degrau>
            ))}
          </Cascata>
        </Secao>
      )}
    </div>
  );
}
