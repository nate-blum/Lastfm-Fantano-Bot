import { GuildMember, Message, MessageEmbed, User } from 'discord.js';

export const TimePeriods = {
    week: '7day',
    overall: 'overall',
    month: '1month',
    year: '12month',
    '3month': '3month',
    '6month': '6month',
    '3m': '3month',
    '6m': '6month',
};

export interface Command {
    aliases: string[];
    collection: string;
    func: (msg: Message) => Promise<CommandCall>;
}

export interface SlashCommand {
    name: string;
    mongo: boolean;
    func: (int: Interaction) => Promise<SlashReturn>;
}

export interface SlashReturn {
    call?: CommandCall;
    embeds?: MessageEmbed[];
    message?: string;
}

export interface HelpMsg {
    name: string;
    aliases?: string[];
    params?: string[];
    artist?: boolean;
    track?: boolean;
    album?: boolean;
    time?: boolean;
    number?: boolean;
    mention?: boolean;
    otherText: string;
}

export const CommonHelp = {
    artist: 'The name of an artist. Defaults to who you currently or most recently listened to.',
    track: 'The name of a track. Defaults to what you currently or most recently listened to.',
    album: 'The name of an album. Defaults to what you currently or most recently listened to.',
    time: 'A time period. Can be one of the following: week, month, 3month, 6month, year, or overall.',
    number: 'The number of results. Defaults to 10.',
    mention: 'The person this command will retrieve data about. Defaults to the one who used the command.',
};

export interface CommandCall {
    identifier: any;
    data: any;
}

export interface Interaction {
    id: string;
    application_id: string;
    type: InteractionType;
    data?: ApplicationCommandInteractionData;
    guild_id?: string;
    channel_id?: string;
    member?: GuildMember;
    user?: User;
    token: string;
    version: number;
}

export enum InteractionType {
    Ping = 1,
    ApplicationCommand = 2,
}

export interface ApplicationCommandInteractionData {
    id: string;
    name: string;
    resolved?: any;
    options?: ApplicationCommandInteractionDataOption[];
}

export interface ApplicationCommandInteractionDataOption {
    name: string;
    type: number;
    value?: any;
    options?: ApplicationCommandInteractionDataOption[];
}
