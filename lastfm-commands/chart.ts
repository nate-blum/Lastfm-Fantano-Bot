import { Message, GuildMember } from 'discord.js';
import { loadImage, createCanvas } from 'canvas';
import * as usernames from '../usernames.json';
import { CommandCall, Interaction, SlashReturn, TimePeriods } from '../lastfm-models/model';
import { uuid } from 'uuidv4';
import * as fs from 'fs';
import { getSingleMember } from '../lastfm-utils/members';
import { registerCommand, registerSlashCommand } from './commandregistry';
import { registerHelp } from './help';
import { client } from '../lastfm';
import { getInteractionOpt } from '../lastfm-utils/find';
import FormData from 'form-data';
import Axios from 'axios';
import { request } from '../lastfm-utils/api';

export function registerChartCommand() {
    registerCommand(['chart'], null, callChart);

    registerSlashCommand('chart', false, callChartSlash);
    registerHelp({
        name: 'chart',
        params: ['limit'],
        time: true,
        mention: true,
        otherText:
            '`<limit?>`: Choose the dimensions of the chart. Should be in the form of `3x3`, which is the default.\n' +
            "Creates a square chart of your mention's or your top listened albums for the time period, which defaults to overall.",
    });
}

async function callChart(msg: Message): Promise<CommandCall> {
    let [limit, time] = (arr => [
        +(arr.find(arg => arg.match(/[0-9]x[0-9]/g)) || '3').slice(0, 1) as any,
        arr.find(arg => !!TimePeriods[arg]) || 'overall',
    ])(msg.content.toLowerCase().split(' '));

    if (limit > 7) {
        msg.channel.send('Please make sure your chart is 7x7 or smaller.');
        return;
    }

    let member: GuildMember = getSingleMember(msg);
    if (!member) return;
    const id = uuid();

    await chart(id, limit, time, member);
    await msg.channel.send({ files: [`${__dirname}\\${id}.png`] });
    fs.unlinkSync(`${__dirname}\\${id}.png`);

    return;
}

async function callChartSlash(int: Interaction): Promise<SlashReturn> {
    let guild = client.guilds.cache.get(int.guild_id);
    const id = uuid();
    await chart(
        id,
        +getInteractionOpt(int, 'size') || 3,
        getInteractionOpt(int, 'time') || 'overall',
        await guild.members.fetch(getInteractionOpt(int, 'mention') || int.member.user.id)
    );

    const formData = new FormData({});
    formData.append('file', fs.createReadStream(`${__dirname}\\${id}.png`));
    formData.append('content', '');

    await Axios.patch(
        `https://discord.com/api/v8/webhooks/${int.application_id}/${int.token}/messages/@original`,
        formData,
        {
            headers: formData.getHeaders(),
        }
    );

    fs.unlinkSync(`${__dirname}/${id}.png`);
    return {};
}

async function chart(id: string, limit: number, time: string, member: GuildMember): Promise<SlashReturn> {
    let canvas = createCanvas(limit * 300, limit * 300);

    (
        await Promise.all(
            (
                await request('user.gettopalbums', {
                    user: usernames[member.id],
                    period: TimePeriods[time],
                    limit: Math.pow(limit, 2),
                })
            ).data.topalbums.album.map(album => loadImage(album.image[album.image.length - 1]['#text']))
        )
    ).forEach((image, i) => canvas.getContext('2d').drawImage(image, (i % limit) * 300, Math.floor(i / limit) * 300));

    const out = fs.createWriteStream(`${__dirname}/${id}.png`);
    const stream = canvas.createPNGStream();
    stream.pipe(out);
    await outFinish(out);

    return {};
}

async function outFinish(stream: fs.WriteStream) {
    return new Promise(resolve => stream.on('finish', resolve));
}
