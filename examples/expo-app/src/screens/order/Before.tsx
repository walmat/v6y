import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { colors, formatPrice } from '@/demo/data';

/** Checkout, BEFORE. */
export default function OrderBefore() {
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

      {/* ✖ duplicate-label ×2: two different "Edit" buttons. Edit what? */}
      <View style={styles.line}>
        <Text style={styles.detail}>Deliver to 12 Elm St</Text>
        <Pressable accessibilityRole="button" onPress={() => {}} style={styles.edit}>
          <Text style={styles.editText}>Edit</Text>
        </Pressable>
      </View>
      <View style={styles.line}>
        <Text style={styles.detail}>Visa •••• 4242</Text>
        <Pressable accessibilityRole="button" onPress={() => {}} style={styles.edit}>
          <Text style={styles.editText}>Edit</Text>
        </Pressable>
      </View>

      {/* ✖ input-missing-label ×2: the placeholder is the only label, and it vanishes once you type */}
      <TextInput placeholder="Name" style={styles.input} />
      <TextInput placeholder="Email" keyboardType="email-address" autoCapitalize="none" style={styles.input} />

      {/* ✖ state-not-exposed: a custom switch that never says whether it's on */}
      <Pressable accessibilityRole="switch" accessibilityLabel="Leave at door" onPress={() => setLeaveAtDoor((v) => !v)} style={styles.toggleRow}>
        <Text style={styles.item}>Leave at door</Text>
        <View style={[styles.track, leaveAtDoor && styles.trackOn]}>
          <View style={[styles.knob, leaveAtDoor && styles.knobOn]} />
        </View>
      </Pressable>

      {/* ✖ font-scaling-disabled: capped at 1.3×, so it can't reach 200% */}
      <Text style={styles.total} maxFontSizeMultiplier={1.3}>
        Total {formatPrice(14)}
      </Text>

      {/* ✖ text-contrast: #b0b0b0 on white is 2.17:1 */}
      <Text style={styles.terms}>By placing your order you agree to our terms of service.</Text>

      {/* ✖ missing-role: announced as plain text, not a button */}
      <TouchableOpacity onPress={() => {}} style={styles.cta}>
        <Text style={styles.ctaText}>Place order</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12 },
  line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detail: { color: colors.secondaryText, fontSize: 15 },
  edit: { minWidth: 48, height: 48, alignItems: 'flex-end', justifyContent: 'center' },
  editText: { color: colors.brand, fontSize: 15, fontWeight: '600' },
  item: { color: colors.text, fontSize: 17 },
  input: { height: 48, borderRadius: 10, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, fontSize: 17, color: colors.text },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  track: { width: 51, height: 31, borderRadius: 16, backgroundColor: colors.border, padding: 2 },
  trackOn: { backgroundColor: '#34c759' },
  knob: { width: 27, height: 27, borderRadius: 14, backgroundColor: '#ffffff' },
  knobOn: { transform: [{ translateX: 20 }] },
  total: { color: colors.text, fontSize: 22, fontWeight: '700', marginTop: 8 },
  terms: { color: '#b0b0b0', fontSize: 12 },
  cta: { height: 52, borderRadius: 26, backgroundColor: colors.text, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: '#ffffff', fontSize: 17, fontWeight: '600' },
});
