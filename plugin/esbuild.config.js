const esbuild = require('esbuild');

esbuild.build({
  entryPoints: ['src/code.ts'],
  bundle: true,
  outfile: 'dist/code.js',
  minify: true,
  // Figma uses a JavaScript VM that supports ES2017
  target: 'es2017',
}).catch(() => process.exit(1));
