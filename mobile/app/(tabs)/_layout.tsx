import { Tabs } from 'expo-router';
import { Text, type ColorValue } from 'react-native';
import { colors } from '@/src/theme';

export default function TabLayout() {
  return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.green, tabBarInactiveTintColor: colors.muted, tabBarStyle: { height: 62, paddingTop: 7, paddingBottom: 7, backgroundColor: colors.white, borderTopColor: colors.line }, tabBarLabelStyle: { fontSize: 10, fontWeight: '700' } }}>
    <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color }) => <TabIcon color={color} glyph="⌂" /> }} />
    <Tabs.Screen name="search" options={{ title: 'Search', tabBarIcon: ({ color }) => <TabIcon color={color} glyph="⌕" /> }} />
    <Tabs.Screen name="cart" options={{ title: 'Cart', tabBarIcon: ({ color }) => <TabIcon color={color} glyph="▱" /> }} />
    <Tabs.Screen name="orders" options={{ title: 'Orders', tabBarIcon: ({ color }) => <TabIcon color={color} glyph="▤" /> }} />
    <Tabs.Screen name="account" options={{ title: 'Account', tabBarIcon: ({ color }) => <TabIcon color={color} glyph="◉" /> }} />
  </Tabs>;
}

function TabIcon({ color, glyph }: { color: ColorValue; glyph: string }) {
  return <Text style={{ fontSize: 22, lineHeight: 25, color: String(color) }}>{glyph}</Text>;
}
