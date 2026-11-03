import { Pressable, StyleSheet, Text, View } from 'react-native';

/**
 * An internal screen that never ships to users (reached by long-pressing the
 * version number on Account). It's full of issues on purpose, and
 *
 *   screens: { ignore: ['dev-menu'] }
 *
 * in v6y.config.ts tells v6y to skip it. Watch for "[v6y] dev-menu: skipped".
 */
export default function DevMenu() {
  return (
    <View style={styles.screen}>
      <Text style={styles.text}>Feature flags</Text>
      <View style={styles.row}>
        <Pressable onPress={() => {}} style={styles.tiny} />
        <Pressable onPress={() => {}} style={styles.tiny} />
        <Pressable onPress={() => {}} style={styles.tiny} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 16, gap: 12, backgroundColor: '#ffffff' },
  text: { color: '#c7c7cc', fontSize: 13 },
  row: { flexDirection: 'row', gap: 8 },
  tiny: { width: 16, height: 16, borderRadius: 4, backgroundColor: '#ff9f0a' },
});
