import * as usernames from '../usernames.json';
import { request } from '../lastfm-utils/api';
import { GuildMember, Message, MessageEmbed } from 'discord.js';
import { normalizeString } from '../lastfm-utils/stringOps';
import { registerCommand, registerSlashCommand } from './commandregistry';
import { registerHelp } from './help';
import { CommandCall, Interaction, SlashReturn } from '../lastfm-models/model';
import { client } from '../lastfm';
import { getInteractionOpt } from '../lastfm-utils/find';
import { sendToChannel } from '../lastfm-utils/logger';

export function registerRecsCommand() {
    registerCommand(['recs', 'rec', 'r'], null, callRecs);
    registerSlashCommand('recs', false, callRecsSlash);
    registerHelp({
        name: 'recs',
        aliases: ['rec', 'r'],
        artist: true,
        otherText:
            'If artist is specified, will retrieve 10 recommendations based on this artist. If not, it will retrieve 10 recommendations based on your top 100 most listened to artists.',
    });
}

async function callRecs(msg: Message): Promise<CommandCall> {
    let { embeds, message } = await recs(msg.member, msg.content.split(' ').slice(1).join(' '));
    message && sendToChannel(msg, message);
    embeds && msg.channel.send({ embed: embeds[0] });
    return null;
}

async function callRecsSlash(int: Interaction): Promise<SlashReturn> {
    let guild = client.guilds.cache.get(int.guild_id);
    return recs(await guild.members.fetch(int.member.user.id), getInteractionOpt(int, 'artist-name'));
}

async function recs(author: GuildMember, artistName?: string): Promise<SlashReturn> {
    if (!artistName) {
        var originals = getRandom(
            (
                await request('user.gettopartists', {
                    user: usernames[author.id],
                    period: 'overall',
                    limit: 100,
                })
            ).data.topartists.artist,
            10
        );

        let embed: MessageEmbed = new MessageEmbed({
            title: `${process.env.NODE_ENV ? '' : 'local: '}Artist recommendations based on artists you've listened to`,
            color: 0xbf2424,
            url: `https://www.last.fm/user/${usernames[author.id]}`,
            footer: {
                text: 'Requested by ' + author.displayName,
                iconURL: author.user.displayAvatarURL(),
            },
        });

        var recsList = [];

        var arrRecs = await Promise.all(
            originals.map(original =>
                request('artist.getsimilar', {
                    limit: 10,
                    artist: original.name,
                })
            )
        );

        arrRecs.forEach(rec => {
            let urlSplit = rec.config.url.split('=');
            rec.data.similarartists.artist.forEach(rec2 => {
                var foundRec = recsList.find(item => normalizeString(item.name) == normalizeString(rec2.name));
                if (foundRec && !(urlSplit[urlSplit.length - 1] in foundRec.original))
                    foundRec.original.push(urlSplit[urlSplit.length - 1]);
                else recsList.push(Object.assign(rec2, { original: [urlSplit[urlSplit.length - 1]] }));
            });
        });

        var playcounts = await Promise.all(
            recsList
                .filter(rec => !originals.find(orig => normalizeString(rec.name) == normalizeString(orig.name)))
                .map(rec =>
                    request('artist.getinfo', {
                        user: usernames[author.id],
                        artist: rec.name,
                    })
                )
        );

        embed.setDescription(
            recsList
                .filter(rec => {
                    let playcount = playcounts.find(playcount => {
                        return !playcount.data.error && playcount.data.artist.name == rec.name;
                    });
                    return playcount ? playcount.data.artist.stats.userplaycount == 0 : false;
                })
                .sort((recA, recB) => {
                    if (recA.original.length == recB.original.length)
                        return parseFloat(recB.match) - parseFloat(recA.match);
                    else return recB.original.length - recA.original.length;
                })
                .slice(0, 10)
                .map(rec => `\`${(parseFloat(rec.match) * 100).toFixed(1)}%\` match\n[**${rec.name}**](${rec.url})`)
                .join('\n\n')
        );

        return { embeds: [embed] };
    } else {
        let embed: MessageEmbed = new MessageEmbed()
            .setTitle(`Artist recommendations based on ${artistName}`)
            .setColor(0xbf2424)
            .setURL(`https://www.last.fm/artist/${encodeURIComponent(artistName)}`)
            .setFooter('Requested by ' + author.displayName, author.user.displayAvatarURL());

        var recs = (
            await request('artist.getsimilar', {
                limit: 50,
                artist: artistName,
            })
        ).data;

        if (recs.error) return { message: recs.message };

        let recommendations = recs.similarartists.artist;

        var playcountsB: any = await Promise.all(
            recommendations.map(rec =>
                request('artist.getinfo', {
                    user: usernames[author.id],
                    artist: rec.name,
                })
            )
        );

        recommendations = getRandom(
            recommendations.filter(rec => {
                let playcount = playcountsB.find(
                    playcount => !playcount.data.error && playcount.data.artist.name == rec.name
                );
                return playcount ? playcount.data.artist.stats.userplaycount == 0 : false;
            }),
            10
        ).sort((recA, recB) => parseFloat(recB.match) - parseFloat(recA.match));

        if (!recommendations[0])
            return {
                message: `No recommendations could be found for artist '${artistName}'.`,
            };
        embed.fields = recommendations.map(rec => {
            return {
                name: `${(rec.match * 100).toFixed(1)}% match`,
                value: `[${rec.name}](${rec.url})`,
                inline: false,
            };
        });

        return { embeds: [embed] };
    }
}

function getRandom(arr, n) {
    var result = new Array(n),
        len = arr.length,
        taken = new Array(len);
    while (n--) {
        var x = Math.floor(Math.random() * len);
        result[n] = arr[x in taken ? taken[x] : x];
        taken[x] = --len in taken ? taken[len] : len;
    }
    return result;
}
