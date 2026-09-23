export default {
  root: '.',
  base: './',
  esbuild: {
    target: 'es2020',
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    open: false,
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
    sourcemap: true,
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
};