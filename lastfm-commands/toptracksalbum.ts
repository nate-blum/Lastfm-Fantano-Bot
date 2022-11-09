import { Message, GuildMember, MessageEmbed } from 'discord.js';
import * as usernames from '../usernames.json';
import { request, spotifyRequest } from '../lastfm-utils/api';
import { change, normalizeString, truncate } from '../lastfm-utils/stringOps';
import { getSingleMember } from '../lastfm-utils/members';
import { Spotify } from '../lastfm-utils/spotifyTypes';
import { sendToChannel } from '../lastfm-utils/logger';
import { registerCommand, registerSlashCommand } from './commandregistry';
import { registerHelp } from './help';
import { CommandCall, Interaction, SlashReturn } from '../lastfm-models/model';
import { mongoInst } from '../lastfm-utils/mongo';
import { findItemByName, getInteractionOpt } from '../lastfm-utils/find';
import { client } from '../lastfm';
const cmdName = 'tta';

export function registerTopTracksAlbumCommand() {
    registerCommand(['tta'], cmdName, callTTA);

    registerSlashCommand(cmdName, true, callTTASlash);

    registerHelp({
        name: 'tta',
        mention: true,
        number: true,
        album: true,
        otherText: "Returns you or your mention's top <number> tracks for the album.",
    });
}

async function callTTA(msg: Message): Promise<CommandCall> {
    let argsArr = msg.content
        .toLowerCase()
        .split(' ')
        .filter(arg => !arg.includes('<@') && !arg.startsWith('!'));
    let member: GuildMember = getSingleMember(msg);
    if (!member) return;
    let limit: number = +argsArr.find(arg => !isNaN(+arg)) || 10;
    let albumName =
        argsArr
            .filter(arg => isNaN(+arg) || arg.startsWith('"'))
            .join(' ')
            .replace(/\"|“|”/g, '') || null;

    let { call, message, embeds } = await tta(member, msg.member, limit, albumName);

    embeds?.forEach(embed => msg.channel.send({ embed }));
    message && sendToChannel(msg, message);
    return call;
}

async function callTTASlash(int: Interaction): Promise<SlashReturn> {
    let guild = client.guilds.cache.get(int.guild_id);
    return tta(
        await guild.members.fetch(getInteractionOpt(int, 'mention') || int.member.user.id),
        await guild.members.fetch(int.member.user.id),
        getInteractionOpt(int, 'length') || 10,
        getInteractionOpt(int, 'album-name') || null
    );
}

async function tta(member: GuildMember, author: GuildMember, limit: number, albumName?: string): Promise<SlashReturn> {
    if (!albumName)
        albumName = (await request('user.getrecenttracks', { limit: 1, user: usernames[member.id] })).data.recenttracks
            .track[0].album['#text'];

    let albumData = await findItemByName(albumName, 'album', member.id);
    if (!albumData) return { message: `\`${member.displayName}\` hasn't played "${albumName}" before.` };
    let requestData = await spotifyRequest('v1/search', { q: albumData.artist.name, type: 'artist', limit: 5 });

    let artistId = requestData.data.artists.items.find((artist: Spotify.Items.Simplified.Artist) =>
        artist.name.split(' ').every(word => albumData.artist.name.includes(word))
    ).id;

    let albumId = (
        await spotifyRequest(`v1/artists/${artistId}/albums`, {
            include_groups: 'album,single,compilation',
        })
    ).data.items.find((album: Spotify.Items.Simplified.Album) =>
        album.name
            .toLowerCase()
            .split(' ')
            .every(word => albumData.name.toLowerCase().includes(word))
    )?.id;
    if (!albumId) return { message: `${albumName} could not be found.` };

    let albumTracks: Spotify.Items.Track[] = (await spotifyRequest(`v1/albums/${albumId}/tracks`, { limit: 50 })).data
        .items;

    let embed: MessageEmbed = new MessageEmbed({
        color: 0xbf2424,
        url: `https://www.last.fm/user/${usernames[member.id]}`,
    });

    let data: any = (
        await Promise.all(
            albumTracks.map(track =>
                request('track.getinfo', {
                    track: track.name,
                    artist: track.artists[0].name,
                    username: usernames[member.id],
                })
            )
        )
    ).reduce((prev: any[], curr) => {
        +curr.data.track?.userplaycount > 0 && prev.push(curr.data.track);
        return prev;
    }, []);
    if (data.every(track => +track.userplaycount == 0))
        data = await Promise.all(albumTracks.map(track => findItemByName(track.name, 'track', member.id)));

    let playcount = data.reduce((prev, curr) => prev + +(curr.userplaycount || curr.playcount), 0);

    //identifier: member.id/limit/album
    //data: [{rank, playcount, pct, name}]

    let newcall: CommandCall = {
            identifier: `${member.id}/${normalizeString(albumData.name)}/${normalizeString(albumData.artist.name)}`,
            data: {
                items: [],
            },
        },
        oldcall: CommandCall = await mongoInst.readCall(
            cmdName,
            `${member.id}/${normalizeString(albumData.name)}/${normalizeString(albumData.artist.name)}`
        );

    if (oldcall?.data.items.includes(null)) oldcall.data.items = oldcall?.data.items.filter(item => item);

    data = data
        .sort((a, b) => +(b.userplaycount || b.playcount) - +(a.userplaycount || a.playcount))
        .map((el, i) => {
            if (!el) return;
            let old = oldcall?.data.items.find(item => item.name == el.name),
                pc = el.userplaycount || el.playcount,
                pct = +((pc * 100) / playcount).toFixed(2);
            newcall.data.items.push({ rank: i + 1, playcount: pc, pct, name: el.name });
            return {
                name: `#${i + 1}${
                    oldcall && old?.limit >= limit && !old ? ' (new)' : change(old?.rank, i + 1, null, false, true)
                }; played ${pc}${change(old?.playcount, pc)} time${pc > 1 ? 's' : ''}, ${pct}%${change(
                    old?.pct,
                    pct,
                    0.1,
                    true
                )} for this album`,
                value: `[${truncate(el.name, 50)}](${el.url})`,
                inline: false,
            };
        })
        .splice(0, limit);
    embed.title = `${process.env.NODE_ENV ? '' : 'local: '}${member.displayName}'s top ${
        data.length
    } tracks for album "${albumData.name}"`;

    newcall.data.items = newcall.data.items.concat(oldcall?.data.items?.slice(limit));

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
        embed.setFooter('Requested by ' + member.displayName, author.user.displayAvatarURL());
        embeds.push(embed);
    }

    return {
        call: newcall,
        embeds,
    };
}
