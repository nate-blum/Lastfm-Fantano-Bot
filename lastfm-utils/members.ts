import * as usernames from '../usernames.json';
import { Message } from 'discord.js';
import { sendToChannel } from './logger';

export function getSingleMember(msg: Message) {
    if (msg.mentions.users.array().length > 0) {
        if (usernames[msg.mentions.users.first().id]) return msg.mentions.members.first();
        else {
            sendToChannel(msg, "I don't have a username stored for your mention.");
            msg.channel.stopTyping();
            return null;
        }
    } else if (usernames[msg.author.id]) return msg.member;
    else {
        sendToChannel(msg, "I don't have a username stored for you.");
        msg.channel.stopTyping();
        return null;
    }
}
