import { Message } from 'discord.js';
import { CommandCall, CommonHelp, HelpMsg } from '../lastfm-models/model';
import { sendToChannel } from '../lastfm-utils/logger';
import { normalizeString } from '../lastfm-utils/stringOps';
import { registerCommand } from './commandregistry';

let helpMsgs: HelpMsg[] = [];

export function registerHelp(help: HelpMsg) {
    helpMsgs.push(help);
}

async function help(msg: Message): Promise<CommandCall> {
    let commandName = msg.content.toLowerCase().split(' ')[1] || '';
    let help = helpMsgs.find(
        help => help.name == normalizeString(commandName) || help.aliases?.includes(normalizeString(commandName))
    );
    help
        ? sendToChannel(msg, constructHelp(help))
        : sendToChannel(
              msg,
              constructHelp({
                  name: 'help',
                  aliases: ['h'],
                  params: ['command'],
                  otherText:
                      '<command?>: The command you want help with.\nCommands: ' +
                      helpMsgs.map(help => `\`!${help.name}\``).join(', '),
              })
          );

    return null;
}

function constructHelp(help: HelpMsg): string {
    let filteredParams = ['artist', 'track', 'album', 'time', 'number', 'mention'].filter(k => help[k]);
    return (
        `Usage: \`!${help.name}\`${help.params ? ' ' + help.params.map(p => `\`<${p}>\``).join(' ') : ' '} ${
            filteredParams.length > 0 ? filteredParams.map(p => `\`<${p}>\``).join(' ') : ''
        }. ${help.aliases ? 'Aliased to: ' + help.aliases.map(al => `\`!${al}\``).join(', ') : ''}\n` +
        `${
            filteredParams.length > 0 ? filteredParams.map(p => `\`<${p}>\`: ${CommonHelp[p]}`).join('\n') + '\n' : ''
        }` +
        help.otherText
    );
}

export function registerHelpCommand() {
    registerCommand(['help', 'h'], null, help);
}
