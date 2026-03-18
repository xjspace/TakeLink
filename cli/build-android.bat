@echo off
chcp 65001 >nul
echo 🏗️ Building LAN CLAUDE Android APK...
echo.

:: 检查环境
where pnpm >nul 2>&1 || (
    echo ❌ pnpm not found, please install pnpm first
    pause
    exit /b 1
)

:: 安装依赖
echo 📦 Installing dependencies...
pnpm install

:: 安装 Capacitor 依赖
echo 📦 Installing Capacitor...
pnpm add -D @capacitor/core @capacitor/cli @capacitor/android @capacitor/status-bar

:: 初始化 Capacitor（如果还没有）
if not exist "android" (
    echo 🔧 Initializing Capacitor...
    npx cap init "LAN CLAUDE" "com.lanclaude.app" --web-dir public
    npx cap add android
)

:: 同步 Web 资源
echo 🔄 Syncing web resources...
npx cap sync android

:: 配置透明状态栏
echo 🎨 Configuring transparent status bar...
if not exist "android\app\src\main\res\values" mkdir android\app\src\main\res\values

echo ^<?xml version="1.0" encoding="utf-8"?^> > android\app\src\main\res\values\styles.xml
echo ^<resources^> >> android\app\src\main\res\values\styles.xml
echo     ^<style name="AppTheme.NoActionBar" parent="Theme.AppCompat.DayNight.NoActionBar"^> >> android\app\src\main\res\values\styles.xml
echo         ^<item name="android:statusBarColor"^>@android:color/transparent^</item^> >> android\app\src\main\res\values\styles.xml
echo         ^<item name="android:navigationBarColor"^>@android:color/transparent^</item^> >> android\app\src\main\res\values\styles.xml
echo         ^<item name="android:windowTranslucentStatus"^>false^</item^> >> android\app\src\main\res\values\styles.xml
echo         ^<item name="android:windowDrawsSystemBarBackgrounds"^>true^</item^> >> android\app\src\main\res\values\styles.xml
echo     ^</style^> >> android\app\src\main\res\values\styles.xml
echo ^</resources^> >> android\app\src\main\res\values\styles.xml

:: 构建 APK
echo 📱 Building APK...
cd android
call gradlew assembleDebug
cd ..

:: 检查构建结果
if exist "android\app\build\outputs\apk\debug\app-debug.apk" (
    echo.
    echo ✅ Build successful!
    echo 📱 APK location: android\app\build\outputs\apk\debug\app-debug.apk
    echo.
    explorer android\app\build\outputs\apk\debug
) else (
    echo.
    echo ❌ Build failed!
)

pause
