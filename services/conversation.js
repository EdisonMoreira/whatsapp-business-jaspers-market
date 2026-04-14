"use strict";

const constants = require("./constants");
const GraphApi = require("./graph-api");
const Message = require("./message");
const Status = require("./status");
const Cache = require("./redis");

// ---------------------------------------------------------------------------
// Helpers de envio
// ---------------------------------------------------------------------------

function sendWelcomeMenu(messageId, senderPhoneNumberId, recipientPhoneNumber, bodyText) {
  return GraphApi.messageWithInteractiveReply(
    messageId,
    senderPhoneNumberId,
    recipientPhoneNumber,
    bodyText,
    [
      { id: constants.REPLY_INTERACTIVE_MEDIA_ID, title: constants.REPLY_INTERACTIVE_WITH_MEDIA_CTA },
      { id: constants.REPLY_MEDIA_CAROUSEL_ID,    title: constants.REPLY_MEDIA_CARD_CAROUSEL_CTA },
      { id: constants.REPLY_OFFER_ID,             title: constants.REPLY_OFFER_CTA },
    ]
  );
}

function sendInteractiveMediaMessage(messageId, senderPhoneNumberId, recipientPhoneNumber) {
  return GraphApi.messageWithUtilityTemplate(
    messageId,
    senderPhoneNumberId,
    recipientPhoneNumber,
    {
      templateName: "grocery_delivery_utility",
      locale: "en_US",
      // Prefira MEDIA_ID_GROCERY no .env; imageLink é fallback
      mediaId: process.env.MEDIA_ID_GROCERIES,
      imageLink: "https://scontent.xx.fbcdn.net/mci_ab/uap/asset_manager/id/?ab_b=e&ab_page=AssetManagerID&ab_entry=1530053877871776",
    }
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
      case "text":
        await sendWelcomeMenu(
          message.id,
          senderPhoneNumberId,
          message.senderPhoneNumber,
          constants.APP_DEFAULT_MESSAGE
        );
        break;

      // Usuário tocou no botão "Shop online"
      case constants.REPLY_INTERACTIVE_MEDIA_ID: {
        const resp = await sendInteractiveMediaMessage(
          message.id,
          senderPhoneNumberId,
          message.senderPhoneNumber
        );
        await markMessageForFollowUp(resp.messages[0].id);
        break;
      }

      // Usuário tocou no botão "Get recipe ideas"
      // case constants.REPLY_MEDIA_CAROUSEL_ID: {
      //  const resp = await sendMediaCarouselMessage(
      //    message.id,
      //    senderPhoneNumberId,
      //    message.senderPhoneNumber
      //  );
      // await markMessageForFollowUp(resp.messages[0].id);
      // break;
      // }
      
      // Usuário tocou no botão "Get recipe ideas"
      case constants.REPLY_MEDIA_CAROUSEL_ID: {
         await GraphApi.sendTextMessage(
           message.id,
           senderPhoneNumberId,
           message.senderPhoneNumber,
           "Our in-house chefs have prepared some delicious and fresh summer recipes. Check back soon for more!"
          );
      break;
}
      // Usuário tocou no botão "Current promo"
      case constants.REPLY_OFFER_ID: {
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
