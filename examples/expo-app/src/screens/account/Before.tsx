import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';

import { colors } from '@/demo/data';

const ROWS = ['Order history', 'Payment methods'] as const;

/** Account, BEFORE. This tab has no navigation header, so the screen draws its own title. */
export default function AccountBefore() {
  const router = useRouter();
  return (
    <ScrollView contentContainerStyle={styles.content}>
      {/* ✖ missing-heading: a big bold "title" that isn't a heading */}
      <Text style={styles.title}>Account</Text>
      <Text style={styles.subtitle}>sam@example.com</Text>

      {ROWS.map((row) => (
        // ✖ missing-role ×2: rows that act like buttons but aren't announced as buttons
        <TouchableOpacity key={row} onPress={() => {}} style={styles.row}>
          <Text style={styles.rowText}>{row}</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.mutedText} />
        </TouchableOpacity>
      ))}

      {/* ✖ text-contrast: #ff6b6b on white is 2.78:1
          ✖ missing-role: pressable text, announced as plain text */}
      <Text style={styles.signOut} onPress={() => {}}>
        Sign out
      </Text>

      {/* v6y-ignore missing-role -- hidden developer shortcut (long-press), not a user-facing control */}
      <Pressable onLongPress={() => router.push('/dev-menu')} style={styles.versionRow}>
        <Text style={styles.version}>Version 1.0.0</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 4 },
  title: { color: colors.text, fontSize: 34, fontWeight: '700' },
  subtitle: { color: colors.mutedText, fontSize: 15, marginBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48, borderBottomWidth: 1, borderBottomColor: colors.surface },
  rowText: { color: colors.text, fontSize: 17 },
  signOut: { color: '#ff6b6b', fontSize: 17, fontWeight: '600', paddingVertical: 12, marginTop: 16 },
  versionRow: { paddingVertical: 12 },
  version: { color: colors.mutedText, fontSize: 13 },
});
