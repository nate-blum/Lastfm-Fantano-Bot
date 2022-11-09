import { Message, WebhookClient } from 'discord.js';

const client = new WebhookClient('*sensitive data*', '*sensitive data*');

export function logToWebhook(message: string) {
    if (process.env.NODE_ENV) client.send(message);
    console.log(message);
}

export function sendToChannel(message: Message, text: string) {
    message.channel.send(`${process.env.NODE_ENV ? '' : 'local: '}${text}`);
}
