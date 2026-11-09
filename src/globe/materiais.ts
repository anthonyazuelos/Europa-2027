/**
 * Materiais em shader para as linhas do globo.
 *
 * Um único material desenha tudo o que um trecho precisa: o estilo do modal
 * (brilho, tracejado ou sólido), o gradiente noturno, o esmaecer suave, o
 * desenho progressivo com cabeça luminosa e a luz que percorre os trechos
 * noturnos. A animação vem de uniforms atualizados uma vez por quadro: nada de
 * geometria refeita nem de entidades por partícula.
 */
import { Cartesian4, Color, Material } from "cesium";

const FONTE_TRECHO = /* glsl */ `
uniform vec4 corA;
uniform vec4 corB;
uniform float estilo;      // 0 = brilho · 1 = tracejado · 2 = sólido
uniform float tracejado;   // comprimento do traço, em px
uniform float nucleo;      // brilho: força do glow · demais: meia largura (0–0.5)
uniform float opacidade;   // ênfase do trecho (1 = normal)
uniform float apagado;     // opacidade fora da janela
uniform vec4 janela;       // dois intervalos de s que ficam acesos
uniform float progresso;   // até onde a linha já foi desenhada (0–1)
uniform float resto;       // opacidade do que ainda não foi desenhado
uniform float cabeca;      // intensidade da cabeça luminosa em "progresso"
uniform float luz;         // intensidade da luz que percorre o trecho
uniform float fase;        // posição da luz (0–1)
uniform float escala;      // pixels por unidade de s perto da luz
uniform float pulso;       // 0–1, brilho extra do trecho em foco

in float v_polylineAngle;
in float v_width;

mat2 girar(float rad) {
    float c = cos(rad);
    float s = sin(rad);
    return mat2(c, s, -s, c);
}

// Cabeça redonda com rastro atrás, em pixels de tela.
float cometa(float s, float t, float centro, float raio, float rastro) {
    float atras = (centro - s) * escala;
    float lado = (t - 0.5) * v_width;
    float frente = exp(-(atras * atras + lado * lado) / (raio * raio));
    float cauda = atras > 0.0 ? exp(-atras / rastro) * exp(-(lado * lado) / (raio * raio * 0.3)) : 0.0;
    return max(frente, cauda * 0.8);
}

czm_material czm_getMaterial(czm_materialInput materialInput)
{
    czm_material material = czm_getDefaultMaterial(materialInput);
    vec2 st = materialInput.st;
    float s = st.s;

    float desenhado = step(s, progresso);
    vec4 cor = mix(corA, corB, s);
    float dentro = clamp(
        step(janela.x, s) * step(s, janela.y) + step(janela.z, s) * step(s, janela.w), 0.0, 1.0);
    float enfase = opacidade * mix(apagado, 1.0, dentro) * mix(resto, 1.0, desenhado);

    float t = abs(st.t - 0.5);
    vec3 rgb = cor.rgb;
    float alfa;
    if (estilo < 0.5) {
        float g = nucleo / max(t, 0.0001) - nucleo * 2.0;
        g *= 1.0 + pulso * 0.7;
        rgb = max(vec3(g - 1.0) + cor.rgb, cor.rgb);
        alfa = clamp(g, 0.0, 1.0);
    } else {
        alfa = 1.0 - smoothstep(nucleo * 0.6, nucleo, t);
        if (estilo < 1.5) {
            vec2 pos = girar(v_polylineAngle) * gl_FragCoord.xy;
            alfa *= step(fract(pos.x / (tracejado * czm_pixelRatio)), 0.5);
        }
        rgb += vec3(pulso * 0.3);
    }
    alfa *= cor.a * enfase;

    float claro = 0.0;
    if (luz > 0.001) {
        claro = luz * opacidade * desenhado * cometa(s, st.t, fase, 5.0, 44.0);
    }
    if (cabeca > 0.001) {
        claro = max(claro, cabeca * cometa(s, st.t, progresso, 7.5, 70.0));
    }
    rgb = mix(rgb, vec3(1.0, 0.97, 0.9), clamp(claro, 0.0, 1.0) * 0.9);
    alfa = max(alfa, clamp(claro, 0.0, 1.0));

    if (alfa < 0.004) {
        discard;
    }
    vec4 final = czm_gammaCorrect(vec4(rgb, alfa));
    material.emission = final.rgb;
    material.alpha = final.a;
    return material;
}
`;

export interface UniformesTrecho {
  corA: Color;
  corB: Color;
  estilo: number;
  tracejado: number;
  nucleo: number;
  opacidade: number;
  apagado: number;
  janela: Cartesian4;
  progresso: number;
  resto: number;
  cabeca: number;
  luz: number;
  fase: number;
  escala: number;
  pulso: number;
}

export const ESTILO = { brilho: 0, tracejado: 1, solido: 2 } as const;

export function materialDoTrecho(inicial: Partial<UniformesTrecho> & Pick<UniformesTrecho, "corA" | "estilo" | "nucleo">): Material {
  return new Material({
    translucent: true,
    fabric: {
      type: "TrechoDaViagem",
      uniforms: {
        corB: inicial.corA,
        tracejado: 16,
        opacidade: 1,
        apagado: 1,
        janela: new Cartesian4(0, 1, 0, 0),
        progresso: 1,
        resto: 0,
        cabeca: 0,
        luz: 0,
        fase: 0,
        escala: 1000,
        pulso: 0,
        ...inicial,
      },
      source: FONTE_TRECHO,
    },
  });
}

export const uniformes = (m: Material) => m.uniforms as unknown as UniformesTrecho;

/** Borda luminosa de um país: o mesmo glow de sempre, com cor e força animáveis. */
export function materialDaBorda(cor: Color): Material {
  return Material.fromType("PolylineGlow", { color: cor, glowPower: 0.2, taperPower: 1 });
}
