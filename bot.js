const path = require('path');
const { Telegraf } = require('telegraf');

const bot = new Telegraf('8642810499:AAGX3srbfsOt-lR5NB7Ep0rnE1U5Do_KBVI');

const IMAGE_PATH = path.join(__dirname, 'image.png');

function mainKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Website', url: 'https://www.cricbuzz.com/' }],
        [{ text: 'Teams', url: 'https://www.cricbuzz.com/cricket-team' }]
      ]
    }
  };
}

async function sendCricketWelcome(ctx) {
  const sentMessage = await ctx.replyWithPhoto(
    { source: IMAGE_PATH },
    {
      caption:
        `🏏 Welcome to the Cricket News App\n\n` +
        `Get the latest cricket news, live scores, and team updates from Cricbuzz.`,
      ...mainKeyboard()
    }
  );

  return sentMessage;
}

bot.start(async (ctx) => {
  try {
    await sendCricketWelcome(ctx);
  } catch (error) {
    console.log('ERROR:', error);
    await ctx.reply(
      `🏏 Welcome to the Cricket News App\n\n` +
        `Use the buttons below to explore Cricbuzz.`,
      mainKeyboard()
    );
  }
});

bot.command('showimage', async (ctx) => {
  try {
    await sendCricketWelcome(ctx);
  } catch (error) {
    console.log('SHOW IMAGE ERROR:', error);
    await ctx.reply('Unable to send the image right now.');
  }
});

bot.command('imageid', async (ctx) => {
  try {
    const sentMessage = await sendCricketWelcome(ctx);
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
    await ctx.reply('Unable to upload the image and fetch its file_id.');
  }
});

bot.catch((err) => {
  console.log('BOT ERROR:', err);
});

bot.launch();

console.log('Bot is running...');
