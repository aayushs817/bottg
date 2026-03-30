const { Telegraf } = require('telegraf');

const bot = new Telegraf(process.env.BOT_TOKEN);

bot.start(async (ctx) => {
    try {
        await ctx.replyWithPhoto('AgACAgQAAxkDAAMEacq-wexk-r7se-j-qc1uydx8JWMAAh0NaxvSelxSlE4f5hUwNNcBAAMCAAN5AAM6BA');

        await ctx.reply(
            `👋 WELCOME TO REDDYANNA OFFICIAL BOOK\n\nClick the buttons below to explore:`,
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

bot.catch((err) => {
    console.log('BOT ERROR:', err);
});

module.exports = async (req, res) => {
    if (req.method === 'POST') {
        try {
            await bot.handleUpdate(req.body);
            res.status(200).json({ ok: true });
        } catch (error) {
            console.error('Webhook error:', error);
            res.status(500).json({ error: error.message });
        }
    } else {
        res.status(200).json({ status: 'Bot is running' });
    }
};
