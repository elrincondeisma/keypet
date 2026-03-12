---
description: Bump patch version, commit, tag and push to trigger CI release
---
Build and release KeyPet. Follow these steps exactly:

1. Read the current version from package.json
2. Bump the patch version (e.g. 1.0.3 -> 1.0.4)
3. Update the version in package.json
4. Run `npm run build` to verify it compiles
5. Stage ALL changed files, commit with message: "chore: bump to vX.Y.Z"
6. Push the commit to origin main
7. Create git tag vX.Y.Z and push it to origin
8. Report: version released, remind that CI will handle the rest (build DMG, create GitHub Release, update homebrew-tap cask automatically)
