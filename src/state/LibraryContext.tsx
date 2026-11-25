import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

export type Playlist = { id: string; name: string; trackIds: string[]; createdAt: number };

type LibraryState = {
  favorites: string[]; // ids de titres
  playlists: Playlist[];
  followedArtists: string[];
  playCounts: Record<string, number>; // écoutes faites sur cet appareil
  history: { trackId: string; at: number }[];
};

type LibraryApi = LibraryState & {
  ready: boolean;
  isFavorite: (trackId: string) => boolean;
  toggleFavorite: (trackId: string) => void;
  createPlaylist: (name: string) => Playlist;
  renamePlaylist: (id: string, name: string) => void;
  deletePlaylist: (id: string) => void;
  addToPlaylist: (playlistId: string, trackId: string) => void;
  removeFromPlaylist: (playlistId: string, trackId: string) => void;
  isFollowing: (artistId: string) => boolean;
  toggleFollow: (artistId: string) => void;
  recordPlay: (trackId: string) => void;
};

const STORAGE_KEY = 'sammeere-jime/library/v1';
const EMPTY: LibraryState = { favorites: [], playlists: [], followedArtists: [], playCounts: {}, history: [] };

const LibraryContext = createContext<LibraryApi | null>(null);

export function LibraryProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<LibraryState>(EMPTY);
  const [ready, setReady] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setState({ ...EMPTY, ...JSON.parse(raw) });
      })
      .catch(() => {})
      .finally(() => {
        loaded.current = true;
        setReady(true);
      });
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
  }, [state]);

  const toggleFavorite = useCallback((trackId: string) => {
    setState((s) => ({
      ...s,
      favorites: s.favorites.includes(trackId)
        ? s.favorites.filter((id) => id !== trackId)
        : [trackId, ...s.favorites],
    }));
  }, []);

  const createPlaylist = useCallback((name: string) => {
    const p: Playlist = { id: `pl_${Date.now()}`, name: name.trim() || 'Nouvelle playlist', trackIds: [], createdAt: Date.now() };
    setState((s) => ({ ...s, playlists: [p, ...s.playlists] }));
    return p;
  }, []);

  const renamePlaylist = useCallback((id: string, name: string) => {
    setState((s) => ({ ...s, playlists: s.playlists.map((p) => (p.id === id ? { ...p, name } : p)) }));
  }, []);

  const deletePlaylist = useCallback((id: string) => {
    setState((s) => ({ ...s, playlists: s.playlists.filter((p) => p.id !== id) }));
  }, []);

  const addToPlaylist = useCallback((playlistId: string, trackId: string) => {
    setState((s) => ({
      ...s,
      playlists: s.playlists.map((p) =>
        p.id === playlistId && !p.trackIds.includes(trackId) ? { ...p, trackIds: [...p.trackIds, trackId] } : p,
      ),
    }));
  }, []);

  const removeFromPlaylist = useCallback((playlistId: string, trackId: string) => {
    setState((s) => ({
      ...s,
      playlists: s.playlists.map((p) =>
        p.id === playlistId ? { ...p, trackIds: p.trackIds.filter((t) => t !== trackId) } : p,
      ),
    }));
  }, []);

  const toggleFollow = useCallback((artistId: string) => {
    setState((s) => ({
      ...s,
      followedArtists: s.followedArtists.includes(artistId)
        ? s.followedArtists.filter((a) => a !== artistId)
        : [...s.followedArtists, artistId],
    }));
  }, []);

  const recordPlay = useCallback((trackId: string) => {
    setState((s) => ({
      ...s,
      playCounts: { ...s.playCounts, [trackId]: (s.playCounts[trackId] ?? 0) + 1 },
      history: [{ trackId, at: Date.now() }, ...s.history].slice(0, 200),
    }));
  }, []);

  const api = useMemo<LibraryApi>(
    () => ({
      ...state,
      ready,
      isFavorite: (id) => state.favorites.includes(id),
      toggleFavorite,
      createPlaylist,
      renamePlaylist,
      deletePlaylist,
      addToPlaylist,
      removeFromPlaylist,
      isFollowing: (id) => state.followedArtists.includes(id),
      toggleFollow,
      recordPlay,
    }),
    [state, ready, toggleFavorite, createPlaylist, renamePlaylist, deletePlaylist, addToPlaylist, removeFromPlaylist, toggleFollow, recordPlay],
  );

  return <LibraryContext.Provider value={api}>{children}</LibraryContext.Provider>;
}

export function useLibrary() {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error('useLibrary doit être utilisé dans LibraryProvider');
  return ctx;
}
