export type MapProvider = "google" | "mapbox" | "openstreetmap";

export function getDirectionsUrl(latitude?: string | number | null, longitude?: string | number | null): string | null {
  if (latitude == null || longitude == null || !Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) return null;
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

  const provider = (process.env.NEXT_PUBLIC_MAP_PROVIDER || process.env.MAP_PROVIDER || "openstreetmap") as MapProvider;
  if (provider === "google") {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${lat},${lng}`)}`;
  }
  if (provider === "mapbox" && process.env.NEXT_PUBLIC_MAP_API_KEY) {
    return `https://www.mapbox.com/directions/?destination=${encodeURIComponent(`${lng},${lat}`)}&access_token=${encodeURIComponent(process.env.NEXT_PUBLIC_MAP_API_KEY)}`;
  }
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`;
}
