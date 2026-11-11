export type MapCoordinates = { latitude: number; longitude: number };
type MapProvider = 'google' | 'apple' | 'openstreetmap';

function configuredProvider(): MapProvider {
  const value = process.env.EXPO_PUBLIC_MAP_PROVIDER?.toLowerCase();
  return value === 'apple' || value === 'openstreetmap' ? value : 'google';
}

export function navigationUrl(destination: MapCoordinates): string {
  const { latitude, longitude } = destination;
  const provider = configuredProvider();
  if (provider === 'apple') return `https://maps.apple.com/?daddr=${latitude},${longitude}`;
  if (provider === 'openstreetmap') return `https://www.openstreetmap.org/directions?to=${latitude}%2C${longitude}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
}

export function mapLocationUrl(point: MapCoordinates): string {
  const { latitude, longitude } = point;
  const provider = configuredProvider();
  if (provider === 'apple') return `https://maps.apple.com/?ll=${latitude},${longitude}&q=Rider`;
  if (provider === 'openstreetmap') return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=16/${latitude}/${longitude}`;
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}
