/**
 * Classements et recommandations.
 * Les chiffres = écoutes de démonstration du catalogue + écoutes réellement
 * faites dans l'application sur cet appareil. Quand le backend existera,
 * `basePlays` sera remplacé par les statistiques globales de la plateforme.
 */
import { albums, artists, tracks } from './catalog';
import type { Artist, Genre, Track } from './types';

export type PlayCounts = Record<string, number>;

export const totalPlays = (t: Track, counts: PlayCounts) => t.basePlays + (counts[t.id] ?? 0);

export const topTracks = (counts: PlayCounts, n = 10) =>
  [...tracks].sort((a, b) => totalPlays(b, counts) - totalPlays(a, counts)).slice(0, n);

export const artistPlays = (artistId: string, counts: PlayCounts) =>
  tracks.filter((t) => t.artistId === artistId).reduce((sum, t) => sum + totalPlays(t, counts), 0);

export const topArtists = (counts: PlayCounts, n = 10) =>
  [...artists].sort((a, b) => artistPlays(b.id, counts) - artistPlays(a.id, counts)).slice(0, n);

export const bestSellingAlbums = (n = 10) =>
  [...albums].filter((a) => !a.preorder).sort((a, b) => b.salesCount - a.salesCount).slice(0, n);

/** Artistes en progression : part des écoutes venant de titres sortis récemment. */
export const risingArtists = (counts: PlayCounts, n = 5): Artist[] => {
  const now = Date.now();
  const recentWeight = (t: Track) => {
    const ageDays = (now - new Date(t.addedAt).getTime()) / 86_400_000;
    return ageDays < 90 ? totalPlays(t, counts) / Math.max(ageDays, 1) : 0;
  };
  const score = (a: Artist) => tracks.filter((t) => t.artistId === a.id).reduce((s, t) => s + recentWeight(t), 0);
  return [...artists].filter((a) => score(a) > 0).sort((a, b) => score(b) - score(a)).slice(0, n);
};

/** Tendances de la semaine : titres de moins de 60 jours, triés par écoutes/jour. */
export const weeklyTrends = (counts: PlayCounts, n = 10) => {
  const now = Date.now();
  const perDay = (t: Track) => totalPlays(t, counts) / Math.max((now - new Date(t.addedAt).getTime()) / 86_400_000, 1);
  return [...tracks].sort((a, b) => perDay(b) - perDay(a)).slice(0, n);
};

export const newReleases = (n = 8) => [...tracks].sort((a, b) => b.addedAt.localeCompare(a.addedAt)).slice(0, n);

/**
 * Recommandations personnalisées : affinité par genre et par artiste calculée
 * à partir des écoutes, des favoris et des abonnements de l'utilisateur.
 */
export const recommendTracks = (
  input: { counts: PlayCounts; favorites: string[]; followed: string[] },
  n = 8,
): Track[] => {
  const genreOf = (artistId: string) => artists.find((a) => a.id === artistId)?.genre;
  const genreScore: Partial<Record<Genre, number>> = {};
  const artistScore: Record<string, number> = {};
  const bump = (t: Track | undefined, w: number) => {
    if (!t) return;
    const g = genreOf(t.artistId);
    if (g) genreScore[g] = (genreScore[g] ?? 0) + w;
    artistScore[t.artistId] = (artistScore[t.artistId] ?? 0) + w;
  };
  Object.entries(input.counts).forEach(([id, c]) => bump(tracks.find((t) => t.id === id), c));
  input.favorites.forEach((id) => bump(tracks.find((t) => t.id === id), 3));
  input.followed.forEach((a) => (artistScore[a] = (artistScore[a] ?? 0) + 5));

  const hasTaste = Object.keys(artistScore).length > 0;
  if (!hasTaste) return topTracks(input.counts, n);

  const score = (t: Track) => {
    const g = genreOf(t.artistId);
    const listened = input.counts[t.id] ?? 0;
    const novelty = listened === 0 ? 2 : 1 / (1 + listened);
    return ((g ? genreScore[g] ?? 0 : 0) * 2 + (artistScore[t.artistId] ?? 0)) * novelty + t.basePlays / 1_000_000;
  };
  return [...tracks].sort((a, b) => score(b) - score(a)).slice(0, n);
};
