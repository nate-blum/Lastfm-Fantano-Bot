import * as usernames from '../usernames.json';
import { request } from '../lastfm-utils/api';
import { Message, MessageEmbed, GuildMember } from 'discord.js';
import { AxiosResponse } from 'axios';
import { registerCommand, registerSlashCommand } from './commandregistry';
import { registerHelp } from './help';
import { CommandCall, Interaction, SlashReturn } from '../lastfm-models/model';
import { sendToChannel } from '../lastfm-utils/logger';
import { client } from '../lastfm';
import { getInteractionOpt } from '../lastfm-utils/find';

export function registerCompareCommand() {
    registerCommand(['compare', 'c'], null, callCompare);
    registerSlashCommand('compare', false, callCompareSlash);

    registerHelp({
        name: 'compare',
        aliases: ['c'],
        mention: true,
        otherText: "Compares you and your mention's 25 closest artist listener counts that are above 10.",
    });
}

async function callCompare(msg: Message): Promise<CommandCall> {
    let mention: GuildMember, author: GuildMember;
    if (msg.mentions.users.array().length > 0) {
        if (usernames[msg.mentions.users.array()[0].id]) mention = msg.mentions.members.array()[0];
        else sendToChannel(msg, "I don't have a username stored for your mention.");
    } else sendToChannel(msg, 'Please include a second person to compare against.');

    if (usernames[msg.author.id]) author = msg.member;
    else sendToChannel(msg, "I don't have a username stored for you.");

    let { embeds } = await compare(author, mention);
    embeds && msg.channel.send({ embed: embeds[0] });

    return;
}

async function callCompareSlash(int: Interaction): Promise<SlashReturn> {
    let guild = client.guilds.cache.get(int.guild_id);
    return compare(
        await guild.members.fetch(int.member.user.id),
        await guild.members.fetch(getInteractionOpt(int, 'mention'))
    );
}

async function compare(author: GuildMember, mention: GuildMember): Promise<SlashReturn> {
    let embed: MessageEmbed = new MessageEmbed({
        title: `${process.env.NODE_ENV ? '' : 'local: '}Comparison of shared artists between ${
            author.displayName
        } and ${mention.displayName}`,
        description: 'The author will be on the left, and the mentioned user will be on the right.',
        color: 0xbf2424,
        footer: {
            text: 'Requested by ' + author.displayName,
            iconURL: author.user.displayAvatarURL(),
        },
    });

    let topArtists = (
        await Promise.all(
            [mention, author].map(member =>
                request('user.gettopartists', {
                    user: usernames[member.id],
                    limit: 500,
                    period: 'overall',
                })
            )
        )
    ).map((res: AxiosResponse) => res.data.topartists);

    let sharedArtists = topArtists[0].artist.filter(artist => {
        return topArtists[1].artist.find(artist2 => artist.name == artist2.name);
    });

    function relDiff(a, b) {
        return 100 * Math.abs((a - b) / ((a + b) / 2));
    }

    embed.fields = sharedArtists
        .sort((a, b) => {
            let otherPlaycounts = [a, b].map(
                artist => topArtists[1].artist.find(artist2 => artist.name == artist2.name).playcount
            );
            return relDiff(a.playcount, otherPlaycounts[0]) - relDiff(b.playcount, otherPlaycounts[1]);
        })
        .filter(artist => {
            let otherPlaycount = topArtists[1].artist.find(artist2 => artist.name == artist2.name).playcount;
            let diff = +artist.playcount - +otherPlaycount;
            return diff != 0 && otherPlaycount >= 10 && artist.playcount >= 10;
        })
        .map(artist => {
            let otherPlaycount = topArtists[1].artist.find(artist2 => artist.name == artist2.name).playcount;
            return {
                name: artist.name,
                value: `\`${otherPlaycount}\` play${otherPlaycount > 1 ? 's' : ''} - \`${artist.playcount}\` play${
                    artist.playcount > 1 ? 's' : ''
                }`,
                inline: true,
            };
        });

    return { embeds: [embed] };
}
