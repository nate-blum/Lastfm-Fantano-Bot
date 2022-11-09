import axios, { AxiosResponse } from 'axios';
import * as usernames from '../usernames.json';
const lastfmapikey: string = '*sensitive data*';
const spotifyEncoded: string = '*sensitive data*=';
let spotifyToken: string = '';

export async function request(
    method: string,
    args: object,
    tryNum?: number,
    echo?: object
): Promise<AxiosResponse<any>> {
    let response: AxiosResponse<any>;
    try {
        response = await axios({
            method: 'get',
            url: 'https://ws.audioscrobbler.com/2.0/',
            params: {
                ...args,
                format: 'json',
                api_key: lastfmapikey,
                method,
            },
            headers: {
                'user-agent':
                    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.122 Safari/537.36',
            },
        });
    } catch {}
    if ((!response || response.status != 200) && (!tryNum || tryNum <= 5))
        return await request(method, args, tryNum ? tryNum + 1 : 2);
    if (
        method == 'user.getrecenttracks' &&
        args['limit'] == 1 &&
        (!response.data.recenttracks.track[0]['@attr'] ||
            !Boolean(response.data.recenttracks.track[0]['@attr'].nowplaying))
    ) {
        let playerResponse: AxiosResponse<any>;
        let id = Object.keys(usernames).find(key => usernames[key] == args['user']);
        try {
            playerResponse = await axios({
                method: 'get',
                url: '*sensitive data*',
                params: {
                    id,
                },
                headers: {
                    'x-api-key': '*sensitive data*',
                },
            });
        } catch {}
        if (
            playerResponse?.status == 200 &&
            playerResponse?.data?.status &&
            playerResponse?.data?.track?.isPlaying &&
            playerResponse?.data?.track?.currently_playing_type == 'track'
        ) {
            playerResponse.data = {
                recenttracks: {
                    track: [
                        {
                            artist: {
                                '#text': playerResponse.data.track.item.artists[0].name,
                            },
                            album: {
                                '#text':
                                    playerResponse.data.track.item.album.name ||
                                    playerResponse.data.track.item.artists[0].name,
                            },
                            name: playerResponse.data.track.item.name,
                            '@attr': {
                                nowplaying: true,
                            },
                        },
                    ],
                },
            };
            return {
                ...playerResponse,
                ...echo,
            };
        }
    }
    return {
        ...response,
        ...echo,
    };
}

export async function spotifyRequest(endpoint: string, args: object, tryNum?: number): Promise<AxiosResponse<any>> {
    let response: AxiosResponse<any>;
    if (spotifyToken.length == 0) spotifyToken = await getSpotifyToken();
    try {
        response = await axios({
            method: 'get',
            url: `https://api.spotify.com/${endpoint}`,
            params: args,
            headers: {
                Authorization: 'Bearer ' + spotifyToken,
            },
        });
    } catch {}
    if ((!response || response.status != 200) && (!tryNum || tryNum <= 5)) {
        spotifyToken = await getSpotifyToken();
        return await spotifyRequest(endpoint, args, tryNum ? tryNum + 1 : 2);
    }
    return response;
}

async function getSpotifyToken(): Promise<string> {
    return (
        await axios({
            method: 'post',
            url: 'https://accounts.spotify.com/api/token?grant_type=client_credentials',
            headers: {
                Authorization: 'Basic ' + spotifyEncoded,
            },
        })
    ).data.access_token;
}
