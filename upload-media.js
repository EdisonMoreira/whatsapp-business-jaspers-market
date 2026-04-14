#!/usr/bin/env node
/**
 * upload-media.js
 *
 * Uso (de qualquer diretório):
 *   node /caminho/para/upload-media.js <arquivo> [mime-type]
 *
 * Exemplos:
 *   node upload-media.js public/groceries.jpg
 *   node upload-media.js public/groceries.jpg image/jpeg
 *
 * Requer Node 18+ (usa fetch nativo). Sem dependências extras.
 * Lê o .env da raiz do projeto automaticamente.
 */

"use strict";

const fs   = require("fs");
const path = require("path");

// Resolve .env a partir do diretório do próprio script, não do cwd
const scriptDir = path.dirname(path.resolve(__filename));
require("dotenv").config({ path: path.join(scriptDir, ".env") });

// --- argumentos ---
const filePath = process.argv[2];
const mimeType = process.argv[3] ?? guessMime(filePath);

if (!filePath) {
  console.error("Uso: node upload-media.js <arquivo> [mime-type]");
  process.exit(1);
}

const absFilePath = path.resolve(filePath);

if (!fs.existsSync(absFilePath)) {
  console.error(`Arquivo não encontrado: ${absFilePath}`);
  process.exit(1);
}

const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const ACCESS_TOKEN    = process.env.ACCESS_TOKEN;

if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
  console.error("PHONE_NUMBER_ID e/ou ACCESS_TOKEN não encontrados.");
  console.error(`Procurei o .env em: ${scriptDir}`);
  process.exit(1);
}

// --- upload ---
async function uploadMedia() {
  const fileBuffer = fs.readFileSync(absFilePath);
  const fileName   = path.basename(absFilePath);

  const blob = new Blob([fileBuffer], { type: mimeType });
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("type", mimeType);
  form.append("file", blob, fileName);

  console.log(`Enviando ${fileName} (${mimeType})...`);

  const res  = await fetch(
    `https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/media`,
    {
      method:  "POST",
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
      body:    form,
    }
  );

  const data = await res.json();

  if (data.error) {
    console.error("Erro no upload:", JSON.stringify(data.error, null, 2));
    process.exit(1);
  }

  const envKey = path.basename(fileName, path.extname(fileName))
    .toUpperCase().replace(/[^A-Z0-9]/g, "_");

  console.log(`\nUpload concluído: ${fileName}`);
  console.log(`media_id : ${data.id}`);
  console.log(`\nAdicione no .env:`);
  console.log(`MEDIA_ID_${envKey}=${data.id}`);
}

function guessMime(file) {
  if (!file) return "image/jpeg";
  const ext = path.extname(file).toLowerCase();
  return {
    ".jpg":  "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png":  "image/png",
    ".mp4":  "video/mp4",
    ".pdf":  "application/pdf",
  }[ext] ?? "image/jpeg";
}

uploadMedia().catch((err) => {
  console.error("Erro inesperado:", err.message ?? err);
  process.exit(1);
});
