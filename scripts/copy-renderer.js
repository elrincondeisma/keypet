const fs = require('fs');
const path = require('path');

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

copyDir(
  path.join(__dirname, '..', 'src', 'renderer'),
  path.join(__dirname, '..', 'dist', 'renderer')
);

console.log('Renderer files copied to dist/renderer/');

copyDir(
  path.join(__dirname, '..', 'assets'),
  path.join(__dirname, '..', 'dist', 'assets')
);

console.log('Assets copied to dist/assets/');
