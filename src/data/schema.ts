/**
 * Schemas (zod) e tipos do roteiro.
 *
 * O conteúdo fica em `trip.ts`; este arquivo só descreve o formato.
 * `npm run validar` (rodado também no build e no dev) confere tudo,
 * inclusive as referências cruzadas (cidade → país, dia → local, etc.).
 */
import { z } from "zod";

const Slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "use minúsculas, números e hífens");
const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "use AAAA-MM-DD");
const Url = z.string().regex(/^https:\/\//, "use um link https://");

/** [latitude, longitude] em graus decimais, na mesma ordem do Google Maps. */
const Coords = z.tuple([z.number().min(-90).max(90), z.number().min(-180).max(180)]);

/**
 * Câmera: de onde o globo olha para o alvo.
 * heading: para onde a câmera aponta (0 = norte, 90 = leste), em graus.
 * pitch: inclinação (-90 = de cima, -20 = quase no horizonte), em graus.
 * range: distância até o alvo, em metros.
 */
const Camera = z.object({
  heading: z.number().min(-360).max(360),
  pitch: z.number().min(-90).max(-5),
  range: z.number().positive(),
});

const Periodo = z.object({
  inicio: IsoDate,
  fim: IsoDate,
  rotulo: z.string(),
});

const Imagem = z.object({
  url: Url,
  credito: z.string(),
});

/* ------------------------------------------------------------------ País */

export const CountrySchema = z.object({
  id: Slug,
  nome: z.string(),
  bandeira: z.string(),
  /** Código ADM0_A3 do Natural Earth, para casar com o GeoJSON de fronteiras. */
  isoA3: z.string().length(3),
  status: z.enum(["visitado", "atravessado"]),
  datas: Periodo,
  noites: z.number().int().min(0),
  resumo: z.string(),
  essencial: z.object({
    moeda: z.string(),
    tomada: z.string(),
    idioma: z.string(),
    gorjeta: z.string(),
    seguranca: z.string(),
    fraseUtil: z.object({ frase: z.string(), traducao: z.string() }),
    clima: z.string(),
    porDoSol: z.string(),
  }),
  /** Cor secundária derivada da bandeira (hex). */
  cor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  camera: Camera.extend({ alvo: Coords }),
  /** Só para países atravessados: o que se vê pela janela. */
  travessia: z
    .object({ titulo: z.string(), texto: z.string(), trecho: Slug, local: Slug.optional() })
    .optional(),
  /** País tratado como local dentro de outra cidade (Vaticano → Roma). */
  dentroDe: Slug.optional(),
});

/* ---------------------------------------------------------------- Cidade */

export const CitySchema = z.object({
  id: Slug,
  countryId: Slug,
  nome: z.string(),
  coords: Coords,
  tipo: z.enum(["base", "parada", "bate-volta", "travessia"]),
  opcional: z.boolean().optional(),
  datas: Periodo,
  noites: z.number().int().min(0),
  porQue: z.string(),
  destaques: z.array(z.string()).length(3),
  hostel: z
    .object({ nome: z.string(), porQue: z.string(), alternativas: z.array(z.string()).optional() })
    .optional(),
  transporteLocal: z.string(),
  guardaVolumes: z.string(),
  alertas: z.array(z.string()),
  /** Título do artigo na Wikipédia em inglês; `npm run imagens` busca a foto livre. */
  wiki: z.string().optional(),
  imagem: Imagem.optional(),
  /** `alvo`: centro do enquadramento, quando não for o mesmo ponto de `coords`. */
  camera: Camera.extend({ alvo: Coords.optional() }),
});

/* ----------------------------------------------------------------- Local */

export const CATEGORIAS = [
  "classico",
  "ancora",
  "comida",
  "noite",
  "mirante",
  "transporte",
  "hostel",
  "bate-volta",
] as const;

export const PlaceSchema = z.object({
  id: Slug,
  cityId: Slug,
  /** Só quando o local fica em outro país que não o da cidade (Vaticano). */
  countryId: Slug.optional(),
  nome: z.string(),
  categoria: z.enum(CATEGORIAS),
  coords: Coords,
  /** Dia principal no roteiro. */
  dia: IsoDate,
  horario: z.string(),
  oQueE: z.string().min(120),
  porQueVale: z.string(),
  dicas: z.object({
    horarioIdeal: z.string(),
    /** Vale entrar ou só ver de fora? */
    entrar: z.string(),
    tempo: z.string(),
  }),
  ingresso: z.object({
    preco: z.string(),
    reservaObrigatoria: z.boolean(),
    link: Url.optional(),
    /** Liga o status "a comprar / comprado" ao item do painel Reservas. */
    reservaId: Slug.optional(),
    nota: z.string().optional(),
  }),
  comoChegar: z.string(),
  /** false = informação ainda não oficial → selo "A confirmar". */
  confirmado: z.boolean(),
  /** O que exatamente falta confirmar (aparece ao lado do selo). */
  aConfirmar: z.string().optional(),
  opcional: z.boolean().optional(),
  wiki: z.string().optional(),
  imagem: Imagem.optional(),
  camera: Camera,
});

/* ---------------------------------------------------------------- Trecho */

export const MODAIS = [
  "voo",
  "onibus-noturno",
  "trem-rapido",
  "trem-noturno",
  "trem-aeroporto",
  "bate-volta",
] as const;

const Parada = z.object({
  nome: z.string().optional(),
  coords: Coords,
  hora: z.string().optional(),
});

export const LegSchema = z.object({
  id: Slug,
  /** id de cidade ou de um ponto extra (ver `pontos`). */
  de: Slug,
  para: Slug,
  /** Estações de partida e chegada, quando conhecidas. */
  estacoes: z.object({ de: z.string(), para: z.string() }).optional(),
  titulo: z.string(),
  modal: z.enum(MODAIS),
  dataHora: z.object({
    saida: z.object({ data: IsoDate, hora: z.string() }),
    chegada: z.object({ data: IsoDate, hora: z.string() }),
  }),
  duracao: z.string(),
  operador: z.string(),
  tipo: z.enum(["experiência", "mínimo"]),
  preco: z.string().optional(),
  destaqueJanela: z.string().optional(),
  /** Onde sentar, o que levar, etc. */
  dicas: z.array(z.string()),
  /** id do item no painel Reservas. */
  reserva: Slug.optional(),
  confirmado: z.boolean(),
  aConfirmar: z.string().optional(),
  opcional: z.boolean().optional(),
  /**
   * Caminho real aproximado, na ordem: começa na estação de partida, passa
   * pelos pontos intermediários e termina na estação de chegada.
   * Pontos sem `nome` só dão forma à linha.
   */
  paradas: z.array(Parada).min(2),
});

/* ------------------------------------------------------------------- Dia */

const ItemRoteiro = z.object({
  texto: z.string(),
  /** id de um Place: torna o item clicável. */
  local: Slug.optional(),
  /** id de um Leg: abre o card do trecho. */
  trecho: Slug.optional(),
  opcional: z.boolean().optional(),
});

const Bloco = z.object({
  /** Ex.: "~17:45" no pôr do sol. */
  hora: z.string().optional(),
  itens: z.array(ItemRoteiro).min(1),
});

export const DaySchema = z.object({
  data: IsoDate,
  diaSemana: z.enum(["seg", "ter", "qua", "qui", "sex", "sáb", "dom"]),
  /** Cidade principal do dia: é para onde a câmera voa. */
  cidade: Slug,
  /** Outras cidades tocadas no dia (bate-volta, chegada à noite…). */
  cidadesExtras: z.array(Slug).optional(),
  titulo: z.string(),
  ritmo: z.string().optional(),
  manha: Bloco.optional(),
  tarde: Bloco.optional(),
  porDoSol: Bloco.optional(),
  noite: Bloco.optional(),
  intensidadeNoite: z.enum(["leve", "média", "alta"]),
  fimDeSemana: z.boolean(),
  /** Dia-âncora da viagem (estrela na timeline). */
  destaque: z.boolean().optional(),
  /** Trechos que partem neste dia, na ordem. */
  trechos: z.array(Slug).optional(),
  /** Trecho em que a noite deste dia é passada (lua na timeline). */
  noiteEmTransporte: Slug.optional(),
  observacoes: z.array(z.string()),
});

/* --------------------------------------------------------------- Reserva */

export const ReservationSchema = z.object({
  id: Slug,
  item: z.string(),
  detalhe: z.string().optional(),
  prazo: z.object({
    rotulo: z.string(),
    /** Data-limite aproximada, usada só para ordenar. */
    ate: IsoDate,
    urgente: z.boolean(),
  }),
  status: z.enum(["a-reservar", "reservado"]),
  links: z.array(z.object({ rotulo: z.string(), url: Url })).min(1),
  cidade: Slug.optional(),
  local: Slug.optional(),
  trecho: Slug.optional(),
  dia: IsoDate.optional(),
});

/* ---------------------------------------------------------------- Viagem */

export const TripInfoSchema = z.object({
  titulo: z.string(),
  subtitulo: z.string(),
  inicio: IsoDate,
  fim: IsoDate,
  resumo: z.object({
    dias: z.number().int(),
    noites: z.number().int(),
    paisesVisitados: z.number().int(),
    texto: z.string(),
  }),
  /** Enquadramento do nível Europa. */
  camera: Camera.extend({ alvo: Coords }),
  /** Pontos fora da lista de cidades usados por trechos (aeroportos). */
  pontos: z.array(z.object({ id: Slug, nome: z.string(), coords: Coords })),
  fimDeSemanas: z.array(z.object({ rotulo: z.string(), onde: z.string(), dia: IsoDate })),
  destaques: z.array(
    z.object({
      titulo: z.string(),
      texto: z.string(),
      icone: z.enum(["estadio", "mascara", "lua", "trem"]),
      /** Rota interna, ex.: "/local/bernabeu". */
      rota: z.string(),
    }),
  ),
  documentos: z.array(z.object({ titulo: z.string(), texto: z.string(), confirmado: z.boolean() })),
  custos: z.object({
    rotulo: z.string(),
    totalMin: z.number(),
    totalMax: z.number(),
    itens: z.array(z.object({ item: z.string(), min: z.number(), max: z.number() })),
  }),
  clima: z.array(z.object({ onde: z.string(), texto: z.string() })),
  porDoSol: z.array(z.object({ onde: z.string(), hora: z.string() })),
  riscos: z.array(z.object({ risco: z.string(), planoB: z.string() })),
  legenda: z.array(z.object({ modal: z.enum(MODAIS), rotulo: z.string(), descricao: z.string() })),
});

export const TripSchema = z
  .object({
    viagem: TripInfoSchema,
    paises: z.array(CountrySchema),
    cidades: z.array(CitySchema),
    locais: z.array(PlaceSchema),
    trechos: z.array(LegSchema),
    dias: z.array(DaySchema),
    reservas: z.array(ReservationSchema),
  })
  .superRefine((t, ctx) => {
    const erro = (message: string) => ctx.addIssue({ code: "custom", message });
    const unicos = (nome: string, ids: string[]) => {
      const vistos = new Set<string>();
      for (const id of ids) {
        if (vistos.has(id)) erro(`${nome}: id duplicado "${id}"`);
        vistos.add(id);
      }
      return vistos;
    };
    const paises = unicos("paises", t.paises.map((p) => p.id));
    const cidades = unicos("cidades", t.cidades.map((c) => c.id));
    const locais = unicos("locais", t.locais.map((l) => l.id));
    const trechos = unicos("trechos", t.trechos.map((l) => l.id));
    const reservas = unicos("reservas", t.reservas.map((r) => r.id));
    const dias = unicos("dias", t.dias.map((d) => d.data));
    const pontos = new Set(t.viagem.pontos.map((p) => p.id));

    for (const p of t.paises) {
      if (p.dentroDe && !cidades.has(p.dentroDe)) erro(`país ${p.id}: dentroDe "${p.dentroDe}" não existe`);
      if (p.travessia && !trechos.has(p.travessia.trecho)) erro(`país ${p.id}: trecho "${p.travessia.trecho}" não existe`);
      if (p.travessia?.local && !locais.has(p.travessia.local)) erro(`país ${p.id}: local "${p.travessia.local}" não existe`);
    }
    for (const c of t.cidades) {
      if (!paises.has(c.countryId)) erro(`cidade ${c.id}: país "${c.countryId}" não existe`);
    }
    for (const l of t.locais) {
      if (!cidades.has(l.cityId)) erro(`local ${l.id}: cidade "${l.cityId}" não existe`);
      if (l.countryId && !paises.has(l.countryId)) erro(`local ${l.id}: país "${l.countryId}" não existe`);
      if (!dias.has(l.dia)) erro(`local ${l.id}: dia "${l.dia}" fora da viagem`);
      if (l.ingresso.reservaId && !reservas.has(l.ingresso.reservaId))
        erro(`local ${l.id}: reserva "${l.ingresso.reservaId}" não existe`);
      if (!l.confirmado && !l.aConfirmar) erro(`local ${l.id}: diga em "aConfirmar" o que falta confirmar`);
    }
    for (const l of t.trechos) {
      for (const ponta of [l.de, l.para]) {
        if (!cidades.has(ponta) && !pontos.has(ponta)) erro(`trecho ${l.id}: ponta "${ponta}" não existe`);
      }
      if (l.reserva && !reservas.has(l.reserva)) erro(`trecho ${l.id}: reserva "${l.reserva}" não existe`);
    }
    for (const d of t.dias) {
      if (!cidades.has(d.cidade)) erro(`dia ${d.data}: cidade "${d.cidade}" não existe`);
      for (const c of d.cidadesExtras ?? []) if (!cidades.has(c)) erro(`dia ${d.data}: cidade "${c}" não existe`);
      for (const id of d.trechos ?? []) if (!trechos.has(id)) erro(`dia ${d.data}: trecho "${id}" não existe`);
      if (d.noiteEmTransporte && !trechos.has(d.noiteEmTransporte))
        erro(`dia ${d.data}: trecho "${d.noiteEmTransporte}" não existe`);
      for (const bloco of [d.manha, d.tarde, d.porDoSol, d.noite]) {
        for (const item of bloco?.itens ?? []) {
          if (item.local && !locais.has(item.local)) erro(`dia ${d.data}: local "${item.local}" não existe`);
          if (item.trecho && !trechos.has(item.trecho)) erro(`dia ${d.data}: trecho "${item.trecho}" não existe`);
        }
      }
    }
    for (const r of t.reservas) {
      if (r.cidade && !cidades.has(r.cidade)) erro(`reserva ${r.id}: cidade "${r.cidade}" não existe`);
      if (r.local && !locais.has(r.local)) erro(`reserva ${r.id}: local "${r.local}" não existe`);
      if (r.trecho && !trechos.has(r.trecho)) erro(`reserva ${r.id}: trecho "${r.trecho}" não existe`);
    }
  });

export type Trip = z.infer<typeof TripSchema>;
export type TripInfo = z.infer<typeof TripInfoSchema>;
export type Country = z.infer<typeof CountrySchema>;
export type City = z.infer<typeof CitySchema>;
export type Place = z.infer<typeof PlaceSchema>;
export type Leg = z.infer<typeof LegSchema>;
export type Day = z.infer<typeof DaySchema>;
export type Reservation = z.infer<typeof ReservationSchema>;
export type Categoria = (typeof CATEGORIAS)[number];
export type Modal = (typeof MODAIS)[number];
export type CameraView = z.infer<typeof Camera>;
export type Bloco = z.infer<typeof Bloco>;
export type ItemRoteiro = z.infer<typeof ItemRoteiro>;
export type LatLon = z.infer<typeof Coords>;
