import { defineConfig } from 'tsup';

export default defineConfig({
    dts: {
        entry: './src/index.tsx',
    },
    format: [
        'esm',
    ],
    clean: true,
    minify: true,
    splitting: true,
    treeshake: true,
    external: ['bun'],
    entry: {
        index: './src/index.tsx',
    },
});
