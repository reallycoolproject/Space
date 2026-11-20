const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) { 
      results.push(file);
    }
  });
  return results;
}

const files = walk(path.join(__dirname, 'src'));
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes('http://localhost:3000')) {
    const relativeToSrc = path.relative(path.dirname(file), path.join(__dirname, 'src', 'config')).replace(/\\/g, '/');
    let importPath = relativeToSrc.startsWith('.') ? relativeToSrc : './' + relativeToSrc;
    const importStr = `import { API_BASE } from '${importPath}';\n`;
    
    if (!content.includes('API_BASE')) {
      const importMatches = [...content.matchAll(/^import.*$/gm)];
      if (importMatches.length > 0) {
        const lastImport = importMatches[importMatches.length - 1];
        const insertPos = lastImport.index + lastImport[0].length;
        content = content.slice(0, insertPos) + '\n' + importStr + content.slice(insertPos);
      } else {
        content = importStr + content;
      }
    }

    content = content.replace(/'http:\/\/localhost:3000\/([^']+)'/g, '`${API_BASE}/$1`');
    content = content.replace(/"http:\/\/localhost:3000\/([^"]+)"/g, '`${API_BASE}/$1`');
    content = content.replace(/http:\/\/localhost:3000\//g, '${API_BASE}/');
    
    fs.writeFileSync(file, content);
    console.log('Updated', file);
  }
});
