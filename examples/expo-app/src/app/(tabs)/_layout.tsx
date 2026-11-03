import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { colors } from '@/demo/data';
import { useFixedMode } from '@/demo/FixedMode';

export default function TabsLayout() {
  const { fixed } = useFixedMode();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.brand,
        // ✖ BEFORE: React Navigation's default inactive label color (50% alpha) is about
        //   3.3:1 on white. v6y reports it against this file, where the tabs are configured.
        // ✓ AFTER: a darker gray passes 4.5:1.
        tabBarInactiveTintColor: fixed ? colors.mutedText : undefined,
      }}>
      <Tabs.Screen
        name="menu"
        options={{ title: 'Menu', tabBarIcon: ({ color, size }) => <Ionicons name="cafe-outline" color={color as string} size={size} /> }}
      />
      <Tabs.Screen
        name="order"
        options={{ title: 'Order', tabBarIcon: ({ color, size }) => <Ionicons name="bag-outline" color={color as string} size={size} /> }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Account',
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" color={color as string} size={size} />,
        }}
      />
    </Tabs>
  );
}
