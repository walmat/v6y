import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, formatPrice } from '@/demo/data';

/** Checkout, AFTER. Compare with ./Before.tsx. */
export default function OrderAfter() {
  const [leaveAtDoor, setLeaveAtDoor] = useState(false);
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.line}>
        <Text style={styles.item}>Flat white × 2</Text>
        <Text style={styles.item}>{formatPrice(9)}</Text>
      </View>
      <View style={styles.line}>
        <Text style={styles.item}>Cold brew</Text>
        <Text style={styles.item}>{formatPrice(5)}</Text>
      </View>

      {/* Visible labels, linked to their fields. accessibilityLabel covers iOS;
          aria-labelledby (nativeID) links the visible label on Android. */}
      <Text nativeID="name-label" style={styles.fieldLabel}>
        Name
      </Text>
      <TextInput accessibilityLabel="Name" aria-labelledby="name-label" autoComplete="name" style={styles.input} />
      <Text nativeID="email-label" style={styles.fieldLabel}>
        Email
      </Text>
      <TextInput
        accessibilityLabel="Email"
        aria-labelledby="email-label"
        autoComplete="email"
        keyboardType="email-address"
        autoCapitalize="none"
        style={styles.input}
      />

      <Pressable
        accessibilityRole="switch"
        accessibilityLabel="Leave at door"
        accessibilityState={{ checked: leaveAtDoor }}
        onPress={() => setLeaveAtDoor((v) => !v)}
        style={styles.toggleRow}>
        <Text style={styles.item}>Leave at door</Text>
        <View style={[styles.track, leaveAtDoor && styles.trackOn]}>
          <View style={[styles.knob, leaveAtDoor && styles.knobOn]} />
        </View>
      </Pressable>

      <Text style={styles.total}>Total {formatPrice(14)}</Text>

      <Text style={styles.terms}>By placing your order you agree to our terms of service.</Text>

      <Pressable accessibilityRole="button" onPress={() => {}} style={styles.cta}>
        <Text style={styles.ctaText}>Place order</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12 },
  line: { flexDirection: 'row', justifyContent: 'space-between' },
  item: { color: colors.text, fontSize: 17 },
  fieldLabel: { color: colors.text, fontSize: 15, fontWeight: '600', marginBottom: -6 },
  input: { height: 48, borderRadius: 10, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, fontSize: 17, color: colors.text },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  track: { width: 51, height: 31, borderRadius: 16, backgroundColor: colors.border, padding: 2 },
  trackOn: { backgroundColor: '#34c759' },
  knob: { width: 27, height: 27, borderRadius: 14, backgroundColor: '#ffffff' },
  knobOn: { transform: [{ translateX: 20 }] },
  total: { color: colors.text, fontSize: 22, fontWeight: '700', marginTop: 8 },
  terms: { color: colors.mutedText, fontSize: 12 },
  cta: { height: 52, borderRadius: 26, backgroundColor: colors.text, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: '#ffffff', fontSize: 17, fontWeight: '600' },
});
