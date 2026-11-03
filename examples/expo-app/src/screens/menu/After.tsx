import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { IconButton } from '@/components/IconButton';
import { ProductCard } from '@/components/ProductCard';
import { PRODUCTS, colors } from '@/demo/data';
import { LegacyPromoBanner } from '@/legacy/LegacyPromoBanner';

/** Menu, AFTER. Compare with ./Before.tsx. */
export default function MenuAfter() {
  const router = useRouter();
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.toolbar}>
        <Text style={styles.greeting}>Good morning, Sam</Text>
        <IconButton icon="search" label="Search the menu" onPress={() => {}} />
        <IconButton icon="bag-outline" label="View order" onPress={() => router.push('/order')} />
      </View>

      {/* Still has issues, still suppressed: legacy code is burned down separately. */}
      <LegacyPromoBanner />

      <Text style={styles.note}>Free delivery on orders over $20</Text>

      {PRODUCTS.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          onOpen={() => router.push(`/product/${product.id}`)}
          onAdd={() => {}}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  greeting: { flex: 1, color: colors.text, fontSize: 20, fontWeight: '700' },
  note: { color: colors.mutedText, fontSize: 13 },
});
