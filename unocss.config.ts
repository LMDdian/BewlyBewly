import { createRequire } from 'node:module'

import { presetAttributify, presetIcons, presetTypography, presetUno, transformerDirectives } from 'unocss'
import { defineConfig } from 'unocss/vite'

const remRE = /(-?[.\d]+)rem/g

/**
 * Node 18.20+/20+/22+/24 rejects `import(json)` without import attributes.
 * UnoCSS 0.59 still loads @iconify/json that way, so icons fail silently and
 * the built style.css contains almost no icon rules.
 * Load collections via createRequire instead.
 */
const require = createRequire(import.meta.url)

function loadIconifyCollection(name: string) {
  return () => require(`@iconify/json/json/${name}.json`)
}

const ICON_COLLECTIONS = [
  'mingcute',
  'tabler',
  'solar',
  'ph',
  'svg-spinners',
  'fluent',
  'ic',
  'uil',
] as const

export default defineConfig({
  content: {
    pipeline: {
      include: [
        '**/*.{js,ts}',
        /\.(vue|svelte|[jt]sx|mdx?|astro|elm|php|phtml|html)($|\?)/,
      ],
    },
  },
  blocklist: [
    'ps',
    'container',
  ],
  presets: [
    presetUno(),
    presetAttributify(),
    presetIcons({
      extraProperties: {
        'display': 'inline-block',
        'vertical-align': 'middle',
        'width': '1.2em',
        'height': '1.2em',
      },
      collections: Object.fromEntries(
        ICON_COLLECTIONS.map(name => [name, loadIconifyCollection(name)]),
      ),
    }),
    presetTypography(),

    {
      name: 'text-size-transformer',
      postprocess: (util) => {
        util.entries.forEach((i) => {
          const value = i[1]

          if (typeof value === 'string' && remRE.test(value)) {
            i[1] = value.replace(remRE, (_, num: number) => {
              return `calc(var(--bew-base-font-size) * ${num})`
            })
          }
        })
      },
    },
  ],
  transformers: [
    transformerDirectives(),
  ],
})
