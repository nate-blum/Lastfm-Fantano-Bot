import * as usernames from '../usernames.json';
import { request } from '../lastfm-utils/api';
import { Message, GuildMember, MessageEmbed } from 'discord.js';
import { CommandCall, Interaction, SlashReturn, TimePeriods } from '../lastfm-models/model';
import { change, rangeNameAutocorrect, truncate } from '../lastfm-utils/stringOps';
import { getSingleMember } from '../lastfm-utils/members';
import { scrobblesPerTime } from './scrobbles';
import { registerCommand, registerSlashCommand } from './commandregistry';
import { registerHelp } from './help';
import { mongoInst } from '../lastfm-utils/mongo';
import { client } from '../lastfm';
import { getInteractionOpt } from '../lastfm-utils/find';
const cmdName = 'list';

export function registerListCommands() {
    registerCommand(['artists', 'ars', 'as'], cmdName, callList.bind({ type: 'artists' }));
    registerCommand(['tracks', 'ts'], cmdName, callList.bind({ type: 'tracks' }));
    registerCommand(['albums', 'als'], cmdName, callList.bind({ type: 'albums' }));

    registerSlashCommand(cmdName, true, callListSlash);

    [
        {
            name: 'artists',
            aliases: ['ars', 'as'],
        },
        {
            name: 'tracks',
            aliases: ['ts'],
        },
        {
            name: 'albums',
            aliases: ['als'],
        },
    ].forEach(cmd =>
        registerHelp({
            ...cmd,
            number: true,
            time: true,
            mention: true,
            otherText:
                "Time defaults to week. Retrieve a list of you or your mention's top <number> " +
                cmd.name +
                ' for the time period.',
        })
    );
}

async function callList(msg: Message): Promise<CommandCall> {
    let argsArr = msg.content.toLowerCase().split(' ');
    let [limit, time] = [
        +argsArr.find(arg => !isNaN(+arg)) || 10,
        rangeNameAutocorrect(
            argsArr.find(arg => isNaN(+arg) && !arg.startsWith('!') && !arg.startsWith('<@')),
            'week'
        ),
    ];

    let member: GuildMember = getSingleMember(msg);
    if (!member) return;

    let { call, embeds } = await list(member, msg.member, limit, time, this.type);

    embeds && embeds.forEach(embed => msg.channel.send({ embed }));
    return call;
}

async function callListSlash(int: Interaction): Promise<SlashReturn> {
    let guild = client.guilds.cache.get(int.guild_id);
    return list(
        await guild.members.fetch(getInteractionOpt(int, 'mention') || int.member.user.id),
        await guild.members.fetch(int.member.user.id),
        getInteractionOpt(int, 'length') || 10,
        getInteractionOpt(int, 'time') || 'week',
        getInteractionOpt(int, 'item-type')
    );
}

async function list(
    member: GuildMember,
    author: GuildMember,
    limit: number,
    time: string,
    type: string
): Promise<SlashReturn> {
    let embed: MessageEmbed = new MessageEmbed({
        color: 0xbf2424,
        url: `https://www.last.fm/user/${usernames[member.id]}`,
    });

    var res = (
        await request('user.gettop' + type, {
            user: usernames[member.id],
            period: TimePeriods[time],
            limit: limit,
        })
    ).data['top' + type];

    let totalScrobbles = +(await scrobblesPerTime(usernames[member.id], time as string, false)),
        call: CommandCall = await mongoInst.readCall(cmdName, `${member.id}/${type}/${TimePeriods[time]}`);

    let data = res[type.substring(0, type.length - 1)].map((el, i) => {
        let pct = +((el.playcount * 100) / totalScrobbles).toFixed(2),
            item = call?.data.items.find(_item => _item.name == el.name);
        return {
            name: `#${i + 1}${
                call && call.data.limit >= limit && !item ? ' (new)' : change(item?.rank, i + 1, null, false, true)
            }; played ${el.playcount}${change(item?.playcount, +el.playcount)} time${
                el.playcount > 1 ? 's' : ''
            }, ${pct}%${change(item?.pct, pct, 0.1, true)} ${
                time == 'overall'
                    ? 'overall'
                    : /^[0-9]/g.test(time)
                    ? `over the past ${time.length == 2 ? TimePeriods[time] : time}${/^[0-9]/.test(time) ? 's' : ''}`
                    : 'this ' + time
            }`,
            value:
                type != 'artists'
                    ? `[${truncate(el.name, 25)} by ${truncate(el.artist.name, 25)}](${el.url})`
                    : `[${truncate(el.name, 25)}](${el.url})`,
            inline: false,
        };
    });

    embed.title = `${process.env.NODE_ENV ? '' : 'local: '}${member.displayName}'s top ${data.length} ${type} ${
        time == 'overall'
            ? 'overall'
            : `over the past ${time.length == 2 ? TimePeriods[time] : time}${/^[0-9]/.test(time) ? 's' : ''}`
    }`;

    let embeds: MessageEmbed[] = [];
    if (data.length > 25) {
        for (let i = 0; i < Math.ceil(data.length / 25); i++) {
            if (i > 0) embed.setTitle('');
            if (i == Math.ceil(data.length / 25) - 1)
                embed.setFooter('Requested by ' + author.displayName, author.user.displayAvatarURL());
            embed.fields = [];

            for (let j = 0; j < 25; j++) {
                data[25 * i + j] && embed.fields.push(Object.assign(data[25 * i + j], { inline: true }));
            }

            embeds.push(Object.assign({}, embed));
        }
    } else {
        embed.fields = data;
        embed.setFooter('Requested by ' + author.displayName, author.user.displayAvatarURL());
        embeds.push(embed);
    }

    //identifier: member id/type/time
    //data: [{item.name, playcount, pct, rank}]

    return {
        call: {
            identifier: `${member.id}/${type}/${TimePeriods[time]}`,
            data: {
                limit,
                items: res[type.substring(0, type.length - 1)]
                    .map(item => ({
                        name: item.name,
                        playcount: +item.playcount,
                        pct: +((item.playcount * 100) / totalScrobbles).toFixed(2),
                        rank: +item['@attr'].rank,
                    }))
                    .concat(call ? (call.data.items as {}[]).slice(limit) : []),
            },
        },
        embeds,
    };
}
