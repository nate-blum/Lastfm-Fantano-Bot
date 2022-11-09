const token = '*sensitive data*';
import { Client, Message, WSEventType } from 'discord.js';
import { callCommand, callSlashCommand, registerAllCommands } from './lastfm-commands/commandregistry';
import { Interaction } from './lastfm-models/model';
import { mongoInst } from './lastfm-utils/mongo';
export const client = new Client();

process.on('SIGTERM', () => {
    mongoInst.close();
});

client.on('ready', async () => {
    client.user.setActivity(' for !help', { type: 'WATCHING' });
    registerAllCommands();
    await mongoInst.run();
});

client.ws.on('INTERACTION_CREATE' as WSEventType, async (interaction: Interaction) => {
    if (
        (interaction.guild_id != '*sensitive data*' && !process.env.NODE_ENV) ||
        (interaction.channel_id == '*sensitive data*' && process.env.NODE_ENV)
    )
        return;
    (client as any).api.interactions(interaction.id, interaction.token).callback.post({
        data: {
            type: 5,
        },
    });
    let data = {},
        response = await callSlashCommand(interaction);
    data[typeof response == 'string' ? 'content' : 'embeds'] = response;
    (client as any).api.webhooks(interaction.application_id, interaction.token).messages('@original').patch({
        data,
    });
});

client.on('message', async (msg: Message) => {
    if (msg.author.bot || !msg.content.startsWith('!')) return;
    if (
        (msg.guild.id != '*sensitive data*' && !process.env.NODE_ENV) ||
        (msg.channel.id == '*sensitive data*' && process.env.NODE_ENV)
    )
        return;
    let command = msg.content.split(' ')[0].replace('!', '').toLowerCase();
    await callCommand(command, msg);
    msg.channel.stopTyping(true);
});

function login() {
    if (client.uptime != null) {
        client.destroy();
    }
    client.login(token);
}

login();

setInterval(login, 600000);
