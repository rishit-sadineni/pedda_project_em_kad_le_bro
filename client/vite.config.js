const { defineConfig } = require('vite');
const react = require('@vitejs/plugin-react');
module.exports = defineConfig({ root: '.', plugins: [react()], server: { port: 5173, proxy: { '/api': 'http://localhost:4000' } }, build: { outDir: 'dist' } });
