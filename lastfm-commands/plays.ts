import { Message, GuildMember } from 'discord.js';
import { request } from '../lastfm-utils/api';
import * as usernames from '../usernames.json';
import { change, normalizeString } from '../lastfm-utils/stringOps';
import { getSingleMember } from '../lastfm-utils/members';
import { sendToChannel } from '../lastfm-utils/logger';
import { scrobblesPerTime } from './scrobbles';
import { registerCommand, registerSlashCommand } from './commandregistry';
import { registerHelp } from './help';
import { CommandCall, Interaction, SlashReturn } from '../lastfm-models/model';
import { mongoInst } from '../lastfm-utils/mongo';
import { findItemByName, getInteractionOpt } from '../lastfm-utils/find';
import { client } from '../lastfm';
const cmdName = 'plays';

export function registerPlaysCommands() {
    registerCommand(['artist', 'ar', 'a'], cmdName, callPlays.bind({ type: 'artist' }));
    registerCommand(['track', 't'], cmdName, callPlays.bind({ type: 'track' }));
    registerCommand(['album', 'al'], cmdName, callPlays.bind({ type: 'album' }));

    registerSlashCommand(cmdName, true, callPlaysSlash);

    [
        {
            name: 'artist',
            aliases: ['ar', 'a'],
            artist: true,
        },
        {
            name: 'track',
            aliases: ['t'],
            track: true,
        },
        {
            name: 'album',
            aliases: ['al'],
            album: true,
        },
    ].forEach(cmd =>
        registerHelp({
            ...cmd,
            mention: true,
            otherText: "You or your mention's listens to the particular " + cmd.name + '.',
        })
    );
}

//identifier: member id/*type*.name/type
//data: playcount, rank

async function callPlays(msg: Message): Promise<CommandCall> {
    let argsArr = msg.content
        .toLowerCase()
        .split(' ')
        .filter(arg => !arg.includes('<@'));
    let member: GuildMember = getSingleMember(msg);
    if (!member) return;
    let { call, message } = await plays(member, this.type, argsArr.splice(1).join(' ') || null);

    message && sendToChannel(msg, message);
    return call;
}

async function callPlaysSlash(int: Interaction): Promise<SlashReturn> {
    let guild = client.guilds.cache.get(int.guild_id);
    return plays(
        await guild.members.fetch(getInteractionOpt(int, 'mention') || int.member.user.id),
        getInteractionOpt(int, 'item-type'),
        getInteractionOpt(int, 'item-name') || null
    );
}

async function plays(member: GuildMember, type: string, itemName?: string): Promise<SlashReturn> {
    let totalScrobbles = +(await scrobblesPerTime(usernames[member.id], 'overall', false));

    let item;
    if (itemName) {
        item = await findItemByName(itemName, type, member.id);
        if (!item)
            return {
                message: await playMessage(member, type, itemName, null, null, null, false),
            };

        let recentTrack = (await request('user.getrecenttracks', { limit: 1, user: usernames[member.id] })).data
            .recenttracks.track[0];
        let nowPlaying =
            normalizeString(item?.name)
                .split(' ')
                .every(word =>
                    normalizeString(type != 'track' ? recentTrack[type]['#text'] : recentTrack.name).includes(word)
                ) &&
            recentTrack['@attr'] &&
            recentTrack['@attr'].nowplaying == 'true';
        return {
            call: item.name
                ? {
                      identifier: `${member.id}/${normalizeString(item.name)}/${type}${
                          type != 'artist' ? '/' + normalizeString(item?.artist?.name) : ''
                      }`,
                      data: {
                          playcount: +item.playcount,
                          rank: +item['@attr'].rank,
                          pct: +((+item.playcount * 100) / totalScrobbles).toFixed(2),
                      },
                  }
                : null,
            message: await playMessage(
                member,
                type,
                item.name || itemName,
                +item.playcount,
                +item['@attr'].rank,
                totalScrobbles,
                nowPlaying,
                item.artist?.name
            ),
        };
    } else {
        let recentTrack = (await request('user.getrecenttracks', { limit: 1, user: usernames[member.id] })).data
            .recenttracks.track[0];
        let searchId = type != 'track' ? recentTrack[type]['#text'] : recentTrack.name;
        item = await findItemByName(searchId, type, member.id, recentTrack.artist['#text']);

        return {
            call: {
                identifier: `${member.id}/${normalizeString(
                    item?.name || (type != 'track' ? recentTrack[type]['#text'] : recentTrack.name)
                )}/${type}${
                    type != 'artist' ? '/' + normalizeString(item?.artist?.name || recentTrack.artist['#text']) : ''
                }`,
                data: {
                    playcount: +item?.playcount,
                    rank: +item?.['@attr'].rank,
                    pct: +((+item?.playcount * 100) / totalScrobbles).toFixed(2),
                },
            },
            message: await playMessage(
                member,
                type,
                item?.name || (type != 'track' ? recentTrack[type]['#text'] : recentTrack.name),
                +item?.playcount,
                +item?.['@attr'].rank,
                totalScrobbles,
                recentTrack?.['@attr']?.nowplaying == 'true',
                item?.artist?.name || (type != 'artist' ? recentTrack.artist['#text'] : '')
            ),
        };
    }
}

async function playMessage(
    user: GuildMember,
    type: string,
    name: string,
    playcount: number,
    rank: number,
    totalScrobbles: number,
    currentlyPlaying: boolean,
    artistName?: string
): Promise<string> {
    if (!playcount || !name || !rank) {
        if (currentlyPlaying)
            return `${user.displayName} is currently playing "${name}"${
                artistName ? ` by "${artistName}"` : ''
            } for the first time.`;
        else return `${user.displayName} has not played "${name}"${artistName ? ` by ${artistName}` : ''} before.`;
    } else {
        let call: CommandCall = await mongoInst.readCall(
                cmdName,
                `${user.id}/${normalizeString(name)}/${type}${artistName ? normalizeString(artistName) : ''}`
            ),
            pct = +((playcount * 100) / totalScrobbles).toFixed(2);
        if (artistName)
            return `${user.displayName} has played "${name}" by ${artistName} **${playcount}${change(
                call?.data.playcount,
                playcount
            )}** time${playcount != 1 ? 's' : ''}, rank **#${rank}${change(call?.data.rank, rank)}**, **${pct}%${change(
                call?.data.pct,
                pct,
                null,
                true
            )}** of all their scrobbles.`;
        else
            return `${user.displayName} has played ${name} **${playcount}${change(
                call?.data.playcount,
                playcount
            )}** time${playcount != 1 ? 's' : ''}, rank **#${rank}${change(call?.data.rank, rank)}**, **${pct}%${change(
                call?.data.pct,
                pct,
                null,
                true
            )}** of all their scrobbles.`;
    }
}
