import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AlbumCard, EmptyState, GoldButton } from '../../components/Cards';
import { Cover } from '../../components/Cover';
import { TabScreen } from '../../components/Screen';
import { Segmented } from '../../components/Segmented';
import { TrackRow } from '../../components/TrackRow';
import { albums, getTrack, tracks } from '../../data/catalog';
import type { Track } from '../../data/types';
import { useLibrary } from '../../state/LibraryContext';
import { colors, radius, spacing } from '../../theme';

const TABS = ['Titres', 'Albums', 'Playlists', 'Favoris'] as const;
type TabName = (typeof TABS)[number];

export default function Musique() {
  const [tab, setTab] = useState<TabName>('Titres');
  const lib = useLibrary();
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const favTracks = lib.favorites.map(getTrack).filter(Boolean) as Track[];

  return (
    <TabScreen title="Musique" subtitle="Votre bibliothèque">
      <Segmented options={TABS} value={tab} onChange={setTab} />

      {tab === 'Titres' && (
        <View style={styles.list}>
          {tracks.map((t, i) => <TrackRow key={t.id} track={t} queue={tracks} index={i} />)}
        </View>
      )}

      {tab === 'Albums' && (
        <View style={styles.grid}>
          {albums.map((a) => <AlbumCard key={a.id} album={a} width={158} />)}
        </View>
      )}

      {tab === 'Playlists' && (
        <View style={styles.list}>
          {creating ? (
            <View style={styles.createRow}>
              <TextInput
                autoFocus
                value={newName}
                onChangeText={setNewName}
                placeholder="Nom de la playlist"
                placeholderTextColor={colors.textFaint}
                style={styles.input}
                onSubmitEditing={() => {
                  lib.createPlaylist(newName);
                  setNewName('');
                  setCreating(false);
                }}
              />
              <GoldButton
                label="Créer"
                onPress={() => {
                  lib.createPlaylist(newName);
                  setNewName('');
                  setCreating(false);
                }}
              />
            </View>
          ) : (
            <View style={{ flexDirection: 'row', marginVertical: spacing.sm }}>
              <GoldButton label="Nouvelle playlist" icon="add" outline onPress={() => setCreating(true)} />
            </View>
          )}
          {lib.playlists.length === 0 ? (
            <EmptyState icon="list" title="Aucune playlist" text="Créez votre première playlist puis ajoutez-y des titres avec le bouton +." />
          ) : (
            lib.playlists.map((p) => {
              const first = p.trackIds[0] ? getTrack(p.trackIds[0]) : undefined;
              const album = first ? albums.find((a) => a.id === first.albumId) : undefined;
              return (
                <Pressable key={p.id} style={styles.plRow} onPress={() => router.push({ pathname: '/playlist/[id]', params: { id: p.id } })}>
                  <Cover palette={album?.palette ?? ['#1A1405', '#D4AF37']} icon="musical-notes" size={52} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.plName}>{p.name}</Text>
                    <Text style={styles.plSub}>{p.trackIds.length} titre{p.trackIds.length > 1 ? 's' : ''}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.textFaint} />
                </Pressable>
              );
            })
          )}
        </View>
      )}

      {tab === 'Favoris' && (
        <View style={styles.list}>
          {favTracks.length === 0 ? (
            <EmptyState icon="heart-outline" title="Pas encore de favoris" text="Touchez le cœur à côté d'un titre pour l'ajouter ici." />
          ) : (
            favTracks.map((t, i) => <TrackRow key={t.id} track={t} queue={favTracks} index={i} />)
          )}
        </View>
      )}
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: spacing.lg, marginTop: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg, paddingHorizontal: spacing.lg, marginTop: spacing.md },
  createRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', marginVertical: spacing.sm },
  input: { flex: 1, backgroundColor: colors.surfaceRaised, color: colors.white, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 10, borderWidth: 1, borderColor: colors.border },
  plRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  plName: { color: colors.white, fontWeight: '700', fontSize: 15 },
  plSub: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
});
