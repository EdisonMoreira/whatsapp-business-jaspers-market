"use strict";

const constants = require("./constants");

module.exports = class Message {
  constructor(rawMessage) {
    this.id = rawMessage.id;
    this.senderPhoneNumber = rawMessage.from;
    this.rawType = rawMessage.type;

    switch (rawMessage.type) {
      case "interactive":
        // button_reply vem quando o usuário toca em um botão
        this.type = rawMessage.interactive?.button_reply?.id ?? "unknown";
        break;

      case "text":
        // Qualquer mensagem de texto livre cai aqui (oi, hello, etc.)
        this.type = "text";
        this.body = rawMessage.text?.body ?? "";
        break;

      case "image":
      case "audio":
      case "video":
      case "document":
      case "sticker":
        this.type = "media";
        this.mediaId = rawMessage[rawMessage.type]?.id;
        break;

      case "location":
        this.type = "location";
        this.location = rawMessage.location;
        break;

      default:
        this.type = "unknown";
        break;
    }
  }
};
