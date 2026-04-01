require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const path = require('path');
const mongoose = require('mongoose');
const { Telegraf, Markup } = require('telegraf');

const User = require('../models/User');
const Event = require('../models/Event');
const Counter = require('../models/Counter');

const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = process.env.ADMIN_ID ? String(process.env.ADMIN_ID) : null;
const MONGODB_URI = process.env.MONGODB_URI;

if (!BOT_TOKEN) throw new Error('BOT_TOKEN is missing in .env');
if (!MONGODB_URI) throw new Error('MONGODB_URI is missing in .env');

const bot = new Telegraf(BOT_TOKEN);

const IMAGE_PATH = path.join(__dirname, '..', 'image.png');

const BASE_LINKS = {
  website: 'https://www.cricbuzz.com/',
  teams: 'https://www.cricbuzz.com/cricket-team'
};


function runBackground(label, fn) {
  Promise.resolve()
    .then(fn)
    .catch((err) => {
      console.error(`[BG:${label}]`, err);
    });
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
      $setOnInsert: {
        firstSeen: new Date()
      }
    },
    {
      upsert: true,
      new: true
    }
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
      $setOnInsert: {
        firstSeen: new Date()
      },
      $inc: {
        [fieldPath]: 1
      }
    },
    {
      upsert: true,
      new: true
    }
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
    startCount,
    websiteClick,
    teamsClick,
    helpClick,
    websiteLinkOpened,
    teamsLinkOpened,
    uniqueStartUsers,
    uniqueWebsiteClicks,
    uniqueTeamsClicks,
    uniqueHelpClicks,
    uniqueWebsiteLinkOpens,
    uniqueTeamsLinkOpens
  ] = await Promise.all([
    getCounterValue('start'),
    getCounterValue('website_click'),
    getCounterValue('teams_click'),
    getCounterValue('help_click'),
    getCounterValue('website_link_opened'),
    getCounterValue('teams_link_opened'),
    uniqueUsersByEvent('start'),
    uniqueUsersByEvent('click_website'),
    uniqueUsersByEvent('click_teams'),
    uniqueUsersByEvent('click_help'),
    uniqueUsersByEvent('open_website_link'),
    uniqueUsersByEvent('open_teams_link')
  ]);

  return (
    `📊 Bot Stats\n\n` +
    `Users\n` +
    `- Total known users: ${totalUsers}\n` +
    `- Total /start count: ${startCount}\n` +
    `- Unique /start users: ${uniqueStartUsers}\n\n` +
    `Internal button clicks\n` +
    `- Website clicks: ${websiteClick} (${uniqueWebsiteClicks} unique)\n` +
    `- Teams clicks: ${teamsClick} (${uniqueTeamsClicks} unique)\n` +
    `- Help clicks: ${helpClick} (${uniqueHelpClicks} unique)\n\n` +
    `External link shown\n` +
    `- Website link shown: ${websiteLinkOpened} (${uniqueWebsiteLinkOpens} unique)\n` +
    `- Teams link shown: ${teamsLinkOpened} (${uniqueTeamsLinkOpens} unique)\n`
  );
}

function escapeMarkdown(text) {
  return String(text ?? '').replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}

async function notifyAdmin(text) {
  if (!ADMIN_ID) return;
  await bot.telegram.sendMessage(ADMIN_ID, text, {
    parse_mode: 'MarkdownV2'
  });
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

  if (extra.cta) {
    msg += `*CTA:* ${escapeMarkdown(extra.cta)}\n`;
  }

  if (extra.linkType) {
    msg += `*Link Type:* ${escapeMarkdown(extra.linkType)}\n`;
  }

  if (extra.url) {
    msg += `*URL:* ${escapeMarkdown(extra.url)}\n`;
  }

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

  notifyAdminInBackground(
    ctx.from,
    `External ${type} link shown`,
    {
      cta: type,
      linkType: type,
      url: trackedUrl
    },
    `notify-admin-external-${type}`
  );
}

function mainMenuKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🌐 Open Website', 'website')],
    [Markup.button.callback('👥 View Teams', 'teams')],
    [Markup.button.callback('🤔 Help Me Choose', 'help_choose')]
  ]);
}

bot.start(async (ctx) => {
  try {
    console.log('START received from:', ctx.from.id);

    runBackground('start-user-upsert', async () => {
      await upsertUser(ctx.from);
    });

    try {
      await ctx.replyWithPhoto({ source: IMAGE_PATH }, {
        caption:
          `🏏 *Welcome to the Cricket News App*\n\n` +
          `Get the latest cricket news, live scores, and team updates from Cricbuzz.`,
        parse_mode: 'Markdown'
      });
    } catch (photoError) {
      console.log('PHOTO ERROR:', photoError.message);
      await ctx.reply(
        `🏏 Welcome to the Cricket News App\n\nGet the latest cricket news, live scores, and team updates from Cricbuzz.`
      );
    }

    await ctx.reply(`Tap an option below 👇`, mainMenuKeyboard());

    runBackground('start-tracking', async () => {
      await Promise.all([
        incrementUserField(ctx.from, 'starts'),
        incrementCounter('start'),
        logEvent(ctx.from, 'start')
      ]);
    });

    notifyAdminInBackground(
      ctx.from,
      'User started bot',
      {},
      'notify-admin-start'
    );
  } catch (error) {
    console.log('START ERROR:', error);
  }
});

bot.command('id', async (ctx) => {
  await ctx.reply(`🆔 Your Telegram user ID is: ${ctx.from.id}`);

  runBackground('id-command', async () => {
    await Promise.all([
      upsertUser(ctx.from),
      logEvent(ctx.from, 'view_id')
    ]);
  });
});

bot.command('imageid', async (ctx) => {
  try {
    const sentMessage = await ctx.replyWithPhoto(
      { source: IMAGE_PATH },
      { caption: 'Uploaded `image.png` to fetch its Telegram file_id.', parse_mode: 'Markdown' }
    );

    const photos = sentMessage.photo || [];
    const bestPhoto = photos[photos.length - 1];

    if (!bestPhoto?.file_id) {
      return ctx.reply('Image uploaded, but no file_id was returned.');
    }

    await ctx.reply(`Image file_id:\n\`${bestPhoto.file_id}\``, {
      parse_mode: 'Markdown'
    });
  } catch (error) {
    console.log('IMAGE ID ERROR:', error);
  }
});

bot.action('website', async (ctx) => {
  try {
    await ctx.answerCbQuery();

    await trackAndReplyLink(
      ctx,
      'website',
      `🌐 *Cricbuzz Website*\n\nOpen the main Cricbuzz site here:`,
      '🏏 Open Cricbuzz'
    );

    runBackground('website-click', async () => {
      await Promise.all([
        incrementUserField(ctx.from, 'clicks.website'),
        incrementCounter('website_click'),
        logEvent(ctx.from, 'click_website', { cta: 'website' })
      ]);
    });

    notifyAdminInBackground(
      ctx.from,
      'User clicked website',
      { cta: 'website' },
      'notify-admin-website'
    );
  } catch (error) {
    console.log('WEBSITE ERROR:', error);
  }
});

bot.action('teams', async (ctx) => {
  try {
    await ctx.answerCbQuery();

    await trackAndReplyLink(
      ctx,
      'teams',
      `👥 *Cricket Teams*\n\nBrowse teams on Cricbuzz here:`,
      '📋 Open Teams'
    );

    runBackground('teams-click', async () => {
      await Promise.all([
        incrementUserField(ctx.from, 'clicks.teams'),
        incrementCounter('teams_click'),
        logEvent(ctx.from, 'click_teams', { cta: 'teams' })
      ]);
    });

    notifyAdminInBackground(
      ctx.from,
      'User clicked teams',
      { cta: 'teams' },
      'notify-admin-teams'
    );
  } catch (error) {
    console.log('TEAMS ERROR:', error);
  }
});

bot.action('help_choose', async (ctx) => {
  try {
    await ctx.answerCbQuery();

    await ctx.reply(
      `Here’s a quick guide:\n\n` +
        `🌐 *Website* — for latest cricket news and live scores\n` +
        `👥 *Teams* — for squad and team pages`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🌐 Open Website', 'website')],
          [Markup.button.callback('👥 View Teams', 'teams')],
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

    notifyAdminInBackground(
      ctx.from,
      'User clicked help me choose',
      { cta: 'help_choose' },
      'notify-admin-help'
    );
  } catch (error) {
    console.log('HELP ERROR:', error);
  }
});

bot.action('back_main', async (ctx) => {
  try {
    await ctx.answerCbQuery();
    await ctx.reply(`Main menu 👇`, mainMenuKeyboard());

    runBackground('back-main', async () => {
      await Promise.all([
        upsertUser(ctx.from),
        logEvent(ctx.from, 'back_main')
      ]);
    });
  } catch (error) {
    console.log('BACK ERROR:', error);
  }
});

bot.command('stats', async (ctx) => {
  try {
    if (ADMIN_ID && String(ctx.from.id) !== ADMIN_ID) {
      return ctx.reply('You are not allowed to view stats.');
    }

    const statsText = await getStatsText();
    await ctx.reply(statsText);
  } catch (error) {
    console.log('STATS ERROR:', error);
  }
});

bot.command('recent', async (ctx) => {
  try {
    if (ADMIN_ID && String(ctx.from.id) !== ADMIN_ID) {
      return ctx.reply('You are not allowed to view recent events.');
    }

    const lastEvents = await Event.find({})
      .sort({ createdAt: -1 })
      .limit(15)
      .lean();

    if (!lastEvents.length) {
      return ctx.reply('No events found.');
    }

    const text = lastEvents
      .map((e) => {
        return `${new Date(e.createdAt).toISOString()} | ${e.type} | ${e.firstName || 'Unknown'} | ${e.telegramId}`;
      })
      .join('\n');

    await ctx.reply(`Recent events:\n\n${text}`);
  } catch (error) {
    console.log('RECENT ERROR:', error);
  }
});

bot.catch((err) => {
  console.log('BOT ERROR:', err);
});

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log('MongoDB connected');
  await bot.launch({ dropPendingUpdates: true });
  console.log('Bot is running...');
}

main().catch(console.error);

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
