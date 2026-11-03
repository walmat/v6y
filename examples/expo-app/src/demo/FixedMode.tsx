/**
 * Demo scaffolding (not something your app needs): every screen exists in a
 * "before" version with real-world accessibility bugs and an "after" version
 * with them fixed. The switch at the top flips between them and asks v6y to
 * re-audit, so you can watch the report in the Metro terminal go to zero.
 */
import { createContext, useContext, useState, type ComponentType, type ReactNode } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { capture } from 'v6y/react-native';

import { colors } from './data';

interface FixedMode {
  fixed: boolean;
  setFixed: (fixed: boolean) => void;
}

const FixedModeContext = createContext<FixedMode>({ fixed: false, setFixed: () => {} });

export function FixedModeProvider({ children, initialFixed = false }: { children: ReactNode; initialFixed?: boolean }) {
  const [fixed, setFixed] = useState(initialFixed);
  return <FixedModeContext.Provider value={{ fixed, setFixed }}>{children}</FixedModeContext.Provider>;
}

export const useFixedMode = () => useContext(FixedModeContext);

/** Renders the before or after version of a screen, with the demo switch on top. */
export function DemoScreen({
  before: Before,
  after: After,
  safeTop = false,
}: {
  before: ComponentType;
  after: ComponentType;
  /** For screens without a navigation header. */
  safeTop?: boolean;
}) {
  const { fixed } = useFixedMode();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.screen, safeTop && { paddingTop: insets.top }]}>
      <DemoSwitch />
      {fixed ? <After /> : <Before />}
    </View>
  );
}

function DemoSwitch() {
  const { fixed, setFixed } = useFixedMode();
  const onValueChange = (value: boolean) => {
    setFixed(value);
    // Same route, new content: ask v6y for a fresh audit once it has rendered.
    // (Normally v6y captures automatically when the focused screen changes.)
    setTimeout(() => void capture(), 600);
  };
  return (
    <View style={styles.bar}>
      <View style={styles.barText}>
        <Text style={styles.barTitle}>{fixed ? 'After: issues fixed' : 'Before: real-world accessibility bugs'}</Text>
        <Text style={styles.barHint}>Flip to re-audit. Results appear in the Metro terminal.</Text>
      </View>
      <Switch value={fixed} onValueChange={onValueChange} accessibilityLabel="Show the fixed version" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.surface,
  },
  barText: { flex: 1 },
  barTitle: { color: colors.text, fontSize: 14, fontWeight: '600' },
  barHint: { color: colors.mutedText, fontSize: 12, marginTop: 2 },
});
