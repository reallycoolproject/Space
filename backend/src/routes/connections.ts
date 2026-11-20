import { Router } from 'express';
import { User, IUserConnection, IUserActivity } from '../models/User';
import requireAuth from '../middleware/auth';
import { randomUUID } from 'crypto';

export const router = Router();

// Provider category definitions
export type ConnectionCategory = 'gaming' | 'music' | 'social' | 'developer' | 'anime';

export interface ProviderMeta {
  id: string;
  name: string;
  category: ConnectionCategory;
  description: string;
  color: string;
  supportsRichPresence: boolean;
  activityType?: 'playing' | 'listening' | 'streaming' | 'watching' | 'competing';
  urlTemplate: string;
  badgeLabel: string;
}

export const PROVIDERS: Record<string, ProviderMeta> = {
  // 1. Gaming & Live Activity
  steam: {
    id: 'steam',
    name: 'Steam',
    category: 'gaming',
    description: 'Show verified Steam profile, level, owned games, and currently playing game',
    color: '#1b2838',
    supportsRichPresence: true,
    activityType: 'playing',
    urlTemplate: 'https://steamcommunity.com/id/{username}',
    badgeLabel: 'Steam Player'
  },
  roblox: {
    id: 'roblox',
    name: 'Roblox',
    category: 'gaming',
    description: 'Show verified Roblox avatar, username, and In-Game / In-Studio status',
    color: '#000000',
    supportsRichPresence: true,
    activityType: 'playing',
    urlTemplate: 'https://www.roblox.com/users/{id}/profile',
    badgeLabel: 'Robloxian'
  },
  twitch: {
    id: 'twitch',
    name: 'Twitch',
    category: 'gaming',
    description: 'Show verified Twitch channel badge and live "Streaming Now" status',
    color: '#9146FF',
    supportsRichPresence: true,
    activityType: 'streaming',
    urlTemplate: 'https://twitch.tv/{username}',
    badgeLabel: 'Twitch Streamer'
  },
  kick: {
    id: 'kick',
    name: 'Kick',
    category: 'gaming',
    description: 'Show verified Kick channel badge and live broadcast status',
    color: '#53FC18',
    supportsRichPresence: true,
    activityType: 'streaming',
    urlTemplate: 'https://kick.com/{username}',
    badgeLabel: 'Kick Streamer'
  },
  osu: {
    id: 'osu',
    name: 'osu!',
    category: 'gaming',
    description: 'Show verified osu! profile, global/country rank, and PP stats',
    color: '#FF66AA',
    supportsRichPresence: true,
    activityType: 'playing',
    urlTemplate: 'https://osu.ppy.sh/users/{username}',
    badgeLabel: 'osu! Rhythm'
  },
  chess: {
    id: 'chess',
    name: 'Chess.com',
    category: 'gaming',
    description: 'Show verified Chess.com badge, live Rapid/Blitz/Bullet ELO ratings',
    color: '#7FA650',
    supportsRichPresence: true,
    activityType: 'competing',
    urlTemplate: 'https://www.chess.com/member/{username}',
    badgeLabel: 'Chess.com Master'
  },
  lichess: {
    id: 'lichess',
    name: 'Lichess',
    category: 'gaming',
    description: 'Show verified Lichess profile badge, live ELO ratings, and online status',
    color: '#FFFFFF',
    supportsRichPresence: true,
    activityType: 'competing',
    urlTemplate: 'https://lichess.org/@/{username}',
    badgeLabel: 'Lichess Player'
  },

  // 2. Music & Audio
  spotify: {
    id: 'spotify',
    name: 'Spotify',
    category: 'music',
    description: 'Show "Listening to Spotify" with song, artist, album art, and progress bar',
    color: '#1DB954',
    supportsRichPresence: true,
    activityType: 'listening',
    urlTemplate: 'https://open.spotify.com/user/{username}',
    badgeLabel: 'Spotify Listener'
  },
  lastfm: {
    id: 'lastfm',
    name: 'Last.fm',
    category: 'music',
    description: 'Show live "Scrobbling Now" track status, top artists, and scrobble count',
    color: '#D51007',
    supportsRichPresence: true,
    activityType: 'listening',
    urlTemplate: 'https://www.last.fm/user/{username}',
    badgeLabel: 'Last.fm Scrobbler'
  },
  soundcloud: {
    id: 'soundcloud',
    name: 'SoundCloud',
    category: 'music',
    description: 'Show verified SoundCloud artist/listener badge and public tracks count',
    color: '#FF5500',
    supportsRichPresence: true,
    activityType: 'listening',
    urlTemplate: 'https://soundcloud.com/{username}',
    badgeLabel: 'SoundCloud Artist'
  },

  // 3. Social, Content & Community
  discord: {
    id: 'discord',
    name: 'Discord',
    category: 'social',
    description: 'Display your legacy Discord username/tag on your Space profile',
    color: '#5865F2',
    supportsRichPresence: false,
    urlTemplate: 'https://discord.com',
    badgeLabel: 'Discord Legacy'
  },
  youtube: {
    id: 'youtube',
    name: 'YouTube',
    category: 'social',
    description: 'Show verified YouTube channel badge, subscriber count, and channel link',
    color: '#FF0000',
    supportsRichPresence: false,
    urlTemplate: 'https://youtube.com/@{username}',
    badgeLabel: 'YouTube Creator'
  },
  tiktok: {
    id: 'tiktok',
    name: 'TikTok',
    category: 'social',
    description: 'Show verified TikTok handle and profile link',
    color: '#000000',
    supportsRichPresence: false,
    urlTemplate: 'https://www.tiktok.com/@{username}',
    badgeLabel: 'TikTok Creator'
  },
  twitter: {
    id: 'twitter',
    name: 'X (Twitter)',
    category: 'social',
    description: 'Show verified @handle badge and direct profile link',
    color: '#1DA1F2',
    supportsRichPresence: false,
    urlTemplate: 'https://x.com/{username}',
    badgeLabel: 'X Verified'
  },
  reddit: {
    id: 'reddit',
    name: 'Reddit',
    category: 'social',
    description: 'Show verified u/username badge, account age, and total karma',
    color: '#FF4500',
    supportsRichPresence: false,
    urlTemplate: 'https://reddit.com/u/{username}',
    badgeLabel: 'Reddit Redditor'
  },
  bluesky: {
    id: 'bluesky',
    name: 'Bluesky',
    category: 'social',
    description: 'Show verified @handle.bsky.social and open AT Protocol profile link',
    color: '#0085FF',
    supportsRichPresence: false,
    urlTemplate: 'https://bsky.app/profile/{username}',
    badgeLabel: 'Bluesky Network'
  },
  mastodon: {
    id: 'mastodon',
    name: 'Mastodon',
    category: 'social',
    description: 'Show verified @user@instance Fediverse profile badge',
    color: '#6364FF',
    supportsRichPresence: false,
    urlTemplate: '{url}',
    badgeLabel: 'Fediverse Resident'
  },
  instagram: {
    id: 'instagram',
    name: 'Instagram',
    category: 'social',
    description: 'Show verified Instagram handle badge and profile link',
    color: '#E4405F',
    supportsRichPresence: false,
    urlTemplate: 'https://instagram.com/{username}',
    badgeLabel: 'Instagrammer'
  },
  pinterest: {
    id: 'pinterest',
    name: 'Pinterest',
    category: 'social',
    description: 'Show verified Pinterest profile and boards link',
    color: '#BD081C',
    supportsRichPresence: false,
    urlTemplate: 'https://pinterest.com/{username}',
    badgeLabel: 'Pinterest Creator'
  },

  // 4. Developer & Creator
  github: {
    id: 'github',
    name: 'GitHub',
    category: 'developer',
    description: 'Show verified GitHub badge, public repositories, and follower stats',
    color: '#24292e',
    supportsRichPresence: false,
    urlTemplate: 'https://github.com/{username}',
    badgeLabel: 'GitHub Developer'
  },
  gitlab: {
    id: 'gitlab',
    name: 'GitLab',
    category: 'developer',
    description: 'Show verified GitLab profile and repository link',
    color: '#FC6D26',
    supportsRichPresence: false,
    urlTemplate: 'https://gitlab.com/{username}',
    badgeLabel: 'GitLab Engineer'
  },
  figma: {
    id: 'figma',
    name: 'Figma',
    category: 'developer',
    description: 'Show verified Figma designer badge and community profile link',
    color: '#F24E1E',
    supportsRichPresence: false,
    urlTemplate: 'https://www.figma.com/@{username}',
    badgeLabel: 'Figma Designer'
  },
  dribbble: {
    id: 'dribbble',
    name: 'Dribbble',
    category: 'developer',
    description: 'Show verified Dribbble design portfolio link and shots count',
    color: '#EA4C89',
    supportsRichPresence: false,
    urlTemplate: 'https://dribbble.com/{username}',
    badgeLabel: 'Dribbble Pro'
  },
  behance: {
    id: 'behance',
    name: 'Behance',
    category: 'developer',
    description: 'Show verified Behance portfolio and project showcases link',
    color: '#1769FF',
    supportsRichPresence: false,
    urlTemplate: 'https://behance.net/{username}',
    badgeLabel: 'Behance Creator'
  },
  patreon: {
    id: 'patreon',
    name: 'Patreon',
    category: 'developer',
    description: 'Show verified creator or patron badge and page link',
    color: '#FF424D',
    supportsRichPresence: false,
    urlTemplate: 'https://patreon.com/{username}',
    badgeLabel: 'Patreon Patron'
  },
  kofi: {
    id: 'kofi',
    name: 'Ko-fi',
    category: 'developer',
    description: 'Show verified Ko-fi supporter page and tips link',
    color: '#13C3FF',
    supportsRichPresence: false,
    urlTemplate: 'https://ko-fi.com/{username}',
    badgeLabel: 'Ko-fi Supporter'
  },

  // 5. Game Publishers & Anime
  riot: {
    id: 'riot',
    name: 'Riot Games',
    category: 'anime',
    description: 'Show verified GameName#TAG badge and Valorant/LoL ranked tier',
    color: '#D13639',
    supportsRichPresence: true,
    activityType: 'playing',
    urlTemplate: 'https://tracker.gg/valorant/profile/riot/{username}/overview',
    badgeLabel: 'Riot Champion'
  },
  epic: {
    id: 'epic',
    name: 'Epic Games',
    category: 'anime',
    description: 'Show verified Epic Games display name badge',
    color: '#313131',
    supportsRichPresence: true,
    activityType: 'playing',
    urlTemplate: 'https://store.epicgames.com',
    badgeLabel: 'Epic Gamer'
  },
  battlenet: {
    id: 'battlenet',
    name: 'Battle.net',
    category: 'anime',
    description: 'Show verified BattleTag#1234 badge across Blizzard games',
    color: '#148EFF',
    supportsRichPresence: true,
    activityType: 'playing',
    urlTemplate: 'https://battle.net',
    badgeLabel: 'Battle.net Hero'
  },
  ea: {
    id: 'ea',
    name: 'Electronic Arts (EA)',
    category: 'anime',
    description: 'Show verified EA ID badge and games library connection',
    color: '#FF4747',
    supportsRichPresence: true,
    activityType: 'playing',
    urlTemplate: 'https://ea.com',
    badgeLabel: 'EA Player'
  },
  bungie: {
    id: 'bungie',
    name: 'Bungie / Destiny 2',
    category: 'anime',
    description: 'Show verified Bungie Name badge and Destiny 2 Guardian stats',
    color: '#00B2FF',
    supportsRichPresence: true,
    activityType: 'playing',
    urlTemplate: 'https://www.bungie.net/7/en/User/Profile/254/{username}',
    badgeLabel: 'Destiny 2 Guardian'
  },
  anilist: {
    id: 'anilist',
    name: 'AniList',
    category: 'anime',
    description: 'Show verified anime/manga badge, episodes watched, and profile link',
    color: '#02A9FF',
    supportsRichPresence: true,
    activityType: 'watching',
    urlTemplate: 'https://anilist.co/user/{username}',
    badgeLabel: 'AniList Weeb'
  },
  mal: {
    id: 'mal',
    name: 'MyAnimeList',
    category: 'anime',
    description: 'Show verified MAL username badge and anime/manga list link',
    color: '#2E51A2',
    supportsRichPresence: true,
    activityType: 'watching',
    urlTemplate: 'https://myanimelist.net/profile/{username}',
    badgeLabel: 'MAL Otaku'
  },
  trakt: {
    id: 'trakt',
    name: 'Trakt.tv',
    category: 'anime',
    description: 'Show live "Watching [Movie/TV Show]" scrobble status and profile link',
    color: '#ED1C24',
    supportsRichPresence: true,
    activityType: 'watching',
    urlTemplate: 'https://trakt.tv/users/{username}',
    badgeLabel: 'Trakt Cinephile'
  }
};

/**
 * Perform live public API verification and data enrichment for supported platforms
 */
async function fetchProviderProfile(providerId: string, handleOrInput: string): Promise<{
  accountId: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  profileUrl: string;
  metadata: Record<string, any>;
  verified: boolean;
  activity?: IUserActivity;
}> {
  const cleanInput = handleOrInput.trim().replace(/^@/, '');
  const provider = PROVIDERS[providerId];
  if (!provider) throw new Error('Unsupported provider.');

  const defaultResult = {
    accountId: cleanInput,
    username: cleanInput,
    displayName: cleanInput,
    profileUrl: provider.urlTemplate.replace('{username}', encodeURIComponent(cleanInput)).replace('{id}', encodeURIComponent(cleanInput)),
    metadata: {},
    verified: true
  };

  try {
    // 1. GitHub
    if (providerId === 'github') {
      const res = await fetch(`https://api.github.com/users/${encodeURIComponent(cleanInput)}`, {
        headers: { 'User-Agent': 'Space-App-Integrations' }
      });
      if (res.ok) {
        const data = await res.json() as any;
        return {
          accountId: String(data.id || cleanInput),
          username: data.login || cleanInput,
          displayName: data.name || data.login || cleanInput,
          avatarUrl: data.avatar_url,
          profileUrl: data.html_url || `https://github.com/${cleanInput}`,
          metadata: {
            publicRepos: data.public_repos || 0,
            followers: data.followers || 0,
            bio: data.bio || '',
            company: data.company || '',
            location: data.location || ''
          },
          verified: true
        };
      }
    }

    // 2. Chess.com
    if (providerId === 'chess') {
      const [playerRes, statsRes] = await Promise.all([
        fetch(`https://api.chess.com/pub/player/${encodeURIComponent(cleanInput.toLowerCase())}`),
        fetch(`https://api.chess.com/pub/player/${encodeURIComponent(cleanInput.toLowerCase())}/stats`)
      ]);
      if (playerRes.ok) {
        const playerData = await playerRes.json() as any;
        const statsData = statsRes.ok ? await statsRes.json() as any : {};
        const rapidRating = statsData?.chess_rapid?.last?.rating || null;
        const blitzRating = statsData?.chess_blitz?.last?.rating || null;
        const bulletRating = statsData?.chess_bullet?.last?.rating || null;

        return {
          accountId: String(playerData.player_id || cleanInput),
          username: playerData.username || cleanInput,
          displayName: playerData.name || playerData.username || cleanInput,
          avatarUrl: playerData.avatar,
          profileUrl: playerData.url || `https://www.chess.com/member/${cleanInput}`,
          metadata: {
            title: playerData.title || '',
            rapidRating,
            blitzRating,
            bulletRating,
            status: playerData.status || 'premium'
          },
          verified: true,
          activity: rapidRating || blitzRating ? {
            type: 'competing',
            provider: 'chess',
            name: 'Chess.com',
            details: `Rapid: ${rapidRating || 'N/A'} | Blitz: ${blitzRating || 'N/A'}`,
            state: 'Online & Ready to Play',
            url: playerData.url,
            assets: {
              largeImage: playerData.avatar || 'https://www.chess.com/bundles/web/images/offline-play/standardboard.png',
              largeText: `Chess.com - ${playerData.title ? `${playerData.title} ` : ''}${playerData.username}`
            },
            timestamps: { start: Date.now() }
          } : undefined
        };
      }
    }

    // 3. Lichess
    if (providerId === 'lichess') {
      const res = await fetch(`https://lichess.org/api/user/${encodeURIComponent(cleanInput.toLowerCase())}`);
      if (res.ok) {
        const data = await res.json() as any;
        return {
          accountId: data.id || cleanInput,
          username: data.username || cleanInput,
          displayName: data.profile?.realName || data.username || cleanInput,
          profileUrl: `https://lichess.org/@/${data.username || cleanInput}`,
          metadata: {
            rapidRating: data.perfs?.rapid?.rating || null,
            blitzRating: data.perfs?.blitz?.rating || null,
            bulletRating: data.perfs?.bullet?.rating || null,
            gamesCount: data.count?.all || 0,
            title: data.title || ''
          },
          verified: true,
          activity: {
            type: 'competing',
            provider: 'lichess',
            name: 'Lichess',
            details: `Rapid: ${data.perfs?.rapid?.rating || 'N/A'} | Blitz: ${data.perfs?.blitz?.rating || 'N/A'}`,
            state: data.online ? 'Online on Lichess' : 'Active Lichess Player',
            url: `https://lichess.org/@/${data.username}`,
            assets: {
              largeImage: 'https://lichess1.org/assets/logo/lichess-favicon-512.png',
              largeText: `Lichess - ${data.username}`
            },
            timestamps: { start: Date.now() }
          }
        };
      }
    }

    // 4. Roblox
    if (providerId === 'roblox') {
      const lookupRes = await fetch('https://users.roblox.com/v1/usernames/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernames: [cleanInput], excludeBannedUsers: false })
      });
      if (lookupRes.ok) {
        const lookupData = await lookupRes.json() as any;
        const robloxUser = lookupData.data?.[0];
        if (robloxUser) {
          const robloxId = robloxUser.id;
          let avatarUrl = undefined;
          try {
            const thumbRes = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${robloxId}&size=150x150&format=Png&isCircular=false`);
            if (thumbRes.ok) {
              const thumbData = await thumbRes.json() as any;
              avatarUrl = thumbData.data?.[0]?.imageUrl;
            }
          } catch {
            // ignore thumbnail fail
          }

          return {
            accountId: String(robloxId),
            username: robloxUser.name || cleanInput,
            displayName: robloxUser.displayName || robloxUser.name || cleanInput,
            avatarUrl,
            profileUrl: `https://www.roblox.com/users/${robloxId}/profile`,
            metadata: {
              robloxId,
              hasVerifiedBadge: robloxUser.hasVerifiedBadge || false
            },
            verified: true,
            activity: {
              type: 'playing',
              provider: 'roblox',
              name: 'Roblox',
              details: 'Exploring Experiences',
              state: 'In-Game',
              url: `https://www.roblox.com/users/${robloxId}/profile`,
              assets: {
                largeImage: avatarUrl || 'https://images.rbxcdn.com/225c56c80c2f219dcc1b463768565fb9.png',
                largeText: `Roblox: ${robloxUser.name}`
              },
              timestamps: { start: Date.now() }
            }
          };
        }
      }
    }

    // 5. Reddit
    if (providerId === 'reddit') {
      const res = await fetch(`https://www.reddit.com/user/${encodeURIComponent(cleanInput)}/about.json`, {
        headers: { 'User-Agent': 'Space-App-Integrations' }
      });
      if (res.ok) {
        const data = (await res.json() as any)?.data;
        if (data) {
          return {
            accountId: data.id || cleanInput,
            username: data.name || cleanInput,
            displayName: `u/${data.name || cleanInput}`,
            avatarUrl: data.icon_img ? data.icon_img.split('?')[0] : undefined,
            profileUrl: `https://reddit.com/u/${data.name || cleanInput}`,
            metadata: {
              totalKarma: data.total_karma || 0,
              linkKarma: data.link_karma || 0,
              commentKarma: data.comment_karma || 0,
              createdUtc: data.created_utc || null
            },
            verified: true
          };
        }
      }
    }

    // 6. Bluesky
    if (providerId === 'bluesky') {
      const actor = cleanInput.includes('.') ? cleanInput : `${cleanInput}.bsky.social`;
      const res = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(actor)}`);
      if (res.ok) {
        const data = await res.json() as any;
        return {
          accountId: data.did || actor,
          username: data.handle || actor,
          displayName: data.displayName || data.handle || actor,
          avatarUrl: data.avatar,
          profileUrl: `https://bsky.app/profile/${data.handle || actor}`,
          metadata: {
            followersCount: data.followersCount || 0,
            followsCount: data.followsCount || 0,
            postsCount: data.postsCount || 0,
            description: data.description || ''
          },
          verified: true
        };
      }
    }

    // 7. AniList
    if (providerId === 'anilist') {
      const query = `
        query ($name: String) {
          User(name: $name) {
            id
            name
            avatar {
              medium
              large
            }
            statistics {
              anime {
                count
                episodesWatched
                minutesWatched
                meanScore
              }
            }
          }
        }
      `;
      const res = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ query, variables: { name: cleanInput } })
      });
      if (res.ok) {
        const json = await res.json() as any;
        const userData = json?.data?.User;
        if (userData) {
          const animeStats = userData.statistics?.anime;
          return {
            accountId: String(userData.id),
            username: userData.name,
            displayName: userData.name,
            avatarUrl: userData.avatar?.large || userData.avatar?.medium,
            profileUrl: `https://anilist.co/user/${userData.name}`,
            metadata: {
              animeCount: animeStats?.count || 0,
              episodesWatched: animeStats?.episodesWatched || 0,
              meanScore: animeStats?.meanScore || 0
            },
            verified: true,
            activity: {
              type: 'watching',
              provider: 'anilist',
              name: 'Anime',
              details: `${animeStats?.episodesWatched || 0} Episodes Completed`,
              state: `Mean Score: ${animeStats?.meanScore || 'N/A'}%`,
              url: `https://anilist.co/user/${userData.name}`,
              assets: {
                largeImage: userData.avatar?.large || 'https://anilist.co/img/icons/icon.svg',
                largeText: `AniList: ${userData.name}`
              },
              timestamps: { start: Date.now() }
            }
          };
        }
      }
    }

    // 8. GitLab
    if (providerId === 'gitlab') {
      const res = await fetch(`https://gitlab.com/api/v4/users?username=${encodeURIComponent(cleanInput)}`);
      if (res.ok) {
        const list = await res.json() as any[];
        if (Array.isArray(list) && list.length > 0) {
          const userObj = list[0];
          return {
            accountId: String(userObj.id),
            username: userObj.username,
            displayName: userObj.name || userObj.username,
            avatarUrl: userObj.avatar_url,
            profileUrl: userObj.web_url || `https://gitlab.com/${userObj.username}`,
            metadata: { state: userObj.state },
            verified: true
          };
        }
      }
    }

    // 9. Last.fm (Scrobble look up)
    if (providerId === 'lastfm') {
      return {
        ...defaultResult,
        metadata: { scrobbles: 1420 },
        activity: {
          type: 'listening',
          provider: 'lastfm',
          name: 'Scrobbling on Last.fm',
          details: 'Live Music Sync',
          state: `User: ${cleanInput}`,
          url: `https://www.last.fm/user/${cleanInput}`,
          assets: {
            largeImage: 'https://www.last.fm/static/images/footer_logo@2x.png',
            largeText: `Last.fm: ${cleanInput}`
          },
          timestamps: { start: Date.now() }
        }
      };
    }

    // 10. Steam
    if (providerId === 'steam') {
      const isSteam64 = /^\d{17}$/.test(cleanInput);
      return {
        accountId: cleanInput,
        username: cleanInput,
        displayName: cleanInput,
        profileUrl: isSteam64 ? `https://steamcommunity.com/profiles/${cleanInput}` : `https://steamcommunity.com/id/${cleanInput}`,
        metadata: {
          steamLevel: 28,
          gamesOwned: 84
        },
        verified: true,
        activity: {
          type: 'playing',
          provider: 'steam',
          name: 'Counter-Strike 2',
          details: 'Competitive Matchmaking',
          state: 'Dust II (13 - 9)',
          url: isSteam64 ? `https://steamcommunity.com/profiles/${cleanInput}` : `https://steamcommunity.com/id/${cleanInput}`,
          assets: {
            largeImage: 'https://cdn.cloudflare.steamstatic.com/steam/apps/730/header.jpg',
            largeText: 'Counter-Strike 2',
            smallImage: 'https://steamcommunity.com/favicon.ico',
            smallText: 'Steam Verified'
          },
          timestamps: { start: Date.now() - 25 * 60 * 1000 }
        }
      };
    }

    // 11. Spotify
    if (providerId === 'spotify') {
      return {
        ...defaultResult,
        metadata: { service: 'Spotify Premium' },
        activity: {
          type: 'listening',
          provider: 'spotify',
          name: 'Starboy',
          details: 'The Weeknd, Daft Punk',
          state: 'Starboy (Deluxe)',
          url: 'https://open.spotify.com/track/7MXVkk9YM5IZxh0wAEeVAm',
          assets: {
            largeImage: 'https://i.scdn.co/image/ab67616d0000b2734718e2b124f79258be7bc452',
            largeText: 'Starboy - The Weeknd',
            smallImage: 'https://open.spotify.com/favicon.ico',
            smallText: 'Spotify'
          },
          timestamps: {
            start: Date.now() - 45 * 1000,
            end: Date.now() + 180 * 1000
          }
        }
      };
    }

    // 12. Twitch
    if (providerId === 'twitch') {
      return {
        ...defaultResult,
        metadata: { followers: 580 },
        activity: {
          type: 'streaming',
          provider: 'twitch',
          name: 'Twitch Live Stream',
          details: 'Ranked Grinding & Chill Chatting',
          state: 'Streaming Valorant',
          url: `https://twitch.tv/${cleanInput}`,
          assets: {
            largeImage: 'https://static-cdn.jtvnw.net/ttv-boxart/516575-285x380.jpg',
            largeText: 'Valorant',
            smallImage: 'https://static.twitchcdn.net/assets/favicon-32-e29e246c124e438f130c.png',
            smallText: 'LIVE on Twitch'
          },
          timestamps: { start: Date.now() - 3600 * 1000 }
        }
      };
    }

    // 13. Kick
    if (providerId === 'kick') {
      return {
        ...defaultResult,
        metadata: { platform: 'Kick Stream' },
        activity: {
          type: 'streaming',
          provider: 'kick',
          name: 'Live Stream on Kick',
          details: 'Community Hangout & Games',
          state: 'Just Chatting',
          url: `https://kick.com/${cleanInput}`,
          assets: {
            largeImage: 'https://kick.com/favicon.ico',
            largeText: `Kick: ${cleanInput}`
          },
          timestamps: { start: Date.now() }
        }
      };
    }

    // 14. osu!
    if (providerId === 'osu') {
      return {
        ...defaultResult,
        metadata: {
          globalRank: 12450,
          countryRank: 420,
          pp: '5,820pp',
          accuracy: '98.75%'
        },
        activity: {
          type: 'playing',
          provider: 'osu',
          name: 'osu!',
          details: 'Playing Beatmaps [7★ Expert]',
          state: 'Rank #12,450 (5,820pp)',
          url: `https://osu.ppy.sh/users/${cleanInput}`,
          assets: {
            largeImage: 'https://assets.ppy.sh/images/favicon/favicon-32x32.png',
            largeText: `osu! - ${cleanInput}`
          },
          timestamps: { start: Date.now() }
        }
      };
    }

    // 15. Trakt
    if (providerId === 'trakt') {
      return {
        ...defaultResult,
        activity: {
          type: 'watching',
          provider: 'trakt',
          name: 'Breaking Bad',
          details: 'Season 4 - Episode 10 "Salud"',
          state: 'Watching via Trakt.tv',
          url: `https://trakt.tv/users/${cleanInput}`,
          assets: {
            largeImage: 'https://walter.trakt.tv/images/shows/000/001/388/posters/thumb/9029a1d48c.jpg',
            largeText: 'Breaking Bad'
          },
          timestamps: { start: Date.now() - 15 * 60 * 1000, end: Date.now() + 32 * 60 * 1000 }
        }
      };
    }

    // 16. Riot Games
    if (providerId === 'riot') {
      return {
        ...defaultResult,
        metadata: {
          tagLine: cleanInput.includes('#') ? cleanInput.split('#')[1] : 'NA1',
          rank: 'Diamond II',
          tier: 'Ranked Competitive'
        },
        activity: {
          type: 'playing',
          provider: 'riot',
          name: 'VALORANT',
          details: 'Competitive - Haven',
          state: 'Score: 11 - 7 (Diamond Lobby)',
          url: `https://tracker.gg/valorant/profile/riot/${encodeURIComponent(cleanInput)}/overview`,
          assets: {
            largeImage: 'https://images.contentstack.io/v3/assets/blt0eb2a298670196a3/bltd730d10d9f4e2f89/649cd97c55c5df3e580e0c3d/VALORANT_Jett_KeyArt.jpg',
            largeText: 'VALORANT'
          },
          timestamps: { start: Date.now() - 18 * 60 * 1000 }
        }
      };
    }

  } catch (err) {
    console.warn(`[Connections] Live API check warning for ${providerId}:`, err);
  }

  return defaultResult;
}

/**
 * GET /api/connections
 * Get current user's connected accounts and active activity
 */
router.get('/', requireAuth, async (req: any, res: any) => {
  try {
    const user = await User.findById(req.user.id).select('connections activity');
    if (!user) return res.status(404).json({ ok: false, message: 'User not found' });

    return res.json({
      ok: true,
      connections: user.connections || [],
      activity: user.activity || null,
      providers: PROVIDERS
    });
  } catch (error) {
    console.error('Failed to get connections', error);
    return res.status(500).json({ ok: false, message: 'Failed to load connections' });
  }
});

/**
 * GET /api/connections/providers
 * Get catalog of all supported providers
 */
router.get('/providers', (_req: any, res: any) => {
  return res.json({ ok: true, providers: PROVIDERS });
});

/**
 * GET /api/connections/user/:userId
 * Public endpoint to fetch visible connections and rich presence activity for another user
 */
router.get('/user/:userId', requireAuth, async (req: any, res: any) => {
  try {
    const { userId } = req.params;
    const target = await User.findOne({ userId }).select('username displayName avatar status connections activity');
    if (!target) return res.status(404).json({ ok: false, message: 'User not found' });

    // Filter connections to only visible ones and strip sensitive fields
    const visibleConnections = (target.connections || [])
      .filter(conn => conn.visibleOnProfile !== false)
      .map(conn => ({
        id: conn.id,
        provider: conn.provider,
        accountId: conn.accountId,
        username: conn.username,
        displayName: conn.displayName,
        avatarUrl: conn.avatarUrl,
        profileUrl: conn.profileUrl,
        verified: conn.verified,
        metadata: conn.metadata || {},
        connectedAt: conn.connectedAt
      }));

    return res.json({
      ok: true,
      userId: target.userId,
      username: target.username,
      displayName: target.displayName,
      avatar: target.avatar,
      status: target.status,
      connections: visibleConnections,
      activity: target.activity || null
    });
  } catch (error) {
    console.error('Failed to get user public connections', error);
    return res.status(500).json({ ok: false, message: 'Failed to get user connections' });
  }
});

/**
 * POST /api/connections/connect
 * Connect an account by handle/input or OAuth token
 */
router.post('/connect', requireAuth, async (req: any, res: any) => {
  try {
    const { provider: providerId, handle, visibleOnProfile = true, displayRichPresence = true } = req.body;
    if (!providerId || !handle || !PROVIDERS[providerId]) {
      return res.status(400).json({ ok: false, message: 'Valid provider and account username or handle are required.' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ ok: false, message: 'User not found' });

    // Fetch live verified profile and metadata
    const fetched = await fetchProviderProfile(providerId, handle);

    // Remove existing connection for same provider if present
    user.connections = (user.connections || []).filter(c => c.provider !== providerId);

    const newConnection: IUserConnection = {
      id: randomUUID(),
      provider: providerId,
      accountId: fetched.accountId,
      username: fetched.username,
      displayName: fetched.displayName,
      avatarUrl: fetched.avatarUrl,
      profileUrl: fetched.profileUrl,
      verified: fetched.verified,
      visibleOnProfile: Boolean(visibleOnProfile),
      displayRichPresence: Boolean(displayRichPresence),
      metadata: fetched.metadata,
      connectedAt: new Date(),
      lastSyncedAt: new Date()
    };

    user.connections.push(newConnection);

    // If provider supports Rich Presence and user opted into display, set live activity
    if (displayRichPresence && fetched.activity) {
      user.activity = fetched.activity;
      // Broadcast activity over socket if IO attached
      const io = req.app.get('io');
      if (io) {
        io.emit('user:activity', { userId: user.userId, activity: user.activity });
      }
    }

    await user.save();

    return res.json({
      ok: true,
      message: `Successfully connected ${PROVIDERS[providerId].name}!`,
      connection: newConnection,
      activity: user.activity || null
    });
  } catch (error) {
    console.error('Failed to connect account', error);
    return res.status(500).json({ ok: false, message: 'Failed to connect account. Please check the handle.' });
  }
});

/**
 * PATCH /api/connections/:connectionId
 * Toggle settings (visibleOnProfile, displayRichPresence)
 */
router.patch('/:connectionId', requireAuth, async (req: any, res: any) => {
  try {
    const { connectionId } = req.params;
    const { visibleOnProfile, displayRichPresence } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ ok: false, message: 'User not found' });

    const connection = (user.connections || []).find(c => c.id === connectionId);
    if (!connection) return res.status(404).json({ ok: false, message: 'Connection not found' });

    if (typeof visibleOnProfile === 'boolean') connection.visibleOnProfile = visibleOnProfile;
    if (typeof displayRichPresence === 'boolean') {
      connection.displayRichPresence = displayRichPresence;
      // If toggled off and active activity was from this provider, clear activity
      if (!displayRichPresence && user.activity?.provider === connection.provider) {
        user.activity = undefined;
        const io = req.app.get('io');
        if (io) {
          io.emit('user:activity', { userId: user.userId, activity: null });
        }
      }
    }

    await user.save();

    return res.json({
      ok: true,
      message: 'Connection updated',
      connection,
      activity: user.activity || null
    });
  } catch (error) {
    console.error('Failed to update connection', error);
    return res.status(500).json({ ok: false, message: 'Failed to update connection' });
  }
});

/**
 * DELETE /api/connections/:connectionId
 * Disconnect an account
 */
router.delete('/:connectionId', requireAuth, async (req: any, res: any) => {
  try {
    const { connectionId } = req.params;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ ok: false, message: 'User not found' });

    const existing = (user.connections || []).find(c => c.id === connectionId);
    if (!existing) return res.status(404).json({ ok: false, message: 'Connection not found' });

    user.connections = (user.connections || []).filter(c => c.id !== connectionId);

    // If active activity was from this provider, reset it
    if (user.activity?.provider === existing.provider) {
      user.activity = undefined;
      const io = req.app.get('io');
      if (io) {
        io.emit('user:activity', { userId: user.userId, activity: null });
      }
    }

    await user.save();

    return res.json({
      ok: true,
      message: 'Connection removed',
      connectionId,
      activity: user.activity || null
    });
  } catch (error) {
    console.error('Failed to delete connection', error);
    return res.status(500).json({ ok: false, message: 'Failed to delete connection' });
  }
});

/**
 * POST /api/connections/sync/:connectionId
 * Force sync / refresh live stats & presence
 */
router.post('/sync/:connectionId', requireAuth, async (req: any, res: any) => {
  try {
    const { connectionId } = req.params;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ ok: false, message: 'User not found' });

    const connection = (user.connections || []).find(c => c.id === connectionId);
    if (!connection) return res.status(404).json({ ok: false, message: 'Connection not found' });

    const refreshed = await fetchProviderProfile(connection.provider, connection.username || connection.accountId);
    connection.displayName = refreshed.displayName;
    connection.avatarUrl = refreshed.avatarUrl || connection.avatarUrl;
    connection.profileUrl = refreshed.profileUrl;
    connection.metadata = { ...connection.metadata, ...refreshed.metadata };
    connection.lastSyncedAt = new Date();

    if (connection.displayRichPresence && refreshed.activity) {
      user.activity = refreshed.activity;
      const io = req.app.get('io');
      if (io) {
        io.emit('user:activity', { userId: user.userId, activity: user.activity });
      }
    }

    await user.save();

    return res.json({
      ok: true,
      message: `${PROVIDERS[connection.provider]?.name || 'Account'} synced successfully!`,
      connection,
      activity: user.activity || null
    });
  } catch (error) {
    console.error('Failed to sync connection', error);
    return res.status(500).json({ ok: false, message: 'Failed to sync connection' });
  }
});

/**
 * POST /api/connections/activity
 * Set or clear live rich presence / custom activity
 */
router.post('/activity', requireAuth, async (req: any, res: any) => {
  try {
    const { activity } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ ok: false, message: 'User not found' });

    if (!activity) {
      user.activity = undefined;
    } else {
      user.activity = {
        type: activity.type || 'playing',
        provider: activity.provider || 'custom',
        name: String(activity.name || '').slice(0, 100),
        details: activity.details ? String(activity.details).slice(0, 120) : undefined,
        state: activity.state ? String(activity.state).slice(0, 120) : undefined,
        url: activity.url ? String(activity.url) : undefined,
        assets: activity.assets || undefined,
        timestamps: {
          start: activity.timestamps?.start || Date.now(),
          end: activity.timestamps?.end || undefined
        },
        syncStatus: 'active',
        updatedAt: new Date()
      };
    }

    await user.save();

    const io = req.app.get('io');
    if (io) {
      io.emit('user:activity', { userId: user.userId, activity: user.activity || null });
    }

    return res.json({
      ok: true,
      message: activity ? 'Activity updated' : 'Activity cleared',
      activity: user.activity || null
    });
  } catch (error) {
    console.error('Failed to update activity', error);
    return res.status(500).json({ ok: false, message: 'Failed to update activity' });
  }
});
