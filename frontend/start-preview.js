// Wrapper: Node 12 spawns Vite using Node 20
const { spawn } = require('child_process');
const path = require('path');

const node20 = '/Users/praveenyelukati/.nvm/versions/node/v20.20.0/bin/node';
const vite   = path.join(__dirname, 'node_modules/.bin/vite');

const proc = spawn(node20, [vite, '--port', '5173'], {
  stdio: 'inherit',
  cwd: __dirname,
});
proc.on('exit', (code) => process.exit(code || 0));
