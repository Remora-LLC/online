const esbuild = require('esbuild');
const tsconfigPaths = require('esbuild-plugin-tsconfig-paths');

esbuild.build({
  entryPoints: ['telemetry-entry.js'],
  bundle: true,
  format: 'iife',
  globalName: 'TelemetryBundle',
  target: 'es2018',
  outfile: 'src/js/telemetry-embed.js',
  plugins: [tsconfigPaths()],
}).catch(() => process.exit(1));