# Roteiro de Refatoração — WhatsApp Business Bot
**Base lida:** `whatsapp-business-jaspers-market-refatora`  
**Objetivo:** Adaptar para o seu negócio substituindo conteúdo, fluxos e mídias  
**Stack:** Node.js v22 · Redis · Ubuntu 26.04 LTS · GCP (deploy futuro)

---

## Mapa do Projeto — O que cada arquivo faz

```
app.js                     ← Servidor Express + roteamento do webhook
services/
  config.js                ← Lê variáveis do .env e as expõe
  constants.js             ← Textos e IDs dos botões do menu ← ALTERAR
  conversation.js          ← Orquestra o fluxo da conversa   ← ALTERAR
  message.js               ← Parseia o JSON da Meta           ← EXPANDIR
  graph-api.js             ← Funções de envio para a API      ← EXPANDIR
  redis.js                 ← Controle de follow-up (TTL 15s)  ← EXPANDIR
  status.js                ← Trata status (delivered/read)    ← manter
  upload-media.js          ← Faz upload de imagens para Meta  ← usar
  fcbkSDK.js               ← SDK client-side (não usado pelo bot)
upload-media.js            ← Versão standalone do upload      ← usar
template.sh                ← Shell que cria templates na Meta ← ADAPTAR
public/                    ← Imagens e JSONs de exemplo       ← SUBSTITUIR
```

---

## Como o fluxo funciona hoje (Jasper's Market)

```
Usuário envia "oi"
        │
        ▼
app.js → Conversation.handleMessage()
        │
        ▼
message.js parseia o tipo:
  - type "text"           → sendWelcomeMenu() → 3 botões
  - type "reply-media"    → sendInteractiveMediaMessage() → template groceries
  - type "reply-carousel" → sendTextMessage() → texto fixo (carousel desativado)
  - type "reply-offer"    → sendLimitedTimeOfferMessage() → template strawberries
        │
        ▼
graph-api.js → api.call() → Meta Cloud API → WhatsApp do usuário
        │
        ▼
redis.js → Cache.insert(messageId) com TTL 15s
        │
        ▼
Quando "delivered" ou "read" chega via status:
  → Cache.remove(messageId) → se existia → sendWelcomeMenu() com "Is there anything else?"
```

---

## Fase 1 — Definir o Negócio (Preencher Antes de Codar)

Responda estas perguntas. Elas guiarão cada mudança no código:

| Pergunta | Sua resposta |
|---|---|
| Nome do negócio | Atelier de Mensagens |
| Saudação inicial | Bom dia Colaboradora |
| Opção 1 do menu (nome + ação) | Acesso Atelier |
| Opção 2 do menu (nome + ação) | Lançamento |
| Opção 3 do menu (nome + ação) | Lançamento Maio |
| Imagens necessárias (quantas, formato) | 3, jpeg|
| Precisa de PDF/documento? | Não |
| Precisa capturar dados do usuário? | Não |
| Idioma principal | Português |

---

## Fase 2 — `services/constants.js` (Textos e IDs dos Botões)

**Arquivo mais simples de alterar. Comece por aqui.**

### Original:
```javascript
APP_DEFAULT_MESSAGE: "Welcome to Jasper's Market! ...",
REPLY_INTERACTIVE_WITH_MEDIA_CTA: "Shop online",
REPLY_MEDIA_CARD_CAROUSEL_CTA:    "Get recipe ideas",
REPLY_OFFER_CTA:                  "Current promo",

REPLY_INTERACTIVE_MEDIA_ID: "reply-media",
REPLY_MEDIA_CAROUSEL_ID:    "reply-carousel",
REPLY_OFFER_ID:             "reply-offer",
```

### Refatorado (modelo para o seu negócio):
```javascript
"use strict";

module.exports = Object.freeze({
  // Mensagens do sistema
  APP_DEFAULT_MESSAGE:   "Olá! Seja bem-vindo ao *Seu Negócio*. Como posso te ajudar?",
  APP_TRY_ANOTHER_MESSAGE: "Posso te ajudar com mais alguma coisa?",

  // Textos visíveis no WhatsApp (máx 20 caracteres cada)
  CTA_OPCAO_1: "Ver Catálogo",       // substitua pelo seu
  CTA_OPCAO_2: "Falar com Consultor", 
  CTA_OPCAO_3: "Promoções",

  // IDs internos dos botões (máx 20 caracteres, sem espaços)
  ID_OPCAO_1: "menu-catalogo",
  ID_OPCAO_2: "menu-consultor",
  ID_OPCAO_3: "menu-promo",
});
```

**Regras importantes da API Meta:**
- Título do botão: máximo 20 caracteres
- ID do botão: máximo 20 caracteres, sem espaços
- Máximo de 3 botões por mensagem interativa

---

## Fase 3 — `services/conversation.js` (Fluxo da Conversa)

**Este é o arquivo central.** Ele conecta os botões às ações.

### Estrutura atual — o que manter:
```javascript
// MANTER — estrutura do switch case
static async handleMessage(senderPhoneNumberId, rawMessage) {
  const message = new Message(rawMessage);
  switch (message.type) {
    case "text": ...      // qualquer texto livre → exibe menu
    case "reply-media":   // botão 1
    case "reply-carousel": // botão 2
    case "reply-offer":   // botão 3
    default: ...          // fallback → exibe menu
  }
}
```

### Refatorado para o seu negócio:
```javascript
"use strict";

const constants = require("./constants");
const GraphApi  = require("./graph-api");
const Message   = require("./message");
const Status    = require("./status");
const Cache     = require("./redis");

// --- Helpers de envio ---

function sendMenuPrincipal(messageId, senderPhoneNumberId, recipientPhoneNumber, bodyText) {
  return GraphApi.messageWithInteractiveReply(
    messageId,
    senderPhoneNumberId,
    recipientPhoneNumber,
    bodyText,
    [
      { id: constants.ID_OPCAO_1, title: constants.CTA_OPCAO_1 },
      { id: constants.ID_OPCAO_2, title: constants.CTA_OPCAO_2 },
      { id: constants.ID_OPCAO_3, title: constants.CTA_OPCAO_3 },
    ]
  );
}

// --- Ações de cada opção ---

async function handleOpcao1(messageId, senderPhoneNumberId, recipientPhoneNumber) {
  // Opção 1: envia imagem do catálogo + texto
  // SUBSTITUA a URL pela sua imagem hospedada no GCP ou ngrok
  return GraphApi.sendImageMessage(
    messageId,
    senderPhoneNumberId,
    recipientPhoneNumber,
    process.env.MEDIA_ID_CATALOGO,          // media_id após upload
    "https://sua-url.com/catalogo.jpg",     // fallback se não tiver media_id
    "Confira nosso catálogo completo! 🛍️"
  );
}

async function handleOpcao2(messageId, senderPhoneNumberId, recipientPhoneNumber) {
  // Opção 2: texto simples encaminhando para consultor
  return GraphApi.sendTextMessage(
    messageId,
    senderPhoneNumberId,
    recipientPhoneNumber,
    "Olá! Um de nossos consultores entrará em contato em breve. 📞\nHorário: Seg–Sex, 9h–18h."
  );
}

async function handleOpcao3(messageId, senderPhoneNumberId, recipientPhoneNumber) {
  // Opção 3: template de oferta limitada (requer template aprovado na Meta)
  // Se não tiver template aprovado ainda, use sendTextMessage como fallback:
  return GraphApi.sendTextMessage(
    messageId,
    senderPhoneNumberId,
    recipientPhoneNumber,
    "🎉 Promoção especial! Use o código PROMO10 e ganhe 10% de desconto na sua primeira compra."
  );
}

// --- Classe principal ---

module.exports = class Conversation {

  static async handleMessage(senderPhoneNumberId, rawMessage) {
    const message = new Message(rawMessage);

    switch (message.type) {

      case "text":
        await sendMenuPrincipal(
          message.id,
          senderPhoneNumberId,
          message.senderPhoneNumber,
          constants.APP_DEFAULT_MESSAGE
        );
        break;

      case constants.ID_OPCAO_1: {
        const resp = await handleOpcao1(message.id, senderPhoneNumberId, message.senderPhoneNumber);
        await Cache.insert(resp.messages[0].id);
        break;
      }

      case constants.ID_OPCAO_2: {
        await handleOpcao2(message.id, senderPhoneNumberId, message.senderPhoneNumber);
        break;
      }

      case constants.ID_OPCAO_3: {
        await handleOpcao3(message.id, senderPhoneNumberId, message.senderPhoneNumber);
        break;
      }

      case "media":
        await GraphApi.sendTextMessage(
          message.id,
          senderPhoneNumberId,
          message.senderPhoneNumber,
          "Recebemos seu arquivo! Em breve retornamos. 📎"
        );
        break;

      default:
        await sendMenuPrincipal(
          message.id,
          senderPhoneNumberId,
          message.senderPhoneNumber,
          constants.APP_DEFAULT_MESSAGE
        );
        break;
    }
  }

  static async handleStatus(senderPhoneNumberId, rawStatus) {
    const status = new Status(rawStatus);

    if (rawStatus.errors?.length) {
      console.error(`Message ${status.messageId} failed:`, JSON.stringify(rawStatus.errors));
      return;
    }

    if (!(status.status === "delivered" || status.status === "read")) return;

    if (await Cache.remove(status.messageId)) {
      await sendMenuPrincipal(
        undefined,
        senderPhoneNumberId,
        status.recipientPhoneNumber,
        constants.APP_TRY_ANOTHER_MESSAGE
      );
    }
  }
};
```

---

## Fase 4 — `services/graph-api.js` (Adicionar Envio de Imagem)

O arquivo original **não tem** função para enviar imagem simples (só templates).  
Adicione o método `sendImageMessage` à classe `GraphApi`:

```javascript
// Adicionar dentro da classe GraphApi, após sendTextMessage:

static async sendImageMessage(messageId, senderPhoneNumberId, recipientPhoneNumber, mediaId, imageLink, caption = "") {
  const imageParam = mediaId
    ? { id: mediaId }
    : { link: imageLink };

  return this.#makeApiCall(messageId, senderPhoneNumberId, {
    messaging_product: "whatsapp",
    to: recipientPhoneNumber,
    type: "image",
    image: { ...imageParam, caption },
  });
}

static async sendDocumentMessage(messageId, senderPhoneNumberId, recipientPhoneNumber, mediaId, docLink, filename = "documento.pdf", caption = "") {
  const docParam = mediaId
    ? { id: mediaId }
    : { link: docLink };

  return this.#makeApiCall(messageId, senderPhoneNumberId, {
    messaging_product: "whatsapp",
    to: recipientPhoneNumber,
    type: "document",
    document: { ...docParam, filename, caption },
  });
}
```

**Por que usar `mediaId` em vez de link direto?**  
O erro 131053 que você enfrentou ocorre quando a Meta tenta baixar a imagem via link e o servidor demora ou está inacessível. Com `mediaId` (imagem já hospedada nos servidores da Meta via upload), o erro não ocorre.

---

## Fase 5 — `services/message.js` (Expandir Tipos se Necessário)

O arquivo atual já trata corretamente:
- `text` → tipo "text"
- `interactive` com `button_reply` → retorna o `id` do botão
- `image`, `audio`, `video`, `document`, `sticker` → tipo "media"
- `location` → tipo "location"

**Só mexa aqui se precisar de:**

```javascript
// Exemplo: tratar lista interativa (list reply) além de botões
case "interactive":
  this.type = rawMessage.interactive?.button_reply?.id
           ?? rawMessage.interactive?.list_reply?.id  // ← adicionar se usar listas
           ?? "unknown";
  break;
```

---

## Fase 6 — `services/redis.js` (Expandir para Contexto de Conversa)

O Redis hoje só faz follow-up com TTL de 15 segundos.  
Para capturar dados do usuário em múltiplos passos (ex: nome, CPF, pedido),  
expanda o Cache:

```javascript
// Adicionar à classe Cache:

// Salvar estado da conversa do usuário (ex: qual etapa do formulário)
static async setState(waId, state, extraData = {}) {
  await client.hSet(waId, {
    state,
    updated_at: String(Date.now()),
    ...Object.fromEntries(Object.entries(extraData).map(([k, v]) => [k, String(v)]))
  });
  await client.expire(waId, 86400); // 24 horas
}

// Ler estado atual do usuário
static async getState(waId) {
  return client.hGetAll(waId);
}

// Limpar estado (ex: conversa concluída)
static async clearState(waId) {
  return client.del(waId);
}
```

**Uso no conversation.js para captura de dados:**
```javascript
// Exemplo de fluxo multi-etapa:
case "text":
  const ctx = await Cache.getState(message.senderPhoneNumber);
  if (ctx.state === "aguardando_nome") {
    await Cache.setState(message.senderPhoneNumber, "aguardando_cpf", { nome: message.body });
    await GraphApi.sendTextMessage(..., "Obrigado! Agora informe seu CPF:");
  } else {
    await sendMenuPrincipal(...);
  }
  break;
```

---

## Fase 7 — `services/config.js` (Adicionar Novas Variáveis)

Adicione as novas variáveis que o seu negócio precisar:

```javascript
// No array ENV_VARS, adicionar:
const ENV_VARS = [
  "ACCESS_TOKEN",
  "APP_SECRET",
  "VERIFY_TOKEN",
  "REDIS_HOST",
  "REDIS_PORT",
  "PHONE_NUMBER_ID",      // ← necessário para upload de mídia
  "MEDIA_ID_CATALOGO",    // ← após fazer upload da imagem do catálogo
];

// No module.exports, adicionar:
phoneNumberId: process.env.PHONE_NUMBER_ID,
mediaIdCatalogo: process.env.MEDIA_ID_CATALOGO,
```

---

## Fase 8 — `.env` Completo para o Seu Negócio

```dotenv
# Meta / WhatsApp
ACCESS_TOKEN=SEU_TOKEN_AQUI
APP_SECRET=SEU_APP_SECRET_AQUI
APP_ID=SEU_APP_ID_AQUI
VERIFY_TOKEN=SUA_SENHA_WEBHOOK_AQUI
PHONE_NUMBER_ID=107164345759376

# Mídias (preencher após rodar: node upload-media.js public/sua-imagem.jpg)
MEDIA_ID_CATALOGO=
MEDIA_ID_PROMO=

# Redis
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

# Server
PORT=3000
```

---

## Fase 9 — Trocar as Imagens (public/)

As imagens atuais são do Jasper's Market (`groceries.jpg`, `salad_bowl.jpg`, etc.).  
Para substituir:

```bash
# 1. Coloque suas imagens na pasta public/
cp ~/minhas-imagens/catalogo.jpg public/
cp ~/minhas-imagens/promo.jpg public/

# 2. Faça o upload para os servidores da Meta (evita erro 131053)
node upload-media.js public/catalogo.jpg image/jpeg
# → Saída: MEDIA_ID_CATALOGO=1234567890

node upload-media.js public/promo.jpg image/jpeg
# → Saída: MEDIA_ID_PROMO=0987654321

# 3. Cole os IDs no seu .env
```

**Formatos aceitos pela Meta:**
- Imagem: JPG, PNG (máx 5MB)
- Documento: PDF (máx 100MB)
- Vídeo: MP4 (máx 16MB)

---

## Fase 10 — `template.sh` (Criar Templates no Painel da Meta)

Se você quiser usar Templates aprovados (necessário para iniciar conversa  
com cliente após 24h de inatividade), adapte o `template.sh`:

```bash
# Altere no início do arquivo:
APPID="SEU_APP_ID"
APPTOKEN="SEU_ACCESS_TOKEN"
WABAID="SEU_WABA_ID"       # WhatsApp Business Account ID
APIVERSION="v22.0"

# Altere os nomes dos templates:
# "grocery_delivery_utility"    → "seu_template_catalogo"
# "strawberries_limited_offer"  → "seu_template_promo"
# "recipe_media_carousel"       → "seu_template_carousel" (se usar)
```

**Atenção:** Templates precisam ser aprovados pela Meta antes de usar.  
Processo leva entre 1h e 24h. Enquanto não aprovados, use `sendTextMessage`  
como fallback (já implementado na Fase 3).

---

## Ordem de Execução Recomendada

```
1. Preencher Fase 1 (definir o negócio no papel)
2. Alterar constants.js (Fase 2) — textos e IDs dos botões
3. Alterar conversation.js (Fase 3) — fluxo das opções
4. Adicionar métodos em graph-api.js (Fase 4) — se precisar de imagem/PDF
5. Atualizar .env (Fase 8) com novas variáveis
6. Fazer upload das suas imagens (Fase 9)
7. Testar localmente:
     redis-cli flushall          # limpa estado antigo
     npm start                   # sobe o servidor
     ngrok http 3000             # abre o túnel
     # enviar "oi" no WhatsApp
8. Expandir Redis (Fase 6) se precisar de multi-etapas
9. Criar templates na Meta (Fase 10) quando necessário
```

---

## Diagnóstico dos Problemas que Você Já Enfrentou

| Problema | Causa (no código) | Solução |
|---|---|---|
| Erro 131053 (media) | `imageLink` com URL inacessível pela Meta | Usar `mediaId` após `upload-media.js` |
| Seleção não tratada | `message.type` retorna o `id` do botão — deve bater exatamente com o `case` | IDs em `constants.js` devem ser idênticos aos IDs dos botões enviados |
| Token expirado | Token temporário dura 24h | Gerar System User Token permanente no Business Manager |
| EADDRINUSE | Processo antigo travado na porta | `pkill -f "node app.js"` ou `fuser -k 3000/tcp` |
| Redis vazio / estado errado | Cache com TTL 15s expira rápido | `redis-cli flushall` + reiniciar conversa |

---

## Referência Rápida de Comandos

```bash
# Iniciar ambiente completo
redis-cli ping                          # verificar Redis
npm start                               # subir servidor
ngrok http 3000                         # abrir túnel
redis-cli monitor                       # monitorar estados em tempo real

# Debug de fluxo
redis-cli hgetall "5521988991807"       # ver estado do usuário específico
redis-cli flushall                      # limpar tudo para novo teste

# Upload de mídia
node upload-media.js public/img.jpg     # retorna MEDIA_ID para o .env

# Matar processo travado na porta 3000
sudo lsof -i :3000                      # achar o PID
kill -9 <PID>                           # encerrar
# ou simplesmente:
pkill -f "node app.js"
```
