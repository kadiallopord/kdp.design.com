import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { EmptyState, GoldButton } from '../../components/Cards';
import { Cover } from '../../components/Cover';
import { TrackRow } from '../../components/TrackRow';
import { getAlbum, getTrack } from '../../data/catalog';
import type { Track } from '../../data/types';
import { useLibrary } from '../../state/LibraryContext';
import { usePlayer } from '../../state/PlayerContext';
import { colors, font, radius, spacing } from '../../theme';

export default function PlaylistScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const lib = useLibrary();
  const { playTracks } = usePlayer();
  const playlist = lib.playlists.find((p) => p.id === id);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(playlist?.name ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!playlist) return <Text style={{ color: colors.text, padding: spacing.lg }}>Playlist introuvable.</Text>;
  const list = playlist.trackIds.map(getTrack).filter(Boolean) as Track[];
  const palette = list[0] ? getAlbum(list[0].albumId)?.palette ?? ['#1A1405', '#D4AF37'] : ['#1A1405', '#D4AF37'];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ paddingBottom: spacing.xxl }}>
      <Stack.Screen options={{ title: playlist.name }} />
      <View style={{ alignItems: 'center', paddingTop: spacing.lg }}>
        <Cover palette={palette as [string, string]} icon="musical-notes" size={180} />
        {editing ? (
          <View style={styles.editRow}>
            <TextInput value={name} onChangeText={setName} style={styles.input} autoFocus placeholderTextColor={colors.textFaint} />
            <GoldButton label="OK" onPress={() => { lib.renamePlaylist(playlist.id, name.trim() || playlist.name); setEditing(false); }} />
          </View>
        ) : (
          <Pressable onPress={() => setEditing(true)}>
            <Text style={[font.title, { marginTop: spacing.lg }]}>{playlist.name} ✎</Text>
          </Pressable>
        )}
        <Text style={font.small}>{list.length} titre{list.length > 1 ? 's' : ''}</Text>
      </View>

      <View style={styles.actions}>
        <GoldButton label="Écouter" icon="play" disabled={!list.length} onPress={() => playTracks(list)} />
        {confirmDelete ? (
          <GoldButton label="Confirmer la suppression" icon="trash" outline onPress={() => { lib.deletePlaylist(playlist.id); router.back(); }} />
        ) : (
          <GoldButton label="Supprimer" icon="trash-outline" outline onPress={() => setConfirmDelete(true)} />
        )}
      </View>

      <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md }}>
        {list.length === 0 ? (
          <EmptyState icon="add-circle-outline" title="Playlist vide" text="Ajoutez des titres avec le bouton + à côté de chaque chanson." />
        ) : (
          list.map((t, i) => <TrackRow key={t.id} track={t} queue={list} index={i} onRemove={() => lib.removeFromPlaylist(playlist.id, t.id)} />)
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', justifyContent: 'center', gap: spacing.md, marginTop: spacing.lg, flexWrap: 'wrap' },
  editRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg, paddingHorizontal: spacing.lg, alignItems: 'center' },
  input: { flex: 1, backgroundColor: colors.surfaceRaised, color: colors.white, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 10, fontSize: 16 },
});
