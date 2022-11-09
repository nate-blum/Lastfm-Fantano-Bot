import axios from 'axios';
import { Client, Message, MessageEmbed, GuildMember, WSEventType } from 'discord.js';
import { normalizeString } from './lastfm-utils/stringOps';
import { request } from './lastfm-utils/api';
import * as usernames from './usernames.json';
import { Interaction, SlashReturn } from './lastfm-models/model';
import { getInteractionOpt } from './lastfm-utils/find';
import { getSingleMember } from './lastfm-utils/members';
var client = new Client();
var discToken = '*sensitive data*';
var youtubeKey = '*sensitive data*';

client.on('ready', () => {
    client.user.setActivity(' for !scores', { type: 'WATCHING' });
});

client.on('message', async (msg: Message) => {
    if (msg.content.startsWith('!scores')) callScores(msg);
});

client.ws.on('INTERACTION_CREATE' as WSEventType, async (interaction: Interaction) => {
    if (
        (interaction.guild_id != '*sensitive data*' && !process.env.NODE_ENV) ||
        (interaction.channel_id == '*sensitive data*' && process.env.NODE_ENV)
    )
        return;
    (client as any).api.interactions(interaction.id, interaction.token).callback.post({
        data: {
            type: 5,
        },
    });
    let response = await callScoresSlash(interaction);
    (client as any).api
        .webhooks(interaction.application_id, interaction.token)
        .messages('@original')
        .patch({
            data: {
                embeds: response.embeds,
            },
        });
});

async function callScores(msg: Message) {
    let member: GuildMember = getSingleMember(msg);
    if (!member) return;

    let argsArr = msg.content.split(' ').filter(word => !word.startsWith('<@!'));
    let searchTerm = argsArr.filter(arg => !arg.startsWith('!')).join(' ') || null;

    let { message, embeds } = await scores(member, searchTerm);
    message && msg.channel.send(message);
    embeds && msg.channel.send({ embed: embeds[0] });
}

async function callScoresSlash(int: Interaction) {
    let guild = client.guilds.cache.get(int.guild_id);
    return scores(
        await guild.members.fetch(getInteractionOpt(int, 'mention') || int.member.user.id),
        getInteractionOpt(int, 'artist-name') || null
    );
}

async function scores(member: GuildMember, searchTerm?: string): Promise<SlashReturn> {
    if (!searchTerm)
        searchTerm = (await request('user.getrecenttracks', { limit: 1, user: usernames[member.id] })).data.recenttracks
            .track[0].artist['#text'];
    let searchPage = (
        await axios({
            url: `https://www.youtube.com/results?search_query=theneedledrop+${searchTerm}&pbj=1`,
            method: 'GET',
            headers: {
                'user-agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.14 Safari/537.36 Edg/83.0.478.10',
                'x-youtube-client-name': 1,
                'x-youtube-client-version': 2.20200413,
            },
        })
    ).data;
    let videos =
        searchPage[1]['response']['contents']['twoColumnSearchResultsRenderer']['primaryContents'][
            'sectionListRenderer'
        ]['contents'][0]['itemSectionRenderer']['contents'];
    let goodVids = [];
    videos.forEach(element => {
        if (element['videoRenderer']) {
            let owner = element['videoRenderer']['ownerText']['runs'][0]['text'];
            let title = element['videoRenderer']['title']['runs'][0]['text'];
            if (
                owner == 'theneedledrop' &&
                (title.includes('REVIEW') || title.includes('NOT GOOD')) &&
                !title.includes('YUNOREVIEW') &&
                !normalizeString(title).includes('track') &&
                normalizeString(title).split('-')[0].includes(normalizeString(searchTerm))
            ) {
                goodVids.push({
                    title: title,
                    id: element['videoRenderer']['videoId'],
                });
            }
        }
    });
    return { embeds: [await awaitVids(goodVids, searchTerm)] };
}

async function awaitVids(data, searchTerm): Promise<MessageEmbed> {
    var kws = ['MIXTAPE', 'ALBUM', 'EP', 'COMPILATION', 'REVIEW', 'NOT', 'GOOD'];
    await Promise.all(
        data.map(async vid => {
            let resp = await getDesc(vid.id);
            vid.score = resp.score;
            vid.year = resp.year;
        })
    );
    var embed: MessageEmbed = new MessageEmbed()
        .setTitle(`${process.env.NODE_ENV ? '' : 'local: '}TheNeedleDrop's scores for "${searchTerm}"`)
        .setColor(0xf1ef80)
        .setDescription(
            data.length > 0
                ? data
                      .sort((a, b) => b.year - a.year)
                      .map(review => {
                          return `[${review.title
                              .split(' ')
                              .filter(word => !kws.includes(word))
                              .join(' ')
                              .replace(':', '')
                              .replace("'s", ' -')} (${review.year})](https://www.youtube.com/watch?v=${
                              review.id
                          })\n**${review.score}**`;
                      })
                      .join('\n\n')
                : 'Sorry, no reviews from TheNeedleDrop could be found for this artist.'
        );
    return embed;
}

async function getDesc(id) {
    let apiInfo = (
        await axios({
            url: `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${id}&key=${youtubeKey}`,
            method: 'GET',
        })
    ).data;
    var video = apiInfo.items[0];
    return {
        score: video.snippet.title.includes('NOT GOOD')
            ? `NOT GOOD`
            : `${
                  video.snippet.description
                      .split(/(\n\n)|(\r\n)/g)
                      .filter(el => el)
                      .find(string => string.match(/^([0-9]+)\/10/g) || string.toLowerCase() == 'classic/10')
                      ? video.snippet.description
                            .split(/(\n\n)|(\r\n)/g)
                            .filter(el => el)
                            .find(string => string.match(/^([0-9]+)\/10/g) || string.toLowerCase() == 'classic/10')
                            .replace(
                                /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g,
                                ''
                            )
                            .toUpperCase()
                      : 'No score could be found.'
              }`,
        year: +video.snippet.publishedAt.split('-')[0],
    };
}

client.login(discToken);
