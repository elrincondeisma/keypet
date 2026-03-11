# KeyPet

Desktop pixel pet that lives on your screen and reacts to your keyboard activity. The more you type, the more your pet evolves.

Built with Electron + TypeScript for macOS.

## Install

### Homebrew (recommended)

```bash
brew install elrincondeisma/tap/keypet
```

### Manual

1. Go to [Releases](https://github.com/elrincondeisma/keypet/releases/latest)
2. Download `KeyPet-<version>-arm64.dmg`
3. Open the DMG and drag **KeyPet** to **Applications**
4. Open KeyPet from Applications

> On first launch, macOS will ask for **Accessibility** permission. KeyPet needs this to count your keystrokes. Go to **System Settings > Privacy & Security > Accessibility** and enable KeyPet.

## Update

### Homebrew

```bash
brew upgrade keypet
```

### Manual

1. Download the latest DMG from [Releases](https://github.com/elrincondeisma/keypet/releases/latest)
2. Quit KeyPet if it's running (click the tray icon > Quit)
3. Open the DMG and drag **KeyPet** to **Applications**, replacing the existing version

## Uninstall

### Homebrew

```bash
brew uninstall keypet
```

### Manual

1. Quit KeyPet
2. Drag **KeyPet** from Applications to the Trash
3. Optionally remove data: `rm -rf ~/Library/Application\ Support/keypet`

## Requirements

- macOS 12+ (Monterey or later)
- Apple Silicon (arm64)

## Development

```bash
# Install dependencies
npm install

# Run in development
npm start

# Build distributable DMG
npm run dist
```

## License

MIT
