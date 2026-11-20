const SPOTIFY_CLIENT_ID = 'c40ba33f45344a5c93734a82c44801e1';
const SPOTIFY_CLIENT_SECRET = 'd71e1ecfd59f4894b9b6470b22fad904';

let accessToken: string | null = null;
let tokenExpiry: number | null = null;

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: { name: string }[];
  album: {
    name: string;
    images: { url: string; height: number; width: number }[];
  };
  duration_ms: number;
  preview_url: string | null;
  external_urls: { spotify: string };
}

export async function getAccessToken(): Promise<string> {
  // Check if we have a valid token
  if (accessToken && tokenExpiry && Date.now() < tokenExpiry) {
    return accessToken;
  }

  // Get new token
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + btoa(SPOTIFY_CLIENT_ID + ':' + SPOTIFY_CLIENT_SECRET)
    },
    body: 'grant_type=client_credentials'
  });

  const data = await response.json();
  
  if (data.error) {
    throw new Error('Failed to get Spotify access token: ' + data.error);
  }

  if (!data.access_token) {
    throw new Error('No access token received from Spotify');
  }

  accessToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000; // Expire 1 minute early
  
  return accessToken!;
}

export async function searchTracks(query: string, limit: number = 10): Promise<SpotifyTrack[]> {
  try {
    const token = await getAccessToken();
    
    const response = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=${limit}`,
      {
        headers: {
          'Authorization': 'Bearer ' + token
        }
      }
    );

    const data = await response.json();
    
    if (data.error) {
      throw new Error('Spotify API error: ' + data.error.message);
    }

    return data.tracks.items.map((item: any) => ({
      id: item.id,
      name: item.name,
      artists: item.artists.map((a: any) => ({ name: a.name })),
      album: {
        name: item.album.name,
        images: item.album.images
      },
      duration_ms: item.duration_ms,
      preview_url: item.preview_url,
      external_urls: item.external_urls
    }));
  } catch (error) {
    console.error('Error searching Spotify tracks:', error);
    throw error;
  }
}

export async function getTrackById(trackId: string): Promise<SpotifyTrack> {
  try {
    const token = await getAccessToken();
    
    const response = await fetch(
      `https://api.spotify.com/v1/tracks/${trackId}`,
      {
        headers: {
          'Authorization': 'Bearer ' + token
        }
      }
    );

    const data = await response.json();
    
    if (data.error) {
      throw new Error('Spotify API error: ' + data.error.message);
    }

    return {
      id: data.id,
      name: data.name,
      artists: data.artists.map((a: any) => ({ name: a.name })),
      album: {
        name: data.album.name,
        images: data.album.images
      },
      duration_ms: data.duration_ms,
      preview_url: data.preview_url,
      external_urls: data.external_urls
    };
  } catch (error) {
    console.error('Error getting Spotify track:', error);
    throw error;
  }
}
