/**
 * CATALOGUE DE DÉMONSTRATION
 * ---------------------------------------------------------------------------
 * Les artistes, albums, titres, radios et vidéos ci-dessous sont FICTIFS.
 * Ils servent à faire fonctionner l'application en attendant le backend
 * (base de données + stockage média). Les fichiers audio et vidéo pointent
 * vers des échantillons libres (SoundHelix, Google sample videos) et doivent
 * être remplacés par les vrais contenus des artistes.
 */
import type { Album, Artist, RadioStation, Track, Video } from './types';

const sh = (n: number) => `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${n}.mp3`;
const gv = (name: string) =>
  `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/${name}.mp4`;

export const artists: Artist[] = [
  {
    id: 'a1',
    name: 'Demba Fuuta',
    genre: 'Rap Pulaar',
    followers: 48200,
    palette: ['#3A2A05', '#D4AF37'],
    bio: "Rappeur originaire du Fuuta Tooro, Demba Fuuta mélange flow moderne et proverbes pulaar. (Profil de démonstration)",
    socials: [
      { label: 'Instagram', handle: '@dembafuuta' },
      { label: 'TikTok', handle: '@dembafuuta' },
    ],
  },
  {
    id: 'a2',
    name: 'Kumba Jaawo',
    genre: 'Pulaar traditionnel',
    followers: 31500,
    palette: ['#2B0F0F', '#C0663A'],
    bio: "Chanteuse à la voix puissante, Kumba Jaawo fait vivre le répertoire traditionnel peul avec le hoddu et le riiti. (Profil de démonstration)",
    socials: [{ label: 'Facebook', handle: 'Kumba Jaawo Officiel' }],
  },
  {
    id: 'a3',
    name: 'Seydi Lamtoro',
    genre: 'Rap Pulaar',
    followers: 22800,
    palette: ['#0B1B2B', '#3F8FD4'],
    bio: "Jeune voix du rap pulaar de Dakar, textes engagés sur la jeunesse et l'exil. (Profil de démonstration)",
    socials: [
      { label: 'Instagram', handle: '@seydilamtoro' },
      { label: 'YouTube', handle: 'Seydi Lamtoro' },
    ],
  },
  {
    id: 'a4',
    name: 'Awa Ndiaye Beats',
    genre: 'Afrobeat',
    followers: 40100,
    palette: ['#1A0B2B', '#9B5BD4'],
    bio: "Productrice et chanteuse afrobeat, ponts entre Lagos, Dakar et Conakry. (Profil de démonstration)",
    socials: [{ label: 'Instagram', handle: '@awandiayebeats' }],
  },
  {
    id: 'a5',
    name: 'Orchestre Gede',
    genre: 'Mbalax',
    followers: 15600,
    palette: ['#0B2B14', '#3FD47A'],
    bio: "Formation live de Saint-Louis, entre mbalax, yéla et percussions. (Profil de démonstration)",
    socials: [{ label: 'Facebook', handle: 'Orchestre Gede' }],
  },
  {
    id: 'a6',
    name: 'Hawa Sow',
    genre: 'Afro-pop',
    followers: 27400,
    palette: ['#2B1A05', '#F1D27A'],
    bio: "Afro-pop chantée en pulaar, wolof et français. (Profil de démonstration)",
    socials: [{ label: 'TikTok', handle: '@hawasow' }],
  },
];

export const albums: Album[] = [
  { id: 'al1', title: 'Fuuta Flow', artistId: 'a1', year: 2026, releaseDate: '2026-10-02', priceFcfa: 3000, palette: ['#1A1405', '#D4AF37'], salesCount: 1840, exclusive: true },
  { id: 'al2', title: 'Ndiyam', artistId: 'a2', year: 2025, releaseDate: '2025-06-14', priceFcfa: 2500, palette: ['#2B0F0F', '#E08A5A'], salesCount: 1210 },
  { id: 'al3', title: 'Lamtoro', artistId: 'a3', year: 2026, releaseDate: '2026-11-08', priceFcfa: 2000, palette: ['#0B1B2B', '#5FA8E8'], salesCount: 760 },
  { id: 'al4', title: 'Dakar Nights', artistId: 'a4', year: 2026, releaseDate: '2026-08-21', priceFcfa: 3500, palette: ['#1A0B2B', '#B47BE8'], salesCount: 1530 },
  { id: 'al5', title: 'Ndar Live', artistId: 'a5', year: 2024, releaseDate: '2024-12-01', priceFcfa: 2000, palette: ['#0B2B14', '#5FE89A'], salesCount: 540 },
  { id: 'al6', title: 'Jam Tan', artistId: 'a6', year: 2026, releaseDate: '2026-09-12', priceFcfa: 2500, palette: ['#2B1A05', '#F1D27A'], salesCount: 980 },
  { id: 'al7', title: 'Bamtaare', artistId: 'a1', year: 2027, releaseDate: '2027-01-15', priceFcfa: 3000, palette: ['#050505', '#D4AF37'], salesCount: 0, preorder: true, exclusive: true },
];

export const tracks: Track[] = [
  { id: 't1', title: 'Fuuta Tooro', artistId: 'a1', albumId: 'al1', durationSec: 372, audioUrl: sh(1), basePlays: 128400, addedAt: '2026-10-02' },
  { id: 't2', title: 'Ɓiɗɗo Leydi', artistId: 'a1', albumId: 'al1', durationSec: 425, audioUrl: sh(2), basePlays: 97300, addedAt: '2026-10-02' },
  { id: 't3', title: 'Jam Waali', artistId: 'a1', albumId: 'al1', durationSec: 344, audioUrl: sh(3), basePlays: 64100, addedAt: '2026-10-02' },
  { id: 't4', title: 'Ndiyam', artistId: 'a2', albumId: 'al2', durationSec: 302, audioUrl: sh(4), basePlays: 88200, addedAt: '2025-06-14' },
  { id: 't5', title: 'Hoddu', artistId: 'a2', albumId: 'al2', durationSec: 353, audioUrl: sh(5), basePlays: 51000, addedAt: '2025-06-14' },
  { id: 't6', title: 'Lamtoro', artistId: 'a3', albumId: 'al3', durationSec: 297, audioUrl: sh(6), basePlays: 72600, addedAt: '2026-11-08' },
  { id: 't7', title: 'Exil', artistId: 'a3', albumId: 'al3', durationSec: 312, audioUrl: sh(7), basePlays: 45800, addedAt: '2026-11-08' },
  { id: 't8', title: 'Dakar Nights', artistId: 'a4', albumId: 'al4', durationSec: 330, audioUrl: sh(8), basePlays: 110900, addedAt: '2026-08-21' },
  { id: 't9', title: 'Lagos to Ndar', artistId: 'a4', albumId: 'al4', durationSec: 290, audioUrl: sh(9), basePlays: 83300, addedAt: '2026-08-21' },
  { id: 't10', title: 'Ndar Ndar', artistId: 'a5', albumId: 'al5', durationSec: 361, audioUrl: sh(10), basePlays: 30400, addedAt: '2024-12-01' },
  { id: 't11', title: 'Jam Tan', artistId: 'a6', albumId: 'al6', durationSec: 318, audioUrl: sh(11), basePlays: 76500, addedAt: '2026-09-12' },
  { id: 't12', title: 'Yiɗde', artistId: 'a6', albumId: 'al6', durationSec: 284, audioUrl: sh(12), basePlays: 58900, addedAt: '2026-09-12' },
  { id: 't13', title: 'Bamtaare (extrait)', artistId: 'a1', albumId: 'al7', durationSec: 260, audioUrl: sh(13), basePlays: 12300, addedAt: '2026-11-20' },
];

export const radios: RadioStation[] = [
  { id: 'r1', name: 'Radio Sammeere Jime', tagline: 'La station officielle', streamUrl: sh(14), palette: ['#1A1405', '#D4AF37'],
    schedule: [{ time: '06:00', show: 'Réveil Pulaar' }, { time: '12:00', show: 'Midi Sammeere' }, { time: '20:00', show: 'Les sorties de la semaine' }] },
  { id: 'r2', name: 'Radio Rap Pulaar', tagline: '100 % rap pulaar', streamUrl: sh(15), palette: ['#050505', '#D4AF37'],
    schedule: [{ time: '10:00', show: 'Freestyle Fuuta' }, { time: '18:00', show: 'Top Rap Pulaar' }, { time: '22:00', show: 'Underground' }] },
  { id: 'r3', name: 'Radio Sénégal', tagline: 'Mbalax, yéla et plus', streamUrl: sh(16), palette: ['#0B2B14', '#3FD47A'],
    schedule: [{ time: '08:00', show: 'Matinale' }, { time: '14:00', show: 'Mbalax Time' }, { time: '21:00', show: 'Soirée live' }] },
  { id: 'r4', name: 'Radio Afrique', tagline: 'Le continent en musique', streamUrl: sh(14), palette: ['#2B0F0F', '#E08A5A'],
    schedule: [{ time: '09:00', show: 'Afrique de l’Ouest' }, { time: '15:00', show: 'Afrique centrale' }, { time: '19:00', show: 'Afrique de l’Est' }] },
  { id: 'r5', name: 'Radio Afrobeat', tagline: 'Les hits afrobeat', streamUrl: sh(15), palette: ['#1A0B2B', '#B47BE8'],
    schedule: [{ time: '11:00', show: 'Afro Morning' }, { time: '17:00', show: 'Afro Hits' }, { time: '23:00', show: 'Afro Night' }] },
  { id: 'r6', name: 'Radio Musique traditionnelle', tagline: 'Hoddu, riiti et griots', streamUrl: sh(16), palette: ['#2B1A05', '#C0663A'],
    schedule: [{ time: '07:00', show: 'Contes et chants' }, { time: '13:00', show: 'Les griots' }, { time: '20:30', show: 'Veillée' }] },
];

export const videos: Video[] = [
  { id: 'v1', title: 'Fuuta Tooro (Clip officiel)', artistId: 'a1', category: 'Clip', durationSec: 596, videoUrl: gv('BigBuckBunny'), publishedAt: '2026-11-18', palette: ['#1A1405', '#D4AF37'], views: 215000 },
  { id: 'v2', title: 'Dakar Nights (Clip officiel)', artistId: 'a4', category: 'Clip', durationSec: 653, videoUrl: gv('ElephantsDream'), publishedAt: '2026-11-10', palette: ['#1A0B2B', '#B47BE8'], views: 168000 },
  { id: 'v3', title: 'Bamtaare : les coulisses', artistId: 'a1', category: 'Exclusivité', durationSec: 15, videoUrl: gv('ForBiggerBlazes'), publishedAt: '2026-11-21', palette: ['#050505', '#D4AF37'], views: 42000 },
  { id: 'v4', title: 'Kumba Jaawo : l’héritage du hoddu', artistId: 'a2', category: 'Interview', durationSec: 15, videoUrl: gv('ForBiggerEscapes'), publishedAt: '2026-11-05', palette: ['#2B0F0F', '#E08A5A'], views: 23000 },
  { id: 'v5', title: 'Seydi Lamtoro parle de l’exil', artistId: 'a3', category: 'Interview', durationSec: 15, videoUrl: gv('ForBiggerFun'), publishedAt: '2026-11-12', palette: ['#0B1B2B', '#5FA8E8'], views: 19000 },
  { id: 'v6', title: 'Festival Pulaar de Podor 2026', category: 'Événement', durationSec: 15, videoUrl: gv('ForBiggerJoyrides'), publishedAt: '2026-10-28', palette: ['#0B2B14', '#5FE89A'], views: 37000 },
];

export const getArtist = (id: string) => artists.find((a) => a.id === id);
export const getAlbum = (id: string) => albums.find((a) => a.id === id);
export const getTrack = (id: string) => tracks.find((t) => t.id === id);
export const getVideo = (id: string) => videos.find((v) => v.id === id);
export const getRadio = (id: string) => radios.find((r) => r.id === id);
export const tracksOfAlbum = (albumId: string) => tracks.filter((t) => t.albumId === albumId);
export const tracksOfArtist = (artistId: string) => tracks.filter((t) => t.artistId === artistId);
export const albumsOfArtist = (artistId: string) => albums.filter((a) => a.artistId === artistId);
export const videosOfArtist = (artistId: string) => videos.filter((v) => v.artistId === artistId);
