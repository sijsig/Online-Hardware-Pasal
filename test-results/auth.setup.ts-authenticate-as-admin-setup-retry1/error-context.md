# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.setup.ts >> authenticate as admin
- Location: tests/auth.setup.ts:241:3

# Error details

```
Error: browserType.launch: Target page, context or browser has been closed
Browser logs:

<launching> /Applications/Google Chrome.app/Contents/MacOS/Google Chrome --disable-field-trial-config --disable-background-networking --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-back-forward-cache --disable-breakpad --disable-component-extensions-with-background-pages --disable-component-update --no-default-browser-check --disable-default-apps --disable-dev-shm-usage --disable-edgeupdater --disable-extensions --disable-features=AvoidUnnecessaryBeforeUnloadCheckSync,DestroyProfileOnBrowserClose,HttpsUpgrades,HttpsFirstBalancedModeAutoEnable,LensOverlay,MediaRouter,PaintHolding,ThirdPartyStoragePartitioning,AvoidCorsURLLoaderRestartOnRedirect,TcpPortRandomizationWin,OptimizationHints,NetworkTimeServiceQuerying,AimEnabled,PreconnectToSearch,msForceBrowserSignIn,msEdgeUpdateLaunchServicesPreferredVersion --enable-features=CDPScreenshotNewSurface,SkipListAccountsWithoutGaiaCookies --allow-pre-commit-input --disable-hang-monitor --disable-ipc-flooding-protection --disable-popup-blocking --disable-prompt-on-repost --disable-renderer-backgrounding --disable-updater-scheduler --force-color-profile=srgb --metrics-recording-only --no-first-run --password-store=basic --use-mock-keychain --no-service-autorun --disable-search-engine-choice-screen --unsafely-disable-devtools-self-xss-warnings --enable-unsafe-swiftshader --edge-skip-compat-layer-relaunch --disable-stack-profiler --disable-infobars --disable-sync --do-not-de-elevate --no-sandbox --disable-gpu --disable-dev-shm-usage --no-sandbox --disable-setuid-sandbox --disable-extensions --disable-background-networking --disable-background-timer-throttling --disable-renderer-backgrounding --no-first-run --no-default-browser-check --disable-crash-reporter --user-data-dir=/var/folders/cv/ybwfpg7x1376g2h56szptspw0000gn/T/playwright_chromiumdev_profile-RZPdHQTGOOYu --remote-debugging-pipe --no-startup-window
<launched> pid=34921
[pid=34921][err] [1117/234615.071335:ERROR:third_party/crashpad/crashpad/util/mach/bootstrap.cc:65] bootstrap_check_in org.chromium.crashpad.child_port_handshake.34925.6312181.UVALQVOKLKPZFCLN: Permission denied (1100)
[pid=34921][err] [1117/234615.071958:ERROR:third_party/crashpad/crashpad/util/file/file_io.cc:103] ReadExactly: expected 4, observed 0
[pid=34921][err] [1117/234615.072526:ERROR:third_party/crashpad/crashpad/util/file/file_io_posix.cc:208] open /Users/sijansigdel/Library/Application Support/Google/Chrome/Crashpad/settings.dat: Operation not permitted (1)
[pid=34921][err] [1117/234615.072677:ERROR:third_party/crashpad/crashpad/util/file/file_io_posix.cc:208] open /Users/sijansigdel/Library/Application Support/Google/Chrome/Crashpad/settings.dat: Operation not permitted (1)
Call log:
  - <launching> /Applications/Google Chrome.app/Contents/MacOS/Google Chrome --disable-field-trial-config --disable-background-networking --disable-background-timer-throttling --disable-backgrounding-occluded-windows --disable-back-forward-cache --disable-breakpad --disable-component-extensions-with-background-pages --disable-component-update --no-default-browser-check --disable-default-apps --disable-dev-shm-usage --disable-edgeupdater --disable-extensions --disable-features=AvoidUnnecessaryBeforeUnloadCheckSync,DestroyProfileOnBrowserClose,HttpsUpgrades,HttpsFirstBalancedModeAutoEnable,LensOverlay,MediaRouter,PaintHolding,ThirdPartyStoragePartitioning,AvoidCorsURLLoaderRestartOnRedirect,TcpPortRandomizationWin,OptimizationHints,NetworkTimeServiceQuerying,AimEnabled,PreconnectToSearch,msForceBrowserSignIn,msEdgeUpdateLaunchServicesPreferredVersion --enable-features=CDPScreenshotNewSurface,SkipListAccountsWithoutGaiaCookies --allow-pre-commit-input --disable-hang-monitor --disable-ipc-flooding-protection --disable-popup-blocking --disable-prompt-on-repost --disable-renderer-backgrounding --disable-updater-scheduler --force-color-profile=srgb --metrics-recording-only --no-first-run --password-store=basic --use-mock-keychain --no-service-autorun --disable-search-engine-choice-screen --unsafely-disable-devtools-self-xss-warnings --enable-unsafe-swiftshader --edge-skip-compat-layer-relaunch --disable-stack-profiler --disable-infobars --disable-sync --do-not-de-elevate --no-sandbox --disable-gpu --disable-dev-shm-usage --no-sandbox --disable-setuid-sandbox --disable-extensions --disable-background-networking --disable-background-timer-throttling --disable-renderer-backgrounding --no-first-run --no-default-browser-check --disable-crash-reporter --user-data-dir=/var/folders/cv/ybwfpg7x1376g2h56szptspw0000gn/T/playwright_chromiumdev_profile-RZPdHQTGOOYu --remote-debugging-pipe --no-startup-window
  - <launched> pid=34921
  - [pid=34921][err] [1117/234615.071335:ERROR:third_party/crashpad/crashpad/util/mach/bootstrap.cc:65] bootstrap_check_in org.chromium.crashpad.child_port_handshake.34925.6312181.UVALQVOKLKPZFCLN: Permission denied (1100)
  - [pid=34921][err] [1117/234615.071958:ERROR:third_party/crashpad/crashpad/util/file/file_io.cc:103] ReadExactly: expected 4, observed 0
  - [pid=34921][err] [1117/234615.072526:ERROR:third_party/crashpad/crashpad/util/file/file_io_posix.cc:208] open /Users/sijansigdel/Library/Application Support/Google/Chrome/Crashpad/settings.dat: Operation not permitted (1)
  - [pid=34921][err] [1117/234615.072677:ERROR:third_party/crashpad/crashpad/util/file/file_io_posix.cc:208] open /Users/sijansigdel/Library/Application Support/Google/Chrome/Crashpad/settings.dat: Operation not permitted (1)
  - [pid=34921] <gracefully close start>
  - [pid=34921] <kill>
  - [pid=34921] <will force kill>
  - [pid=34921] exception while trying to kill process: Error: kill EPERM
  - [pid=34921] <process did exit: exitCode=null, signal=SIGABRT>
  - [pid=34921] starting temporary directories cleanup
  - [pid=34921] finished temporary directories cleanup
  - [pid=34921] <gracefully close end>

```