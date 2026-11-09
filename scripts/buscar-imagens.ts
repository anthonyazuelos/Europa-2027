/**
 * Busca, para cada cidade e local com `wiki` em trip.ts, a foto principal do
 * artigo na Wikipédia (só licenças livres, hospedadas no Wikimedia Commons) e
 * grava url + crédito em src/data/imagens.ts.
 *
 *   npm run imagens
 *
 * Itens sem `wiki`, sem foto livre ou com imagem que não seja fotografia ficam
 * de fora: o app mostra um gradiente com ícone no lugar.
 */
import { writeFile } from "node:fs/promises";
import { trip } from "../src/data/trip";

const UA = "europa-2027-mapa/1.0 (script de build)";
const LARGURA = 960; // um dos tamanhos de miniatura padrão do Wikimedia
const NAO_FOTO = /\.(svg|gif|tiff?|webm|ogv|pdf)$/i;
const SUSPEITO = /(map|logo|locator|location|coat[_ ]of|flag|icon|diagram|plan[_ ]|blason|escudo|wappen)/i;

type Imagem = { url: string; credito: string };

async function api(host: string, params: Record<string, string>) {
  const url = new URL(`https://${host}/w/api.php`);
  for (const [k, v] of Object.entries({ format: "json", formatversion: "2", origin: "*", ...params })) {
    url.searchParams.set(k, v);
  }
  for (let tentativa = 0; tentativa < 4; tentativa++) {
    const r = await fetch(url, { headers: { "User-Agent": UA } });
    if (r.ok) return r.json();
    await new Promise((ok) => setTimeout(ok, 1500 * (tentativa + 1)));
  }
  throw new Error(`Falha na API ${host}`);
}

const lotes = <T>(itens: T[], n: number) =>
  Array.from({ length: Math.ceil(itens.length / n) }, (_, i) => itens.slice(i * n, i * n + n));

const semHtml = (s: string) =>
  s
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** título do artigo → nome do arquivo da imagem principal (se for livre) */
async function imagensDosArtigos(titulos: string[]) {
  const saida = new Map<string, string>();
  for (const lote of lotes(titulos, 40)) {
    const j = await api("en.wikipedia.org", {
      action: "query",
      titles: lote.join("|"),
      redirects: "1",
      prop: "pageimages",
      piprop: "name",
      pilicense: "free",
      pilimit: "50",
    });
    const destino = new Map<string, string>();
    for (const n of j.query.normalized ?? []) destino.set(n.from, n.to);
    for (const r of j.query.redirects ?? []) destino.set(r.from, r.to);
    const final = (t: string) => {
      let atual = t;
      for (let i = 0; i < 4 && destino.has(atual); i++) atual = destino.get(atual)!;
      return atual;
    };
    const porTitulo = new Map<string, string>();
    for (const p of j.query.pages ?? []) if (p.pageimage) porTitulo.set(p.title, p.pageimage);
    for (const t of lote) {
      const arquivo = porTitulo.get(final(t));
      if (arquivo) saida.set(t, arquivo);
    }
  }
  return saida;
}

/** nome do arquivo → miniatura + crédito, só se estiver no Commons com licença */
async function detalhes(arquivos: string[]) {
  const saida = new Map<string, Imagem>();
  for (const lote of lotes([...new Set(arquivos)], 40)) {
    const j = await api("commons.wikimedia.org", {
      action: "query",
      titles: lote.map((a) => `File:${a}`).join("|"),
      prop: "imageinfo",
      iiprop: "url|extmetadata",
      iiurlwidth: String(LARGURA),
    });
    const normal = new Map<string, string>();
    for (const n of j.query.normalized ?? []) normal.set(n.to, n.from);
    for (const p of j.query.pages ?? []) {
      const info = p.imageinfo?.[0];
      if (!info || p.missing) continue;
      const meta = info.extmetadata ?? {};
      const licenca = semHtml(meta.LicenseShortName?.value ?? "");
      if (!licenca) continue;
      let autor = semHtml(meta.Artist?.value ?? "");
      if (!autor || autor.length > 70) autor = autor ? autor.slice(0, 67).trimEnd() + "…" : "Autor não informado";
      const original = (normal.get(p.title) ?? p.title).replace(/^File:/, "");
      saida.set(original.replace(/ /g, "_"), {
        url: String(info.thumburl ?? info.url).split("?")[0],
        credito: `${autor} · ${licenca} · Wikimedia Commons`,
      });
    }
  }
  return saida;
}

const alvos = [
  ...trip.cidades.filter((c) => c.wiki && !c.imagem).map((c) => ({ tipo: "cidades" as const, id: c.id, wiki: c.wiki! })),
  ...trip.locais.filter((l) => l.wiki && !l.imagem).map((l) => ({ tipo: "locais" as const, id: l.id, wiki: l.wiki! })),
];

console.log(`Consultando ${alvos.length} artigos…`);
const arquivos = await imagensDosArtigos([...new Set(alvos.map((a) => a.wiki))]);
const usaveis = [...arquivos.entries()].filter(([, f]) => !NAO_FOTO.test(f) && !SUSPEITO.test(f));
const info = await detalhes(usaveis.map(([, f]) => f));

const resultado: Record<"cidades" | "locais", Record<string, Imagem>> = { cidades: {}, locais: {} };
const faltando: string[] = [];
for (const alvo of alvos) {
  const arquivo = arquivos.get(alvo.wiki);
  const img = arquivo ? info.get(arquivo.replace(/ /g, "_")) : undefined;
  if (img) resultado[alvo.tipo][alvo.id] = img;
  else faltando.push(`${alvo.id} (${alvo.wiki}${arquivo ? ` → ${arquivo}` : ""})`);
}

const texto = `/**
 * GERADO por \`npm run imagens\`. Não edite à mão: para trocar uma foto,
 * preencha \`imagem\` no item em trip.ts (ele tem prioridade sobre este arquivo).
 * Todas as fotos vêm do Wikimedia Commons, com autor e licença no crédito.
 */
export const IMAGENS: Record<"cidades" | "locais", Record<string, { url: string; credito: string }>> = ${JSON.stringify(resultado, null, 2)};
`;
await writeFile(new URL("../src/data/imagens.ts", import.meta.url), texto);
console.log(
  `✔ ${Object.keys(resultado.cidades).length} cidades e ${Object.keys(resultado.locais).length} locais com foto.`,
);
if (faltando.length) console.log(`Sem foto (${faltando.length}):\n  ${faltando.join("\n  ")}`);
