import { AnimatePresence, motion } from "framer-motion";
import { CalendarDays, Flag, type LucideIcon, ListChecks, MapPin, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cidadeDoLocal, paisDaCidade, rotuloDoDia, trip } from "../data";
import { navegar, type Rota } from "../router";
import { useApp } from "../store";
import { CATEGORIA, MODAL } from "./comuns";

interface Entrada {
  chave: string;
  titulo: string;
  sub: string;
  grupo: string;
  Icone: LucideIcon;
  rota: Rota;
  texto: string;
}

const limpar = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

function montarIndice(): Entrada[] {
  const e: Entrada[] = [];
  const add = (x: Omit<Entrada, "texto" | "chave"> & { extra?: string }) =>
    e.push({ ...x, chave: `${x.grupo}:${x.titulo}:${e.length}`, texto: limpar(`${x.titulo} ${x.sub} ${x.extra ?? ""}`) });

  for (const c of trip.cidades) {
    add({ titulo: c.nome, sub: `${paisDaCidade(c).nome} · ${c.datas.rotulo}`, grupo: "Cidades", Icone: MapPin, rota: { tipo: "cidade", id: c.id } });
  }
  for (const p of trip.paises) {
    add({ titulo: p.nome, sub: p.datas.rotulo, grupo: "Países", Icone: Flag, rota: { tipo: "pais", id: p.id } });
  }
  for (const l of trip.locais) {
    add({
      titulo: l.nome,
      sub: `${cidadeDoLocal(l).nome} · ${CATEGORIA[l.categoria].rotulo}`,
      grupo: "Locais e eventos",
      Icone: CATEGORIA[l.categoria].Icone,
      rota: { tipo: "local", id: l.id },
      extra: l.id.replace(/-/g, " "),
    });
  }
  trip.dias.forEach((d, i) => {
    const [, , dia] = d.data.split("-").map(Number);
    add({
      titulo: `${rotuloDoDia(d)} · ${d.titulo}`,
      sub: `Dia ${i + 1} de ${trip.dias.length}`,
      grupo: "Dias",
      Icone: CalendarDays,
      rota: { tipo: "dia", data: d.data },
      extra: `dia ${i + 1} ${dia} ${d.data} ${d.fimDeSemana ? "fim de semana" : ""}`,
    });
  });
  for (const t of trip.trechos) {
    add({
      titulo: t.titulo,
      sub: `${MODAL[t.modal].rotulo} · ${t.operador}`,
      grupo: "Trechos",
      Icone: MODAL[t.modal].Icone,
      rota: { tipo: "trecho", id: t.id },
      extra: "trem onibus voo",
    });
  }
  add({ titulo: "Reservas", sub: "Checklist com prazos e links oficiais", grupo: "Atalhos", Icone: ListChecks, rota: { tipo: "reservas" } });
  return e;
}

function pontuar(entrada: Entrada, termos: string[]) {
  const titulo = limpar(entrada.titulo);
  let pontos = 0;
  for (const t of termos) {
    if (!entrada.texto.includes(t)) return 0;
    if (titulo.startsWith(t)) pontos += 6;
    else if (titulo.includes(` ${t}`)) pontos += 4;
    else if (titulo.includes(t)) pontos += 3;
    else pontos += 1;
  }
  if (entrada.grupo === "Cidades") pontos += 1.5;
  if (entrada.grupo === "Países") pontos += 1;
  return pontos;
}

const SUGESTOES = ["coliseu", "bernabeu", "carnaval-de-veneza", "louvre", "vale-do-elba", "casa-anne-frank"];

export function Busca() {
  const aberta = useApp((s) => s.buscaAberta);
  const fechar = () => useApp.setState({ buscaAberta: false });
  const indice = useMemo(montarIndice, []);
  const [consulta, setConsulta] = useState("");
  const [cursor, setCursor] = useState(0);
  const lista = useRef<HTMLUListElement>(null);
  const anterior = useRef<Element | null>(null);

  const resultados = useMemo(() => {
    const termos = limpar(consulta).split(/\s+/).filter(Boolean);
    if (!termos.length) {
      return indice.filter((x) => x.rota.tipo === "local" && SUGESTOES.includes((x.rota as { id: string }).id));
    }
    return indice
      .map((x) => ({ x, p: pontuar(x, termos) }))
      .filter((r) => r.p > 0)
      .sort((a, b) => b.p - a.p)
      .slice(0, 30)
      .map((r) => r.x);
  }, [consulta, indice]);

  useEffect(() => setCursor(0), [consulta]);
  useEffect(() => {
    if (aberta) {
      anterior.current = document.activeElement;
      setConsulta("");
    } else if (anterior.current instanceof HTMLElement) {
      anterior.current.focus();
    }
  }, [aberta]);
  useEffect(() => {
    const caixa = lista.current;
    const item = caixa?.querySelector<HTMLElement>(`[data-i="${cursor}"]`);
    if (!caixa || !item) return;
    if (item.offsetTop < caixa.scrollTop) caixa.scrollTop = item.offsetTop - 6;
    else if (item.offsetTop + item.offsetHeight > caixa.scrollTop + caixa.clientHeight) {
      caixa.scrollTop = item.offsetTop + item.offsetHeight - caixa.clientHeight + 6;
    }
  }, [cursor]);

  const escolher = (x: Entrada | undefined) => {
    if (!x) return;
    fechar();
    navegar(x.rota);
  };

  return (
    <AnimatePresence>
      {aberta && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/55 px-3 pt-[12vh] backdrop-blur-[3px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onPointerDown={(e) => e.target === e.currentTarget && fechar()}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Busca"
            initial={{ y: -12, scale: 0.98 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: -8, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="vidro w-full max-w-xl overflow-hidden rounded-2xl"
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                fechar();
              } else if (e.key === "ArrowDown") {
                e.preventDefault();
                setCursor((c) => Math.min(resultados.length - 1, c + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setCursor((c) => Math.max(0, c - 1));
              } else if (e.key === "Enter") {
                e.preventDefault();
                escolher(resultados[cursor]);
              } else if (e.key === "Tab") {
                e.preventDefault(); // o foco fica no campo: a lista se navega com as setas
              }
            }}
          >
            <div className="flex items-center gap-3 border-b border-linha px-4">
              <Search size={18} className="shrink-0 text-bruma" aria-hidden />
              <input
                autoFocus
                type="text"
                role="combobox"
                aria-expanded="true"
                aria-controls="busca-resultados"
                aria-activedescendant={resultados[cursor] ? `busca-${cursor}` : undefined}
                aria-label="Buscar cidade, local, evento ou dia"
                placeholder="Buscar cidade, local, evento ou dia"
                value={consulta}
                onChange={(e) => setConsulta(e.target.value)}
                className="h-14 w-full bg-transparent text-base text-papel outline-none placeholder:text-bruma"
              />
              <kbd className="shrink-0 rounded border border-linha px-1.5 py-0.5 text-[11px] text-bruma">Esc</kbd>
            </div>
            <ul ref={lista} id="busca-resultados" role="listbox" aria-label="Resultados" className="rolagem relative max-h-[52vh] p-1.5">
              {!consulta && <li className="px-3 pb-1 pt-2 text-xs font-medium text-bruma" role="presentation">Para começar</li>}
              {resultados.map((x, i) => (
                <li
                  key={x.chave}
                  id={`busca-${i}`}
                  data-i={i}
                  role="option"
                  aria-selected={i === cursor}
                  onPointerMove={() => setCursor(i)}
                  onClick={() => escolher(x)}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 ${i === cursor ? "bg-white/[0.09]" : ""}`}
                >
                  <x.Icone size={16} className="shrink-0 text-ambar" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-papel">{x.titulo}</span>
                    <span className="block truncate text-xs text-nevoa">{x.sub}</span>
                  </span>
                  <span className="shrink-0 text-[11px] text-bruma">{x.grupo}</span>
                </li>
              ))}
              {consulta && resultados.length === 0 && (
                <li className="px-3 py-8 text-center text-sm text-nevoa" role="presentation">
                  Nada encontrado para “{consulta}”. Tente o nome de uma cidade, um lugar ou uma data, como “30”.
                </li>
              )}
            </ul>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
