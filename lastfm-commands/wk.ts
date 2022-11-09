import { Collection, GuildMember, Message, MessageEmbed } from 'discord.js';
import { request } from '../lastfm-utils/api';
import * as usernames from '../usernames.json';
import { getSingleMember } from '../lastfm-utils/members';
import { registerCommand, registerSlashCommand } from './commandregistry';
import { registerHelp } from './help';
import { CommandCall, Interaction, SlashReturn } from '../lastfm-models/model';
import { mongoInst } from '../lastfm-utils/mongo';
import { change, normalizeString } from '../lastfm-utils/stringOps';
import { sendToChannel } from '../lastfm-utils/logger';
import { getInteractionOpt } from '../lastfm-utils/find';
import { client } from '../lastfm';
const cmdName = 'wk';

export function registerWhoKnowsCommand() {
    registerCommand(['whoknowsartist', 'wka', 'wk'], cmdName, callWK.bind({ type: 'artist' }));
    registerCommand(['whoknowsalbum', 'wkal'], cmdName, callWK.bind({ type: 'album' }));
    registerCommand(['whoknowstrack', 'wkt'], cmdName, callWK.bind({ type: 'track' }));

    registerSlashCommand(cmdName, true, callWKSlash);

    [
        {
            name: 'whoknowsartist',
            aliases: ['wka', 'wk'],
            artist: true,
        },
        {
            name: 'whoknowstrack',
            aliases: ['wkt'],
            track: true,
        },
        {
            name: 'whoknowsalbum',
            aliases: ['wkal'],
            album: true,
        },
    ].forEach(cmd =>
        registerHelp({
            ...cmd,
            otherText: `Rankings of who has listened to the ${cmd.name.replace(
                'whoknows',
                ''
            )} the most and how much, plus the overall server listens.`,
        })
    );
}

async function callWK(msg: Message): Promise<CommandCall> {
    let { call, embeds, message } = await wk(
        getSingleMember(msg),
        msg.member,
        this.type,
        await msg.guild.members.fetch(),
        msg.guild.id,
        msg.content
            .split(' ')
            .slice(1)
            .filter(w => !w.startsWith('<@!'))
            .join(' ') || null
    );

    embeds && msg.channel.send({ embed: embeds[0] });
    message && sendToChannel(msg, message);

    return call;
}

async function callWKSlash(int: Interaction): Promise<SlashReturn> {
    let guild = client.guilds.cache.get(int.guild_id);
    return wk(
        await guild.members.fetch(getInteractionOpt(int, 'mention') || int.member.user.id),
        await guild.members.fetch(int.member.user.id),
        getInteractionOpt(int, 'item-type') || 'artist',
        await guild.members.fetch(),
        int.guild_id,
        getInteractionOpt(int, 'item-name') || null
    );
}

async function wk(
    member: GuildMember,
    author: GuildMember,
    type: string,
    members: Collection<string, GuildMember>,
    guild_id: string,
    itemName?: string
): Promise<SlashReturn> {
    let spcs, artistName;

    if (itemName) {
        let items = (await request(`${type}.search`, { [type]: itemName, limit: 2 })).data.results[`${type}matches`][
            type
        ];
        let count = 0;
        for (let i = 0; i < items.length; i++) {
            let _spcs = await sortedListens(items[i], members, type, true);
            if (_spcs.reduce((a, b: any) => a + b.playcount, 0) > count) {
                itemName = items[i].name;
                type != 'artist' && (artistName = items[i].artist);
                spcs = _spcs;
                count = _spcs.reduce((a, b: any) => a + b.playcount, 0);
            }
        }
    } else {
        let item = (await request('user.getrecenttracks', { limit: 1, user: usernames[member.id] })).data.recenttracks
            .track[0];
        spcs = await sortedListens(item, members, type, false);
        itemName = type == 'track' ? item.name : item[type]['#text'];
        type != 'artist' && (artistName = item.artist['#text']);
    }
    let serverPlays = (spcs?.reduce((a: number, b: any) => a + b.playcount, 0) as number) || 0;
    if (serverPlays == 0)
        return {
            message: `No one in this server knows "${itemName}".`,
        };

    //identifier: guild.id/item.name/type
    // data: {serverplays, places: [{member.id, rank, playcount, pct}]}

    let newcall: CommandCall = {
            identifier: `${guild_id}/${normalizeString(itemName)}/${type}`,
            data: {
                serverPlays,
                members: [],
            },
        },
        oldcall = await mongoInst.readCall(cmdName, `${guild_id}/${normalizeString(itemName)}/${type}`);

    let description = spcs.map((el: any, i) => {
        let user = members.get(el.id),
            pct = +((el.playcount * 100) / serverPlays).toFixed(2),
            old = oldcall?.data.members.find(place => place.id == el.id);
        newcall.data.members.push({ id: el.id, rank: i + 1, playcount: el.playcount, pct });
        return `${i == 0 ? '👑' : `#${i + 1};`}${
            oldcall && !old ? ' (new)' : change(old?.rank, i + 1, null, false, true)
        } [${user?.displayName}](https://www.last.fm/user/${usernames[el.id]}) - **${el.playcount}${change(
            old?.playcount,
            el.playcount
        )}** play${+el.playcount != 1 ? 's' : ''}, **${pct}%${change(old?.pct, pct, 0.1, true)}** server plays`;
    });

    return {
        call: newcall,
        embeds: [
            new MessageEmbed({
                title: `${process.env.NODE_ENV ? '' : 'local: '}Who knows "${itemName}"${
                    type != 'artist' ? ` by "${artistName}"` : ''
                }`,
                color: 0xbf2424,
                footer: {
                    text: 'Requested by ' + author.displayName,
                    iconURL: author.user.displayAvatarURL(),
                },
                description: description
                    .concat(`\nTotal server plays: ${serverPlays}${change(oldcall?.data.serverPlays, serverPlays)}`)
                    .join('\n'),
            }),
        ],
    };
}

async function sortedListens(item: any, users: Collection<string, GuildMember>, type: string, search: boolean) {
    return (
        await Promise.all(
            Object.keys(usernames)
                .filter(id => users.has(id))
                .map(id =>
                    request(
                        `${type}.getInfo`,
                        {
                            artist: search ? item[type == 'artist' ? 'name' : 'artist'] : item.artist['#text'],
                            album: search ? (type == 'album' ? item.name : '') : item.album['#text'],
                            track: item.name,
                            username: usernames[id],
                        },
                        0,
                        { userId: id }
                    )
                )
        )
    )
        .reduce((prev, el: any) => {
            +(el.data[type].stats?.userplaycount || el.data[type].userplaycount) > 0 &&
                prev.push({
                    playcount: +(el.data[type].stats?.userplaycount || el.data[type].userplaycount),
                    id: el.userId,
                });
            return prev;
        }, [])
        .sort((a: any, b: any) => b.playcount - a.playcount);
}
