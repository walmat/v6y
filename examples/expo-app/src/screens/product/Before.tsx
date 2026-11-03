import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { SIZES, colors, findProduct, formatPrice } from '@/demo/data';

/** Product detail, BEFORE. */
export default function ProductBefore() {
  const router = useRouter();
  const product = findProduct(useLocalSearchParams<{ id: string }>().id);
  const [size, setSize] = useState<(typeof SIZES)[number]>('Medium');
  const [quantity, setQuantity] = useState(1);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {/* ✖ image-missing-label: made focusable, but VoiceOver can only say "image" */}
      <Image source={product.image} accessible style={styles.hero} />

      {/* ✖ missing-heading: looks like a title, but screen readers can't jump to it */}
      <Text style={styles.title}>{product.name}</Text>

      {/* ✖ font-scaling-disabled: ignores the user's text size setting */}
      <Text style={styles.price} allowFontScaling={false}>
        {formatPrice(product.price)}
      </Text>
      <Text style={styles.description}>{product.description}</Text>

      <Text style={styles.label}>Size</Text>
      <View style={styles.sizes}>
        {SIZES.map((s) => (
          // ✖ state-not-exposed ×3: radio buttons that never say which one is selected
          <Pressable key={s} accessibilityRole="radio" onPress={() => setSize(s)} style={[styles.size, s === size && styles.sizeSelected]}>
            <Text style={[styles.sizeText, s === size && styles.sizeTextSelected]}>{s}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.stepper}>
        {/* ✖ touch-target-size ×2: 20×20 is below the 24×24 minimum */}
        <Pressable accessibilityRole="button" accessibilityLabel="Decrease quantity" onPress={() => setQuantity((q) => Math.max(1, q - 1))} style={styles.step}>
          <Text style={styles.stepText}>−</Text>
        </Pressable>
        <Text style={styles.quantity}>{quantity}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Increase quantity" onPress={() => setQuantity((q) => q + 1)} style={styles.step}>
          <Text style={styles.stepText}>+</Text>
        </Pressable>
      </View>

      {/* ✖ meaningless-label: "btn_add_to_order" is read aloud as-is
          ✖ missing-role: TouchableOpacity isn't announced as a button
          ✖ text-contrast: white on #0a84ff is 3.65:1 */}
      <TouchableOpacity accessibilityLabel="btn_add_to_order" onPress={() => router.back()} style={styles.cta}>
        <Text style={styles.ctaText}>Add to order · {formatPrice(product.price * quantity)}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12 },
  hero: { width: '100%', height: 220, borderRadius: 16 },
  title: { color: colors.text, fontSize: 28, fontWeight: '700' },
  price: { color: colors.text, fontSize: 20, fontWeight: '600' },
  description: { color: colors.secondaryText, fontSize: 15 },
  label: { color: colors.text, fontSize: 15, fontWeight: '600', marginTop: 8 },
  sizes: { flexDirection: 'row', gap: 8 },
  size: { flex: 1, height: 44, borderRadius: 10, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  sizeSelected: { backgroundColor: colors.text },
  sizeText: { color: colors.text, fontSize: 15 },
  sizeTextSelected: { color: '#ffffff', fontWeight: '600' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  step: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  stepText: { color: colors.text, fontSize: 15 },
  quantity: { color: colors.text, fontSize: 17, minWidth: 24, textAlign: 'center' },
  cta: { height: 52, borderRadius: 26, backgroundColor: '#0a84ff', alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  ctaText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
});
