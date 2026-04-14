/**
 * Copyright 2021-present, Facebook, Inc. All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

"use strict";

module.exports = Object.freeze({
  // Response messages
  APP_DEFAULT_MESSAGE: "Welcome to Jasper's Market! What can we help you with today?",
  APP_TRY_ANOTHER_MESSAGE: "Is there anything else we can help you with?",

  // CTA texts
  REPLY_INTERACTIVE_WITH_MEDIA_CTA: "Shop online",
  REPLY_MEDIA_CARD_CAROUSEL_CTA: "Get recipe ideas",
  REPLY_OFFER_CTA: "Current promo",

  // Reply Button IDs — max 20 chars (WhatsApp API limit)
  REPLY_INTERACTIVE_MEDIA_ID: "reply-media",       // era: reply-interactive-with-media (28 chars)
  REPLY_MEDIA_CAROUSEL_ID:    "reply-carousel",    // era: reply-media-card-carousel (25 chars)
  REPLY_OFFER_ID:             "reply-offer",       // ok: 11 chars
});
