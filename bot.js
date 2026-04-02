require("dotenv").config();
const { Telegraf, Markup } = require("telegraf");

const BOT_TOKEN = "8642810499:AAGX3srbfsOt-lR5NB7Ep0rnE1U5Do_KBVI";
const HYPRFORGE_URL = "https://hyprforge.com";
const CONSULT_URL = process.env.CONSULT_URL || HYPRFORGE_URL;
const BRAND_NAME = process.env.BRAND_NAME || "HyprForge";

if (!BOT_TOKEN) {
  throw new Error("BOT_TOKEN is missing. Set it in your environment before starting the bot.");
}

const bot = new Telegraf(BOT_TOKEN);

const adVariations = [
  "Build and scale digital products with expert support. Book a free consultation at hyprforge.com",
  "Need help with your next digital project? Get practical guidance from HyprForge. Book a free consultation.",
  "Explore tailored digital solutions for your business. Book a free consultation with HyprForge today.",
];

const welcomeText = [
  "Welcome to the HyprForge ad bot.",
  "",
  "Use /ad to get a Telegram-compliant promo message, /share to get a shareable post, and /about to learn more.",
].join("\n");

const aboutText =
  "This bot shares simple, policy-friendly promotional copy for HyprForge. All ad text is written to stay clear, factual, and professional.";

const adKeyboard = Markup.inlineKeyboard([
  [Markup.button.url("Book Free Consultation", CONSULT_URL)],
]);

bot.start(async (ctx) => {
  await ctx.reply(welcomeText);
});

bot.command("about", async (ctx) => {
  await ctx.reply(aboutText);
});

bot.command("website", async (ctx) => {
  await ctx.reply(`Visit ${BRAND_NAME}: ${HYPRFORGE_URL}`, adKeyboard);
});

bot.command("ad", async (ctx) => {
  const rawArg = ctx.message.text.split(" ")[1];
  let index = 0;

  if (rawArg) {
    const parsed = Number.parseInt(rawArg, 10);
    if (!Number.isNaN(parsed)) {
      index = Math.max(0, Math.min(parsed - 1, adVariations.length - 1));
    }
  }

  await ctx.reply(adVariations[index], adKeyboard);
});

bot.command("variants", async (ctx) => {
  const text = adVariations.map((item, i) => `${i + 1}. ${item}`).join("\n\n");
  await ctx.reply(text, adKeyboard);
});

bot.command("share", async (ctx) => {
  const shareText =
    `Looking for expert help with digital products, automation, or growth? ${BRAND_NAME} offers practical guidance and tailored solutions. Book a free consultation: ${CONSULT_URL}`;
  await ctx.reply(shareText, adKeyboard);
});

bot.command("help", async (ctx) => {
  const helpText = [
    "/start - welcome message",
    "/about - what this bot does",
    "/ad - send one ad variation",
    "/ad 2 - send a specific variation",
    "/variants - list all ad variations",
    "/share - send a longer shareable promo post",
    "/website - show the HyprForge link",
  ].join("\n");

  await ctx.reply(helpText);
});

bot.catch((err, ctx) => {
  console.error("Bot error for update", ctx.update, err);
});

bot.launch();
console.log("HyprForge Telegram ad bot is running...");

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));