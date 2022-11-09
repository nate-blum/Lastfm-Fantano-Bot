import { Message, MessageEmbed } from 'discord.js';
import { monthsShort } from 'moment';
import { Command, CommandCall, Interaction, SlashCommand, SlashReturn } from '../lastfm-models/model';
import { mongoInst } from '../lastfm-utils/mongo';
import { normalizeString } from '../lastfm-utils/stringOps';
import { registerChartCommand } from './chart';
import { registerCompareCommand } from './compare';
import { registerHelpCommand } from './help';
import { registerListCommands } from './list';
import { registerPlaysCommands } from './plays';
import { registerRankCommands } from './rank';
import { registerRecsCommand } from './recs';
import { registerScrobblesCommand } from './scrobbles';
import { registerTopArtistCommand } from './topartist';
import { registerTopTracksAlbumCommand } from './toptracksalbum';
import { registerWhoKnowsCommand } from './wk';

let commands: Command[] = [];
let slashCommands: SlashCommand[] = [];

export function registerCommand(aliases: string[], collection: string, func: (msg: Message) => Promise<CommandCall>) {
    commands.push({ aliases, collection, func });
}

export function registerSlashCommand(name: string, mongo: boolean, func: (int: Interaction) => Promise<SlashReturn>) {
    slashCommands.push({ name, mongo, func });
}

export async function callCommand(commandName: string, msg: Message) {
    let command = commands.find(cmd => cmd.aliases.includes(normalizeString(commandName)));
    let call: CommandCall;
    if (command) {
        if (msg.content.includes('--dev') || msg.content.includes('—dev')) {
            if (process.env.NODE_ENV) return;
            msg.content = msg.content
                .split(' ')
                .filter(wd => wd != '--dev' && wd != '—dev')
                .join(' ');
        }

        msg.channel.startTyping();
        call = await command.func(msg);
        command.collection && (await mongoInst.writeCall(command.collection, call));
    }
}

export async function callSlashCommand(int: Interaction): Promise<MessageEmbed[] | string> {
    let command = slashCommands.find(cmd => cmd.name == int.data.name);
    let { call, embeds, message }: SlashReturn = await command.func(int);
    command.mongo && (await mongoInst.writeCall(command.name, call));
    return embeds || message;
}

export function registerAllCommands() {
    registerChartCommand();
    registerHelpCommand();
    registerCompareCommand();
    registerListCommands();
    registerPlaysCommands();
    registerRecsCommand();
    registerScrobblesCommand();
    registerTopArtistCommand();
    registerTopTracksAlbumCommand();
    registerWhoKnowsCommand();
    registerRankCommands();
}
