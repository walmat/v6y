/** Before/after code for each rule's docs page (docs/rules/<id>.md). */
export const RULE_EXAMPLES: Record<string, { bad: string; good: string }> = {
  'missing-label': {
    bad: `<Pressable onPress={close}>
  <Ionicons name="close" size={20} />
</Pressable>`,
    good: `<Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Close">
  <Ionicons name="close" size={20} />
</Pressable>`,
  },
  'meaningless-label': {
    bad: `<TouchableOpacity accessibilityLabel="btn_add_to_order" onPress={add}>`,
    good: `<TouchableOpacity accessibilityLabel="Add to order" onPress={add}>`,
  },
  'image-missing-label': {
    bad: `<Image source={product.image} accessible />`,
    good: `// Meaningful: describe it
<Image source={product.image} accessible accessibilityLabel="A flat white in a white cup" />

// Decorative: leave it out of the accessibility tree (the default)
<Image source={background} />`,
  },
  'input-missing-label': {
    bad: `<TextInput placeholder="Email" />`,
    good: `<Text nativeID="email-label">Email</Text>
<TextInput accessibilityLabel="Email" aria-labelledby="email-label" />`,
  },
  'duplicate-label': {
    bad: `<Pressable accessibilityRole="button" onPress={editAddress}><Text>Edit</Text></Pressable>
<Pressable accessibilityRole="button" onPress={editPayment}><Text>Edit</Text></Pressable>`,
    good: `<Pressable accessibilityRole="button" accessibilityLabel="Edit delivery address" onPress={editAddress}>
  <Text>Edit</Text>
</Pressable>
<Pressable accessibilityRole="button" accessibilityLabel="Edit payment method" onPress={editPayment}>
  <Text>Edit</Text>
</Pressable>`,
  },
  'missing-role': {
    bad: `<TouchableOpacity onPress={placeOrder}>
  <Text>Place order</Text>
</TouchableOpacity>`,
    good: `<Pressable accessibilityRole="button" onPress={placeOrder}>
  <Text>Place order</Text>
</Pressable>`,
  },
  'nested-interactive': {
    bad: `<Pressable onPress={openProduct}>
  <Text>{product.name}</Text>
  <Pressable onPress={toggleFavorite}>…</Pressable>
</Pressable>`,
    good: `<View style={styles.row}>
  <Pressable accessibilityRole="button" onPress={openProduct}>
    <Text>{product.name}</Text>
  </Pressable>
  <Pressable accessibilityRole="togglebutton" accessibilityLabel={\`Favorite \${product.name}\`} onPress={toggleFavorite}>…</Pressable>
</View>`,
  },
  'state-not-exposed': {
    bad: `<Pressable accessibilityRole="switch" accessibilityLabel="Leave at door" onPress={toggle}>`,
    good: `<Pressable
  accessibilityRole="switch"
  accessibilityLabel="Leave at door"
  accessibilityState={{ checked: leaveAtDoor }}
  onPress={toggle}>`,
  },
  'missing-heading': {
    bad: `<Text style={{ fontSize: 34, fontWeight: '700' }}>Account</Text>`,
    good: `<Text accessibilityRole="header" style={{ fontSize: 34, fontWeight: '700' }}>Account</Text>`,
  },
  'touch-target-size': {
    bad: `<Pressable style={{ width: 20, height: 20 }} onPress={increment}>`,
    good: `// Grow the touchable area without changing the layout
<Pressable style={{ width: 32, height: 32 }} hitSlop={8} onPress={increment}>`,
  },
  'text-contrast': {
    bad: `<Text style={{ color: '#aaaaaa' }}>Terms apply</Text> // 2.32:1 on white`,
    good: `<Text style={{ color: '#595959' }}>Terms apply</Text> // 7.0:1 on white`,
  },
  'font-scaling-disabled': {
    bad: `<Text allowFontScaling={false}>$49.00</Text>
<Text maxFontSizeMultiplier={1.3}>Total</Text>`,
    good: `<Text>$49.00</Text>
<Text maxFontSizeMultiplier={2}>Total</Text> // only if the layout truly can't grow further`,
  },
};

/** What each rule option does (for the docs; the TypeScript types carry the same text). */
export const OPTION_DOCS: Record<string, Record<string, string>> = {
  'meaningless-label': {
    allow: 'Labels to always accept, e.g. `["OK"]`. Case-insensitive.',
    generic: "Extra words to treat as generic, e.g. your design system's component names.",
  },
  'input-missing-label': { allowPlaceholder: 'Accept a placeholder as the only label.' },
  'duplicate-label': {
    ignoreCase: 'Treat "Delete" and "delete" as the same name.',
    includeRepeated: 'Also flag repeats from one list (the same row rendered many times).',
  },
  'touch-target-size': {
    minimum: 'Hard minimum in pt/dp, reported at the rule\'s level (WCAG 2.2 AA is 24).',
    platformGuidelines: 'Also warn below the platform guideline (Apple 44pt, Material 48dp).',
    ios: 'Apple guideline in pt.',
    android: 'Material guideline in dp.',
  },
  'text-contrast': { level: '`"AA"` (4.5:1, large text 3:1) or `"AAA"` (7:1, large text 4.5:1).' },
  'font-scaling-disabled': { minMultiplier: 'Lowest acceptable `maxFontSizeMultiplier`. WCAG 1.4.4 means 200%, so 2.' },
};

/** Where each rule's docs page lives. */
export const DOCS_BASE = 'https://github.com/walmat/v6y/blob/main/docs/rules';
export const ruleDocsUrl = (ruleId: string) => `${DOCS_BASE}/${ruleId}.md`;
