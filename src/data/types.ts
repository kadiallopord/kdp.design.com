export type Genre = 'Rap Pulaar' | 'Pulaar traditionnel' | 'Afrobeat' | 'Mbalax' | 'Afro-pop';

export type Artist = {
  id: string;
  name: string;
  bio: string;
  genre: Genre;
  followers: number;
  palette: [string, string];
  socials: { label: string; handle: string }[];
};

export type Album = {
  id: string;
  title: string;
  artistId: string;
  year: number;
  releaseDate: string; // AAAA-MM-JJ
  priceFcfa: number;
  palette: [string, string];
  exclusive?: boolean;
  preorder?: boolean; // sortie à venir, précommande possible
  salesCount: number;
};

export type Track = {
  id: string;
  title: string;
  artistId: string;
  albumId: string;
  durationSec: number;
  audioUrl: string;
  basePlays: number; // écoutes de démonstration, cumulées aux écoutes réelles de l'appareil
  addedAt: string;
};

export type RadioStation = {
  id: string;
  name: string;
  tagline: string;
  streamUrl: string;
  palette: [string, string];
  schedule: { time: string; show: string }[];
};

export type VideoCategory = 'Clip' | 'Exclusivité' | 'Interview' | 'Événement';

export type Video = {
  id: string;
  title: string;
  artistId?: string;
  category: VideoCategory;
  durationSec: number;
  videoUrl: string;
  publishedAt: string;
  palette: [string, string];
  views: number;
};
