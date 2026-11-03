import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

/**
 * A banner from the old app that hasn't been rewritten yet. It has several
 * issues (low contrast, an unlabelled close button), but v6y.config.ts has
 *
 *   ignore: ['src/legacy/**']
 *
 * so they're counted as "suppressed" instead of failing CI. That lets a team
 * adopt v6y today and burn down legacy debt later.
 */
export function LegacyPromoBanner() {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;
  return (
    <View style={styles.banner}>
      <Text style={styles.text}>2-for-1 lattes before 9am</Text>
      <TouchableOpacity onPress={() => setVisible(false)} style={styles.close}>
        <Ionicons name="close" size={16} color="#ffffff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#ff9f0a',
  },
  text: { flex: 1, color: '#ffffff', fontSize: 15, fontWeight: '600' },
  close: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
});
