import * as usernames from '../usernames.json';
import { request } from '../lastfm-utils/api';
import { Message, GuildMember, MessageEmbed, Collection } from 'discord.js';
import { getSingleMember } from '../lastfm-utils/members';
import moment from 'moment-timezone';
import { sendToChannel } from '../lastfm-utils/logger';
import { registerCommand, registerSlashCommand } from './commandregistry';
import { registerHelp } from './help';
import { CommandCall, Interaction, SlashReturn, TimePeriods } from '../lastfm-models/model';
import { mongoInst } from '../lastfm-utils/mongo';
import { change, rangeNameAutocorrect } from '../lastfm-utils/stringOps';
import { getInteractionOpt } from '../lastfm-utils/find';
import { client } from '../lastfm';
const cmdName = 'scrobbles';

export function registerScrobblesCommand() {
    registerCommand(['scrobbles', 's'], cmdName, callScrobbles);
    registerSlashCommand(cmdName, true, callScrobblesSlash);
    registerHelp({
        name: 'scrobbles',
        aliases: ['s'],
        time: true,
        mention: true,
        otherText:
            'Time also includes day in this command, defaults to overall. Returns your number of scrobbles for the time period.\nInclude `-l, -L, l, L, leaderboards or leaderboard` in your call to see leaderboards.',
    });
}

//identifier: member.id/time
//data: scrobbles

async function callScrobbles(msg: Message): Promise<CommandCall> {
    let time: string = rangeNameAutocorrect(
        msg.content.split(' ').find(word => !/^(!|(<)|(-l)|(-L)|(l)|(L)|(leaderboard)|(leaderboards))/g.test(word)),
        'overall',
        ['day', 'week', 'month', 'year', 'overall']
    );

    let results: SlashReturn;
    if (['-l', '-L', 'l', 'L', 'leaderboard', 'leaderboards'].some(kw => msg.content.includes(kw))) {
        results = await leaderboards(msg.member, time, await msg.guild.members.fetch(), msg.guild.id);
    } else {
        let member: GuildMember = getSingleMember(msg);
        if (!member) return;

        results = await scrobbles(member, time);
    }

    results.embeds && results.embeds.forEach(embed => msg.channel.send({ embed }));
    results.message && sendToChannel(msg, results.message);
    return results.call;
}

async function callScrobblesSlash(int: Interaction): Promise<SlashReturn> {
    let guild = client.guilds.cache.get(int.guild_id);
    return getInteractionOpt(int, 'leaderboard') || false
        ? leaderboards(
              await guild.members.fetch(int.member.user.id),
              getInteractionOpt(int, 'time') || 'overall',
              await guild.members.fetch(),
              int.guild_id
          )
        : scrobbles(
              await guild.members.fetch(getInteractionOpt(int, 'mention') || int.member.user.id),
              getInteractionOpt(int, 'time') || 'overall'
          );
}

async function scrobbles(member: GuildMember, time: string): Promise<SlashReturn> {
    var scrobbles = await scrobblesPerTime(usernames[member.id], time, false),
        call: CommandCall = await mongoInst.readCall(cmdName, `${member.id}/${time}`);
    return {
        call: {
            identifier: `${member.id}/${time}`,
            data: { scrobbles: +scrobbles },
        },
        message: `${member.displayName} has **${scrobbles}${change(call?.data.scrobbles, +scrobbles)}** scrobbles ${
            time == 'overall' ? 'overall' : 'over the past ' + time
        }.`,
    };
}

async function leaderboards(
    author: GuildMember,
    time: string,
    members: Collection<string, GuildMember>,
    guild_id: string
): Promise<SlashReturn> {
    let spcs = (
        await Promise.all(
            Object.keys(usernames)
                .filter(id => members.has(id))
                .map(id => scrobblesPerTime(id, time, true))
        )
    ).sort((a: any, b: any) => b.scrobbles - a.scrobbles);

    let serverPlays: number = spcs.reduce((a: any, b: any) => a + b.scrobbles, 0) as number;

    //identifier: guild.id/time/leaderboards
    //data: {serverplays, members: [{member.id, rank, scrobbles, pct}]}

    let newcall: CommandCall = {
            identifier: `${guild_id}/${time}/leaderboards`,
            data: {
                serverPlays,
                members: [],
            },
        },
        oldcall = await mongoInst.readCall('scrobbles', `${guild_id}/${time}/leaderboards`);

    let description = spcs.map((el: any, i) => {
        let member = members.get(el.id),
            pct = +((el.scrobbles * 100) / serverPlays).toFixed(2),
            old = oldcall?.data.members.find(member => member?.id == el.id);

        newcall.data.members.push({ id: el.id, rank: i + 1, scrobbles: el.scrobbles, pct });
        return `${i == 0 ? '👑' : `#${i + 1};`}${
            oldcall && !old ? ' (new)' : change(old?.rank, i + 1, null, false, true)
        } [${member?.displayName}](https://www.last.fm/user/${usernames[el.id]}) - **${el.scrobbles}${change(
            old?.scrobbles,
            el.scrobbles
        )}** play${el.scrobbles != 1 ? 's' : ''}, **${pct}%${change(old?.pct, pct, 0.1, true)}** server scrobbles`;
    });

    return {
        call: newcall,
        embeds: [
            new MessageEmbed({
                title: `${process.env.NODE_ENV ? '' : 'local: '}Scrobbles leaderboard ${
                    time == 'overall' ? 'overall' : `for the past ${time}`
                }`,
                color: 0xbf2424,
                footer: {
                    text: 'Requested by ' + author.displayName,
                    iconURL: author.user.displayAvatarURL(),
                },
                description: description
                    .concat(`\nTotal server scrobbles: ${serverPlays}${change(oldcall?.data.serverPlays, serverPlays)}`)
                    .join('\n'),
            }),
        ],
    };
}

export async function scrobblesPerTime(user: string, time: string, useNReturnId: boolean): Promise<any> {
    let scrobbles = +(
        await request('user.getrecenttracks', {
            user: useNReturnId ? usernames[user] : user,
            from:
                time == 'overall'
                    ? null
                    : /^[0-9]/g.test(time)
                    ? moment()
                          .tz('America/New_York')
                          .subtract(
                              +time.charAt(0),
                              TimePeriods[time].slice(1) as moment.unitOfTime.DurationConstructor
                          )
                          .unix()
                    : moment()
                          .tz('America/New_York')
                          .subtract(1, time as moment.unitOfTime.DurationConstructor)
                          .unix(),
        })
    ).data.recenttracks['@attr'].total;
    return useNReturnId ? { scrobbles, id: user } : scrobbles;
}
