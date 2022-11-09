import { distance } from 'fastest-levenshtein';
import { TimePeriods } from '../lastfm-models/model';

export function normalizeString(str: string): string {
    return (
        str
            .toLowerCase()
            .trim()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\+|'/g, ' ')
            // .replace(/ \(.+\)/g, '')
            // .replace(/ (feat)|(with)\..+/g, '')
            .split('')
            .map(char => (char == '$' ? 's' : char))
            .join('')
    );
}

export function truncate(str: string, limit: number): string {
    if (str.length >= limit) return str.slice(0, limit - 3) + '...';
    return str;
}

export function change(old: number, _new: number, limit?: number, decimals?: boolean, invert?: boolean) {
    let diff = invert ? old - _new : _new - old;
    if (diff == 0 || !old || (limit && Math.abs(diff) < limit) || (decimals && +diff.toFixed(2) == 0)) return '';
    return ` (${diff > 0 ? '+' : ''}${decimals ? diff.toFixed(2) : diff})`;
}

export function rangeNameAutocorrect(name: string, def?: string, timeArr?: string[]): string {
    if (name?.length > 0) {
        return timeArr
            ? timeArr.reduce(
                  (prev, curr) =>
                      distance(normalizeString(name), curr) < (prev ? distance(normalizeString(name), prev) : 100)
                          ? curr
                          : prev,
                  ''
              )
            : Object.entries(TimePeriods).reduce(
                  (prev, curr) =>
                      distance(normalizeString(name), curr[0]) <
                      (prev[0] ? distance(normalizeString(name), prev[0]) : 100)
                          ? curr
                          : prev,
                  ['', '']
              )[0];
    }
    return def;
}
