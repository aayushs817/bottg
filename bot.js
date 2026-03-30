const { Telegraf } = require('telegraf');

const bot = new Telegraf('8642810499:AAGX3srbfsOt-lR5NB7Ep0rnE1U5Do_KBVI');

bot.start(async (ctx) => {
    try {

        await ctx.replyWithPhoto('AgACAgQAAxkDAAMEacq-wexk-r7se-j-qc1uydx8JWMAAh0NaxvSelxSlE4f5hUwNNcBAAMCAAN5AAM6BA');

        await ctx.reply(
            `👋 WELCOME TO REDDYANNA OFFICIAL BOOK\n\n` +
            `Click the buttons below to explore:`,
            {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: "Register Now", url: "https://www.reddy888.com/register?campaignId=gauravxcricket" }],
                        [{ text: "24x7 Support", url: "https://wa.link/Reddy888vip" }],
                        [{ text: "Join us on Telegram", url: "https://t.me/+qvRgBIht3fw0YzQ1" }]
                    ]
                }
            }
        );

    } catch (error) {
        console.log("ERROR:", error);
    }
});

// Global error handler
bot.catch((err) => {
    console.log('BOT ERROR:', err);
});

bot.launch();

console.log("Bot is running...");