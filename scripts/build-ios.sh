#!/bin/bash
# Build script for RPG Maker Player iOS
# This can be run on macOS locally or via CI (GitHub Actions)

set -euo pipefail

echo "=== Building RPG Maker Player for iOS ==="

# Install dependencies
echo "Installing npm dependencies..."
npm ci

# Build web shell
echo "Building web shell..."
npm run build

# Sync with Capacitor
echo "Syncing with Capacitor..."
npx cap sync ios

# Install CocoaPods
echo "Installing CocoaPods..."
cd ios/App
pod install --repo-update
cd ../..

# Build with Xcode
echo "Building iOS app..."
cd ios/App

xcodebuild clean archive \
  -workspace App.xcworkspace \
  -scheme App \
  -archivePath ../../dist/ios/App.xcarchive \
  -sdk iphoneos \
  -configuration Release \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO

echo "=== Build complete ==="
echo "Archive at: dist/ios/App.xcarchive"

# To export .ipa (requires signing):
# xcodebuild -exportArchive \
#   -archivePath ../../dist/ios/App.xcarchive \
#   -exportPath ../../dist/ios/ \
#   -exportOptionsPlist exportOptions.plist
