/**
 * Motor do globo: tudo o que fala com o CesiumJS mora aqui.
 * Este módulo (e o Cesium inteiro) é carregado sob demanda pelo App.
 *
 * Como é desenhado, para ficar leve:
 * - rota: uma única PolylineCollection; estilo, esmaecer, desenho progressivo
 *   e luz dos trens noturnos saem de um material em shader (materiais.ts);
 * - países: um GroundPrimitive em lote para o preenchimento, uma
 *   PolylineCollection para as bordas e uma camada de imagem para escurecer
 *   o resto do mundo;
 * - câmera: voo próprio (voo.ts), com arco proporcional à distância;
 * - qualidade: a resolução cai só enquanto a câmera se move em máquinas
 *   fracas e volta ao máximo quando ela para.
 */
import {
  ArcGisMapServerImageryProvider,
  BoundingSphere,
  type Camera,
  Cartesian2,
  Cartesian3,
  Cartesian4,
  Cartographic,
  type Cesium3DTileset,
  ClassificationType,
  Color,
  ColorGeometryInstanceAttribute,
  createGooglePhotorealistic3DTileset,
  createWorldTerrainAsync,
  Ellipsoid,
  EllipsoidalOccluder,
  EllipsoidGeodesic,
  EllipsoidTerrainProvider,
  type Entity,
  GeometryInstance,
  GroundPrimitive,
  HeadingPitchRange,
  type ImageryLayer,
  type ImageryProvider,
  IntersectionTests,
  Ion,
  IonImageryProvider,
  JulianDate,
  type Material,
  Math as CMath,
  Matrix4,
  PerInstanceColorAppearance,
  type PerspectiveFrustum,
  PolygonGeometry,
  PolygonHierarchy,
  type Polyline,
  PolylineCollection,
  PolylineDashMaterialProperty,
  Ray,
  Rectangle,
  sampleTerrain,
  sampleTerrainMostDetailed,
  type Scene,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  SingleTileImageryProvider,
  SkyBox,
  type TerrainProvider,
  TileMapServiceImageryProvider,
  Transforms,
  UrlTemplateImageryProvider,
  buildModuleUrl,
  Viewer,
} from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";

import { paisPorId, trip } from "../data";
import type { LatLon, Leg, Modal } from "../data/schema";
import { ceuEstrelado, porDoSol } from "./ceu";
import {
  type Anel,
  caixaDoAnel,
  comprimento,
  densificarAnel,
  dentroDoPais,
  distancia,
  limitar,
  mistura,
  type Pais,
  reamostrar,
  suave,
  suavizar,
} from "./geometria";
import { ESTILO, materialDaBorda, materialDoTrecho, type UniformesTrecho, uniformes } from "./materiais";
import { criarZoom, menorGiro, suavizarVoo, type Zoom } from "./voo";

/* ------------------------------------------------------------------ tipos */

export type Nivel = "europa" | "pais" | "cidade" | "local";

export interface Cena {
  nivel: Nivel;
  paisId?: string;
  /** Trecho em foco (card aberto): fica realçado e o resto esmaece. */
  trechoId?: string;
}

export interface AlvoCamera {
  lat: number;
  lon: number;
  heading: number;
  pitch: number;
  range: number;
}

export interface Camadas {
  rotulos: boolean;
  relevo: boolean;
  /** Cidades em 3D (fotogrametria do Google). */
  predios: boolean;
  luz: boolean;
}

export interface Capacidades {
  token: boolean;
  imagem: "ion" | "esri" | "natural-earth";
  relevo: boolean;
  predios: boolean;
  fotorrealista: boolean;
}

export interface Eventos {
  aoPassarTrecho?: (id: string | null, x: number, y: number) => void;
  aoPassarPais?: (id: string | null) => void;
  aoClicarTrecho?: (id: string) => void;
  aoClicarPais?: (id: string) => void;
  /** Um voo de câmera começou: a UI sincroniza as entradas com a duração. */
  aoVoar?: (duracao: number) => void;
  /** O motor desligou camadas pesadas porque o desempenho caiu. */
  aoReduzirQualidade?: (camadas: Camadas) => void;
}

/** Pose da câmera em torno de um alvo no chão (ângulos em radianos). */
interface Pose {
  lat: number;
  lon: number;
  /** Altura do terreno no alvo, sem exagero. */
  alt: number;
  heading: number;
  pitch: number;
  range: number;
}

interface TrechoDesenhado {
  trecho: Leg;
  /** Caminho em pontos igualmente espaçados: o índice dá a fração do trecho. */
  pts: LatLon[];
  alturas: number[];
  mundo: Cartesian3[];
  linha: Polyline;
  u: UniformesTrecho;
  comprimento: number;
  opacidadeAlvo: number;
  /** Pedaços do trecho dentro de cada país, como frações. */
  janelas: Map<string, Cartesian4>;
}

interface PaisDesenhado {
  cor: Color;
  ids: string[];
  atributos?: { color: Uint8Array }[];
  preenchimento: Color;
  preenchimentoAlvo: Color;
  material: Material;
  geral: Polyline[];
  detalhe: Polyline[];
  borda: number;
  bordaAlvo: number;
  brilho: number;
  brilhoAlvo: number;
}

/* ------------------------------------------------------------- constantes */

const AMBAR = Color.fromCssColorString("#ffb547");
const AMBAR_CLARO = Color.fromCssColorString("#ffe2a8");
const NOITE_A = Color.fromCssColorString("#58a6ff");
const NOITE_B = Color.fromCssColorString("#b98cff");
const ONIBUS = Color.fromCssColorString("#a9bcff");
const VOO = Color.fromCssColorString("#e6ecf8");
const ESCURO = Color.fromCssColorString("#03060c");
const TRANSPARENTE = new Color(0, 0, 0, 0);

const ESRI = "https://services.arcgisonline.com/ArcGIS/rest/services";
const RAD = Math.PI / 180;
const MOVIMENTO_REDUZIDO =
  typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const CELULAR = typeof matchMedia !== "undefined" && matchMedia("(max-width: 820px), (pointer: coarse)").matches;

/** Janela (em graus) da camada que escurece os países fora da viagem. */
const JANELA_ESCURA = { oeste: -38, leste: 62, sul: 20, norte: 76 };
/**
 * Contorno da visão geral. "simples" usa o 1:110m e troca para 1:50m só no
 * país em foco; "detalhe" usa 1:50m sempre. Numa PolylineCollection o custo é
 * o mesmo (uma chamada de desenho, poucos milhares de vértices), e o 1:110m
 * deixa a costa serrilhada e fora do lugar: por isso o padrão é "detalhe".
 */
const CONTORNO_GERAL = "detalhe" as "simples" | "detalhe";

const ROTA_PRINCIPAL = trip.trechos.filter((t) =>
  (["onibus-noturno", "trem-rapido", "trem-noturno"] as Modal[]).includes(t.modal),
);

/** Degraus de qualidade, do melhor ao mais leve. */
const DEGRAUS = [
  { msaa: 4, escala: 1 },
  { msaa: 1, escala: 1 },
  { msaa: 1, escala: 0.85 },
  { msaa: 1, escala: 0.72 },
  { msaa: 1, escala: 0.6 },
  { msaa: 1, escala: 0.5 },
];

const CHAVE_QUALIDADE = "europa2027:qualidade";
const chaveAltura = (lat: number, lon: number) => `${lat.toFixed(4)},${lon.toFixed(4)}`;
const espera = (ms: number) => new Promise<void>((ok) => setTimeout(ok, ms));

/** GPU integrada ou de celular: começa sem MSAA. */
function gpuModesta() {
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    const ext = gl?.getExtension("WEBGL_debug_renderer_info");
    const nome = ext && gl ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : "";
    return /Intel|UHD|Iris|Mali|Adreno|PowerVR|SwiftShader|llvmpipe|Microsoft Basic/i.test(nome);
  } catch {
    return true;
  }
}

/* ================================================================== motor */

export class GlobeEngine {
  readonly viewer: Viewer;
  private readonly scene: Scene;
  private readonly camera: Camera;
  private readonly ocluder = new EllipsoidalOccluder(Ellipsoid.WGS84, Cartesian3.ZERO);

  capacidades: Capacidades = { token: false, imagem: "natural-earth", relevo: false, predios: false, fotorrealista: false };
  camadas: Camadas = { rotulos: true, relevo: true, predios: true, luz: false };
  eventos: Eventos = {};
  /** Faixas da tela cobertas por painéis: o alvo é centralizado no que sobra. */
  margens = { esquerda: 0, baixo: 0 };

  private cena: Cena = { nivel: "europa" };
  private destruido = false;
  private relogio = 0;

  // camadas
  private camadaBase?: ImageryLayer;
  private camadaRotulos?: ImageryLayer;
  private camadaEscura?: ImageryLayer;
  private escuroAlvo = 0.46;
  private relevoIon?: TerrainProvider;
  private readonly elipsoide = new EllipsoidTerrainProvider();
  private foto?: Cesium3DTileset;
  private fotoEstado: "nao" | "carregando" | "ok" | "falhou" = "nao";
  private falhasFoto = 0;
  private exagero = 1;
  private data: { iso: string; lat: number; lon: number } | null = null;

  // países
  private paises: Pais[] = [];
  private readonly porA3 = new Map<string, Pais>();
  private readonly a3DaViagem = new Map(trip.paises.map((p) => [p.isoA3, p.id]));
  private preenchimentos?: GroundPrimitive;
  private bordas?: PolylineCollection;
  private readonly desenhados = new Map<string, PaisDesenhado>();
  private paisSobCursor: string | null = null;

  // rota
  private linhas!: PolylineCollection;
  private readonly trechos = new Map<string, TrechoDesenhado>();
  private caminhoDia?: Entity;
  private trechoEmJogo: string | null = null;

  // alturas do terreno (sem exagero)
  private readonly alturas = new Map<string, number>();
  private alturasProntas: Promise<void> = Promise.resolve();

  // câmera
  private voo = 0;
  private pose: Pose | null = null;
  private poseSuja = true;
  private voando: {
    de: Pose;
    para: Pose;
    geo: EllipsoidGeodesic | null;
    zoom: Zoom;
    arco: number;
    t: number;
    duracao: number;
    resolver: (chegou: boolean) => void;
  } | null = null;
  private orbita: { pose: Pose; idade: number; espera: number } | null = null;
  private animacao: ((dt: number) => void) | null = null;
  private pausado = false;
  private ultimoTick = performance.now();
  private sseBase = 2;
  private sseFoto = 16;
  private fotoVisivel = false;

  // ponteiro
  private ponteiro: { x: number; y: number } | null = null;
  private ponteiroSujo = false;
  private trechoSobCursor: string | null = null;

  // qualidade adaptativa
  private quadros: (() => void)[] = [];
  private degrau = 0;
  private degrauMinimo = 0;
  private media = 16;
  private lentos = 0;
  private rapidos = 0;
  private ignorar = 30;
  private subidaLiberada = 0;
  private ultimoMovimento = 0;
  private emMovimento = false;
  private readonly ultimaPosicao = new Cartesian3();
  private readonly ultimaDirecao = new Cartesian3();
  private brilhoGlobal = false;
  private readonly janela: number[] = [];
  private desdeAvaliacao = 0;
  private antesDeDescer = 0;
  private descidaLiberada = 0;
  private modesta = false;

  /* ------------------------------------------------------------ criação */

  static async criar(container: HTMLElement, creditos: HTMLElement): Promise<GlobeEngine> {
    const token = (import.meta.env.VITE_CESIUM_ION_TOKEN ?? "").trim();
    if (token) Ion.defaultAccessToken = token;
    const modesta = CELULAR || gpuModesta();

    const viewer = new Viewer(container, {
      baseLayer: false,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      animation: false,
      timeline: false,
      fullscreenButton: false,
      infoBox: false,
      selectionIndicator: false,
      vrButton: false,
      projectionPicker: false,
      scene3DOnly: true,
      requestRenderMode: true,
      maximumRenderTimeChange: Infinity,
      msaaSamples: modesta ? 1 : 4,
      // Linhas e marcadores não precisam de transparência independente de ordem,
      // e ela custa passes de tela cheia.
      orderIndependentTranslucency: false,
      creditContainer: creditos,
      contextOptions: { webgl: { alpha: false, powerPreference: "high-performance" } },
    });

    const motor = new GlobeEngine(viewer, Boolean(token), modesta);
    await motor.iniciar();
    return motor;
  }

  private constructor(viewer: Viewer, token: boolean, modesta: boolean) {
    this.viewer = viewer;
    this.scene = viewer.scene;
    this.camera = viewer.camera;
    this.capacidades.token = token;
    this.degrau = this.degrauMinimo = modesta ? 1 : 0;
    this.modesta = modesta;
    try {
      const salvo = Number(localStorage.getItem(CHAVE_QUALIDADE));
      if (Number.isInteger(salvo) && salvo > this.degrau && salvo < DEGRAUS.length) this.degrau = salvo;
    } catch {
      // Sem armazenamento: começa do degrau padrão.
    }
  }

  private async iniciar() {
    const { scene, viewer } = this;
    // Resolução recomendada pelo navegador (pixels CSS). A escala é ajustada
    // pelo controle de qualidade, só enquanto a câmera se move.
    viewer.useBrowserRecommendedResolution = true;
    viewer.resolutionScale = 1;

    scene.globe.baseColor = Color.fromCssColorString("#0a1422");
    scene.backgroundColor = Color.BLACK;
    this.sseBase = CELULAR ? 3 : 2;
    scene.globe.maximumScreenSpaceError = this.sseBase;
    scene.globe.tileCacheSize = CELULAR ? 400 : 1000;
    scene.globe.preloadAncestors = true;
    scene.globe.preloadSiblings = true;
    scene.globe.showGroundAtmosphere = true;
    // Atmosfera do chão por vértice até mais longe: por fragmento custa caro
    // e só muda a aparência vista do espaço.
    // Sombra mais suave no lado escuro: a noite aparece, mas o mapa continua legível.
    scene.globe.vertexShadowDarkness = 0.16;
    scene.globe.lambertDiffuseMultiplier = 1.7;
    scene.globe.nightFadeOutDistance = 2.2e7;
    scene.globe.nightFadeInDistance = 6e7;
    scene.fog.enabled = true;
    scene.fog.density = 1.6e-4;
    if (scene.skyAtmosphere) scene.skyAtmosphere.show = true;
    if (scene.moon) scene.moon.show = false;
    scene.sunBloom = false;
    scene.highDynamicRange = false;
    this.aplicarDegrau();
    scene.screenSpaceCameraController.minimumZoomDistance = 80;
    scene.screenSpaceCameraController.maximumZoomDistance = 32_000_000;
    try {
      scene.skyBox = new SkyBox({ sources: ceuEstrelado(CELULAR ? 1024 : 2048) });
    } catch (e) {
      console.warn("Céu estrelado próprio indisponível; usando o padrão.", e);
    }

    viewer.clock.shouldAnimate = false;
    this.aplicarLuz(true);

    // Qualquer erro de renderização nas camadas 3D opcionais: desliga a camada
    // e segue, em vez de congelar o globo.
    scene.renderError.addEventListener((_cena: Scene, erro: unknown) => {
      console.error("Erro de renderização; desligando camadas 3D opcionais.", erro);
      if (this.foto) this.foto.show = false;
      this.fotoVisivel = false;
      this.capacidades.predios = false;
      this.fotoEstado = "falhou";
      scene.globe.show = true;
      viewer.useDefaultRenderLoop = true;
    });

    this.camera.setView({ destination: Cartesian3.fromDegrees(-24, 22, 19_000_000) });

    await Promise.all([this.montarImagem(), this.montarRelevo()]);
    this.montarRota();
    this.montarEntrada();
    void this.montarPaises();
    // As alturas do terreno são pedidas depois que o globo aparece: antes
    // disso elas só disputariam a fila de downloads com os primeiros tiles.
    void this.quandoOGloboCarregar().then(() => this.amostrarAlturas());

    scene.preUpdate.addEventListener(() => this.tick());
    scene.postRender.addEventListener(() => {
      for (const cb of this.quadros) cb();
    });
    this.aplicarCena();
    // A fotogrametria é preparada com folga, escondida: a primeira entrada
    // numa cidade não paga a inicialização.
    setTimeout(() => void this.montarFoto(), 2500);
  }

  /* -------------------------------------------------------------- imagem */

  private async montarImagem() {
    const camadas = this.viewer.imageryLayers;
    if (this.camadaBase) camadas.remove(this.camadaBase, true);
    if (this.camadaRotulos) camadas.remove(this.camadaRotulos, true);
    this.camadaBase = undefined;
    this.camadaRotulos = undefined;

    if (this.capacidades.token) {
      try {
        // Uma camada só, com os rótulos embutidos. 3 = Bing Aerial with Labels · 2 = Bing Aerial
        const ion = await IonImageryProvider.fromAssetId(this.camadas.rotulos ? 3 : 2);
        this.camadaBase = camadas.addImageryProvider(ion, 0);
        this.capacidades.imagem = "ion";
      } catch (e) {
        console.warn("Cesium ion indisponível (token inválido ou sem rede); usando ESRI.", e);
        this.capacidades.token = false;
      }
    }
    if (!this.camadaBase) {
      try {
        const esri = await ArcGisMapServerImageryProvider.fromUrl(`${ESRI}/World_Imagery/MapServer`, {
          enablePickFeatures: false,
        });
        this.camadaBase = camadas.addImageryProvider(esri, 0);
        this.capacidades.imagem = "esri";
        // Sem token não existe satélite gratuito com rótulos embutidos: eles vêm em uma segunda camada.
        this.camadaRotulos = camadas.addImageryProvider(
          new UrlTemplateImageryProvider({
            url: `${ESRI}/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}`,
            maximumLevel: 13,
            credit: "Esri",
          }),
          1,
        );
        this.camadaRotulos.alpha = 0.72;
      } catch (e) {
        console.warn("ESRI indisponível; usando o Natural Earth embutido.", e);
      }
    }
    if (!this.camadaBase) {
      const ne = await TileMapServiceImageryProvider.fromUrl(buildModuleUrl("Assets/Textures/NaturalEarthII"));
      this.camadaBase = camadas.addImageryProvider(ne, 0);
      this.capacidades.imagem = "natural-earth";
    }
    // Leve escurecida: a rota e os painéis ganham contraste.
    this.camadaBase.brightness = 0.86;
    this.camadaBase.contrast = 1.12;
    this.camadaBase.saturation = 0.92;
    this.aplicarVisibilidade3D();
  }

  private async montarRelevo() {
    if (!this.capacidades.token) return;
    try {
      this.relevoIon = await createWorldTerrainAsync({ requestVertexNormals: true });
      this.capacidades.relevo = true;
      // Cidades em 3D = fotogrametria do Google via Cesium ion (precisa da flag e do asset na conta).
      this.capacidades.fotorrealista = import.meta.env.VITE_ENABLE_PHOTOREALISTIC === "true";
      this.capacidades.predios = this.capacidades.fotorrealista;
      if (this.camadas.relevo) this.viewer.terrainProvider = this.relevoIon;
    } catch (e) {
      console.warn("Relevo do Cesium ion indisponível; seguindo sem relevo.", e);
    }
  }

  private async montarFoto() {
    if (this.fotoEstado !== "nao" || !this.capacidades.fotorrealista || this.destruido) return;
    this.fotoEstado = "carregando";
    try {
      const foto = await createGooglePhotorealistic3DTileset();
      if (this.destruido) return;
      foto.show = false;
      // Fotogrametria pesa: GPUs modestas pedem menos detalhe (textura ainda nítida à distância do roteiro).
      this.sseFoto = CELULAR ? 28 : this.modesta ? 24 : 16;
      foto.maximumScreenSpaceError = this.sseFoto;
      foto.dynamicScreenSpaceError = true;
      foto.preloadFlightDestinations = true;
      foto.cullRequestsWhileMoving = true;
      foto.tileFailed.addEventListener(() => {
        // Cota estourada ou rede ruim: volta para terreno + imagem de satélite.
        if (++this.falhasFoto > 12 && this.fotoEstado === "ok") {
          console.warn("Photorealistic 3D Tiles falhando; voltando para o terreno.");
          this.fotoEstado = "falhou";
          this.capacidades.predios = false;
          this.atualizarFoto();
        }
      });
      this.foto = this.scene.primitives.add(foto) as Cesium3DTileset;
      this.fotoEstado = "ok";
      this.pedirQuadro();
    } catch (e) {
      console.warn("Photorealistic 3D Tiles indisponível (o asset do Google precisa estar na conta do ion).", e);
      this.fotoEstado = "falhou";
      this.capacidades.predios = false;
    }
  }

  private get perto() {
    return this.cena.nivel === "cidade" || this.cena.nivel === "local";
  }

  /**
   * Fotogrametria do Google nos níveis Cidade e Local. A troca entre o globo
   * (imagem de satélite + relevo) e o modelo 3D acontece por altitude, com
   * histerese, abaixo de ~35 km: nessa altura a diferença entre as duas
   * imagens quase não se nota, e o 3D já está carregando quando a câmera
   * pousa. O globo some porque os dois têm o chão no mesmo lugar.
   */
  private atualizarFoto() {
    const quer = this.perto && this.camadas.predios && this.fotoEstado === "ok" && this.foto;
    const altitude = this.camera.positionCartographic.height;
    let visivel = this.fotoVisivel;
    if (!quer) visivel = false;
    else if (altitude < 32_000) visivel = true;
    else if (altitude > 48_000) visivel = false;
    if (visivel === this.fotoVisivel && this.scene.globe.show === !visivel) return;
    this.fotoVisivel = visivel;
    if (this.foto) this.foto.show = visivel;
    this.scene.globe.show = !visivel;
    this.pedirQuadro();
  }

  /** Rótulos da Esri conforme o nível (sem token). */
  private aplicarVisibilidade3D() {
    // Os rótulos da Esri só vão até o zoom regional: de perto viram borrão.
    if (this.camadaRotulos) this.camadaRotulos.show = this.camadas.rotulos && !this.perto;
    this.atualizarFoto();
    this.pedirQuadro();
  }

  definirCamadas(novas: Camadas) {
    const antes = this.camadas;
    this.camadas = { ...novas };
    if (novas.rotulos !== antes.rotulos && this.capacidades.imagem === "ion") void this.montarImagem();
    if (novas.relevo !== antes.relevo && this.relevoIon) {
      this.viewer.terrainProvider = novas.relevo ? this.relevoIon : this.elipsoide;
      this.reposicionarLinhas();
    }
    if (novas.luz !== antes.luz) this.aplicarLuz(true);
    if (novas.predios) void this.montarFoto();
    this.aplicarVisibilidade3D();
  }

  /**
   * Data em evidência (o dia aberto na linha do tempo) e onde estaremos.
   * Com "Dia e noite" ligado, o sol vai para a posição real do fim de tarde
   * daquela data naquele lugar.
   */
  definirData(iso: string | null, lat = 47, lon = 8) {
    const mesma = this.data?.iso === iso && this.data?.lat === lat && this.data?.lon === lon;
    if (mesma || (!iso && !this.data)) return;
    this.data = iso ? { iso, lat, lon } : null;
    if (this.camadas.luz) this.aplicarLuz(false);
  }

  private nivelDaLuz: boolean | null = null;

  private horaAlvo(): JulianDate {
    if (!this.camadas.luz) {
      // Luz neutra de estúdio: sol alto sobre a Europa, relevo e prédios bem modelados.
      return JulianDate.fromIso8601("2027-06-21T10:30:00Z");
    }
    const d = this.data ?? { iso: trip.viagem.inicio, lat: 47, lon: 8 };
    // De longe: pouco antes do pôr do sol no lugar, com a noite já cobrindo o
    // leste da Europa e o oeste ainda claro. De perto: meio da tarde, para a cidade ficar bem iluminada.
    const antes = this.perto ? 170 : 55;
    return JulianDate.fromDate(new Date(porDoSol(d.iso, d.lat, d.lon).getTime() - antes * 60_000));
  }

  private horaDe = new JulianDate();
  private horaPara = new JulianDate();
  private horaT = 1;

  private aplicarLuz(imediato: boolean) {
    this.nivelDaLuz = this.perto;
    this.scene.globe.enableLighting = this.camadas.luz;
    const alvo = this.horaAlvo();
    if (imediato || MOVIMENTO_REDUZIDO) {
      this.viewer.clock.currentTime = alvo;
      this.horaT = 1;
    } else {
      JulianDate.clone(this.viewer.clock.currentTime, this.horaDe);
      JulianDate.clone(alvo, this.horaPara);
      this.horaT = 0;
    }
    this.pedirQuadro();
  }

  /* -------------------------------------------------------------- países */

  private async montarPaises() {
    const simples = new Map<string, Anel[]>();
    try {
      const url = new URL("geo/paises-50m.geojson", document.baseURI).href;
      const geo = await (await fetch(url)).json();
      type Feicao = { properties: { a3: string; nome: string; simples?: Anel[] }; geometry: { coordinates: Anel[][] } };
      this.paises = (geo.features as Feicao[]).map((f) => {
        const poligonos = f.geometry.coordinates;
        const caixas = poligonos.map((p) => caixaDoAnel(p[0]));
        if (f.properties.simples) simples.set(f.properties.a3, f.properties.simples);
        return {
          a3: f.properties.a3,
          nome: f.properties.nome,
          poligonos,
          caixa: [
            Math.min(...caixas.map((c) => c[0])),
            Math.min(...caixas.map((c) => c[1])),
            Math.max(...caixas.map((c) => c[2])),
            Math.max(...caixas.map((c) => c[3])),
          ],
        } satisfies Pais;
      });
    } catch (e) {
      console.warn("Não foi possível carregar as fronteiras.", e);
      return;
    }
    if (this.destruido) return;
    for (const p of this.paises) this.porA3.set(p.a3, p);

    const naEuropa = (anel: Anel) => {
      const [o, s, l, n] = caixaDoAnel(anel);
      return l > -32 && o < 50 && n > 24 && s < 74;
    };
    const hierarquia = (poligono: Anel[]) =>
      new PolygonHierarchy(
        Cartesian3.fromDegreesArray(poligono[0].flat()),
        poligono.slice(1).map((buraco) => new PolygonHierarchy(Cartesian3.fromDegreesArray(buraco.flat()))),
      );

    const instancias: GeometryInstance[] = [];
    const foraDaViagem: Anel[][] = [];
    this.bordas = this.scene.primitives.add(new PolylineCollection()) as PolylineCollection;
    const paraAmostrar: { linha: Polyline; anel: Anel }[] = [];

    for (const pais of this.paises) {
      const id = this.a3DaViagem.get(pais.a3);
      if (!id) {
        foraDaViagem.push(...pais.poligonos);
        continue;
      }
      // Territórios ultramarinos (Guiana Francesa, Caribe holandês) não entram no destaque.
      foraDaViagem.push(...pais.poligonos.filter((p) => !naEuropa(p[0])));
      pais.poligonos = pais.poligonos.filter((p) => naEuropa(p[0]));
      const caixas = pais.poligonos.map((p) => caixaDoAnel(p[0]));
      pais.caixa = [
        Math.min(...caixas.map((c) => c[0])),
        Math.min(...caixas.map((c) => c[1])),
        Math.max(...caixas.map((c) => c[2])),
        Math.max(...caixas.map((c) => c[3])),
      ];

      const cor = Color.fromCssColorString(paisPorId.get(id)!.cor);
      const ids: string[] = [];
      pais.poligonos.forEach((poligono, i) => {
        const idInstancia = `pais:${pais.a3}:${i}`;
        ids.push(idInstancia);
        instancias.push(
          new GeometryInstance({
            id: idInstancia,
            geometry: new PolygonGeometry({ polygonHierarchy: hierarquia(poligono) }),
            attributes: { color: ColorGeometryInstanceAttribute.fromColor(TRANSPARENTE) },
          }),
        );
      });

      const material = materialDaBorda(cor.withAlpha(0));
      const linhas = (aneis: Anel[], visivel: boolean) =>
        aneis.map((bruto) => {
          const anel = densificarAnel(bruto);
          const linha = this.bordas!.add({ positions: this.posicoesDaBorda(anel), width: 5, loop: true, material, show: visivel });
          paraAmostrar.push({ linha, anel });
          return linha;
        });
      const aneisDetalhe = pais.poligonos.filter((p) => pais.poligonos.length === 1 || this.grande(p[0])).map((p) => p[0]);
      const aneisGerais = CONTORNO_GERAL === "simples" && simples.get(pais.a3)?.length ? simples.get(pais.a3)! : null;
      const detalhe = linhas(aneisDetalhe, !aneisGerais);
      const geral = aneisGerais ? linhas(aneisGerais, true) : detalhe;
      this.desenhados.set(id, {
        cor,
        ids,
        preenchimento: Color.clone(TRANSPARENTE),
        preenchimentoAlvo: Color.clone(TRANSPARENTE),
        material,
        geral,
        detalhe,
        borda: 0,
        bordaAlvo: 0,
        brilho: 0.2,
        brilhoAlvo: 0.2,
      });
    }

    // Um único GroundPrimitive para todos os países da viagem: uma chamada de
    // desenho, cor por instância (é o que permite o fade).
    if (GroundPrimitive.isSupported(this.scene)) {
      this.preenchimentos = this.scene.primitives.add(
        new GroundPrimitive({
          geometryInstances: instancias,
          appearance: new PerInstanceColorAppearance({ flat: true, translucent: true }),
          classificationType: ClassificationType.TERRAIN,
          releaseGeometryInstances: true,
        }),
      ) as GroundPrimitive;
    }
    this.aplicarPaises();
    void this.montarEscurecimento(foraDaViagem);
    void this.quandoOGloboCarregar().then(() => this.amostrarBordas(paraAmostrar));
  }

  /**
   * O resto do mundo é escurecido por uma camada de imagem (uma textura sobre
   * o terreno), bem mais barata que classificar centenas de polígonos.
   */
  private async montarEscurecimento(poligonos: Anel[][]) {
    const J = JANELA_ESCURA;
    const largura = CELULAR ? 2048 : 4096;
    const altura = Math.round((largura * (J.norte - J.sul)) / (J.leste - J.oeste));
    const tela = document.createElement("canvas");
    tela.width = largura;
    tela.height = altura;
    const g = tela.getContext("2d")!;
    const x = (lon: number) => ((lon - J.oeste) / (J.leste - J.oeste)) * largura;
    const y = (lat: number) => ((J.norte - lat) / (J.norte - J.sul)) * altura;
    g.fillStyle = "#03060c";
    for (const poligono of poligonos) {
      const [o, s, l, n] = caixaDoAnel(poligono[0]);
      if (l < J.oeste || o > J.leste || n < J.sul || s > J.norte) continue;
      g.beginPath();
      for (const anel of poligono) {
        anel.forEach(([lon, lat], i) => (i ? g.lineTo(x(lon), y(lat)) : g.moveTo(x(lon), y(lat))));
        g.closePath();
      }
      g.fill("evenodd");
    }
    // Bordas da janela em degradê: de longe, o escurecimento some aos poucos, sem linha reta.
    g.globalCompositeOperation = "destination-out";
    const faixa = (x0: number, y0: number, x1: number, y1: number, rx: number, ry: number, rw: number, rh: number) => {
      const grad = g.createLinearGradient(x0, y0, x1, y1);
      grad.addColorStop(0, "rgba(0,0,0,1)");
      grad.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = grad;
      g.fillRect(rx, ry, rw, rh);
    };
    const mx = largura * 0.1;
    const my = altura * 0.12;
    faixa(0, 0, mx, 0, 0, 0, mx, altura);
    faixa(largura, 0, largura - mx, 0, largura - mx, 0, mx, altura);
    faixa(0, 0, 0, my, 0, 0, largura, my);
    faixa(0, altura, 0, altura - my, 0, altura - my, largura, my);

    const blob = await new Promise<Blob | null>((ok) => tela.toBlob(ok, "image/png"));
    if (!blob || this.destruido) return;
    const url = URL.createObjectURL(blob);
    try {
      const provedor = await SingleTileImageryProvider.fromUrl(url, {
        rectangle: Rectangle.fromDegrees(J.oeste, J.sul, J.leste, J.norte),
      });
      if (this.destruido) return;
      this.camadaEscura = this.viewer.imageryLayers.addImageryProvider(provedor as ImageryProvider);
      this.camadaEscura.alpha = 0;
      this.pedirQuadro();
    } catch (e) {
      console.warn("Camada de escurecimento indisponível.", e);
    }
  }

  private posicoesDaBorda(anel: Anel): Cartesian3[] {
    // As bordas só aparecem de longe, onde o relevo está exagerado.
    return anel.map(([lon, lat]) => {
      const h = this.usaRelevo ? (this.alturas.get(chaveAltura(lat, lon)) ?? 0) * 1.8 : 0;
      return Cartesian3.fromDegrees(lon, lat, h + 260);
    });
  }

  /** Dá às bordas a altura do terreno (grosseira: elas só aparecem de longe). */
  private amostrarBordas(aneis: { linha: Polyline; anel: Anel }[]) {
    const relevo = this.relevoIon;
    if (!relevo) return;
    const cartos: Cartographic[] = [];
    for (const a of aneis) for (const [lon, lat] of a.anel) cartos.push(Cartographic.fromDegrees(lon, lat));
    const chaves = aneis.flatMap((a) => a.anel.map(([lon, lat]) => chaveAltura(lat, lon)));
    sampleTerrain(relevo, 6, cartos)
      .then((res) => {
        if (this.destruido) return;
        res.forEach((c, i) => this.alturas.set(chaves[i], Math.max(0, c.height || 0)));
        for (const a of aneis) a.linha.positions = this.posicoesDaBorda(a.anel);
        this.pedirQuadro();
      })
      .catch(() => undefined);
  }

  private grande(anel: Anel) {
    const [o, s, l, n] = caixaDoAnel(anel);
    return (l - o) * (n - s) >= 0.02;
  }

  /** Define os alvos de cor das fronteiras para a cena atual; o tick faz o fade. */
  private aplicarPaises() {
    const { nivel, paisId } = this.cena;
    const perto = this.perto;
    this.escuroAlvo = perto ? 0 : 0.46;
    for (const [id, d] of this.desenhados) {
      const pais = paisPorId.get(id)!;
      const sobCursor = this.paisSobCursor === id;
      const emFoco = nivel === "pais" && id === paisId;
      let preenchimento: Color;
      let borda = pais.status === "atravessado" ? 0.5 : 0.85;
      if (perto) {
        preenchimento = TRANSPARENTE;
        borda = 0;
      } else if (nivel === "pais") {
        preenchimento = emFoco ? d.cor.withAlpha(0.07) : ESCURO.withAlpha(0.3);
        if (sobCursor && !emFoco) preenchimento = d.cor.withAlpha(0.16);
        borda = emFoco ? 1 : 0.22;
      } else {
        preenchimento = d.cor.withAlpha((pais.status === "atravessado" ? 0.06 : 0.11) + (sobCursor ? 0.14 : 0));
      }
      if (sobCursor && !perto) borda = 1;
      Color.clone(preenchimento, d.preenchimentoAlvo);
      d.bordaAlvo = borda;
      d.brilhoAlvo = sobCursor || emFoco ? 0.3 : 0.2;
      // 1:50m só no país em foco; a visão geral usa o contorno simplificado.
      if (d.geral !== d.detalhe) {
        for (const l of d.detalhe) l.show = emFoco;
        for (const l of d.geral) l.show = !emFoco;
      }
    }
    this.pedirQuadro();
  }

  /** Aproxima cores e brilhos dos alvos: é o fade de países e bordas. */
  private animarPaises(dt: number): boolean {
    let mudando = false;
    const k = MOVIMENTO_REDUZIDO ? 1 : 1 - Math.exp(-dt * 7);
    if (this.camadaEscura) {
      const a = this.camadaEscura.alpha;
      if (Math.abs(a - this.escuroAlvo) > 0.004) {
        this.camadaEscura.alpha = mistura(a, this.escuroAlvo, k);
        mudando = true;
      } else if (a !== this.escuroAlvo) {
        this.camadaEscura.alpha = this.escuroAlvo;
      }
      this.camadaEscura.show = this.camadaEscura.alpha > 0.004;
    }
    const pronto = this.preenchimentos?.ready ?? false;
    let algumPreenchido = false;
    let algumaBorda = false;
    for (const [id, d] of this.desenhados) {
      const c = d.preenchimento;
      const alvo = d.preenchimentoAlvo;
      const diferenca =
        Math.abs(c.alpha - alvo.alpha) + (Math.abs(c.red - alvo.red) + Math.abs(c.green - alvo.green) + Math.abs(c.blue - alvo.blue)) * alvo.alpha;
      if (diferenca > 0.004) {
        mudando = true;
        if (pronto) {
          // Quem está invisível já nasce na cor final: só a opacidade anima.
          const kCor = c.alpha < 0.01 ? 1 : k;
          if (alvo.alpha > 0.003) {
            c.red = mistura(c.red, alvo.red, kCor);
            c.green = mistura(c.green, alvo.green, kCor);
            c.blue = mistura(c.blue, alvo.blue, kCor);
          }
          c.alpha = mistura(c.alpha, alvo.alpha, k);
          if (Math.abs(c.alpha - alvo.alpha) < 0.004) c.alpha = alvo.alpha;
          d.atributos ??= d.ids.map((i) => this.preenchimentos!.getGeometryInstanceAttributes(i)) as { color: Uint8Array }[];
          const valor = ColorGeometryInstanceAttribute.toValue(c);
          for (const a of d.atributos) if (a) a.color = valor;
        }
      }
      if (c.alpha > 0.003) algumPreenchido = true;

      const emFoco = this.cena.nivel === "pais" && id === this.cena.paisId;
      if (Math.abs(d.borda - d.bordaAlvo) > 0.004) {
        d.borda = mistura(d.borda, d.bordaAlvo, k);
        mudando = true;
      } else {
        d.borda = d.bordaAlvo;
      }
      d.brilho = mistura(d.brilho, d.brilhoAlvo, k);
      // "Respiração" da borda do país em foco.
      const respira = emFoco && !MOVIMENTO_REDUZIDO ? Math.sin(this.relogio * 1.9) : 0;
      if (emFoco && !MOVIMENTO_REDUZIDO) mudando = true;
      const u = d.material.uniforms as { color: Color; glowPower: number };
      u.color = d.cor.withAlpha(limitar(d.borda * (1 - 0.1 + 0.1 * respira), 0, 1), u.color);
      u.glowPower = d.brilho + 0.055 * respira;
      if (d.borda > 0.004) algumaBorda = true;
    }
    if (this.preenchimentos) this.preenchimentos.show = algumPreenchido || !pronto;
    if (this.bordas) this.bordas.show = algumaBorda;
    return mudando;
  }

  private paisEm(lon: number, lat: number): string | null {
    for (const [a3, id] of this.a3DaViagem) {
      const pais = this.porA3.get(a3);
      if (pais && dentroDoPais(lon, lat, pais)) return id;
    }
    return null;
  }

  /* ---------------------------------------------------------------- rota */

  private get usaRelevo() {
    return this.camadas.relevo && this.capacidades.relevo;
  }

  private montarRota() {
    this.linhas = this.scene.primitives.add(new PolylineCollection()) as PolylineCollection;
    type Inicial = Partial<UniformesTrecho> & Pick<UniformesTrecho, "corA" | "estilo" | "nucleo">;
    const estilos: Record<Modal, { largura: number; u: Inicial }> = {
      voo: { largura: 4, u: { corA: VOO.withAlpha(0.62), estilo: ESTILO.tracejado, nucleo: 0.2, tracejado: 14 } },
      "onibus-noturno": { largura: 13, u: { corA: ONIBUS.withAlpha(0.95), estilo: ESTILO.tracejado, nucleo: 0.115, tracejado: 9 } },
      "trem-rapido": { largura: 11, u: { corA: AMBAR, estilo: ESTILO.brilho, nucleo: 0.12 } },
      "trem-noturno": { largura: 13, u: { corA: NOITE_A, corB: NOITE_B, estilo: ESTILO.brilho, nucleo: 0.105 } },
      "trem-aeroporto": { largura: 4, u: { corA: AMBAR.withAlpha(0.9), estilo: ESTILO.solido, nucleo: 0.32 } },
      "bate-volta": { largura: 4, u: { corA: AMBAR_CLARO.withAlpha(0.95), estilo: ESTILO.tracejado, nucleo: 0.28, tracejado: 6 } },
    };

    for (const trecho of trip.trechos) {
      const voo = trecho.modal === "voo";
      const bruto = trecho.paradas.map((p) => p.coords);
      let pts: LatLon[];
      let mundo: Cartesian3[];
      if (voo) {
        const arco = this.arco(bruto[0], bruto[bruto.length - 1]);
        pts = arco.pts;
        mundo = arco.mundo;
      } else {
        pts = reamostrar(suavizar(bruto, 12), 3500);
        mundo = pts.map(([lat, lon]) => Cartesian3.fromDegrees(lon, lat, 30));
      }
      const estilo = estilos[trecho.modal];
      const material = materialDoTrecho({ ...estilo.u, fase: Math.random() });
      const linha = this.linhas.add({ positions: mundo, width: estilo.largura, material });
      this.trechos.set(trecho.id, {
        trecho,
        pts,
        alturas: new Array(pts.length).fill(0),
        mundo,
        linha,
        u: uniformes(material),
        comprimento: comprimento(pts),
        opacidadeAlvo: 1,
        janelas: new Map(),
      });
    }
  }

  private arco(a: LatLon, b: LatLon, n = 140) {
    const geo = new EllipsoidGeodesic(Cartographic.fromDegrees(a[1], a[0]), Cartographic.fromDegrees(b[1], b[0]));
    const topo = limitar(geo.surfaceDistance * 0.09, 120_000, 520_000);
    const pts: LatLon[] = [];
    const mundo: Cartesian3[] = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const c = geo.interpolateUsingFraction(t);
      pts.push([c.latitude / RAD, c.longitude / RAD]);
      mundo.push(Cartesian3.fromRadians(c.longitude, c.latitude, Math.sin(Math.PI * t) * topo));
    }
    return { pts, mundo };
  }

  /** Recalcula a posição das linhas com a altura do terreno (leve altura, sem clamp). */
  private reposicionarLinhas() {
    for (const d of this.trechos.values()) {
      if (d.trecho.modal === "voo") continue;
      d.mundo = d.pts.map(([lat, lon], i) => Cartesian3.fromDegrees(lon, lat, (this.usaRelevo ? d.alturas[i] : 0) + 30));
      d.linha.positions = d.mundo;
    }
    this.pedirQuadro();
  }

  /** Ponto do mundo na fração f do trecho. */
  private pontoNoTrecho(d: TrechoDesenhado, f: number, saida: Cartesian3) {
    const i = limitar(f, 0, 1) * (d.mundo.length - 1);
    const a = Math.floor(i);
    const b = Math.min(d.mundo.length - 1, a + 1);
    return Cartesian3.lerp(d.mundo[a], d.mundo[b], i - a, saida);
  }

  /** Frações do trecho que ficam dentro do país (até dois pedaços, os maiores). */
  private janelaNoPais(d: TrechoDesenhado, paisId: string): Cartesian4 {
    const pronta = d.janelas.get(paisId);
    if (pronta) return pronta;
    const pais = this.porA3.get(paisPorId.get(paisId)!.isoA3);
    const pedacos: [number, number][] = [];
    if (pais && d.trecho.modal !== "voo") {
      let inicio = -1;
      const n = d.pts.length - 1;
      d.pts.forEach(([lat, lon], i) => {
        const dentro = dentroDoPais(lon, lat, pais);
        if (dentro && inicio < 0) inicio = i;
        if ((!dentro || i === n) && inicio >= 0) {
          const fim = dentro ? i : i - 1;
          if (fim > inicio) pedacos.push([inicio / n, fim / n]);
          inicio = -1;
        }
      });
    }
    pedacos.sort((a, b) => b[1] - b[0] - (a[1] - a[0]));
    const [p0, p1] = pedacos;
    const janela = new Cartesian4(p0?.[0] ?? 2, p0?.[1] ?? 2, p1?.[0] ?? 2, p1?.[1] ?? 2);
    if (pais) d.janelas.set(paisId, janela);
    return janela;
  }

  /** Define ênfase de cada trecho para a cena atual; o tick faz a transição. */
  private aplicarRota() {
    if (this.introAtiva) return;
    const { nivel, paisId, trechoId } = this.cena;
    for (const [id, d] of this.trechos) {
      d.linha.show = true;
      if (trechoId) {
        d.opacidadeAlvo = id === trechoId ? 1 : 0.2;
        Cartesian4.fromElements(0, 1, 0, 0, d.u.janela);
        d.u.apagado = 1;
      } else if (nivel === "pais" && paisId) {
        // Só o pedaço dentro do país fica aceso.
        d.opacidadeAlvo = 1;
        Cartesian4.clone(this.janelaNoPais(d, paisId), d.u.janela);
        d.u.apagado = 0.2;
      } else {
        d.opacidadeAlvo = 1;
        Cartesian4.fromElements(0, 1, 0, 0, d.u.janela);
        d.u.apagado = 1;
      }
    }
    this.pedirQuadro();
  }

  /** Anima opacidade, pulso e a luz dos trechos noturnos. Devolve se algo mudou. */
  private animarRota(dt: number): boolean {
    let mudando = false;
    const k = MOVIMENTO_REDUZIDO ? 1 : 1 - Math.exp(-dt * 7);
    const longe = !this.perto || Boolean(this.cena.trechoId);
    for (const [id, d] of this.trechos) {
      const u = d.u;
      if (Math.abs(u.opacidade - d.opacidadeAlvo) > 0.004) {
        u.opacidade = mistura(u.opacidade, d.opacidadeAlvo, k);
        mudando = true;
      } else {
        u.opacidade = d.opacidadeAlvo;
      }
      // Brilho pulsante sutil no trecho em foco; firme no trecho sob o cursor.
      let pulso = 0;
      if (!MOVIMENTO_REDUZIDO && (this.cena.trechoId === id || this.trechoEmJogo === id)) {
        pulso = 0.32 + 0.28 * Math.sin(this.relogio * 2.6);
        mudando = true;
      }
      if (this.trechoSobCursor === id) pulso = Math.max(pulso, 0.7);
      if (Math.abs(u.pulso - pulso) > 0.004) mudando = true;
      u.pulso = mistura(u.pulso, pulso, k);

      const noturno = d.trecho.modal === "trem-noturno" || d.trecho.modal === "onibus-noturno";
      if (noturno) {
        const luzAlvo = longe && !MOVIMENTO_REDUZIDO && !this.introAtiva ? (d.trecho.modal === "trem-noturno" ? 1 : 0.85) : 0;
        if (Math.abs(u.luz - luzAlvo) > 0.004) mudando = true;
        u.luz = mistura(u.luz, luzAlvo, k);
      }
      const temCabeca = u.cabeca > 0.001;
      if ((u.luz > 0.01 || temCabeca) && d.linha.show) {
        if (u.luz > 0.01 && !this.pausado) {
          u.fase = (u.fase + dt / (d.trecho.modal === "trem-noturno" ? 9 : 11)) % 1;
          mudando = true;
        }
        // Quantos pixels vale uma unidade de s perto da luz: a cabeça fica redonda em qualquer zoom.
        const f = temCabeca ? u.progresso : u.fase;
        const a = this.scene.cartesianToCanvasCoordinates(this.pontoNoTrecho(d, f, this.tmpMundo), this.tmpTela);
        const b = this.scene.cartesianToCanvasCoordinates(this.pontoNoTrecho(d, Math.min(1, f + 0.01), this.tmpMundo2), this.tmpTela2);
        if (a && b) {
          const px = Math.hypot(b.x - a.x, b.y - a.y) / 0.01;
          if (px > 1) u.escala = px;
        }
      }
    }
    return mudando;
  }

  /** Linha pontilhada ligando, em ordem, os locais do dia. */
  definirCaminhoDoDia(pontos: LatLon[] | null) {
    if (this.caminhoDia) this.viewer.entities.remove(this.caminhoDia);
    this.caminhoDia = undefined;
    // Pontos repetidos em sequência (dois locais na mesma praça) quebram a geometria.
    const unicos = (pontos ?? []).filter((p, i, todos) => i === 0 || distancia(p, todos[i - 1]) > 15);
    if (unicos.length > 1) {
      // É a única linha colada no terreno: são poucos quilômetros dentro da cidade.
      this.caminhoDia = this.viewer.entities.add({
        polyline: {
          positions: unicos.map(([lat, lon]) => Cartesian3.fromDegrees(lon, lat)),
          width: 2.5,
          material: new PolylineDashMaterialProperty({ color: Color.WHITE.withAlpha(0.75), dashLength: 10 }),
          clampToGround: true,
          classificationType: ClassificationType.BOTH,
        },
      });
    }
    this.pedirQuadro();
  }

  /* -------------------------------------------------------------- alturas */

  private async quandoOGloboCarregar() {
    for (let i = 0; i < 40 && !this.destruido; i++) {
      await espera(250);
      if (this.scene.globe.tilesLoaded) return;
    }
  }

  private amostrarAlturas() {
    const relevo = this.relevoIon;
    if (!relevo) return;
    const pontos: LatLon[] = [
      ...trip.cidades.map((c) => c.camera.alvo ?? c.coords),
      ...trip.cidades.map((c) => c.coords),
      ...trip.locais.map((l) => l.coords),
      ...trip.paises.map((p) => p.camera.alvo),
    ];
    const cartos = pontos.map(([lat, lon]) => Cartographic.fromDegrees(lon, lat));
    this.alturasProntas = sampleTerrainMostDetailed(relevo, cartos)
      .then((res) => {
        res.forEach((c, i) => this.alturas.set(chaveAltura(pontos[i][0], pontos[i][1]), c.height || 0));
        this.pedirQuadro();
      })
      .catch(() => undefined);

    for (const d of this.trechos.values()) {
      if (d.trecho.modal === "voo") continue;
      const cartosDoTrecho = d.pts.map(([lat, lon]) => Cartographic.fromDegrees(lon, lat));
      sampleTerrain(relevo, 9, cartosDoTrecho)
        .then((res) => {
          if (this.destruido) return undefined;
          d.alturas = res.map((c) => Math.max(0, c.height || 0));
          this.reposicionarLinhas();
          // Perto das estações a linha é vista de perto: ali vale a altura mais precisa.
          const n = d.pts.length;
          const pontas = [...Array(Math.min(6, n)).keys()].flatMap((i) => [i, n - 1 - i]);
          return sampleTerrainMostDetailed(
            relevo,
            pontas.map((i) => Cartographic.fromDegrees(d.pts[i][1], d.pts[i][0])),
          ).then((finos) => {
            finos.forEach((c, k) => (d.alturas[pontas[k]] = Math.max(0, c.height || 0)));
            this.reposicionarLinhas();
          });
        })
        .catch(() => undefined);
    }
  }

  private alturaBruta(lat: number, lon: number) {
    return this.usaRelevo ? (this.alturas.get(chaveAltura(lat, lon)) ?? 0) : 0;
  }

  /**
   * Relevo exagerado de longe (os Alpes aparecem) e real de perto. A passagem
   * acontece em poucos degraus pequenos conforme a altitude: cada mudança faz
   * o Cesium percorrer todos os tiles carregados, então uma rampa contínua
   * travaria o voo, e um salto único seria visível.
   */
  private ajustarPorAltitude() {
    const altitude = this.camera.positionCartographic.height;
    // Com relevo, o exagero nunca é exatamente 1: entrar e sair de 1 obriga a
    // recodificar a malha de todos os tiles.
    let alvo = 1;
    if (this.usaRelevo) {
      const continuo = 0.8 * suave((altitude - 150_000) / 450_000);
      const degrau = Math.round(continuo / 0.2) * 0.2;
      // Só troca quando passou bem do meio do caminho até o próximo degrau.
      const atual = this.exagero - 1;
      alvo = 1 + (Math.abs(continuo - atual) > 0.14 ? degrau : Math.round(atual / 0.2) * 0.2);
      if (alvo < 1.001) alvo = 1.001;
    }
    if (alvo !== this.exagero) {
      this.exagero = alvo;
      this.scene.verticalExaggeration = alvo;
    }
    // De longe as linhas não são testadas contra o terreno (ficam sempre
    // visíveis, mesmo com o relevo exagerado); de perto, sim, para os prédios
    // e os morros esconderem o que está atrás.
    const testar = this.capacidades.relevo && altitude < 60_000;
    if (this.scene.globe.depthTestAgainstTerrain !== testar) this.scene.globe.depthTestAgainstTerrain = testar;
    this.atualizarFoto();
  }

  /* ----------------------------------------------------------------- cena */

  definirCena(cena: Cena) {
    this.cena = cena;
    this.aplicarCena();
  }

  private aplicarCena() {
    if (this.perto && this.camadas.predios) void this.montarFoto();
    this.aplicarVisibilidade3D();
    this.aplicarPaises();
    this.aplicarRota();
    if (this.camadas.luz && this.nivelDaLuz !== this.perto) this.aplicarLuz(false);
  }

  /* --------------------------------------------------------------- câmera */

  /** Quanto a câmera é transladada, por metro de distância, para compensar os painéis. */
  private fatores(pitch: number) {
    const largura = this.scene.canvas.clientWidth || 1;
    const altura = this.scene.canvas.clientHeight || 1;
    const fov = (this.camera.frustum as PerspectiveFrustum).fov ?? CMath.toRadians(60);
    const aspecto = largura / altura;
    const tanX = aspecto >= 1 ? Math.tan(fov / 2) : Math.tan(fov / 2) * aspecto;
    const tanY = aspecto >= 1 ? Math.tan(fov / 2) / aspecto : Math.tan(fov / 2);
    const kx = this.margens.esquerda > 0 ? tanX * (this.margens.esquerda / largura) : 0;
    // Descer demais numa vista rasante colocaria a câmera perto do chão.
    const ky =
      this.margens.baixo > 0
        ? Math.min(Math.sin(Math.abs(pitch)) * 0.45, tanY * (Math.min(this.margens.baixo, altura * 0.4) / altura))
        : 0;
    return { kx, ky, tanX, largura };
  }

  /**
   * As distâncias em trip.ts foram pensadas para uma tela larga. Em tela
   * estreita (celular em pé), países e trechos precisam de mais distância
   * para caber na faixa livre.
   */
  private fatorDeTela(range: number) {
    if (range < 80_000) return 1;
    const { tanX, largura } = this.fatores(-1);
    const livre = (2 * tanX * (largura - this.margens.esquerda)) / largura;
    return limitar(0.76 / livre, 1, 2.4);
  }

  /**
   * Coloca a câmera olhando para o alvo e a translada de lado (sem girar): o
   * alvo desliza para o centro da área livre e o horizonte continua reto.
   */
  private posicionar(cam: Camera, centro: Cartesian3, heading: number, pitch: number, range: number) {
    cam.lookAt(centro, new HeadingPitchRange(heading, pitch, range));
    cam.lookAtTransform(Matrix4.IDENTITY);
    const { kx, ky } = this.fatores(cam.pitch);
    if (kx) cam.moveLeft(range * kx);
    if (ky) cam.moveDown(range * ky);
  }

  private centro(p: Pose, saida = new Cartesian3()) {
    return Cartesian3.fromDegrees(p.lon, p.lat, p.alt * this.exagero, Ellipsoid.WGS84, saida);
  }

  /**
   * Pose atual da câmera. Se ela foi mexida à mão, é recalculada a partir da
   * câmera de modo que `posicionar` devolva exatamente a mesma vista: o voo
   * seguinte parte sem salto.
   */
  private lerPose(): Pose | null {
    if (this.pose && !this.poseSuja) return this.pose;
    const cam = this.camera;
    const { kx, ky } = this.fatores(cam.pitch);
    const direcao = Cartesian3.clone(cam.directionWC);
    Cartesian3.add(direcao, Cartesian3.multiplyByScalar(cam.rightWC, kx, new Cartesian3()), direcao);
    Cartesian3.add(direcao, Cartesian3.multiplyByScalar(cam.upWC, ky, new Cartesian3()), direcao);
    const modulo = Cartesian3.magnitude(direcao);
    const raio = new Ray(cam.positionWC, Cartesian3.normalize(direcao, new Cartesian3()));
    const corte = IntersectionTests.rayEllipsoid(raio, Ellipsoid.WGS84);
    if (!corte || corte.start <= 0) return null;
    const range = corte.start / modulo;
    const alvo = Ray.getPoint(raio, corte.start);
    const carto = Cartographic.fromCartesian(alvo);
    if (!carto) return null;
    // Orientação medida no referencial do alvo, que é o que `lookAt` usa.
    const paraLocal = Matrix4.inverseTransformation(Transforms.eastNorthUpToFixedFrame(alvo), new Matrix4());
    const local = Matrix4.multiplyByPointAsVector(paraLocal, cam.directionWC, new Cartesian3());
    this.pose = {
      lat: carto.latitude / RAD,
      lon: carto.longitude / RAD,
      alt: 0,
      heading: Math.atan2(local.x, local.y),
      pitch: Math.asin(limitar(local.z, -1, 1)),
      range,
    };
    this.poseSuja = false;
    return this.pose;
  }

  private pararAnimacoes() {
    this.orbita = null;
    this.animacao = null;
    if (this.voando) {
      const v = this.voando;
      this.voando = null;
      v.resolver(false);
    }
    this.restaurarDetalhe();
  }

  private restaurarDetalhe() {
    this.scene.globe.maximumScreenSpaceError = this.sseBase;
    if (this.foto) this.foto.maximumScreenSpaceError = this.sseFoto;
  }

  /**
   * Voa até o alvo, no estilo Google Earth: sobe em arco proporcional à
   * distância, inclina e gira de leve no caminho e desacelera no pouso.
   * Resolve `true` se chegou e `false` se outro voo ou o usuário assumiu.
   * Com `orbitar`, emenda numa órbita lenta que para na primeira interação.
   */
  async voarPara(
    alvo: AlvoCamera,
    opcoes: { orbitar?: boolean; imediato?: boolean; duracao?: number; manterAnimacao?: boolean } = {},
  ): Promise<boolean> {
    const voo = ++this.voo;
    const animacao = opcoes.manterAnimacao ? this.animacao : null;
    this.pararAnimacoes();
    this.animacao = animacao;
    this.camera.cancelFlight();

    if (this.relevoIon && !this.alturas.has(chaveAltura(alvo.lat, alvo.lon))) {
      await Promise.race([this.alturasProntas, espera(700)]);
      if (voo !== this.voo || this.destruido) return false;
    }
    // Sem relevo nem prédios, a imagem de satélite é plana: vista muito rasante
    // vira um borrão, então a câmera olha mais de cima.
    const plano = !this.capacidades.relevo && alvo.range < 80_000;
    const para: Pose = {
      lat: alvo.lat,
      lon: alvo.lon,
      alt: this.alturaBruta(alvo.lat, alvo.lon),
      heading: alvo.heading * RAD,
      pitch: (plano ? Math.min(alvo.pitch, -52) : alvo.pitch) * RAD,
      range: (plano ? Math.max(alvo.range, 650) : alvo.range) * this.fatorDeTela(alvo.range),
    };
    const de = this.lerPose();
    this.preCarregar(para);

    const chegar = () => {
      this.pose = para;
      this.poseSuja = false;
      this.posicionar(this.camera, this.centro(para), para.heading, para.pitch, para.range);
      if (opcoes.orbitar && !MOVIMENTO_REDUZIDO) this.orbita = { pose: { ...para }, idade: 0, espera: 0 };
      this.pedirQuadro();
    };

    if (!de || opcoes.imediato) {
      this.eventos.aoVoar?.(0);
      chegar();
      return true;
    }

    const geo = new EllipsoidGeodesic(Cartographic.fromDegrees(de.lon, de.lat), Cartographic.fromDegrees(para.lon, para.lat));
    const chao = geo.surfaceDistance || 0;
    const zoom = criarZoom(chao, de.range, para.range);
    let duracao = opcoes.duracao ?? limitar(1.45 + 0.34 * zoom.comprimento, 2.0, 3.5);
    if (MOVIMENTO_REDUZIDO) duracao = Math.min(duracao, 0.6);
    // Quanto o caminho sobe acima das duas pontas: 0 = sem arco, 1 = arco alto.
    const arco = limitar(Math.log(zoom.topo / Math.max(de.range, para.range)) / 1.6, 0, 1);

    this.eventos.aoVoar?.(duracao);
    const chegou = await new Promise<boolean>((resolver) => {
      this.voando = { de, para, geo: chao > 1 ? geo : null, zoom, arco, t: 0, duracao, resolver };
      this.pedirQuadro();
    });
    if (!chegou || voo !== this.voo || this.destruido) return false;
    chegar();
    return true;
  }

  private avancarVoo(dt: number) {
    const v = this.voando!;
    v.t = Math.min(1, v.t + dt / v.duracao);
    const e = suavizarVoo(v.t);
    const { andado, distancia: range } = v.zoom.em(e);
    const meio = Math.sin(Math.PI * e);
    let lat = v.para.lat;
    let lon = v.para.lon;
    if (v.geo) {
      const c = v.geo.interpolateUsingFraction(andado, this.tmpCarto);
      lat = c.latitude / RAD;
      lon = c.longitude / RAD;
    }
    // No alto do arco a câmera olha mais de cima e gira de leve; no pouso, assenta na pose final.
    const pitchReto = mistura(v.de.pitch, v.para.pitch, e);
    const pitch = pitchReto + (-82 * RAD - pitchReto) * 0.55 * v.arco * meio;
    const heading = v.de.heading + menorGiro(v.de.heading, v.para.heading) * e + 7 * RAD * v.arco * meio;
    const alt = mistura(v.de.alt, v.para.alt, andado) * this.exagero;
    this.posicionar(this.camera, Cartesian3.fromDegrees(lon, lat, alt, Ellipsoid.WGS84, this.tmpMundo), heading, pitch, range);
    // No meio do voo o detalhe do chão não é percebido: pedir menos tiles
    // deixa a banda e a GPU para o destino.
    const folga = e < 0.82 ? meio : 0;
    this.scene.globe.maximumScreenSpaceError = this.sseBase * (1 + 1.5 * folga);
    if (this.foto) this.foto.maximumScreenSpaceError = this.sseFoto * (1 + 2.5 * folga);
    if (v.t >= 1) {
      this.voando = null;
      this.restaurarDetalhe();
      v.resolver(true);
    }
  }

  /**
   * Começa a baixar os tiles do destino no início do voo: quando a câmera
   * pousa, a imagem já está no cache do navegador e chega nítida.
   */
  private preCarregar(p: Pose) {
    try {
      const provedor = this.camadaBase?.imageryProvider;
      const carto = Cartographic.fromDegrees(p.lon, p.lat);
      const nivelPara = (larguraDoTile: number) =>
        Math.round(Math.log2((40_075_000 * Math.cos(p.lat * RAD)) / Math.max(1, larguraDoTile)));
      if (provedor?.tilingScheme) {
        const maximo = provedor.maximumLevel ?? 18;
        const nivel = limitar(nivelPara(p.range * 0.55), provedor.minimumLevel ?? 0, maximo);
        for (const n of nivel > 2 ? [nivel - 1, nivel] : [nivel]) {
          const xy = provedor.tilingScheme.positionToTileXY(carto, n);
          if (!xy) continue;
          const lado = provedor.tilingScheme.getNumberOfXTilesAtLevel(n);
          const altura = provedor.tilingScheme.getNumberOfYTilesAtLevel(n);
          for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
              const x = (xy.x + dx + lado) % lado;
              const y = xy.y + dy;
              if (y < 0 || y >= altura) continue;
              const pedido = provedor.requestImage(x, y, n);
              pedido?.then((img) => (img as { close?: () => void })?.close?.()).catch(() => undefined);
            }
          }
        }
      }
      const relevo = this.usaRelevo ? this.relevoIon : undefined;
      if (relevo) {
        const nivel = limitar(nivelPara(p.range * 1.6) - 1, 0, 13);
        const xy = relevo.tilingScheme.positionToTileXY(carto, nivel);
        if (xy && relevo.getTileDataAvailable(xy.x, xy.y, nivel) !== false) {
          relevo.requestTileGeometry(xy.x, xy.y, nivel)?.catch(() => undefined);
        }
      }
    } catch {
      // Pré-carregamento é só um adiantamento: se falhar, o voo segue normal.
    }
  }

  pararOrbita() {
    this.orbita = null;
  }

  /* ---------------------------------------------------------------- intro */

  private introAtiva = false;
  private fimDaIntro: (() => void) | null = null;

  /**
   * Abertura: arco Fortaleza → Lisboa, giro até a Europa e a rota se
   * desenhando de Lisboa a Roma. `aoAlcancar` avisa cada cidade tocada.
   */
  tocarIntro(aoAlcancar: (cidadeId: string) => void): Promise<void> {
    const europa = trip.viagem.camera;
    const alvoEuropa: AlvoCamera = { lat: europa.alvo[0], lon: europa.alvo[1], heading: europa.heading, pitch: europa.pitch, range: europa.range };
    if (MOVIMENTO_REDUZIDO) {
      for (const c of trip.cidades) aoAlcancar(c.id);
      return this.voarPara(alvoEuropa, { imediato: true }).then(() => undefined);
    }
    this.introAtiva = true;
    for (const d of this.trechos.values()) {
      d.u.progresso = 0;
      d.u.resto = 0;
      d.u.cabeca = 0;
      d.u.opacidade = d.opacidadeAlvo = 1;
      d.linha.show = false;
    }

    const ida = this.trechos.get("voo-ida")!;
    const rota = ROTA_PRINCIPAL.map((t) => this.trechos.get(t.id)!);
    const total = rota.reduce((s, d) => s + d.comprimento, 0);
    let acumulado = 0;
    const limites = rota.map((d) => (acumulado += d.comprimento) / total);

    const T_ARCO = [0.5, 3.2];
    const T_CAMERA = 1.9;
    const T_ROTA = [6.0, 13.2];
    const T_FIM = 14.0;
    let t = 0;
    let cameraPartiu = false;
    let lisboa = false;
    let alcancados = 0;
    ida.linha.show = true;
    ida.u.cabeca = 1;

    const revelar = (cidadeId: string) => {
      aoAlcancar(cidadeId);
      for (const bv of trip.trechos) {
        if (bv.modal === "bate-volta" && bv.de === cidadeId) {
          const d = this.trechos.get(bv.id)!;
          d.linha.show = true;
          d.u.progresso = 1;
          aoAlcancar(bv.para);
        }
      }
    };

    return new Promise<void>((resolver) => {
      const terminar = () => {
        if (!this.introAtiva) return;
        this.introAtiva = false;
        this.fimDaIntro = null;
        this.animacao = null;
        for (const d of this.trechos.values()) {
          d.u.progresso = 1;
          d.u.cabeca = 0;
          d.linha.show = true;
        }
        for (const c of trip.cidades) aoAlcancar(c.id);
        this.aplicarRota();
        resolver();
      };
      this.fimDaIntro = () => {
        terminar();
        void this.voarPara(alvoEuropa, { duracao: 0.9 });
      };
      this.animacao = (dt) => {
        t += dt;
        if (!cameraPartiu && t >= T_CAMERA) {
          cameraPartiu = true;
          void this.voarPara(alvoEuropa, { duracao: 4.6, manterAnimacao: true });
        }
        if (t < T_ROTA[0]) {
          const f = suave((t - T_ARCO[0]) / (T_ARCO[1] - T_ARCO[0]));
          ida.u.progresso = f;
          ida.u.cabeca = f < 1 ? 1 : Math.max(0, ida.u.cabeca - dt * 2.5);
          if (f >= 1 && !lisboa) {
            lisboa = true;
            revelar("lisboa");
          }
        } else {
          ida.u.cabeca = 0;
          const f = suave((t - T_ROTA[0]) / (T_ROTA[1] - T_ROTA[0]));
          let k = limites.findIndex((l) => f < l);
          if (k < 0) k = rota.length - 1;
          const inicio = k === 0 ? 0 : limites[k - 1];
          const local = limitar((f - inicio) / (limites[k] - inicio), 0, 1);
          while (alcancados < k || (f >= 1 && alcancados < rota.length)) {
            const feito = rota[alcancados];
            feito.u.progresso = 1;
            feito.u.cabeca = 0;
            revelar(feito.trecho.para);
            alcancados++;
          }
          if (f < 1) {
            // Cada trecho se desenha já no seu estilo, puxado pela cabeça luminosa.
            rota[k].linha.show = true;
            rota[k].u.progresso = local;
            rota[k].u.cabeca = 1;
          }
        }
        if (t >= T_FIM) terminar();
      };
    });
  }

  pularIntro() {
    this.fimDaIntro?.();
  }

  /* ----------------------------------------------------------------- tour */

  definirPausa(pausado: boolean) {
    this.pausado = pausado;
  }

  /**
   * Redesenha um trecho do começo ao fim, puxado por uma cabeça luminosa, com
   * a câmera acompanhando. Resolve `false` se foi interrompido.
   */
  async tocarTrecho(id: string): Promise<boolean> {
    const d = this.trechos.get(id);
    if (!d) return true;
    const voo = d.trecho.modal === "voo";
    const km = d.comprimento / 1000;
    const range = voo ? d.comprimento * 1.9 : limitar(d.comprimento * 1.25, 45_000, 1_100_000);
    const pitch = voo ? -88 : -58;
    const inicio = d.pts[voo ? Math.floor(d.pts.length / 2) : 0];
    const chegou = await this.voarPara({ lat: inicio[0], lon: inicio[1], heading: 0, pitch, range }, { duracao: voo ? 2.4 : 1.7 });
    if (!chegou) return false;
    if (MOVIMENTO_REDUZIDO) return true;

    const meuVoo = this.voo;
    const duracao = voo ? 3.6 : limitar(2.2 + km / 260, 2.4, 6.2);
    const pose = { ...this.pose! };
    let t = 0;
    this.trechoEmJogo = id;
    d.u.resto = 0.28;
    d.u.progresso = 0;
    d.u.cabeca = 1;
    const soltar = () => {
      d.u.progresso = 1;
      d.u.resto = 0;
      d.u.cabeca = 0;
      if (this.trechoEmJogo === id) this.trechoEmJogo = null;
    };
    return new Promise<boolean>((resolver) => {
      const animar = (dt: number) => {
        t += dt;
        const f = suave(t / duracao);
        d.u.progresso = f;
        d.u.cabeca = t < duracao ? 1 : Math.max(0, 1 - (t - duracao) * 2.5);
        if (!voo) {
          const i = f * (d.pts.length - 1);
          const a = Math.floor(i);
          const b = Math.min(d.pts.length - 1, a + 1);
          pose.lat = mistura(d.pts[a][0], d.pts[b][0], i - a);
          pose.lon = mistura(d.pts[a][1], d.pts[b][1], i - a);
          pose.alt = 0;
          this.posicionar(this.camera, this.centro(pose, this.tmpMundo), pose.heading, pose.pitch, pose.range);
          this.pose = pose;
          this.poseSuja = false;
        }
        if (t >= duracao + 0.5) {
          this.animacao = null;
          this.aoTrocarAnimacao = null;
          soltar();
          resolver(true);
        }
      };
      this.animacao = animar;
      // Se outro voo ou o usuário assumir, o trecho volta ao normal.
      this.aoTrocarAnimacao = () => {
        if (meuVoo === this.voo && this.animacao === animar) return;
        this.aoTrocarAnimacao = null;
        soltar();
        resolver(false);
      };
    });
  }

  private aoTrocarAnimacao: (() => void) | null = null;

  /* -------------------------------------------------------------- entrada */

  private montarEntrada() {
    const mao = new ScreenSpaceEventHandler(this.scene.canvas);
    const interagiu = () => {
      // A mão do usuário manda: voo e órbita param onde estão.
      this.orbita = null;
      if (this.voando) {
        const v = this.voando;
        this.voando = null;
        this.restaurarDetalhe();
        v.resolver(false);
      }
      this.poseSuja = true;
    };
    for (const tipo of [
      ScreenSpaceEventType.LEFT_DOWN,
      ScreenSpaceEventType.RIGHT_DOWN,
      ScreenSpaceEventType.MIDDLE_DOWN,
      ScreenSpaceEventType.WHEEL,
      ScreenSpaceEventType.PINCH_START,
    ]) {
      mao.setInputAction(interagiu, tipo);
    }
    mao.setInputAction((e: { endPosition: Cartesian2 }) => {
      this.ponteiro = { x: e.endPosition.x, y: e.endPosition.y };
      this.ponteiroSujo = true;
    }, ScreenSpaceEventType.MOUSE_MOVE);
    mao.setInputAction((e: { position: Cartesian2 }) => {
      if (this.introAtiva) return;
      const trecho = this.trechoEm(e.position.x, e.position.y, CELULAR ? 18 : 10);
      if (trecho) {
        this.eventos.aoClicarTrecho?.(trecho);
        return;
      }
      if (this.cena.nivel === "europa" || this.cena.nivel === "pais") {
        const pais = this.paisNaTela(e.position.x, e.position.y);
        if (pais && pais !== this.cena.paisId) this.eventos.aoClicarPais?.(pais);
      }
    }, ScreenSpaceEventType.LEFT_CLICK);
    this.scene.canvas.addEventListener("pointerleave", () => {
      this.ponteiro = null;
      this.ponteiroSujo = true;
    });
  }

  private paisNaTela(x: number, y: number): string | null {
    const ponto = this.camera.pickEllipsoid(new Cartesian2(x, y));
    if (!ponto) return null;
    const c = Cartographic.fromCartesian(ponto);
    return this.paisEm(c.longitude / RAD, c.latitude / RAD);
  }

  private trechoEm(x: number, y: number, tolerancia: number): string | null {
    this.ocluder.cameraPosition = this.camera.positionWC;
    const tela = this.tmpTela;
    let melhor: string | null = null;
    let menor = tolerancia;
    for (const [id, d] of this.trechos) {
      if (!d.linha.show || d.u.progresso < 1) continue;
      let ax = NaN;
      let ay = NaN;
      const passo = d.mundo.length > 160 ? 2 : 1;
      for (let i = 0; i < d.mundo.length; i += passo) {
        const p = d.mundo[i];
        const visivel = this.ocluder.isPointVisible(p) && this.scene.cartesianToCanvasCoordinates(p, tela);
        if (!visivel) {
          ax = NaN;
          continue;
        }
        const bx = tela.x;
        const by = tela.y;
        if (!Number.isNaN(ax)) {
          const dx = bx - ax;
          const dy = by - ay;
          const l2 = dx * dx + dy * dy || 1;
          const k = limitar(((x - ax) * dx + (y - ay) * dy) / l2, 0, 1);
          const dist = Math.hypot(x - (ax + dx * k), y - (ay + dy * k));
          if (dist < menor) {
            menor = dist;
            melhor = id;
          }
        }
        ax = bx;
        ay = by;
      }
    }
    return melhor;
  }

  private processarPonteiro() {
    this.ponteiroSujo = false;
    if (this.introAtiva) return;
    const p = this.ponteiro;
    const trecho = p ? this.trechoEm(p.x, p.y, 9) : null;
    if (trecho !== this.trechoSobCursor || trecho) {
      this.trechoSobCursor = trecho;
      this.eventos.aoPassarTrecho?.(trecho, p?.x ?? 0, p?.y ?? 0);
    }
    let pais: string | null = null;
    if (p && !trecho && (this.cena.nivel === "europa" || this.cena.nivel === "pais")) {
      pais = this.paisNaTela(p.x, p.y);
      if (pais === this.cena.paisId) pais = null;
    }
    if (pais !== this.paisSobCursor) {
      this.paisSobCursor = pais;
      this.eventos.aoPassarPais?.(pais);
      this.aplicarPaises();
    }
    this.scene.canvas.style.cursor = trecho || pais ? "pointer" : "";
  }

  /* --------------------------------------------------------------- quadro */

  private tick() {
    const agora = performance.now();
    const bruto = (agora - this.ultimoTick) / 1000;
    const dt = Math.min(0.1, bruto);
    this.ultimoTick = agora;
    this.relogio += dt;
    if (this.ponteiroSujo) this.processarPonteiro();
    this.aoTrocarAnimacao?.();

    let movimento = false;
    if (this.voando) {
      this.avancarVoo(dt);
      movimento = true;
    }
    if (!this.pausado && this.animacao) {
      this.animacao(dt);
      movimento = true;
    }
    if (!this.pausado && this.orbita && !this.voando) {
      // A órbita engata aos poucos: é o "assentamento" depois do pouso. Se os
      // prédios ainda estão chegando, ela espera (até 4 s): carregar e girar
      // ao mesmo tempo é o que engasga.
      const o = this.orbita;
      const carregando = this.fotoVisivel && this.foto && !this.foto.tilesLoaded && o.espera < 4;
      if (carregando) o.espera += dt;
      else o.idade += dt;
      o.pose.heading += dt * 2.4 * RAD * suave(o.idade / 2.6);
      this.posicionar(this.camera, this.centro(o.pose, this.tmpMundo), o.pose.heading, o.pose.pitch, o.pose.range);
      this.pose = o.pose;
      this.poseSuja = false;
      movimento = true;
    }
    this.ajustarPorAltitude();

    // Animações de ambiente: não mexem na câmera, mas pedem quadro novo.
    let ambiente = this.animarPaises(dt);
    ambiente = this.animarRota(dt) || ambiente;
    if (this.horaT < 1) {
      this.horaT = Math.min(1, this.horaT + dt / 1.2);
      const segundos = JulianDate.secondsDifference(this.horaPara, this.horaDe) * suave(this.horaT);
      this.viewer.clock.currentTime = JulianDate.addSeconds(this.horaDe, segundos, new JulianDate());
      ambiente = true;
    }

    // A câmera se moveu (voo, órbita ou a mão do usuário)?
    const cam = this.camera;
    if (
      !Cartesian3.equalsEpsilon(cam.positionWC, this.ultimaPosicao, 1e-9, 0.01) ||
      !Cartesian3.equalsEpsilon(cam.directionWC, this.ultimaDirecao, 1e-7)
    ) {
      Cartesian3.clone(cam.positionWC, this.ultimaPosicao);
      Cartesian3.clone(cam.directionWC, this.ultimaDirecao);
      movimento = true;
    }
    this.governar(bruto, movimento || ambiente, agora);
    if (movimento || ambiente) this.scene.requestRender();
  }

  /**
   * Controle de qualidade. Enquanto há quadros sendo desenhados (câmera em
   * movimento ou animação de ambiente), olha os últimos 45 tempos de quadro:
   * - se até os quadros "bons" (percentil 40) passam de ~19 ms, a GPU não dá
   *   conta e ele desce um degrau: primeiro o MSAA, depois a resolução;
   * - travadas isoladas (carregar tiles, montar prédios) não contam: baixar a
   *   resolução não as resolveria;
   * - se descer não ajudou, o gargalo não é a GPU: volta ao degrau anterior.
   * Quando tudo para, um último quadro sai em resolução cheia e com
   * antialiasing: a imagem em repouso é sempre nítida.
   */
  private governar(dt: number, ativo: boolean, agora: number) {
    if (ativo) this.ultimoMovimento = agora;
    const emMovimento = agora - this.ultimoMovimento < 380;
    if (emMovimento !== this.emMovimento) {
      this.emMovimento = emMovimento;
      this.aplicarDegrau();
      this.ignorar = 10;
      this.scene.requestRender();
    }
    if (!ativo || dt > 0.25) return;
    if (this.ignorar > 0) {
      this.ignorar--;
      return;
    }
    const janela = this.janela;
    janela.push(dt * 1000);
    if (janela.length > 45) janela.shift();
    if (janela.length < 45 || ++this.desdeAvaliacao < 15) return;
    this.desdeAvaliacao = 0;
    const ordenado = [...janela].sort((a, b) => a - b);
    const p40 = ordenado[18];
    const p90 = ordenado[40];
    this.media = p40;
    const ultimo = DEGRAUS.length - 1;

    // Acabou de descer: valeu a pena?
    if (this.antesDeDescer > 0) {
      const antes = this.antesDeDescer;
      this.antesDeDescer = 0;
      if (p40 > antes * 0.9 && this.degrau > this.degrauMinimo) {
        this.descidaLiberada = agora + 25_000;
        this.trocarDegrau(this.degrau - 1);
        return;
      }
    }
    if (p40 > 19.5) {
      this.rapidos = 0;
      if (this.degrau < ultimo && agora > this.descidaLiberada) {
        // Subiu e teve de descer logo em seguida: não tenta subir de novo tão cedo.
        if (agora < this.subidaLiberada + 8000) this.subidaLiberada = agora + 90_000;
        this.antesDeDescer = p40;
        this.trocarDegrau(Math.min(ultimo, this.degrau + (p40 > 36 ? 2 : 1)));
      } else if (this.degrau === ultimo && ++this.lentos > 5) {
        this.lentos = 0;
        this.aliviar();
      }
    } else if (p90 < 12.5) {
      this.lentos = 0;
      this.rapidos++;
      if (this.rapidos >= 4 && this.degrau > this.degrauMinimo && agora > this.subidaLiberada) {
        this.subidaLiberada = agora;
        this.trocarDegrau(this.degrau - 1);
      } else if (this.rapidos >= 20 && this.degrau === 0 && !this.brilhoGlobal && p90 < 9.5) {
        this.ligarBrilho(true);
      }
    } else {
      this.rapidos = 0;
      this.lentos = 0;
    }
  }

  /** Aplica o degrau atual; em repouso, resolução cheia e antialiasing. */
  private aplicarDegrau() {
    const d = DEGRAUS[this.degrau];
    const { scene, viewer } = this;
    if (scene.msaaSamples !== d.msaa) scene.msaaSamples = d.msaa;
    // Sem MSAA, o FXAA entra só no quadro de repouso: em movimento ele custa caro e não se nota.
    const fxaa = d.msaa === 1 && !this.emMovimento;
    if (scene.postProcessStages.fxaa.enabled !== fxaa) scene.postProcessStages.fxaa.enabled = fxaa;
    const escala = this.emMovimento ? d.escala : 1;
    if (viewer.resolutionScale !== escala) viewer.resolutionScale = escala;
  }

  private trocarDegrau(novo: number) {
    this.degrau = novo;
    this.lentos = this.rapidos = 0;
    this.ignorar = 12;
    this.janela.length = 0;
    this.desdeAvaliacao = 0;
    if (novo > 0) this.ligarBrilho(false);
    this.aplicarDegrau();
    try {
      // Na próxima visita a máquina já começa no degrau que aguenta.
      localStorage.setItem(CHAVE_QUALIDADE, String(novo));
    } catch {
      // Sem armazenamento: o ajuste vale só nesta visita.
    }
  }

  /** Último recurso, já na menor resolução: desliga as cidades em 3D (só no celular). */
  private aliviar() {
    if (!CELULAR || !this.camadas.predios || !this.perto) return;
    this.camadas = { ...this.camadas, predios: false };
    this.sseBase = 4;
    this.scene.globe.maximumScreenSpaceError = this.sseBase;
    this.eventos.aoReduzirQualidade?.(this.camadas);
    this.atualizarFoto();
  }

  /** Bloom leve, só quando a máquina tem folga de sobra. */
  private ligarBrilho(ligado: boolean) {
    if (this.brilhoGlobal === ligado) return;
    this.brilhoGlobal = ligado;
    const bloom = this.scene.postProcessStages.bloom;
    bloom.enabled = ligado;
    if (ligado) {
      bloom.uniforms.glowOnly = false;
      bloom.uniforms.contrast = 108;
      bloom.uniforms.brightness = -0.46;
      bloom.uniforms.delta = 0.9;
      bloom.uniforms.sigma = 2.2;
      bloom.uniforms.stepSize = 1.2;
    }
    this.ignorar = 20;
  }

  /** Registra uma função chamada depois de cada quadro desenhado. */
  aoQuadro(cb: () => void): () => void {
    this.quadros.push(cb);
    this.pedirQuadro();
    return () => {
      this.quadros = this.quadros.filter((q) => q !== cb);
    };
  }

  pedirQuadro() {
    this.scene.requestRender();
  }

  /** Posição na tela de um ponto do mapa, ou false se estiver atrás do globo. */
  projetar(lat: number, lon: number, saida: { x: number; y: number }): boolean {
    const mundo = Cartesian3.fromDegrees(lon, lat, this.alturaBruta(lat, lon) * this.exagero, Ellipsoid.WGS84, this.tmpMundo);
    this.ocluder.cameraPosition = this.camera.positionWC;
    if (!this.ocluder.isPointVisible(mundo)) return false;
    const tela = this.scene.cartesianToCanvasCoordinates(mundo, this.tmpTela);
    if (!tela) return false;
    saida.x = tela.x;
    saida.y = tela.y;
    return true;
  }
  private readonly tmpMundo = new Cartesian3();
  private readonly tmpMundo2 = new Cartesian3();
  private readonly tmpTela = new Cartesian2();
  private readonly tmpTela2 = new Cartesian2();
  private readonly tmpCarto = new Cartographic();

  /** Enquadra um conjunto de pontos visto de cima (usado no card de trecho). */
  alvoParaPontos(pontos: LatLon[], pitch = -62): AlvoCamera {
    const esfera = BoundingSphere.fromPoints(pontos.map(([lat, lon]) => Cartesian3.fromDegrees(lon, lat)));
    const c = Cartographic.fromCartesian(esfera.center);
    return { lat: c.latitude / RAD, lon: c.longitude / RAD, heading: 0, pitch, range: Math.max(400, esfera.radius * 3.1) };
  }

  /** Estado do controle de qualidade (para diagnóstico). */
  get qualidade() {
    return {
      degrau: this.degrau,
      escala: this.viewer.resolutionScale,
      msaa: this.scene.msaaSamples,
      brilho: this.brilhoGlobal,
      mediaMs: Math.round(this.media * 10) / 10,
    };
  }

  /** Força o bloom, só para conferir a aparência em máquinas que não o ligariam sozinhas. */
  forcarBrilho(ligado: boolean) {
    this.ligarBrilho(ligado);
    this.pedirQuadro();
  }

  destruir() {
    this.destruido = true;
    this.quadros = [];
    if (!this.viewer.isDestroyed()) this.viewer.destroy();
  }
}
