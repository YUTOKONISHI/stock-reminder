import inertia from '@inertiajs/vite';
import { wayfinder } from '@laravel/vite-plugin-wayfinder';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import laravel from 'laravel-vite-plugin';
import { google } from 'laravel-vite-plugin/fonts';
import { defineConfig } from 'vite';

export default defineConfig({
    plugins: [
        laravel({
            input: ['resources/css/app.css', 'resources/js/app.tsx'],
            refresh: true,
            /* Bunny には和文の unicode-range がほぼ無く、366 個の @font-face に対して 9 個しか
             * 付かない。ブラウザが必要な文字を判別できず全サブセットを取りに行くため、
             * 和文は Google を使う。
             *
             * preload は既定が「全WOFF2」で、和文だと363ファイルすべてに link[rel=preload] が
             * 出て unicode-range の意味が消える。false にして、必要な字だけ取らせる。
             * 500 は shadcn の Label / Input / Button が font-medium で使う。外すと無言で400に落ちる。
             * 経緯は doc/plans/20260912-ui-design-refinement.md にある。 */
            fonts: [
                google('Zen Kaku Gothic New', {
                    weights: [400, 500, 700],
                    subsets: ['japanese', 'latin'],
                    preload: false,
                }),
                google('Roboto', {
                    weights: [400, 500, 700],
                    subsets: ['latin'],
                    preload: false,
                }),
            ],
        }),
        inertia(),
        react({
            babel: {
                plugins: ['babel-plugin-react-compiler'],
            },
        }),
        tailwindcss(),
        wayfinder({
            formVariants: true,
        }),
    ],
});
