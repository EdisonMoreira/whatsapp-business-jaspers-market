/**
 * upload-media.js
 *
 * Uso:
 *   node upload-media.js <caminho-da-imagem> [tipo-mime]
 *
 * Exemplos:
 *   node upload-media.js public/groceries.jpg image/jpeg
 *   node upload-media.js public/strawberries.jpg
 *
 * Pré-requisito: npm install form-data node-fetch (ou use node 18+ com fetch nativo)
 */

"use strict";

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const FormData = require("form-data");

const filePath = process.argv[2];
const mimeType = process.argv[3] ?? "image/jpeg";

if (!filePath) {
  console.error("Uso: node upload-media.js <arquivo> [mime-type]");
  process.exit(1);
}

const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const ACCESS_TOKEN = process.env.ACCESS_TOKEN;

if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
  console.error("Defina PHONE_NUMBER_ID e ACCESS_TOKEN no .env");
  process.exit(1);
}

async function uploadMedia() {
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("type", mimeType);
  form.append("file", fs.createReadStream(filePath), {
    filename: path.basename(filePath),
    contentType: mimeType,
  });

  const res = await fetch(
    `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/media`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        ...form.getHeaders(),
      },
      body: form,
    }
  );

  const data = await res.json();

  if (data.error) {
    console.error("Erro no upload:", JSON.stringify(data.error, null, 2));
    process.exit(1);
  }

  console.log(`\nUpload concluído para: ${path.basename(filePath)}`);
  console.log(`media_id: ${data.id}`);
  console.log(`\nAdicione no seu .env:`);
  console.log(`MEDIA_ID_${path.basename(filePath, path.extname(filePath)).toUpperCase()}=${data.id}`);
}

uploadMedia().catch((err) => {
  console.error("Erro inesperado:", err);
  process.exit(1);
});
