import path from 'node:path';
import process from 'node:process';
import fs from 'node:fs';

const buildDir = 'dist';
const pagesDir = 'docs';

const target = process.argv?.[2] || 'latest';
const sourceDir = path.join(import.meta.dirname, buildDir);
const targetDir = path.join(import.meta.dirname, pagesDir, target);

// Files and directories to exclude from deployment
const excludePatterns = [
  '.claude',
  '.vscode',
  'package-lock.json'
];

function shouldExclude(filePath) {
  const basename = path.basename(filePath);
  return excludePatterns.some(pattern => 
    basename === pattern || filePath.includes(path.sep + pattern + path.sep) || filePath.endsWith(path.sep + pattern)
  );
}

function copyRecursive(src, dest) {
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (shouldExclude(srcPath)) {
      console.log(`Skipping excluded file/directory: ${srcPath}`);
      continue;
    }
    
    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

console.log(`Publishing contents from:\n    ${sourceDir}\nto:\n    ${targetDir}`);
if(fs.existsSync(targetDir)) {
  fs.rmSync(targetDir, { recursive: true, force: true });
}
fs.mkdirSync(targetDir, { recursive: true });
copyRecursive(sourceDir, targetDir);