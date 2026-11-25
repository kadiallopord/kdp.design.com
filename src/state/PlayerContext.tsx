import { createAudioPlayer, setAudioModeAsync, useAudioPlayerStatus, type AudioPlayer } from 'expo-audio';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getArtist, getAlbum } from '../data/catalog';
import type { RadioStation, Track } from '../data/types';
import { useLibrary } from './LibraryContext';

export type NowPlaying =
  | { kind: 'track'; track: Track }
  | { kind: 'radio'; station: RadioStation };

type PlayerApi = {
  current: NowPlaying | null;
  queue: Track[];
  index: number;
  playing: boolean;
  buffering: boolean;
  position: number;
  duration: number;
  shuffle: boolean;
  repeat: 'off' | 'all' | 'one';
  playTracks: (tracks: Track[], startIndex?: number) => void;
  playRadio: (station: RadioStation) => void;
  togglePlay: () => void;
  next: () => void;
  previous: () => void;
  seekTo: (sec: number) => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  stop: () => void;
};

const PlayerContext = createContext<PlayerApi | null>(null);

let sharedPlayer: AudioPlayer | null = null;
const getPlayer = () => {
  if (!sharedPlayer) sharedPlayer = createAudioPlayer(null, { updateInterval: 500 });
  return sharedPlayer;
};

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const player = getPlayer();
  const status = useAudioPlayerStatus(player);
  const { recordPlay } = useLibrary();

  const [queue, setQueue] = useState<Track[]>([]);
  const [index, setIndex] = useState(0);
  const [current, setCurrent] = useState<NowPlaying | null>(null);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<'off' | 'all' | 'one'>('off');
  const finishedFor = useRef<string | null>(null);

  // Écoute en arrière-plan : la session audio reste active quand l'app passe en fond.
  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
    }).catch(() => {});
  }, []);

  const load = useCallback(
    (item: NowPlaying) => {
      const url = item.kind === 'track' ? item.track.audioUrl : item.station.streamUrl;
      player.replace({ uri: url });
      player.play();
      setCurrent(item);
      finishedFor.current = null;
      const metadata =
        item.kind === 'track'
          ? {
              title: item.track.title,
              artist: getArtist(item.track.artistId)?.name,
              albumTitle: getAlbum(item.track.albumId)?.title,
            }
          : { title: item.station.name, artist: 'En direct • SAMMEERE JIME' };
      try {
        // Contrôles sur l'écran verrouillé (nécessaire sur Android pour l'écoute longue en fond).
        player.setActiveForLockScreen(true, metadata, { showSeekForward: true, showSeekBackward: true });
      } catch {
        // non disponible sur certaines plateformes (web)
      }
      if (item.kind === 'track') recordPlay(item.track.id);
    },
    [player, recordPlay],
  );

  const playTracks = useCallback(
    (tracks: Track[], startIndex = 0) => {
      if (!tracks.length) return;
      setQueue(tracks);
      setIndex(startIndex);
      load({ kind: 'track', track: tracks[startIndex] });
    },
    [load],
  );

  const playRadio = useCallback(
    (station: RadioStation) => {
      setQueue([]);
      setIndex(0);
      load({ kind: 'radio', station });
    },
    [load],
  );

  const goTo = useCallback(
    (i: number) => {
      if (!queue.length) return;
      const wrapped = (i + queue.length) % queue.length;
      setIndex(wrapped);
      load({ kind: 'track', track: queue[wrapped] });
    },
    [queue, load],
  );

  const next = useCallback(() => {
    if (current?.kind !== 'track' || !queue.length) return;
    if (shuffle && queue.length > 1) {
      let r = index;
      while (r === index) r = Math.floor(Math.random() * queue.length);
      goTo(r);
    } else {
      goTo(index + 1);
    }
  }, [current, queue, index, shuffle, goTo]);

  const previous = useCallback(() => {
    if (current?.kind !== 'track') return;
    if (status.currentTime > 3) {
      player.seekTo(0);
      return;
    }
    goTo(index - 1);
  }, [current, status.currentTime, player, index, goTo]);

  // Enchaînement automatique à la fin d'un titre.
  useEffect(() => {
    if (!status.didJustFinish || current?.kind !== 'track') return;
    const key = `${current.track.id}:${index}`;
    if (finishedFor.current === key) return;
    finishedFor.current = key;
    if (repeat === 'one') {
      player.seekTo(0);
      player.play();
      recordPlay(current.track.id);
    } else if (shuffle || repeat === 'all' || index < queue.length - 1) {
      next();
    }
  }, [status.didJustFinish, current, index, queue.length, repeat, shuffle, next, player, recordPlay]);

  const togglePlay = useCallback(() => {
    if (!current) return;
    if (status.playing) player.pause();
    else player.play();
  }, [current, status.playing, player]);

  const stop = useCallback(() => {
    player.pause();
    try {
      player.clearLockScreenControls();
    } catch {}
    setCurrent(null);
    setQueue([]);
  }, [player]);

  const api = useMemo<PlayerApi>(
    () => ({
      current,
      queue,
      index,
      playing: status.playing,
      buffering: status.isBuffering,
      position: status.currentTime,
      duration: current?.kind === 'track' ? status.duration || current.track.durationSec : 0,
      shuffle,
      repeat,
      playTracks,
      playRadio,
      togglePlay,
      next,
      previous,
      seekTo: (sec) => player.seekTo(sec),
      toggleShuffle: () => setShuffle((s) => !s),
      cycleRepeat: () => setRepeat((r) => (r === 'off' ? 'all' : r === 'all' ? 'one' : 'off')),
      stop,
    }),
    [current, queue, index, status, shuffle, repeat, playTracks, playRadio, togglePlay, next, previous, player, stop],
  );

  return <PlayerContext.Provider value={api}>{children}</PlayerContext.Provider>;
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer doit être utilisé dans PlayerProvider');
  return ctx;
}
