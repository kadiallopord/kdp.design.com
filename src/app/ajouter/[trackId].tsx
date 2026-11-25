import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { GoldButton } from '../../components/Cards';
import { getArtist, getTrack } from '../../data/catalog';
import { useLibrary } from '../../state/LibraryContext';
import { colors, font, radius, spacing } from '../../theme';

export default function AddToPlaylist() {
  const { trackId } = useLocalSearchParams<{ trackId: string }>();
  const track = getTrack(trackId);
  const lib = useLibrary();
  const [name, setName] = useState('');

  if (!track) return <Text style={{ color: colors.text, padding: spacing.lg }}>Titre introuvable.</Text>;

  const add = (playlistId: string) => {
    lib.addToPlaylist(playlistId, track.id);
    router.back();
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.lg }} keyboardShouldPersistTaps="handled">
      <Text style={font.h2}>{track.title}</Text>
      <Text style={font.small}>{getArtist(track.artistId)?.name}</Text>

      <View style={styles.createRow}>
        <TextInput value={name} onChangeText={setName} placeholder="Nouvelle playlist…" placeholderTextColor={colors.textFaint} style={styles.input} />
        <GoldButton label="Créer et ajouter" disabled={!name.trim()} onPress={() => add(lib.createPlaylist(name).id)} />
      </View>

      {lib.playlists.map((p) => {
        const already = p.trackIds.includes(track.id);
        return (
          <Pressable key={p.id} style={styles.row} disabled={already} onPress={() => add(p.id)}>
            <Ionicons name={already ? 'checkmark-circle' : 'list'} size={22} color={colors.gold} />
            <Text style={styles.name}>{p.name}</Text>
            <Text style={font.small}>{already ? 'Déjà ajouté' : `${p.trackIds.length} titres`}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  createRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', marginVertical: spacing.lg },
  input: { flex: 1, backgroundColor: colors.surfaceRaised, color: colors.white, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 10, borderWidth: 1, borderColor: colors.border },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  name: { color: colors.white, flex: 1, fontSize: 15, fontWeight: '600' },
});
