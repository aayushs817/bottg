require('dotenv').config();

const mongoose = require('mongoose');
const { Telegraf, Markup } = require('telegraf');

const User = require('./models/User');
const Event = require('./models/Event');
const Counter = require('./models/Counter');

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID ? String(process.env.ADMIN_ID) : null;
const MONGODB_URI = process.env.MONGODB_URI;

if (!BOT_TOKEN) throw new Error('BOT_TOKEN is missing');
if (!MONGODB_URI) throw new Error('MONGODB_URI is missing');

const bot = new Telegraf(BOT_TOKEN);

const PHOTO_FILE_ID =
  'AgACAgQAAxkDAAMEacq-wexk-r7se-j-qc1uydx8JWMAAh0NaxvSelxSlE4f5hUwNNcBAAMCAAN5AAM6BA';

const BASE_LINKS = {
  register: 'https://www.reddy888.com/register?campaignId=gauravxcricket',
  support: 'https://wa.link/Reddy888vip',
  telegram: 'https://t.me/+qvRgBIht3fw0YzQ1'
};

function runBackground(label, fn) {
  Promise.resolve()
    .then(fn)
    .catch((err) => console.error(`[BG:${label}]`, err));
}

async function upsertUser(from) {
  return User.findOneAndUpdate(
    { telegramId: String(from.id) },
    {
      $set: {
        username: from.username || null,
        firstName: from.first_name || null,
        lastName: from.last_name || null,
        lastSeen: new Date()
      },
      $setOnInsert: { firstSeen: new Date() }
    },
    { upsert: true, new: true }
  );
}

async function incrementUserField(from, fieldPath) {
  return User.findOneAndUpdate(
    { telegramId: String(from.id) },
    {
      $set: {
        username: from.username || null,
        firstName: from.first_name || null,
        lastName: from.last_name || null,
        lastSeen: new Date()
      },
      $setOnInsert: { firstSeen: new Date() },
      $inc: { [fieldPath]: 1 }
    },
    { upsert: true, new: true }
  );
}

async function incrementCounter(key) {
  return Counter.findOneAndUpdate(
    { key },
    { $inc: { value: 1 } },
    { upsert: true, new: true }
  );
}

async function getCounterValue(key) {
  const counter = await Counter.findOne({ key }).lean();
  return counter ? counter.value : 0;
}

async function logEvent(from, type, extra = {}) {
  return Event.create({
    telegramId: String(from.id),
    username: from.username || null,
    firstName: from.first_name || null,
    type,
    cta: extra.cta || null,
    extra
  });
}

function buildTrackedLink(type, userId) {
  const url = new URL(BASE_LINKS[type]);
  url.searchParams.set('src', 'telegram_bot');
  url.searchParams.set('bot', 'reddyanna');
  url.searchParams.set('cta', type);
  url.searchParams.set('user_id', String(userId));
  url.searchParams.set('ts', Date.now().toString());
  return url.toString();
}

async function uniqueUsersByEvent(eventType) {
  const result = await Event.distinct('telegramId', { type: eventType });
  return result.length;
}

async function getStatsText() {
  const totalUsers = await User.countDocuments();
  const [
    startCount, registerClick, supportClick, telegramClick, helpClick,
    registerLinkOpened, supportLinkOpened, telegramLinkOpened,
    uniqueStartUsers, uniqueRegisterClicks, uniqueSupportClicks,
    uniqueTelegramClicks, uniqueHelpClicks, uniqueRegisterLinkOpens,
    uniqueSupportLinkOpens, uniqueTelegramLinkOpens
  ] = await Promise.all([
    getCounterValue('start'), getCounterValue('register_click'),
    getCounterValue('support_click'), getCounterValue('telegram_click'),
    getCounterValue('help_click'), getCounterValue('register_link_opened'),
    getCounterValue('support_link_opened'), getCounterValue('telegram_link_opened'),
    uniqueUsersByEvent('start'), uniqueUsersByEvent('click_register'),
    uniqueUsersByEvent('click_support'), uniqueUsersByEvent('click_telegram'),
    uniqueUsersByEvent('click_help'), uniqueUsersByEvent('open_register_link'),
    uniqueUsersByEvent('open_support_link'), uniqueUsersByEvent('open_telegram_link')
  ]);

  return (
    `📊 Bot Stats\n\n` +
    `Users\n` +
    `- Total known users: ${totalUsers}\n` +
    `- Total /start count: ${startCount}\n` +
    `- Unique /start users: ${uniqueStartUsers}\n\n` +
    `Internal button clicks\n` +
    `- Register clicks: ${registerClick} (${uniqueRegisterClicks} unique)\n` +
    `- Support clicks: ${supportClick} (${uniqueSupportClicks} unique)\n` +
    `- Telegram clicks: ${telegramClick} (${uniqueTelegramClicks} unique)\n` +
    `- Help clicks: ${helpClick} (${uniqueHelpClicks} unique)\n\n` +
    `External link shown\n` +
    `- Register link shown: ${registerLinkOpened} (${uniqueRegisterLinkOpens} unique)\n` +
    `- Support link shown: ${supportLinkOpened} (${uniqueSupportLinkOpens} unique)\n` +
    `- Telegram link shown: ${telegramLinkOpened} (${uniqueTelegramLinkOpens} unique)\n`
  );
}

function escapeMarkdown(text) {
  return String(text ?? '').replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}

async function notifyAdmin(text) {
  if (!ADMIN_ID) return;
  await bot.telegram.sendMessage(ADMIN_ID, text, { parse_mode: 'MarkdownV2' });
}

function buildAdminAlert(from, action, extra = {}) {
  const firstName = escapeMarkdown(from.first_name || 'Unknown');
  const username = from.username ? `@${escapeMarkdown(from.username)}` : '-';
  const userId = escapeMarkdown(String(from.id));
  const time = escapeMarkdown(new Date().toISOString());

  let msg =
    `🔔 *Bot Activity Alert*\n\n` +
    `*Action:* ${escapeMarkdown(action)}\n` +
    `*User:* ${firstName}\n` +
    `*Username:* ${username}\n` +
    `*User ID:* \`${userId}\`\n`;

  if (extra.cta) msg += `*CTA:* ${escapeMarkdown(extra.cta)}\n`;
  if (extra.linkType) msg += `*Link Type:* ${escapeMarkdown(extra.linkType)}\n`;
  if (extra.url) msg += `*URL:* ${escapeMarkdown(extra.url)}\n`;
  msg += `*Time:* ${time}`;
  return msg;
}

function notifyAdminInBackground(from, action, extra = {}, label = 'admin-alert') {
  if (!ADMIN_ID) return;
  runBackground(label, async () => {
    await notifyAdmin(buildAdminAlert(from, action, extra));
  });
}

async function trackAndReplyLink(ctx, type, title, buttonText) {
  const trackedUrl = buildTrackedLink(type, ctx.from.id);
  await ctx.reply(title, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([
      [Markup.button.url(buttonText, trackedUrl)],
      [Markup.button.callback('⬅ Back', 'back_main')]
    ])
  });
  runBackground(`track-link-${type}`, async () => {
    await Promise.all([
      incrementUserField(ctx.from, `linkOpens.${type}`),
      incrementCounter(`${type}_link_opened`),
      logEvent(ctx.from, `open_${type}_link`, { cta: type, url: trackedUrl })
    ]);
  });
  notifyAdminInBackground(ctx.from, `External ${type} link shown`, { cta: type, linkType: type, url: trackedUrl }, `notify-admin-external-${type}`);
}

function mainMenuKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🚀 Register Now', 'register')],
    [Markup.button.callback('💬 24x7 Support', 'support')],
    [Markup.button.callback('📢 Join Telegram', 'telegram')],
    [Markup.button.callback('🤔 Help Me Choose', 'help_choose')]
  ]);
}

bot.start(async (ctx) => {
  try {
    console.log('START received from:', ctx.from.id);
    runBackground('start-user-upsert', async () => { await upsertUser(ctx.from); });
    try {
      await ctx.replyWithPhoto(PHOTO_FILE_ID, {
        caption: `👋 *Welcome to ReddyAnna Official Book*\n\nChoose what you want to do below:`,
        parse_mode: 'Markdown'
      });
    } catch (photoError) {
      console.log('PHOTO ERROR:', photoError.message);
      await ctx.reply(`👋 Welcome to ReddyAnna Official Book\n\nChoose what you want to do below:`);
    }
    await ctx.reply(`Tap an option below 👇`, mainMenuKeyboard());
    runBackground('start-tracking', async () => {
      await Promise.all([
        incrementUserField(ctx.from, 'starts'),
        incrementCounter('start'),
        logEvent(ctx.from, 'start')
      ]);
    });
    notifyAdminInBackground(ctx.from, 'User started bot', {}, 'notify-admin-start');
  } catch (error) {
    console.log('START ERROR:', error);
  }
});

bot.command('id', async (ctx) => {
  await ctx.reply(`🆔 Your Telegram user ID is: ${ctx.from.id}`);
  runBackground('id-command', async () => {
    await Promise.all([upsertUser(ctx.from), logEvent(ctx.from, 'view_id')]);
  });
});

bot.action('register', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    await trackAndReplyLink(ctx, 'register', `✅ *Best for new users*\n\nCreate your account here:`, '🔥 Open Registration');
    runBackground('register-click', async () => {
      await Promise.all([
        incrementUserField(ctx.from, 'clicks.register'),
        incrementCounter('register_click'),
        logEvent(ctx.from, 'click_register', { cta: 'register' })
      ]);
    });
    notifyAdminInBackground(ctx.from, 'User clicked register', { cta: 'register' }, 'notify-admin-register');
  } catch (error) { console.log('REGISTER ERROR:', error); }
});

bot.action('support', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    await trackAndReplyLink(ctx, 'support', `💬 *Need help right now?*\n\nTalk to support here:`, '📞 Open Support Chat');
    runBackground('support-click', async () => {
      await Promise.all([
        incrementUserField(ctx.from, 'clicks.support'),
        incrementCounter('support_click'),
        logEvent(ctx.from, 'click_support', { cta: 'support' })
      ]);
    });
    notifyAdminInBackground(ctx.from, 'User clicked support', { cta: 'support' }, 'notify-admin-support');
  } catch (error) { console.log('SUPPORT ERROR:', error); }
});

bot.action('telegram', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    await trackAndReplyLink(ctx, 'telegram', `📢 *Get updates and community access*\n\nJoin here:`, '📲 Join Telegram Channel');
    runBackground('telegram-click', async () => {
      await Promise.all([
        incrementUserField(ctx.from, 'clicks.telegram'),
        incrementCounter('telegram_click'),
        logEvent(ctx.from, 'click_telegram', { cta: 'telegram' })
      ]);
    });
    notifyAdminInBackground(ctx.from, 'User clicked join telegram', { cta: 'telegram' }, 'notify-admin-telegram');
  } catch (error) { console.log('TELEGRAM ERROR:', error); }
});

bot.action('help_choose', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    await ctx.reply(
      `Here's a quick guide:\n\n` +
      `🚀 *Register* — for new users\n` +
      `💬 *Support* — for help or questions\n` +
      `📢 *Telegram* — for updates and community`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🚀 I want to register', 'register')],
          [Markup.button.callback('💬 I need support', 'support')],
          [Markup.button.callback('📢 Show Telegram', 'telegram')],
          [Markup.button.callback('⬅ Back', 'back_main')]
        ])
      }
    );
    runBackground('help-click', async () => {
      await Promise.all([
        incrementUserField(ctx.from, 'clicks.help'),
        incrementCounter('help_click'),
        logEvent(ctx.from, 'click_help', { cta: 'help_choose' })
      ]);
    });
    notifyAdminInBackground(ctx.from, 'User clicked help me choose', { cta: 'help_choose' }, 'notify-admin-help');
  } catch (error) { console.log('HELP ERROR:', error); }
});

bot.action('back_main', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    await ctx.reply(`Main menu 👇`, mainMenuKeyboard());
    runBackground('back-main', async () => {
      await Promise.all([upsertUser(ctx.from), logEvent(ctx.from, 'back_main')]);
    });
  } catch (error) { console.log('BACK ERROR:', error); }
});

bot.command('stats', async (ctx) => {
  try {
    if (ADMIN_ID && String(ctx.from.id) !== ADMIN_ID) return ctx.reply('You are not allowed to view stats.');
    const statsText = await getStatsText();
    await ctx.reply(statsText);
  } catch (error) { console.log('STATS ERROR:', error); }
});

bot.command('recent', async (ctx) => {
  try {
    if (ADMIN_ID && String(ctx.from.id) !== ADMIN_ID) return ctx.reply('You are not allowed to view recent events.');
    const lastEvents = await Event.find({}).sort({ createdAt: -1 }).limit(15).lean();
    if (!lastEvents.length) return ctx.reply('No events found.');
    const text = lastEvents.map((e) =>
      `${new Date(e.createdAt).toISOString()} | ${e.type} | ${e.firstName || 'Unknown'} | ${e.telegramId}`
    ).join('\n');
    await ctx.reply(`Recent events:\n\n${text}`);
  } catch (error) { console.log('RECENT ERROR:', error); }
});

bot.catch((err) => {
  console.log('BOT ERROR:', err);
});

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log('MongoDB connected');
  await bot.launch();
  console.log('Bot is running...');
}

main().catch(console.error);

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
