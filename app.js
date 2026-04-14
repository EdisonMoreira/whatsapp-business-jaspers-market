"use strict";

const crypto = require("crypto");
const { urlencoded, json } = require("body-parser");
require("dotenv").config();
const express = require("express");

const config = require("./services/config");
const Conversation = require("./services/conversation");

const app = express();

// ---------------------------------------------------------------------------
// Captura rejeicoes nao tratadas ANTES que o SDK do Facebook as intercepte.
// Sem isso, erros de API (ex: token expirado) derrubam o processo inteiro.
// ---------------------------------------------------------------------------
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection (processo mantido):", reason?.message ?? reason);
});

process.on("uncaughtException", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Porta ${config.port} em uso. Rode: pkill -f "node app.js"`);
    process.exit(1);
  }
  console.error("Uncaught exception (processo mantido):", err.message);
});

// ---------------------------------------------------------------------------
// Middlewares
// ---------------------------------------------------------------------------
app.use((req, res, next) => {
  res.setHeader("ngrok-skip-browser-warning", "true");
  next();
});

app.use(urlencoded({ extended: true }));
app.use(json({ verify: verifyRequestSignature }));

// ---------------------------------------------------------------------------
// Webhook verification (GET)
// ---------------------------------------------------------------------------
app.get("/webhook", (req, res) => {
  if (
    req.query["hub.mode"] !== "subscribe" ||
    req.query["hub.verify_token"] !== config.verifyToken
  ) {
    res.sendStatus(403);
    return;
  }
  res.send(req.query["hub.challenge"]);
});

// ---------------------------------------------------------------------------
// Webhook de mensagens (POST)
// ---------------------------------------------------------------------------
app.post("/webhook", (req, res) => {
  console.log(JSON.stringify(req.body, null, 2));

  // Responde 200 imediatamente — obrigatorio pela Meta (timeout de 20s)
  res.status(200).send("EVENT_RECEIVED");

  if (req.body.object !== "whatsapp_business_account") return;

  req.body.entry.forEach((entry) => {
    entry.changes.forEach((change) => {
      const value = change.value;
      if (!value) return;

      const senderPhoneNumberId = value.metadata.phone_number_id;

      if (value.statuses) {
        value.statuses.forEach((status) =>
          Conversation.handleStatus(senderPhoneNumberId, status).catch((err) =>
            console.error("handleStatus error:", err.message)
          )
        );
      }

      if (value.messages) {
        value.messages.forEach((rawMessage) =>
          Conversation.handleMessage(senderPhoneNumberId, rawMessage).catch((err) =>
            console.error("handleMessage error:", err.message)
          )
        );
      }
    });
  });
});

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------
app.get("/", (req, res) => {
  res.json({
    message: "Jasper's Market Server is running",
    endpoints: ["POST /webhook - WhatsApp webhook endpoint"],
  });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
config.checkEnvVariables();

const listener = app.listen(config.port, () => {
  console.log(`The app is listening on port ${listener.address().port}`);
});

// ---------------------------------------------------------------------------
// Verificacao de assinatura HMAC
// ---------------------------------------------------------------------------
function verifyRequestSignature(req, res, buf) {
  const signature = req.headers["x-hub-signature-256"];
  if (!signature) {
    console.warn('Aviso: header "x-hub-signature-256" ausente.');
    return;
  }
  const signatureHash = signature.split("=")[1];
  const expectedHash = crypto
    .createHmac("sha256", config.appSecret)
    .update(buf)
    .digest("hex");

  if (signatureHash !== expectedHash) {
    throw new Error("Assinatura da requisicao invalida.");
  }
}
