type SpotifyArtist = {
  spotifyId: string;
  name: string;
  imageUrl: string | null;
  genres: string[];
};

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.value;
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Spotify credentials are not configured");
  }

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    throw new Error(`Spotify token request failed: ${res.status}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    value: data.access_token,
    // Refresh a little early so we don't race a mid-request expiry.
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return cachedToken.value;
}

export async function searchArtists(query: string): Promise<SpotifyArtist[]> {
  const token = await getAccessToken();

  const res = await fetch(
    `https://api.spotify.com/v1/search?type=artist&limit=10&q=${encodeURIComponent(query)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  if (!res.ok) {
    throw new Error(`Spotify search failed: ${res.status}`);
  }

  const data = (await res.json()) as {
    artists: {
      items: Array<{
        id: string;
        name: string;
        images: Array<{ url: string }>;
        genres: string[];
      }>;
    };
  };

  return data.artists.items.map((artist) => ({
    spotifyId: artist.id,
    name: artist.name,
    imageUrl: artist.images[0]?.url ?? null,
    genres: artist.genres,
  }));
}
