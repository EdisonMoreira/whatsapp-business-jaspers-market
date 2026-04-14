"use strict";

const { FacebookAdsApi } = require("facebook-nodejs-business-sdk");
const config = require("./config");

const api = new FacebookAdsApi(config.accessToken);

module.exports = class GraphApi {

  static async #makeApiCall(messageId, senderPhoneNumberId, requestBody) {
    try {
      if (messageId) {
        await api.call("POST", [`${senderPhoneNumberId}`, "messages"], {
          messaging_product: "whatsapp",
          status: "read",
          message_id: messageId,
          typing_indicator: { type: "text" },
        });
      }

      console.log("Payload enviado:", JSON.stringify(requestBody, null, 2));

      const response = await api.call(
        "POST",
        [`${senderPhoneNumberId}`, "messages"],
        requestBody
      );
      console.log("API call successful:", JSON.stringify(response));
      return response;
    } catch (error) {
      console.error("Error making API call:", error?.response?.data ?? error);
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Texto simples
  // ---------------------------------------------------------------------------
  static async sendTextMessage(messageId, senderPhoneNumberId, recipientPhoneNumber, text) {
    return this.#makeApiCall(messageId, senderPhoneNumberId, {
      messaging_product: "whatsapp",
      to: recipientPhoneNumber,
      type: "text",
      text: { body: text },
    });
  }

  // ---------------------------------------------------------------------------
  // Mensagem interativa com botoes de resposta rapida
  // ---------------------------------------------------------------------------
  static async messageWithInteractiveReply(messageId, senderPhoneNumberId, recipientPhoneNumber, messageText, replyCTAs) {
    return this.#makeApiCall(messageId, senderPhoneNumberId, {
      messaging_product: "whatsapp",
      to: recipientPhoneNumber,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: messageText },
        action: {
          buttons: replyCTAs.map((cta) => ({
            type: "reply",
            reply: {
              id: cta.id.substring(0, 20),
              title: cta.title.substring(0, 20),
            },
          })),
        },
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Template grocery_delivery_utility
  // Header: imagem variavel | Body: fixo | Footer: fixo | Button: URL estatica
  // ---------------------------------------------------------------------------
  static async messageWithUtilityTemplate(messageId, senderPhoneNumberId, recipientPhoneNumber, options) {
    const { templateName, locale, mediaId, imageLink } = options;

    const headerParam = mediaId
      ? { type: "image", image: { id: mediaId } }
      : { type: "image", image: { link: imageLink } };

    return this.#makeApiCall(messageId, senderPhoneNumberId, {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: recipientPhoneNumber,
      type: "template",
      template: {
        name: templateName,
        language: { code: locale },
        components: [
          { type: "header", parameters: [headerParam] },
        ],
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Template strawberries_limited_offer
  // Header: imagem variavel | Body: fixo | Buttons: copy_code (idx 0) + URL (idx 1)
  // ---------------------------------------------------------------------------
  static async messageWithLimitedTimeOfferTemplate(messageId, senderPhoneNumberId, recipientPhoneNumber, options) {
  const { templateName, locale, mediaId, imageLink, offerCode } = options;

  const futureTime = new Date(Date.now() + 48 * 60 * 60 * 1000);

  const headerParam = mediaId
    ? { type: "image", image: { id: mediaId } }
    : { type: "image", image: { link: imageLink } };

  return this.#makeApiCall(messageId, senderPhoneNumberId, {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: recipientPhoneNumber,
    type: "template",
    template: {
      name: templateName,
      language: { code: locale },
      components: [
        { type: "header", parameters: [headerParam] },
        {
          type: "limited_time_offer",
          parameters: [
            {
              type: "limited_time_offer",
              limited_time_offer: {
                expiration_time_ms: futureTime.getTime(),
              },
            },
          ],
        },
        {
          type: "button",
          sub_type: "copy_code",
          index: 0,
          parameters: [{ type: "coupon_code", coupon_code: offerCode }],
        },
      ],
    },
  });
}/*  */

  // ---------------------------------------------------------------------------
  // Template recipe_media_carousel
  // Header: nenhum | Body: fixo | Footer: nenhum | Buttons: nenhum
  // Nao ha componentes variaveis — a API preenche tudo do template aprovado.
  // ---------------------------------------------------------------------------
  static async messageWithMediaCardCarousel(messageId, senderPhoneNumberId, recipientPhoneNumber, options) {
    const { templateName, locale } = options;

    return this.#makeApiCall(messageId, senderPhoneNumberId, {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: recipientPhoneNumber,
      type: "template",
      template: {
        name: templateName,
        language: { code: locale },
        
      },
    });
  }
};