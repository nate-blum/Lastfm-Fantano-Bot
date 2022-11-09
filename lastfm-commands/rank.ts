import { Message, GuildMember } from 'discord.js';
import { request } from '../lastfm-utils/api';
import * as usernames from '../usernames.json';
import { change, normalizeString, rangeNameAutocorrect } from '../lastfm-utils/stringOps';
import { getSingleMember } from '../lastfm-utils/members';
import { sendToChannel } from '../lastfm-utils/logger';
import { scrobblesPerTime } from './scrobbles';
import { registerCommand, registerSlashCommand } from './commandregistry';
import { registerHelp } from './help';
import { CommandCall, Interaction, SlashReturn, TimePeriods } from '../lastfm-models/model';
import { mongoInst } from '../lastfm-utils/mongo';
import { getInteractionOpt } from '../lastfm-utils/find';
import { client } from '../lastfm';
const cmdName = 'rank';

export function registerRankCommands() {
    registerCommand(['artistrank', 'ra'], cmdName, callRank.bind({ type: 'artist' }));
    registerCommand(['trackrank', 'rt'], cmdName, callRank.bind({ type: 'track' }));
    registerCommand(['albumrank', 'ral'], cmdName, callRank.bind({ type: 'album' }));

    registerSlashCommand(cmdName, true, callRankSlash);

    [
        {
            name: 'artistrank',
            aliases: ['ra'],
        },
        {
            name: 'trackrank',
            aliases: ['rt'],
        },
        {
            name: 'albumrank',
            aliases: ['ral'],
        },
    ].forEach(cmd =>
        registerHelp({
            ...cmd,
            mention: true,
            time: true,
            params: ['rank'],
            otherText:
                "`<rank>`: The rank you are trying to find. Defaults to 1.\nYou or your mention's " +
                cmd.name.replace('rank', '') +
                ' at the rank for the time period. Time defaults to overall.',
        })
    );
}

async function rank(time: string, rank: number, member: GuildMember, type: string): Promise<SlashReturn> {
    let item = (
        await request(`user.gettop${type}s`, {
            user: usernames[member.id],
            period: TimePeriods[time],
            limit: 1,
            page: rank,
        })
    ).data[`top${type}s`][type][0];

    //identifier: member.id/time/rank/type
    //data: pct, playcount, item.name

    let old = await mongoInst.readCall(cmdName, `${member.id}/${TimePeriods[time]}/${rank}/${type}`),
        totalScrobbles = +(await scrobblesPerTime(usernames[member.id], time as string, false)),
        pct = +((+item.playcount * 100) / totalScrobbles).toFixed(2),
        message =
            !!old?.data.name && normalizeString(old?.data.name || '') != normalizeString(item.name)
                ? `${member.displayName}'s rank **#${item['@attr'].rank} (new)** ${type} is "${item.name}"${
                      type == 'artist' ? '' : `, by ${item.artist.name}`
                  } (was "${old.data.name}"), **${item.playcount}** plays, **${pct}%** of their scrobbles ${
                      time == 'overall'
                          ? 'overall'
                          : `for the past ${(time as string).length == 2 ? TimePeriods[time] : time}${
                                /^[0-9]/.test(time as string) ? 's' : ''
                            }`
                  }.`
                : `${member.displayName}'s rank **#${item['@attr'].rank}** ${type} is "${item.name}"${
                      type == 'artist' ? '' : `, by ${item.artist.name}`
                  }, **${item.playcount}${change(old?.data.playcount, item.playcount)}** plays, **${pct}%${change(
                      old?.data.pct,
                      pct,
                      0.1,
                      true
                  )}** of their scrobbles ${time == 'overall' ? 'overall' : `for the past ${time}`}.`;

    return {
        call: {
            identifier: `${member.id}/${TimePeriods[time]}/${rank}/${type}`,
            data: { pct, playcount: item.playcount, name: item.name },
        },
        message,
    };
}

async function callRank(msg: Message): Promise<CommandCall> {
    let { time, rankNum }: { time: string; rankNum: number } = (arr => ({
        time: rangeNameAutocorrect(
            arr.find(arg => isNaN(+arg) && !arg.startsWith('!')),
            'overall'
        ),
        rankNum: Math.abs(+arr.find(arg => !isNaN(+arg))) || 1,
    }))(msg.content.toLowerCase().split(' '));

    let member: GuildMember = getSingleMember(msg);
    if (!member) return;

    let { call, message }: SlashReturn = await rank(time, rankNum, member, this.type);

    sendToChannel(msg, message);
    return call;
}

async function callRankSlash(int: Interaction): Promise<SlashReturn> {
    return rank(
        getInteractionOpt(int, 'time') || 'overall',
        getInteractionOpt(int, 'rank') || 1,
        await client.guilds.cache
            .get(int.guild_id)
            .members.fetch(getInteractionOpt(int, 'mention') || int.member.user.id),
        getInteractionOpt(int, 'item-type')
    );
}
