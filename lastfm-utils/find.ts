import { distance } from 'fastest-levenshtein';
import { request } from './api';
import { normalizeString } from './stringOps';
import * as usernames from '../usernames.json';
import { Interaction } from '../lastfm-models/model';

export async function findItemByName(name: string, type: string, userId: string, artist?: string) {
    let matches: any[] = [];
    let allItems = (await request(`user.gettop${type}s`, { limit: 999, period: 'overall', user: usernames[userId] }))
        .data;

    allItems = [
        allItems[`top${type}s`][type],
        ...(
            await Promise.all(
                Array.from({ length: +allItems[`top${type}s`]['@attr'].totalPages }, (v, i) =>
                    request(`user.gettop${type}s`, {
                        limit: 999,
                        period: 'overall',
                        user: usernames[userId],
                        page: i + 2,
                    })
                )
            )
        ).map(result => result.data[`top${type}s`][type]),
    ].flat();

    allItems.forEach(
        item =>
            normalizeString(name)
                .split(' ')
                .every(
                    word =>
                        normalizeString(item.name).includes(word) ||
                        (type != 'artist' && normalizeString(item.artist.name).includes(word))
                ) &&
            (artist && type != 'artist' ? artist == item.artist.name : true) &&
            matches.push(item)
    );

    return matches.length > 0
        ? {
              ...matches.reduce((prev, curr) =>
                  distance(normalizeString(prev.name), normalizeString(name)) >
                  distance(normalizeString(curr.name), normalizeString(name))
                      ? curr
                      : prev
              ),
              id: userId,
          }
        : null;
}

export function getInteractionOpt(int: Interaction, name: string) {
    return int.data.options?.find(opt => opt.name == name)?.value;
}
