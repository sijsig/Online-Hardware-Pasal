import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '@/src/auth/auth-provider';
import { CartProvider } from '@/src/cart/cart-provider';
import { FavoritesProvider } from '@/src/favorites/favorites-provider';
import { LoyaltyProvider } from '@/src/loyalty/loyalty-provider';
import { colors } from '@/src/theme';

export default function RootLayout() {
  return <AuthProvider><CartProvider><FavoritesProvider><LoyaltyProvider><StatusBar style="dark" /><Stack screenOptions={{ headerStyle: { backgroundColor: colors.canvas }, headerTintColor: colors.ink, headerTitleStyle: { fontWeight: '800' }, contentStyle: { backgroundColor: colors.canvas } }}><Stack.Screen name="(tabs)" options={{ headerShown: false }} /><Stack.Screen name="login" options={{ title: 'Your account', presentation: 'modal' }} /><Stack.Screen name="checkout" options={{ title: 'Checkout' }} /><Stack.Screen name="vendor" options={{ title: 'Shop dashboard' }} /><Stack.Screen name="vendor-apply" options={{ title: 'Shop application' }} /><Stack.Screen name="rider" options={{ title: 'Rider dashboard' }} /><Stack.Screen name="admin" options={{ title: 'Admin review' }} /><Stack.Screen name="order/[id]" options={{ title: 'Order tracking' }} /><Stack.Screen name="product/[id]" options={{ title: 'Product details' }} /></Stack></LoyaltyProvider></FavoritesProvider></CartProvider></AuthProvider>;
}
