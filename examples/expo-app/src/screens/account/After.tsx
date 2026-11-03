import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { colors } from '@/demo/data';

const ROWS = ['Order history', 'Payment methods'] as const;

/** Account, AFTER. Compare with ./Before.tsx. */
export default function AccountAfter() {
  const router = useRouter();
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={styles.title}>
        Account
      </Text>
      <Text style={styles.subtitle}>sam@example.com</Text>

      {ROWS.map((row) => (
        <Pressable key={row} accessibilityRole="button" onPress={() => {}} style={styles.row}>
          <Text style={styles.rowText}>{row}</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.mutedText} />
        </Pressable>
      ))}

      <Pressable accessibilityRole="button" onPress={() => {}} style={styles.signOutRow}>
        <Text style={styles.signOut}>Sign out</Text>
      </Pressable>

      {/* The one legitimate exception stays, with its reason. v6y counts it as suppressed. */}
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
  signOutRow: { minHeight: 48, justifyContent: 'center', marginTop: 16 },
  signOut: { color: colors.danger, fontSize: 17, fontWeight: '600' },
  versionRow: { minHeight: 48, justifyContent: 'center' },
  version: { color: colors.mutedText, fontSize: 13 },
});
