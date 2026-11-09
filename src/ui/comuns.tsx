import {
  BedDouble,
  Binoculars,
  Bus,
  CircleDashed,
  Landmark,
  type LucideIcon,
  Martini,
  Moon,
  Plane,
  Repeat2,
  Star,
  TrainFront,
  TramFront,
  UtensilsCrossed,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import type { Categoria, Modal } from "../data/schema";
import { href, type Rota } from "../router";

export const CATEGORIA: Record<Categoria, { rotulo: string; plural: string; Icone: LucideIcon; cor: string }> = {
  ancora: { rotulo: "Experiência âncora", plural: "Experiências âncora", Icone: Star, cor: "var(--color-ambar)" },
  classico: { rotulo: "Clássico", plural: "Clássicos", Icone: Landmark, cor: "var(--color-papel)" },
  mirante: { rotulo: "Mirante", plural: "Mirantes", Icone: Binoculars, cor: "#ffd76b" },
  comida: { rotulo: "Comida", plural: "Comida", Icone: UtensilsCrossed, cor: "#ffc98a" },
  noite: { rotulo: "Noite", plural: "Noite", Icone: Martini, cor: "var(--color-violeta)" },
  "bate-volta": { rotulo: "Bate-volta", plural: "Bate-volta", Icone: Repeat2, cor: "#ffe2a8" },
  transporte: { rotulo: "Transporte", plural: "Transporte", Icone: TrainFront, cor: "var(--color-azul)" },
  hostel: { rotulo: "Hostel", plural: "Hostel", Icone: BedDouble, cor: "var(--color-azul)" },
};

export const MODAL: Record<Modal, { rotulo: string; Icone: LucideIcon; cor: string }> = {
  voo: { rotulo: "Voo intercontinental", Icone: Plane, cor: "#e6ecf8" },
  "onibus-noturno": { rotulo: "Ônibus noturno", Icone: Bus, cor: "#a9bcff" },
  "trem-rapido": { rotulo: "Trem de alta velocidade", Icone: TrainFront, cor: "var(--color-ambar)" },
  "trem-noturno": { rotulo: "Trem noturno", Icone: Moon, cor: "var(--color-violeta)" },
  "trem-aeroporto": { rotulo: "Trem para o aeroporto", Icone: TramFront, cor: "var(--color-ambar)" },
  "bate-volta": { rotulo: "Bate-volta", Icone: Repeat2, cor: "#ffe2a8" },
};

const BANDEIRAS: Record<string, React.ReactNode> = {
  portugal: (
    <>
      <rect width="24" height="16" fill="#DA291C" />
      <rect width="9.6" height="16" fill="#046A38" />
      <circle cx="9.6" cy="8" r="2.7" fill="#FFE900" />
    </>
  ),
  espanha: (
    <>
      <rect width="24" height="16" fill="#AA151B" />
      <rect y="4" width="24" height="8" fill="#F1BF00" />
    </>
  ),
  franca: (
    <>
      <rect width="24" height="16" fill="#fff" />
      <rect width="8" height="16" fill="#0055A4" />
      <rect x="16" width="8" height="16" fill="#EF4135" />
    </>
  ),
  "paises-baixos": (
    <>
      <rect width="24" height="16" fill="#fff" />
      <rect width="24" height="5.33" fill="#AE1C28" />
      <rect y="10.67" width="24" height="5.33" fill="#21468B" />
    </>
  ),
  alemanha: (
    <>
      <rect width="24" height="16" fill="#DD0000" />
      <rect width="24" height="5.33" fill="#111" />
      <rect y="10.67" width="24" height="5.33" fill="#FFCE00" />
    </>
  ),
  tchequia: (
    <>
      <rect width="24" height="16" fill="#D7141A" />
      <rect width="24" height="8" fill="#fff" />
      <path d="M0 0l11 8L0 16z" fill="#11457E" />
    </>
  ),
  austria: (
    <>
      <rect width="24" height="16" fill="#ED2939" />
      <rect y="5.33" width="24" height="5.33" fill="#fff" />
    </>
  ),
  italia: (
    <>
      <rect width="24" height="16" fill="#fff" />
      <rect width="8" height="16" fill="#009246" />
      <rect x="16" width="8" height="16" fill="#CE2B37" />
    </>
  ),
  vaticano: (
    <>
      <rect width="24" height="16" fill="#fff" />
      <rect width="12" height="16" fill="#FFE000" />
      <circle cx="18" cy="8" r="2.2" fill="none" stroke="#C9A227" strokeWidth="1.2" />
    </>
  ),
};

/** Bandeira desenhada em SVG: o emoji de bandeira não aparece no Windows. */
export function Bandeira({ pais, largura = 24, className = "" }: { pais: string; largura?: number; className?: string }) {
  const desenho = BANDEIRAS[pais];
  if (!desenho) return null;
  return (
    <svg
      viewBox="0 0 24 16"
      width={largura}
      height={(largura * 2) / 3}
      aria-hidden
      className={`inline-block shrink-0 rounded-[3px] ring-1 ring-white/15 ${className}`}
    >
      {desenho}
    </svg>
  );
}

/** Amostra do traço de cada modal, igual ao desenhado no globo. */
export function TracoModal({ modal, largura = 44 }: { modal: Modal; largura?: number }) {
  const y = 6;
  const comum = { x1: 2, x2: largura - 2, y1: y, y2: y, strokeLinecap: "round" as const };
  return (
    <svg width={largura} height={12} aria-hidden className="shrink-0">
      <defs>
        <linearGradient id="grad-noturno" x1="0" x2="1">
          <stop offset="0" stopColor="#58a6ff" />
          <stop offset="1" stopColor="#b98cff" />
        </linearGradient>
      </defs>
      {modal === "voo" && <line {...comum} stroke="#e6ecf8" strokeWidth={1.4} strokeDasharray="6 5" opacity={0.8} />}
      {modal === "onibus-noturno" && <line {...comum} stroke="#a9bcff" strokeWidth={2.4} strokeDasharray="4 4" />}
      {modal === "trem-rapido" && (
        <>
          <line {...comum} stroke="#ffb547" strokeWidth={6} opacity={0.28} />
          <line {...comum} stroke="#ffb547" strokeWidth={2.4} />
        </>
      )}
      {modal === "trem-noturno" && (
        <>
          <line {...comum} stroke="url(#grad-noturno)" strokeWidth={6} opacity={0.3} />
          <line {...comum} stroke="url(#grad-noturno)" strokeWidth={2.4} />
        </>
      )}
      {modal === "trem-aeroporto" && <line {...comum} stroke="#ffb547" strokeWidth={1.8} />}
      {modal === "bate-volta" && <line {...comum} stroke="#ffe2a8" strokeWidth={2} strokeDasharray="1 5" />}
    </svg>
  );
}

/** Selo para tudo o que ainda não é oficial. */
export function AConfirmar({ nota, className = "" }: { nota?: string; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-dashed border-ambar/70 bg-ambar/10 px-2.5 py-1 text-xs font-medium text-ambar ${className}`}
      title={nota}
    >
      <CircleDashed size={12} aria-hidden />A confirmar
    </span>
  );
}

export function Etiqueta({ children, cor }: { children: ReactNode; cor?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.07] px-2.5 py-1 text-xs font-medium text-nevoa"
      style={cor ? { color: cor } : undefined}
    >
      {children}
    </span>
  );
}

export function Secao({ titulo, children, className = "" }: { titulo?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`mt-7 first:mt-0 ${className}`}>
      {titulo && <h2 className="mb-3 text-[13px] font-semibold text-nevoa">{titulo}</h2>}
      {children}
    </section>
  );
}

/** Link interno (hash). Renderiza <a>, então funciona com teclado e "abrir em nova aba". */
export function Ir({
  para,
  children,
  className = "",
  ...resto
}: { para: Rota | string; children?: ReactNode; className?: string } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  return (
    <a href={href(para)} className={className} {...resto}>
      {children}
    </a>
  );
}

/**
 * Foto com crédito. Se não houver imagem (ou ela falhar ao carregar),
 * mostra um gradiente com o ícone da categoria.
 */
export function Foto({
  imagem,
  alt,
  Icone,
  cor = "var(--color-ambar)",
  className = "",
  credito = true,
  prioridade = false,
}: {
  imagem?: { url: string; credito: string };
  alt: string;
  Icone: LucideIcon;
  cor?: string;
  className?: string;
  credito?: boolean;
  prioridade?: boolean;
}) {
  const [falhou, setFalhou] = useState(false);
  const mostra = imagem && !falhou;
  return (
    <figure className={`relative overflow-hidden bg-noite-700 ${className}`}>
      {mostra ? (
        <img
          src={imagem.url}
          alt={alt}
          loading={prioridade ? "eager" : "lazy"}
          fetchPriority={prioridade ? "high" : "auto"}
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFalhou(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <div
          role="img"
          aria-label={alt}
          className="grid h-full w-full place-items-center"
          style={{
            background: `radial-gradient(120% 120% at 20% 0%, color-mix(in oklab, ${cor} 34%, transparent), transparent 60%), linear-gradient(160deg, #1a2540, #0b111e)`,
          }}
        >
          <Icone size={30} strokeWidth={1.4} style={{ color: cor }} aria-hidden />
        </div>
      )}
      {mostra && credito && (
        <figcaption className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/75 to-transparent px-3 pb-1.5 pt-5 text-[10.5px] text-white/80">
          Foto: {imagem.credito}
        </figcaption>
      )}
    </figure>
  );
}

export function LinhaInfo({ Icone, rotulo, children }: { Icone: LucideIcon; rotulo: string; children: ReactNode }) {
  return (
    <div className="relative py-2.5 pl-7">
      <dt className="rotulo">
        <Icone size={16} className="absolute left-0 top-3 text-bruma" aria-hidden />
        {rotulo}
      </dt>
      <dd className="mt-0.5 text-sm leading-relaxed text-papel">{children}</dd>
    </div>
  );
}
