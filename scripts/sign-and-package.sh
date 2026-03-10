#!/bin/bash
# sign-and-package.sh
# Builds DMGs with electron-builder (Applications symlink included),
# then extracts each .app, re-signs ad-hoc inside-out, and repackages
# into a new DMG preserving the original layout.
#
# Usage: bash scripts/sign-and-package.sh
#
# Recipients must run once after installing:
#   xattr -cr /Applications/KeyPet.app

set -e

VERSION=$(node -p "require('./package.json').version")
DMG_ARM="release/KeyPet-${VERSION}-arm64.dmg"
DMG_X64="release/KeyPet-${VERSION}.dmg"

echo "▶ Building and packaging with electron-builder..."
npm run build
npx electron-builder

resign_dmg() {
  local DMG="$1"
  local ARCH="$2"
  local WORK_DIR="release/sign-tmp-${ARCH}"

  echo "▶ Re-signing DMG: $DMG"

  rm -rf "$WORK_DIR"
  mkdir -p "$WORK_DIR"

  # Mount original DMG
  local MOUNT_POINT="$WORK_DIR/mnt"
  mkdir -p "$MOUNT_POINT"
  hdiutil attach "$DMG" -mountpoint "$MOUNT_POINT" -nobrowse -quiet

  # Copy app out (writable)
  local APP_SRC
  APP_SRC=$(find "$MOUNT_POINT" -name "*.app" -maxdepth 1 | head -1)
  local APP_DEST="$WORK_DIR/KeyPet.app"
  cp -R "$APP_SRC" "$APP_DEST"

  # Detach
  hdiutil detach "$MOUNT_POINT" -quiet

  # Re-sign inside-out
  find "$APP_DEST" -name "*.node" -print0 | xargs -0 -I{} codesign --force --sign - --timestamp=none "{}"

  for helper in \
    "KeyPet Helper (GPU).app" \
    "KeyPet Helper (Plugin).app" \
    "KeyPet Helper (Renderer).app" \
    "KeyPet Helper.app"; do
    local HELPER="$APP_DEST/Contents/Frameworks/$helper"
    if [ -d "$HELPER" ]; then
      codesign --force --sign - --timestamp=none "$HELPER"
    fi
  done

  codesign --force --sign - --timestamp=none --deep "$APP_DEST"
  echo "  ✓ Signed"

  # Rebuild DMG with Applications symlink
  local NEW_STAGING="$WORK_DIR/dmg-staging"
  mkdir -p "$NEW_STAGING"
  cp -R "$APP_DEST" "$NEW_STAGING/"
  ln -s /Applications "$NEW_STAGING/Applications"

  rm -f "$DMG"
  hdiutil create \
    -volname "KeyPet ${VERSION}" \
    -srcfolder "$NEW_STAGING" \
    -ov -format UDZO \
    "$DMG"

  rm -rf "$WORK_DIR"
  echo "  ✓ DMG ready: $DMG"
}

resign_dmg "$DMG_ARM" "arm64"
resign_dmg "$DMG_X64" "x64"

# Restore arm64 native modules for local dev
echo "▶ Restoring arm64 native modules for local dev..."
npm run rebuild

echo ""
echo "✅ Done. DMGs ready:"
echo "   $DMG_ARM"
echo "   $DMG_X64"
echo ""
echo "ℹ️  Recipients must run this once after installing:"
echo "   xattr -cr /Applications/KeyPet.app"
