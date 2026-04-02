require("dotenv").config();
const { Telegraf, Markup } = require("telegraf");

const BOT_TOKEN = "8642810499:AAGX3srbfsOt-lR5NB7Ep0rnE1U5Do_KBVI";
const HYPRFORGE_URL = "https://hyprforge.com/";
const CONSULT_URL = process.env.CONSULT_URL || HYPRFORGE_URL;
const BRAND_NAME = process.env.BRAND_NAME || "HyprForge";
const SOLUTIONS_URL = process.env.SOLUTIONS_URL || "https://www.hyprforge.com/solutions";

if (!BOT_TOKEN) {
  throw new Error("BOT_TOKEN is missing. Set it in your environment before starting the bot.");
}

const bot = new Telegraf(BOT_TOKEN);

// --- Ad Variations (policy-safe) ---
const adVariations = [
  "Build and scale digital products with expert support. Book a free consultation at hyprforge.com",
  "Need help with your next digital project? Get practical guidance from HyprForge. Book a free consultation.",
  "Explore tailored digital solutions for your business. Book a free consultation with HyprForge today.",
];

// --- Welcome / Intro Message ---
const welcomeText =
  `Welcome to ${BRAND_NAME}\n\n` +
  `We help businesses build, launch, and scale digital products with practical solutions and expert guidance.\n\n` +
  `What you can do here:\n` +
  `- Explore our services\n` +
  `- View real case studies\n` +
  `- Book a consultation with our team`;

// --- CTA Buttons ---
const mainKeyboard = Markup.inlineKeyboard([
  [Markup.button.url("Book your consultation now", HYPRFORGE_URL)],
  [Markup.button.url("View case studies", SOLUTIONS_URL)],
]);

// --- Commands ---

bot.start(async (ctx) => {
  await ctx.reply(welcomeText, mainKeyboard);
});

bot.command("about", async (ctx) => {
  const aboutText =
    `${BRAND_NAME} provides digital solutions to help businesses grow and scale. ` +
    `We focus on building reliable, practical systems tailored to your needs.`;

  await ctx.reply(aboutText, mainKeyboard);
});

bot.command("website", async (ctx) => {
  await ctx.reply(`Visit ${BRAND_NAME}: ${HYPRFORGE_URL}`, mainKeyboard);
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

  await ctx.reply(adVariations[index], mainKeyboard);
});

bot.command("variants", async (ctx) => {
  const text = adVariations.map((item, i) => `${i + 1}. ${item}`).join("\n\n");
  await ctx.reply(text, mainKeyboard);
});

bot.command("share", async (ctx) => {
  const shareText =
    `Looking for expert help with digital products or growth? ${BRAND_NAME} offers practical solutions and tailored support. Book your consultation: ${HYPRFORGE_URL}`;
  await ctx.reply(shareText, mainKeyboard);
});

bot.command("help", async (ctx) => {
  const helpText = [
    "/start - introduction",
    "/about - about HyprForge",
    "/ad - send one ad",
    "/ad 2 - send a specific ad",
    "/variants - list all ads",
    "/share - share message",
    "/website - open website",
  ].join("\n");

  await ctx.reply(helpText);
});

// --- Error Handling ---
bot.catch((err, ctx) => {
  console.error("Bot error:", err);
});

bot.launch();
console.log("HyprForge Telegram bot running...");

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));