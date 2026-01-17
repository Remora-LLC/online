const esbuild = require('esbuild');
const tsconfigPathsPlugin = require('esbuild-plugin-tsconfig-paths').default;

esbuild.build({
  entryPoints: ['telemetry-entry.js'],
  bundle: true,
  format: 'iife',
  globalName: 'TelemetryBundle',
  target: 'es2018',
  outfile: 'src/js/telemetry-embed.js',
  plugins: [tsconfigPathsPlugin()],
}).catch(() => process.exit(1));