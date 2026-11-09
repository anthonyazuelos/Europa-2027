# Europa 2027 · mapa 3D da viagem

Globo 3D interativo do mochilão de 15 de janeiro a 4 de fevereiro de 2027: Lisboa → Roma por terra, com a rota desenhada, os 21 dias, cada cidade e cada lugar do roteiro.

Feito com Vite, React, TypeScript, Tailwind, Framer Motion e CesiumJS. É um site estático: qualquer hospedagem gratuita serve.

## Rodar no computador

Precisa do [Node.js](https://nodejs.org) 20.19 ou mais novo.

```bash
npm install
npm run dev
```

Abra o endereço que aparecer no terminal (normalmente http://localhost:5173).

O app funciona sem configuração nenhuma. Sem token ele usa a imagem de satélite da Esri, sem relevo e sem cidades em 3D. Para a experiência completa, crie o token abaixo.

## Token gratuito do Cesium ion

O token libera a imagem de satélite do Bing, o relevo (Alpes e Pirineus em 3D) e, com a flag abaixo, os locais em 3D. Os nomes no mapa são desenhados pelo próprio app.

1. Crie uma conta gratuita em https://ion.cesium.com/signup.
2. Vá em **Access Tokens** (https://ion.cesium.com/tokens) e clique em **Create token**.
3. Dê um nome (ex.: `europa-2027`) e mantenha só os escopos padrão de leitura (`assets:read` e `geocode`).
4. Copie o token.
5. Na pasta do projeto, copie `.env.example` para `.env` e cole o token:

   ```
   VITE_CESIUM_ION_TOKEN=cole_o_token_aqui
   ```

6. Pare e rode `npm run dev` de novo.

### Restringir o token ao domínio publicado

O token vai dentro do JavaScript do site, então qualquer pessoa consegue vê-lo. Para ele só funcionar no seu endereço:

1. Em https://ion.cesium.com/tokens, abra o token.
2. Em **Allowed URLs**, escolha **Selected URLs** e adicione o endereço do site, por exemplo `https://europa-2027.vercel.app` ou `https://seu-usuario.github.io/europa-2027`.
3. Adicione também `http://localhost:5173` se quiser continuar testando no computador com o mesmo token (ou crie um segundo token só para desenvolvimento).
4. Salve.

### Cidades em 3D (fotogrametria do Google)

No zoom de local o mapa troca a imagem de satélite pelos **Photorealistic 3D Tiles do Google**, servidos pelo Cesium ion: prédios, árvores e monumentos com textura real. Para isso:

1. Na conta do ion, em **Asset Depot**, adicione "Google Photorealistic 3D Tiles" a **My Assets** (uma vez só).
2. No `.env`, deixe `VITE_ENABLE_PHOTOREALISTIC=true`.

É um asset do Google: o uso é medido pelo ion e pode ter cota ou cobrança conforme o plano. Se o asset não estiver na conta, a cota acabar ou a rede falhar, o app volta sozinho para terreno + satélite. Sem a flag, as cidades ficam só com relevo e imagem de satélite.

## Publicar em 2 minutos

### Vercel

1. Suba a pasta para um repositório no GitHub.
2. Em https://vercel.com/new, importe o repositório. A Vercel detecta o Vite sozinha (o `vercel.json` já está pronto).
3. Em **Environment Variables**, adicione `VITE_CESIUM_ION_TOKEN` com o seu token.
4. Clique em **Deploy**. O link público sai em menos de um minuto.

Sem GitHub: `npx vercel` na pasta do projeto faz o mesmo pelo terminal.

### GitHub Pages

1. Suba a pasta para um repositório no GitHub (branch `main`).
2. Em **Settings → Pages**, em **Source**, escolha **GitHub Actions**.
3. Em **Settings → Secrets and variables → Actions**, crie o secret `VITE_CESIUM_ION_TOKEN`.
4. Faça um push. O workflow `.github/workflows/deploy.yml` compila e publica em `https://seu-usuario.github.io/nome-do-repo/`.

O caminho base do site é configurável pela variável `VITE_BASE`. O padrão é `./`, que funciona em qualquer lugar; o workflow do GitHub Pages já define `/nome-do-repo/`.

## Editar o roteiro

Tudo o que o mapa mostra está em **`src/data/trip.ts`**. O arquivo segue esta ordem: viagem → países → cidades → trechos → reservas → locais → dias.

- **Mudar um texto, horário ou preço:** procure o item pelo nome e edite.
- **Marcar algo como oficial:** troque `confirmado: false` por `true` (o selo "A confirmar" some). Enquanto for `false`, diga em `aConfirmar` o que falta.
- **Adicionar um lugar:** copie um bloco de `locais`, troque o `id` (minúsculas e hífens, único) e ajuste `cityId`, `coords: [latitude, longitude]`, `dia` e os textos. Para ele aparecer no roteiro, cite o `id` em um item do dia: `{ texto: "…", local: "meu-id" }`.
- **Ângulo da câmera:** `camera: { heading, pitch, range }`. `heading` é para onde a câmera aponta (0 = norte, 90 = leste), `pitch` é a inclinação (-90 = de cima, -20 = rasante) e `range` é a distância em metros.
- **Caminho de um trecho:** `paradas` lista os pontos por onde a linha passa, na ordem, da estação de partida à de chegada. Pontos sem `nome` só dão forma à linha.
- **Fotos:** preencha `wiki` com o título do artigo na Wikipédia em inglês e rode `npm run imagens`. O script busca a foto de licença livre no Wikimedia Commons e grava URL e crédito em `src/data/imagens.ts`. Para escolher a foto à mão, preencha `imagem: { url, credito }` no próprio item.

Ao salvar, o `npm run dev` valida o arquivo e mostra os erros no console do navegador. `npm run validar` faz a mesma checagem no terminal, e o `npm run build` se recusa a publicar dados quebrados (id repetido, lugar citado que não existe, data fora do formato).

## Desempenho

O globo se adapta à máquina: enquanto a câmera se move ou há animação na tela, ele mede o tempo de cada quadro e, se a GPU não dá conta de ~55 fps, desliga o MSAA e depois baixa a resolução em degraus (até 50%). Quando tudo para, o último quadro sai em resolução cheia e com antialiasing. O degrau aprendido fica salvo no navegador (`localStorage`). Em GPUs com folga, um bloom leve é ligado sozinho.

Outras escolhas que mantêm a fluidez: rota e fronteiras em coleções únicas de linhas com materiais em shader (as luzes dos trens noturnos, o desenho progressivo e o esmaecer são uniforms, não geometria), escurecimento do resto do mundo como camada de imagem, pré-carregamento dos tiles do destino no início de cada voo e menos detalhe pedido no meio do voo.

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor local com recarga automática |
| `npm run build` | Valida o roteiro, checa os tipos e gera o site em `dist/` |
| `npm run preview` | Serve o `dist/` para conferir o resultado final |
| `npm run validar` | Só valida `trip.ts` |
| `npm run imagens` | Atualiza as fotos a partir do Wikimedia Commons |
| `npm run geo` | Baixa de novo as fronteiras do Natural Earth para `public/geo/` |

## Links diretos

As rotas ficam depois do `#`, então todo link pode ser compartilhado:

- `#/` visão da Europa
- `#/pais/italia`
- `#/cidade/veneza`
- `#/local/coliseu`
- `#/dia/2027-01-30`
- `#/trecho/sleeper-amsterda-praga`
- `#/reservas`

## Teclado

- `Esc` volta um nível (e pula a abertura).
- `Ctrl`/`⌘` + `K` ou `/` abre a busca.
- `←` `→` trocam de dia quando um dia está aberto; dentro da linha do tempo, movem o foco e `Enter` abre o dia.

## Onde fica cada coisa

```
src/data/trip.ts        o roteiro (única fonte de verdade)
src/data/schema.ts      formato dos dados (zod)
src/data/imagens.ts     fotos e créditos (gerado)
src/globe/engine.ts     tudo o que usa o Cesium: camadas, fronteiras, rota, câmera
src/globe/cena.ts       o que cada rota mostra no globo
src/ui/                 painéis, linha do tempo, busca, info
public/geo/             fronteiras do Natural Earth (arquivo local)
```

## Créditos

Imagem de satélite: Bing Maps via Cesium ion, ou Esri World Imagery. Relevo: Cesium World Terrain. Cidades em 3D: Google Photorealistic 3D Tiles via Cesium ion. Fronteiras: Natural Earth. Fotos: Wikimedia Commons, com autor e licença em cada imagem.
