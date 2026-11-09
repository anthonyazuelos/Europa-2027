import { ChevronRight, ListChecks, Moon, TrainFront, Trophy, VenetianMask } from "lucide-react";
import { useMemo } from "react";
import { bases, dataCurta, diaPorData, trechoPorId, trip } from "../../data";
import { useApp } from "../../store";
import { Bandeira, Ir, Secao } from "../comuns";
import { Cascata, Degrau } from "./partes";

const ICONE_DESTAQUE = { estadio: Trophy, mascara: VenetianMask, lua: Moon, trem: TrainFront } as const;

interface Noite {
  data: string;
  onde: string;
  /** Noites seguidas no mesmo lugar: dá a intensidade da cor. */
  seguidas: number;
  transporte: boolean;
  rota: string;
}

/** Uma célula por noite, na ordem da viagem. */
function noitesDaViagem(): Noite[] {
  const porData = new Map<string, Noite>();
  for (const c of bases) {
    const inicio = new Date(`${c.datas.inicio}T12:00:00Z`);
    for (let n = 0; n < c.noites; n++) {
      const data = new Date(inicio.getTime() + n * 86_400_000).toISOString().slice(0, 10);
      porData.set(data, { data, onde: c.nome, seguidas: c.noites, transporte: false, rota: `/cidade/${c.id}` });
    }
  }
  for (const d of trip.dias) {
    if (!d.noiteEmTransporte) continue;
    const t = trechoPorId.get(d.noiteEmTransporte)!;
    porData.set(d.data, {
      data: d.data,
      onde: t.modal === "onibus-noturno" ? "Ônibus noturno" : t.operador.replace(/ (ES|NJ) ?\d+$/, ""),
      seguidas: 1,
      transporte: true,
      rota: `/trecho/${t.id}`,
    });
  }
  return trip.dias.slice(0, -1).map((d) => porData.get(d.data)!).filter(Boolean);
}

function MapaDeNoites() {
  const noites = useMemo(noitesDaViagem, []);
  const grupos = useMemo(() => {
    const saida: { onde: string; noites: Noite[] }[] = [];
    for (const n of noites) {
      const ultimo = saida[saida.length - 1];
      if (ultimo && ultimo.onde === n.onde) ultimo.noites.push(n);
      else saida.push({ onde: n.onde, noites: [n] });
    }
    return saida;
  }, [noites]);

  return (
    <div>
      <div className="flex gap-[3px]" role="list" aria-label="Onde passamos cada noite">
        {noites.map((n) => (
          <Ir
            key={n.data}
            para={n.rota}
            role="listitem"
            title={`Noite de ${dataCurta(n.data)}: ${n.onde}`}
            aria-label={`Noite de ${dataCurta(n.data)}: ${n.onde}`}
            className="h-9 flex-1 rounded-[5px] transition-transform hover:-translate-y-0.5"
            style={{
              background: n.transporte
                ? "linear-gradient(160deg, #58a6ff, #b98cff)"
                : `rgb(255 181 71 / ${0.28 + n.seguidas * 0.22})`,
            }}
          />
        ))}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13px]">
        {grupos.map((g) => (
          <li key={g.noites[0].data} className="flex items-baseline justify-between gap-2">
            <Ir para={g.noites[0].rota} className="truncate text-papel underline-offset-4 hover:underline">
              {g.noites[0].transporte && <Moon size={11} className="mr-1 inline text-violeta" aria-hidden />}
              {g.onde}
            </Ir>
            <span className="shrink-0 tabular-nums text-bruma">
              {g.noites.length} {g.noites.length === 1 ? "noite" : "noites"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function rotuloNoites(noites: number, status: string) {
  if (status === "atravessado") return "atravessada à noite";
  if (noites === 0) return "sem pernoite";
  return `${noites} ${noites === 1 ? "noite" : "noites"}`;
}

export function PainelEuropa() {
  const v = trip.viagem;
  const feitas = useApp((s) => s.reservasFeitas);
  const pendentes = trip.reservas.filter((r) => !feitas[r.id]).length;

  return (
    <div>
      <p className="text-[13px] font-medium text-ambar">15 jan → 4 fev de 2027</p>
      <h1 className="titulo mt-1 text-[2.6rem] leading-none">{v.titulo}</h1>
      <p className="mt-2 text-[15px] text-nevoa">{v.subtitulo}</p>

      <p className="titulo mt-6 text-[1.35rem] leading-snug text-papel">
        {v.resumo.dias} dias, {v.resumo.noites} noites, {v.resumo.paisesVisitados} países visitados e a Alemanha
        atravessada de trem noturno.
      </p>
      <p className="mt-3 text-sm leading-relaxed text-nevoa">{v.resumo.texto}</p>

      <Secao titulo="Onde passamos cada noite">
        <MapaDeNoites />
      </Secao>

      <Secao titulo="Destaques da viagem">
        <Cascata className="space-y-2">
          {v.destaques.map((d) => {
            const Icone = ICONE_DESTAQUE[d.icone];
            return (
              <Degrau key={d.titulo}>
                <Ir para={d.rota} className="item-clicavel group flex items-start gap-3 rounded-2xl border border-linha p-3.5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-ambar/15 text-ambar">
                    <Icone size={18} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-papel">{d.titulo}</span>
                    <span className="mt-0.5 block text-[13px] leading-snug text-nevoa">{d.texto}</span>
                  </span>
                  <ChevronRight size={16} className="mt-2 shrink-0 text-bruma transition-transform group-hover:translate-x-0.5" aria-hidden />
                </Ir>
              </Degrau>
            );
          })}
        </Cascata>
      </Secao>

      <Secao titulo="Os três fins de semana">
        <ul className="divide-y divide-linha rounded-2xl border border-linha">
          {v.fimDeSemanas.map((f) => (
            <li key={f.dia}>
              <Ir para={{ tipo: "dia", data: f.dia }} className="item-clicavel flex items-center gap-3 px-3.5 py-3 text-sm first:rounded-t-2xl last:rounded-b-2xl">
                <span className="w-[4.6rem] shrink-0 font-medium tabular-nums text-ambar">{f.rotulo}</span>
                <span className="flex-1 text-papel">{f.onde}</span>
                {diaPorData.get(f.dia)?.destaque && <VenetianMask size={15} className="text-ambar" aria-hidden />}
                <ChevronRight size={15} className="text-bruma" aria-hidden />
              </Ir>
            </li>
          ))}
        </ul>
      </Secao>

      <Secao titulo="Países">
        <Cascata className="divide-y divide-linha rounded-2xl border border-linha">
          {trip.paises.map((p) => (
            <Degrau key={p.id}>
              <Ir para={{ tipo: "pais", id: p.id }} className="item-clicavel group flex items-center gap-3 px-3.5 py-3">
                <Bandeira pais={p.id} largura={30} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-papel">{p.nome}</span>
                  <span className="block text-[13px] text-nevoa">
                    {p.datas.rotulo} · {rotuloNoites(p.noites, p.status)}
                  </span>
                </span>
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: p.cor }} aria-hidden />
                <ChevronRight size={16} className="shrink-0 text-bruma transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Ir>
            </Degrau>
          ))}
        </Cascata>
      </Secao>

      <Secao>
        <Ir para={{ tipo: "reservas" }} className="item-clicavel flex items-center gap-3 rounded-2xl border border-ambar/35 bg-ambar/[0.07] p-3.5">
          <ListChecks size={18} className="text-ambar" aria-hidden />
          <span className="flex-1 text-sm">
            <span className="font-semibold text-papel">Reservas</span>
            <span className="block text-[13px] text-nevoa">
              {pendentes === 0 ? "Tudo reservado." : `${pendentes} de ${trip.reservas.length} ainda por fazer`}
            </span>
          </span>
          <ChevronRight size={16} className="text-bruma" aria-hidden />
        </Ir>
      </Secao>
    </div>
  );
}
