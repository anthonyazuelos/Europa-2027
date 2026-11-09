import { rotuloDaData, trechoPorId } from "../data";
import { useApp } from "../store";
import { AConfirmar, MODAL } from "./comuns";

/** Tooltip que acompanha o cursor sobre um trecho da rota. */
export function DicaTrecho() {
  const alvo = useApp((s) => s.trechoSobCursor);
  if (!alvo) return null;
  const t = trechoPorId.get(alvo.id);
  if (!t) return null;
  const m = MODAL[t.modal];
  const largura = 280;
  const x = Math.min(alvo.x + 16, window.innerWidth - largura - 12);
  const y = Math.min(alvo.y + 18, window.innerHeight - 190);

  return (
    <div
      role="tooltip"
      className="vidro pointer-events-none absolute z-40 rounded-2xl p-3.5"
      style={{ left: x, top: y, width: largura }}
    >
      <p className="flex items-center gap-2 text-xs font-medium" style={{ color: m.cor }}>
        <m.Icone size={13} aria-hidden />
        {m.rotulo}
        {!t.confirmado && <AConfirmar className="ml-auto !py-0.5 !text-[10.5px]" />}
      </p>
      <p className="mt-1 text-[15px] font-semibold text-papel">{t.titulo}</p>
      <p className="mt-0.5 text-[13px] text-nevoa">
        {rotuloDaData(t.dataHora.saida.data)}, {t.dataHora.saida.hora} · {t.duracao}
      </p>
      {t.destaqueJanela && <p className="mt-2 line-clamp-3 text-[13px] leading-snug text-papel/90">Pela janela: {t.destaqueJanela}</p>}
      <p className="mt-2 text-[11px] text-bruma">Clique para ver o trecho</p>
    </div>
  );
}
