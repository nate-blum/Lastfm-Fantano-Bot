import { Message, GuildMember, MessageEmbed } from 'discord.js';
import * as usernames from '../usernames.json';
import { request } from '../lastfm-utils/api';
import { CommandCall, Interaction, SlashReturn, TimePeriods } from '../lastfm-models/model';
import { change, normalizeString, truncate } from '../lastfm-utils/stringOps';
import { getSingleMember } from '../lastfm-utils/members';
import { registerCommand, registerSlashCommand } from './commandregistry';
import { registerHelp } from './help';
import { mongoInst } from '../lastfm-utils/mongo';
import { sendToChannel } from '../lastfm-utils/logger';
import { findItemByName, getInteractionOpt } from '../lastfm-utils/find';
import { client } from '../lastfm';
const cmdName = 'top';

export function registerTopArtistCommand() {
    registerCommand(['toptracks', 'tt'], cmdName, callTopArtist.bind({ type: 'track' }));
    registerCommand(['topalbums', 'ta'], cmdName, callTopArtist.bind({ type: 'album' }));

    registerSlashCommand(cmdName, true, callTopArtistSlash);

    [
        {
            name: 'toptracks',
            aliases: ['tt'],
        },
        {
            name: 'topalbums',
            aliases: ['ta'],
        },
    ].forEach(cmd =>
        registerHelp({
            ...cmd,
            number: true,
            time: true,
            mention: true,
            artist: true,
            otherText:
                "Time defaults to overall. Retrieve a list of you or your mention's top <number> " +
                cmd.name.replace('top', '') +
                ' for the artist and time period.',
        })
    );
}

//identifier: member.id/limit/time/artist
//data: [{playcount, pct, rank, name}]

async function callTopArtist(msg: Message): Promise<CommandCall> {
    let argsArr = msg.content
        .toLowerCase()
        .split(' ')
        .filter(arg => !arg.includes('<@'));
    let { call, embeds, message } = await topartist(
        getSingleMember(msg),
        msg.member,
        +argsArr.find(arg => !isNaN(+arg)) || 10,
        TimePeriods[argsArr.find(arg => TimePeriods[arg])] || 'overall',
        this.type,
        argsArr
            .filter(arg => isNaN(+arg) && !arg.startsWith('!') && !TimePeriods[arg])
            .join(' ')
            .replace(/\"|“|”/g, '')
    );
    embeds?.forEach(embed => msg.channel.send({ embed }));
    message && sendToChannel(msg, message);
    return call;
}

async function callTopArtistSlash(int: Interaction): Promise<SlashReturn> {
    let guild = client.guilds.cache.get(int.guild_id);
    return topartist(
        await guild.members.fetch(getInteractionOpt(int, 'mention') || int.member.user.id),
        await guild.members.fetch(int.member.user.id),
        getInteractionOpt(int, 'length') || 10,
        getInteractionOpt(int, 'time') || 'overall',
        getInteractionOpt(int, 'item-type'),
        getInteractionOpt(int, 'artist-name')
    );
}

async function topartist(
    member: GuildMember,
    author: GuildMember,
    limit: number,
    time: string,
    type: string,
    artistName?: string
): Promise<SlashReturn> {
    let artist;
    let playcount;
    if (artistName) {
        let data = await findItemByName(artistName, 'artist', member.id);
        if (!data) return { message: 'Could not find this artist.' };
        artist = data.name;
        playcount = +data.playcount;
    } else {
        artist = (await request('user.getrecenttracks', { limit: 1, user: usernames[member.id] })).data.recenttracks
            .track[0].artist['#text'];
        playcount = +(await request('artist.getinfo', { artist, username: usernames[member.id] })).data.artist.stats
            .userplaycount;
    }

    let embed: MessageEmbed = new MessageEmbed({
        color: 0xbf2424,
        url: `https://www.last.fm/user/${usernames[member.id]}`,
    });

    let newcall: CommandCall = {
            identifier: `${member.id}/${TimePeriods[time]}/${normalizeString(artist)}/${type}`,
            data: {
                limit,
                items: [],
            },
        },
        oldcall: CommandCall = await mongoInst.readCall(
            cmdName,
            `${member.id}/${TimePeriods[time]}/${normalizeString(artist)}/${type}`
        );

    let data = await filterTracksOrAlbumsByArtistName(artist, type, usernames[member.id], time);

    if (playcount == 0 && data.length > 0)
        return { message: 'Please check your artist name for special characters that you may have missed.' };
    else if (data.length == 0) return { message: "You haven't listened to this artist." };

    data = data
        .map((el, i) => {
            let pct = +((+el.playcount * 100) / playcount).toFixed(2);
            newcall.data.items.push({ playcount: +el.playcount, pct, rank: i + 1, name: el.name });
            let old = oldcall?.data.items.find(item => item.name == el.name);
            return {
                name: `#${i + 1}${
                    oldcall && oldcall.data.limit >= limit && !old
                        ? ' (new)'
                        : change(old?.rank, i + 1, null, false, true)
                }; played ${el.playcount}${change(old?.playcount, +el.playcount)} time${
                    el.playcount > 1 ? 's' : ''
                }, ${pct}%${change(old?.pct, pct, 0.1, true)} for this artist`,
                value: `[${truncate(el.name, 50)}](${el.url})`,
                inline: false,
            };
        })
        .splice(0, limit);
    embed.title = `${process.env.NODE_ENV ? '' : 'local: '}${member.displayName}'s top ${data.length} ${type}s ${
        time == 'overall'
            ? 'overall'
            : `over the past ${time.length == 2 ? TimePeriods[time] : time}${/^[0-9]/.test(time) ? 's' : ''}`
    } for artist "${artist}"`;

    newcall.data.items = newcall.data.items.slice(0, limit).concat(oldcall?.data.items.slice(limit) || []);

    let embeds: MessageEmbed[] = [];
    if (data.length > 24) {
        for (let i = 0; i < Math.ceil(data.length / 24); i++) {
            if (i > 0) embed.setTitle('');
            if (i == Math.ceil(data.length / 24) - 1)
                embed.setFooter('Requested by ' + author.displayName, author.user.displayAvatarURL());
            embed.fields = [];

            for (let j = 0; j < 24; j++) {
                data[24 * i + j] && embed.fields.push(Object.assign(data[24 * i + j], { inline: true }));
            }

            embeds.push(Object.assign({}, embed));
        }
    } else {
        embed.fields = data;
        embed.setFooter('Requested by ' + author.displayName, author.user.displayAvatarURL());
        embeds.push(embed);
    }

    return {
        call: newcall,
        embeds,
    };
}

async function filterTracksOrAlbumsByArtistName(artist: string, type: string, user: string, timeperiod: string) {
    let allTracks = (await request(`user.gettop${type}s`, { limit: 999, period: timeperiod, user: user })).data;
    if (+allTracks[`top${type}s`]['@attr'].page < +allTracks[`top${type}s`]['@attr'].totalPages) {
        allTracks[`top${type}s`][type] = allTracks[`top${type}s`][type].concat(
            [].concat(
                ...(await Promise.all(
                    Array(+allTracks[`top${type}s`]['@attr'].totalPages - 1)
                        .fill('')
                        .map((v, i) => {
                            return new Promise(async resolve =>
                                resolve(
                                    (
                                        await request(`user.gettop${type}s`, {
                                            limit: 999,
                                            period: timeperiod,
                                            user: user,
                                            page: i + 2,
                                        })
                                    ).data[`top${type}s`][type]
                                )
                            );
                        })
                ))
            )
        );
    }
    return allTracks[`top${type}s`][type].filter(item => {
        if (normalizeString(artist) == 'travis scott')
            return normalizeString(item.artist.name) == normalizeString(artist);
        return item.artist.name == artist;
    });
}
