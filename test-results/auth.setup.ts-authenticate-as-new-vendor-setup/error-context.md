# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.setup.ts >> authenticate as new vendor
- Location: tests/auth.setup.ts:319:1

# Error details

```
Error: browserContext.newPage: Target page, context or browser has been closed
Browser logs:

<launching> /Users/sijansigdel/Library/Caches/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-mac-arm64/chrome-headless-shell --disable-field-trial-config --disable-background-networking --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-back-forward-cache --disable-breakpad --disable-component-extensions-with-background-pages --disable-component-update --no-default-browser-check --disable-default-apps --disable-dev-shm-usage --disable-edgeupdater --disable-extensions --disable-features=AvoidUnnecessaryBeforeUnloadCheckSync,DestroyProfileOnBrowserClose,HttpsUpgrades,HttpsFirstBalancedModeAutoEnable,LensOverlay,MediaRouter,PaintHolding,ThirdPartyStoragePartitioning,AvoidCorsURLLoaderRestartOnRedirect,TcpPortRandomizationWin,OptimizationHints,NetworkTimeServiceQuerying,AimEnabled,PreconnectToSearch,msForceBrowserSignIn,msEdgeUpdateLaunchServicesPreferredVersion --enable-features=CDPScreenshotNewSurface,SkipListAccountsWithoutGaiaCookies --allow-pre-commit-input --disable-hang-monitor --disable-ipc-flooding-protection --disable-popup-blocking --disable-prompt-on-repost --disable-renderer-backgrounding --disable-updater-scheduler --force-color-profile=srgb --metrics-recording-only --no-first-run --password-store=basic --use-mock-keychain --no-service-autorun --disable-search-engine-choice-screen --unsafely-disable-devtools-self-xss-warnings --enable-unsafe-swiftshader --edge-skip-compat-layer-relaunch --disable-stack-profiler --disable-infobars --disable-sync --do-not-de-elevate --headless --hide-scrollbars --mute-audio --blink-settings=primaryHoverType=2,availableHoverTypes=2,primaryPointerType=4,availablePointerTypes=4 --no-sandbox --no-sandbox --disable-setuid-sandbox --disable-dev-shm-usage --disable-gpu --single-process --disable-extensions --disable-background-networking --disable-background-timer-throttling --disable-renderer-backgrounding --no-first-run --no-default-browser-check --disable-crash-reporter --user-data-dir=/var/folders/cv/ybwfpg7x1376g2h56szptspw0000gn/T/playwright_chromiumdev_profile-ewOo7uYjvxnM --remote-debugging-pipe --no-startup-window
<launched> pid=74187
[pid=74187][err] [1119/205015.371474:ERROR:ui/display/mac/cv_display_link_mac.mm:192] CVDisplayLinkCreateWithCGDisplay failed. CVReturn: -6670
[pid=74187][err] [1119/205020.718683:ERROR:ui/display/mac/cv_display_link_mac.mm:192] CVDisplayLinkCreateWithCGDisplay failed. CVReturn: -6670
[pid=74187][err] [1119/205021.022983:INFO:CONSOLE:25631] "%cDownload the React DevTools for a better development experience: https://react.dev/link/react-devtools font-weight:bold", source: webpack-internal:///(app-pages-browser)/./node_modules/next/dist/compiled/react-dom/cjs/react-dom-client.development.js (25631)
[pid=74187][err] [1119/205025.502614:ERROR:ui/display/mac/cv_display_link_mac.mm:192] CVDisplayLinkCreateWithCGDisplay failed. CVReturn: -6670
[pid=74187][err] [1119/205025.772618:INFO:CONSOLE:25631] "%cDownload the React DevTools for a better development experience: https://react.dev/link/react-devtools font-weight:bold", source: webpack-internal:///(app-pages-browser)/./node_modules/next/dist/compiled/react-dom/cjs/react-dom-client.development.js (25631)
[pid=74187][err] [1119/205031.578879:ERROR:ui/display/mac/cv_display_link_mac.mm:192] CVDisplayLinkCreateWithCGDisplay failed. CVReturn: -6670
[pid=74187][err] [1119/205031.851496:INFO:CONSOLE:25631] "%cDownload the React DevTools for a better development experience: https://react.dev/link/react-devtools font-weight:bold", source: webpack-internal:///(app-pages-browser)/./node_modules/next/dist/compiled/react-dom/cjs/react-dom-client.development.js (25631)
```