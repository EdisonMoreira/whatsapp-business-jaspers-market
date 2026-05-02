"use strict";

const constants = require("./constants");
const GraphApi = require("./graph-api");
const Message = require("./message");
const Status = require("./status");
const Cache = require("./redis");

// ---------------------------------------------------------------------------
// Helpers de envio
// ---------------------------------------------------------------------------

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

async function handleOpcao1(messageId, senderPhoneNumberId, recipientPhoneNumber) {
  // Opção 1: envia imagem do catálogo + texto
  // SUBSTITUA a URL pela sua imagem hospedada no GCP ou ngrok
  return GraphApi.sendImageMessage(
    messageId,
    senderPhoneNumberId,
    recipientPhoneNumber,
    process.env.MEDIA_ID_CATALOGO,          // media_id após upload
    "https://ateliedasmensagens.com/home/",     // fallback se não tiver media_id
    "Faça contato conosco! 🛍️"
  );
}

function sendLimitedTimeOfferMessage(messageId, senderPhoneNumberId, recipientPhoneNumber) {
  return GraphApi.messageWithLimitedTimeOfferTemplate(
    messageId,
    senderPhoneNumberId,
    recipientPhoneNumber,
    {
      templateName: "strawberries_limited_offer",
      locale: "en_US",
      mediaId: process.env.MEDIA_ID_STRAWBERRIES,
      imageLink: "https://scontent.xx.fbcdn.net/mci_ab/uap/asset_manager/id/?ab_b=e&ab_page=AssetManagerID&ab_entry=1393969325614091",
      offerCode: "BERRIES20",
    }
  );
}

// eslint-disable-next-line no-unused-vars
function sendMediaCarouselMessage(messageId, senderPhoneNumberId, recipientPhoneNumber) {
  return GraphApi.messageWithMediaCardCarousel(
    messageId,
    senderPhoneNumberId,
    recipientPhoneNumber,
    {
      templateName: "recipe_media_carousel",
      locale: "en_US",
      mediaId: process.env.MEDIA_ID_SALAD_BOWL,
      imageLink: "https://scontent.xx.fbcdn.net/mci_ab/uap/asset_manager/id/?ab_b=e&ab_page=AssetManagerID&ab_entry=1389202275965231",
    }
  );
}

async function markMessageForFollowUp(messageId) {
  await Cache.insert(messageId);
}

// ---------------------------------------------------------------------------
// Classe principal
// ---------------------------------------------------------------------------

module.exports = class Conversation {

  static async handleMessage(senderPhoneNumberId, rawMessage) {
    const message = new Message(rawMessage);

    switch (message.type) {

      // Mensagem de texto livre → envia o menu interativo
      case "Atelie":
          await sendWelcomeMenu(
          message.id,
          senderPhoneNumberId,
          message.senderPhoneNumber,
          constants.APP_DEFAULT_MESSAGE
        );
        break;

      // Usuário tocou no botão "Atelie"
      case constants.CTA_OPCAO_1: {
        const resp = await sendInteractiveMediaMessage(
          message.id,
          senderPhoneNumberId,
          message.senderPhoneNumber
        );
        await markMessageForFollowUp(resp.messages[0].id);
        break;
      }

      
      // Usuário tocou no botão "Ver Lançamentos"
      case constants.CTA_OPCAO_2: {
         await GraphApi.sendTextMessage(
           message.id,
           senderPhoneNumberId,
           message.senderPhoneNumber,
           "Solicite no https://loja.marykay.com.br/"
            break;
}
      // Usuário tocou no botão "Current promo"
      case constants.CTA_OPCAO_3: {
        const resp = await sendLimitedTimeOfferMessage(
          message.id,
          senderPhoneNumberId,
          message.senderPhoneNumber
        );
        await markMessageForFollowUp(resp.messages[0].id);
        break;
      }

      // Mídia recebida (imagem, áudio, etc.) — apenas acusa recebimento por ora
      case "media":
        await GraphApi.sendTextMessage(
          message.id,
          senderPhoneNumberId,
          message.senderPhoneNumber,
          "Recebemos sua mídia! Em breve retornamos."
        );
        break;

      // Tipo desconhecido — envia menu padrão como fallback
      default:
        await sendWelcomeMenu(
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

    // Loga erros de envio (ex: erro 131053 de media)
    if (rawStatus.errors?.length) {
      console.error(
        `Message ${status.messageId} failed:`,
        JSON.stringify(rawStatus.errors)
      );
      return;
    }

    if (!(status.status === "delivered" || status.status === "read")) {
      return;
    }

    if (await Cache.remove(status.messageId)) {
      await sendWelcomeMenu(
        undefined,
        senderPhoneNumberId,
        status.recipientPhoneNumber,
        constants.APP_TRY_ANOTHER_MESSAGE
      );
    }
  }
};
