export namespace Spotify {
    export interface User {
        country?: string;
        display_name: string | null;
        email?: string;
        external_urls: External.URL;
        folllowers: {
            href: null;
            total: number;
        };
        href: string;
        id: string;
        images: Misc.Image[];
        product?: "premium" | "free" | "open";
        type: "user";
        uri: string;
    };
    export interface Device {
        id: string | null;
        is_active: Boolean;
        is_restricted: Boolean;
        is_private_session: Boolean;
        name: string;
        type: "Computer" | "Tablet" | "Smartphone" | "Speaker" | "TV" | "AVR" | "STB" | "AudioDongle" | "GameConsole" | "CastVideo" | "CastAudio" | "Automobile" | "Unknown";
        volume_percent: Number | null;
    };
    export interface PagingObject {
        href: string;
        limit: number;
        next: string;
        offset: number;
        previous: string;
        total: number;
        items: Items.Track[] | Items.Artist[];
    };
    export namespace Context {
        export interface CurrentlyPlaying {
            timestamp: number | null;
            device: Device
            progress_ms: number;
            status: Boolean;
            is_playing: Boolean;
            currently_playing_type: "track" | "episode" | "unknown" | "ad" | "unknown";
            actions: Misc.Disallows;
            item: Items.Track;
            shuffle_state: Boolean;
            repeat_state: "off" | any;
            context: Default | null;
        };
        export interface Default {
            external_urls: External.URL;
            href: string;
            type: "album" | "artist" | "playlist";
            uri: string;
        };
    };
    export namespace Items {
        export interface Track {
            album: Simplified.Album;
            artists: Artist[];
            available_markets: Array<Misc.IsoStrings>;
            disc_number: number;
            duration_ms: number;
            explicit: Boolean;
            external_ids: External.ID;
            external_urls: External.URL;
            href: string;
            id: string;
            is_playable: Boolean;
            linked_from: Misc.TrackLink;
            restrictions: Misc.Restrictions;
            name: string;
            popularity: number;
            preview_url: string | null;
            track_number: number;
            type: "track";
            uri: string;
            is_local: Boolean;
        };
        export interface Artist extends Simplified.Artist {
            followers: Misc.Followers;
            genres: string[];
            images: Misc.Image[];
            popularity: number;
        };
        export interface Episode {
            audio_preview_url: string;
            description: string;
            duration_ms: number;
            explicit: boolean;
            external_urls: External.URL;
            href: string;
            id: string;
            images: Misc.Image[];
            is_externally_hosted: boolean;
            is_playable: boolean;
            language?: string;
            languages: string[];
            name: string;
            release_date: string;
            release_date_precision: string;
            resume_point: string;
            show: Simplified.Show;
            type: "episode";
            uri: string;
        };
        export namespace Simplified {
            export interface Artist {
                external_urls: External.URL;
                href: string;
                id: string;
                name: string;
                type: "artist";
                uri: string;
            };
            export interface Show {
                available_markets: Array<Misc.IsoStrings>;
                copyrights: Misc.Copyright[];
                description: string;
                excplicit: boolean;
                external_urls: External.URL;
                href: string;
                id: string;
                images: Misc.Image[];
                is_externally_hosted: boolean;
                languages: string[];
                media_type: string;
                name: string;
                publisher: string;
                type: "show";
                uri: string;
            };
            export interface Album {
                album_group?: string;
                album_type: string;
                artists: Artist[];
                available_markets: Array<Misc.IsoStrings>;
                external_urls: External.URL;
                href: string;
                id: string;
                images: Misc.Image[];
                name: string;
                release_date: string;
                release_date_precision: "year" | "month" | "day";
                type: "album";
                restrictions: Misc.Restrictions;
                uri: string;
            };
            export interface Track {
                artists: Artist[];
                available_markets: Array<Misc.IsoStrings>;
                disc_number: number;
                duration_ms: number
                explicit: boolean;
                external_urls: External.URL;
                href: string;
                is_playable: boolean;
                linked_from: Misc.TrackLink;
                restrictions: Misc.Restrictions;
                name: string;
                preview_url: string;
                track_number: number;
                type: "track";
                uri: string;
                is_local: boolean;
            };
        };
    };
    export namespace Misc {
        export interface Disallows {
            disallows: {
                interrupting_playback?: Boolean;
                pausing?: Boolean;
                resuming?: Boolean;
                seeking?: Boolean;
                skipping_next?: Boolean;
                skipping_prev?: Boolean;
                toggling_repeat_context?: Boolean;
                toggling_shuffle?: Boolean;
                toggling_repeat_track?: Boolean;
                transferring_playback?: Boolean;
            };
        };
        export interface PlayHistory {
            track: Items.Simplified.Track
            /**
             * ISO 8601 format as Coordinated Universal Time (UTC) with a zero offset: YYYY-MM-DDTHH:MM:SSZ
             */
            played_at: string;
            context: Context.Default
        };
        export interface Copyright {
            text: string;
            type: string;
        };
        export interface Image {
            height: number | null
            url: string
            width: number | null
        };
        export interface Followers {
            href: string | null;
            total: number;
        };
        export interface TrackLink {
            external_urls: External.URL;
            href: string;
            id: string;
            type: "track";
            uri: string;
        };
        export interface Restrictions {
            reason: string;
        };
        export type IsoStrings = "AD" | "AE" | "AF" | "AG" | "AI" | "AL" | "AM" | "AO" | "AQ" | "AR" | "AS" | "AT" | "AU" | "AW" | "AX" | "AZ" | "BA" | "BB" | "BD" | "BE" | "BF" | "BG" | "BH" | "BI" | "BJ" | "BL" | "BM" | "BN" | "BO" | "BQ" | "BQ" | "BR" | "BS" | "BT" | "BV" | "BW" | "BY" | "BZ" | "CA" | "CC" | "CD" | "CF" | "CG" | "CH" | "CI" | "CK" | "CL" | "CM" | "CN" | "CO" | "CR" | "CU" | "CV" | "CW" | "CX" | "CY" | "CZ" | "DE" | "DJ" | "DK" | "DM" | "DO" | "DZ" | "EC" | "EE" | "EG" | "EH" | "ER" | "ES" | "ET" | "FI" | "FJ" | "FK" | "FM" | "FO" | "FR" | "GA" | "GB" | "GD" | "GE" | "GF" | "GG" | "GH" | "GI" | "GL" | "GM" | "GN" | "GP" | "GQ" | "GR" | "GS" | "GT" | "GU" | "GW" | "GY" | "HK" | "HM" | "HN" | "HR" | "HT" | "HU" | "ID" | "IE" | "IL" | "IM" | "IN" | "IO" | "IQ" | "IR" | "IS" | "IT" | "JE" | "JM" | "JO" | "JP" | "KE" | "KG" | "KH" | "KI" | "KM" | "KN" | "KP" | "KR" | "KW" | "KY" | "KZ" | "LA" | "LB" | "LC" | "LI" | "LK" | "LR" | "LS" | "LT" | "LU" | "LV" | "LY" | "MA" | "MC" | "MD" | "ME" | "MF" | "MG" | "MH" | "MK" | "ML" | "MM" | "MN" | "MO" | "MP" | "MQ" | "MR" | "MS" | "MT" | "MU" | "MV" | "MW" | "MX" | "MY" | "MZ" | "NA" | "NC" | "NE" | "NF" | "NG" | "NI" | "NL" | "NO" | "NP" | "NR" | "NU" | "NZ" | "OM" | "PA" | "PE" | "PF" | "PG" | "PH" | "PK" | "PL" | "PM" | "PN" | "PR" | "PS" | "PT" | "PW" | "PY" | "QA" | "RE" | "RO" | "RS" | "RU" | "RW" | "SA" | "SB" | "SC" | "SD" | "SE" | "SG" | "SH" | "SI" | "SJ" | "SK" | "SL" | "SM" | "SN" | "SO" | "SR" | "SS" | "ST" | "SV" | "SX" | "SY" | "SZ" | "TC" | "TD" | "TF" | "TG" | "TH" | "TJ" | "TK" | "TL" | "TM" | "TN" | "TO" | "TR" | "TT" | "TV" | "TW" | "IS" | "TZ" | "UA" | "UG" | "UM" | "US" | "UY" | "UZ" | "VA" | "VC" | "VE" | "VG" | "VI" | "VN" | "VU" | "WF" | "WS" | "YE" | "YT" | "ZA" | "ZM" | "ZW";
    };
    export namespace External {
        export type ID = {
            [key in "isrc" | "ean" | "upc"]: string;
        };
        export interface URL {
            [key: string]: string
        };
    };
};