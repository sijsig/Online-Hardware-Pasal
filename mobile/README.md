# Hardware Online Pasal mobile app

This is the native iOS and Android client for Hardware Online Pasal. It uses Expo, React Native, TypeScript, Expo Router, and the existing Supabase project. It is not a web page wrapped in a native shell.

## Configure Supabase

1. Copy `.env.example` to `.env` in this `mobile/` directory.
2. Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` from the Supabase project settings.
3. Never put the Supabase service role key in this app. Values prefixed with `EXPO_PUBLIC_` are included in the mobile bundle.
4. Apply the repository's pending Supabase migrations before using product search, checkout, vendor workflows, or rider delivery functions.

## Run on a phone

```sh
cd mobile
npm install
npm run start
```

Install Expo Go on the phone and scan the QR code from the terminal. The phone and computer should be on the same network. If they cannot connect, run `npx expo start --tunnel`.

## Run in a simulator

- iOS: install Xcode and an iOS Simulator, then run `npm run ios`.
- Android: install Android Studio and start an emulator, then run `npm run android`.
- Web preview: run `npm run web` (the primary target is iOS and Android).

## Current mobile workflows

- Customer: database-backed categories, PostGIS nearby product offers, distance/stock/delivery estimates, vendor-specific cart, account registration/sign-in, delivery address capture, COD checkout, order history and realtime status refresh.
- Vendor: shop-specific inventory and orders, add a catalog listing for admin approval, display commission and estimated shop proceeds, accept/reject orders, and move accepted orders through preparation to pickup-ready.
- Rider: application, availability, foreground location updates at a throttled interval, assignment offers, accept/decline, pickup, and COD delivery confirmation.
- Admin: role-protected mobile queue for reviewing shops, rider applications and product listings. Full reports, payments and marketplace configuration remain in the existing web dashboard.

Online payments, push notifications, background location, native map navigation, image upload, and store publishing are not enabled yet. COD is the only checkout method exposed in the mobile app; payment success is never simulated.
