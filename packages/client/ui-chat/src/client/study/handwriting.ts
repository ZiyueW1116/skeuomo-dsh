/** 纸面排字与按笔顺落墨；坐标与机械臂笔尖使用同一条轨迹。 */
export interface Glyph {
  medians: number[][][]
  strokes: string[]
}
/**
 * 纸面上单个字的位置与字号，坐标以纹理像素计。
 */
export interface Letter {
  char: string
  x: number
  y: number
  size: number
  angle: number
  slant: number
}
/**
 * 纸面纹理宽度，以像素计。
 */
export const PAPER_W = 900
/**
 * 纸面纹理高度，以像素计。
 */
export const PAPER_H = 1240
/**
 * 本地手写字体及浏览器字体族。
 */
export const FONT = 'StudyHand, cursive'
const glyphs = new Map<string, Glyph | null>()
const pending = new Map<string, Promise<void>>()
/**
 * 加载文本中的中文笔顺；缺失字形由手写字体绘制。
 * @param text - 需要书写的文本。
 * @returns 所有本地笔顺请求完成后的 Promise。
 */
export function preloadGlyphs(text: string): Promise<void> {
  return Promise.all(
    [...new Set(text)]
      .filter(char => /\p{Script=Han}/u.test(char))
      .map((char) => {
        if (glyphs.has(char)) return Promise.resolve()
        let promise = pending.get(char)
        if (!promise) {
          promise = fetch(`/study/glyphs/${encodeURIComponent(char)}.json`)
            .then(async (response) => {
              glyphs.set(
                char,
                response.ok ? ((await response.json()) as Glyph) : null,
              )
            })
            .catch(() => {
              glyphs.set(char, null)
            })
            .finally(() => {
              pending.delete(char)
            })
          pending.set(char, promise)
        }
        return promise
      }),
  ).then(() => {})
}
/**
 * 将正文按行宽与纸面高度排成多页字形。
 * @param text - 保留换行的正文。
 * @returns 每页按书写顺序排列的字形。
 */
export function paginate(text: string): Letter[][] {
  const pages: Letter[][] = [[]]
  let x = 80,
    y = 240,
    index = 0
  for (const char of text.replaceAll('\t', '    ')) {
    const rhythm = Math.sin(index * 2.399) + Math.sin(index * 0.71) * 0.5
    const size = 60 + rhythm * 1.9
    const width = (/[\u0000-\u00ff]/u.test(char) ? 32 : 65) + rhythm * 1.2
    if (char === '\n' || x + width > 825) {
      x = 80
      y += 82
    }
    if (y > 1090) {
      pages.push([])
      y = 240
    }
    index++
    if (char !== '\n') {
      ;(pages.at(-1) as Letter[]).push({
        char,
        x: x + Math.sin(index * 0.91) * 0.8,
        y: y + Math.sin(index * 1.71) * 1.8,
        size,
        angle: Math.sin(index * 1.37) * 0.026,
        slant: 0.035 + Math.sin(index * 0.83) * 0.025,
      })
      x += width
    }
  }
  return pages
}
/**
 * 按排版中的轻微倾斜与字形变化绘制输入文字。
 * @param ctx - 纸面绘制上下文。
 * @param letter - 已排版的单个文字。
 */
export function drawHandLetter(
  ctx: CanvasRenderingContext2D,
  letter: Letter,
): void {
  ctx.save()
  ctx.translate(letter.x, letter.y)
  ctx.rotate(letter.angle)
  ctx.transform(1, 0, letter.slant, 1, 0, 0)
  ctx.font = `${letter.size}px ${FONT}`
  ctx.fillStyle = '#304049'
  ctx.fillText(letter.char, 0, 0)
  ctx.restore()
}
/** 单线拉丁字形，坐标刻意保留手写的倾斜与不对称。 */
const LATIN: Record<string, number[][][]> = {
  A: [
    [
      [0.05, 1],
      [0.55, 0],
      [0.95, 1],
    ],
    [
      [0.24, 0.62],
      [0.78, 0.6],
    ],
  ],
  B: [
    [
      [0.14, 1],
      [0.22, 0],
      [0.66, 0.02],
      [0.9, 0.2],
      [0.78, 0.42],
      [0.19, 0.49],
      [0.73, 0.49],
      [0.92, 0.71],
      [0.8, 0.94],
      [0.14, 1],
    ],
  ],
  C: [
    [
      [0.93, 0.15],
      [0.62, 0.02],
      [0.25, 0.16],
      [0.07, 0.57],
      [0.22, 0.9],
      [0.59, 1],
      [0.91, 0.84],
    ],
  ],
  D: [
    [
      [0.12, 1],
      [0.21, 0],
      [0.63, 0.03],
      [0.9, 0.3],
      [0.9, 0.65],
      [0.65, 0.94],
      [0.12, 1],
    ],
  ],
  E: [
    [
      [0.94, 0.02],
      [0.22, 0.04],
      [0.13, 0.98],
      [0.87, 0.98],
    ],
    [
      [0.18, 0.49],
      [0.73, 0.48],
    ],
  ],
  F: [
    [
      [0.14, 1],
      [0.23, 0.04],
      [0.95, 0.02],
    ],
    [
      [0.19, 0.5],
      [0.77, 0.48],
    ],
  ],
  G: [
    [
      [0.92, 0.16],
      [0.62, 0.02],
      [0.25, 0.16],
      [0.07, 0.57],
      [0.22, 0.9],
      [0.59, 1],
      [0.9, 0.84],
      [0.91, 0.56],
      [0.6, 0.57],
    ],
  ],
  H: [
    [
      [0.16, 0],
      [0.08, 1],
    ],
    [
      [0.94, 0],
      [0.84, 1],
    ],
    [
      [0.13, 0.52],
      [0.88, 0.49],
    ],
  ],
  I: [
    [
      [0.13, 0.03],
      [0.91, 0.01],
    ],
    [
      [0.54, 0.03],
      [0.45, 0.98],
    ],
    [
      [0.08, 1],
      [0.84, 0.97],
    ],
  ],
  J: [
    [
      [0.3, 0.02],
      [0.94, 0.02],
    ],
    [
      [0.77, 0.02],
      [0.68, 0.79],
      [0.49, 0.98],
      [0.21, 0.93],
      [0.09, 0.7],
    ],
  ],
  K: [
    [
      [0.2, 0],
      [0.1, 1],
    ],
    [
      [0.94, 0.02],
      [0.16, 0.55],
      [0.89, 1],
    ],
  ],
  L: [
    [
      [0.23, 0],
      [0.13, 0.99],
      [0.92, 0.97],
    ],
  ],
  M: [
    [
      [0.06, 1],
      [0.16, 0.02],
      [0.51, 0.64],
      [0.91, 0.01],
      [0.91, 1],
    ],
  ],
  N: [
    [
      [0.1, 1],
      [0.19, 0.02],
      [0.85, 0.98],
      [0.95, 0],
    ],
  ],
  O: [
    [
      [0.57, 0.02],
      [0.23, 0.14],
      [0.07, 0.57],
      [0.2, 0.89],
      [0.54, 1],
      [0.85, 0.8],
      [0.95, 0.36],
      [0.83, 0.09],
      [0.57, 0.02],
    ],
  ],
  P: [
    [
      [0.13, 1],
      [0.22, 0.02],
      [0.68, 0.03],
      [0.91, 0.22],
      [0.77, 0.49],
      [0.18, 0.53],
    ],
  ],
  Q: [
    [
      [0.57, 0.02],
      [0.23, 0.14],
      [0.07, 0.57],
      [0.2, 0.89],
      [0.54, 1],
      [0.85, 0.8],
      [0.95, 0.36],
      [0.83, 0.09],
      [0.57, 0.02],
    ],
    [
      [0.6, 0.7],
      [1, 1.13],
    ],
  ],
  R: [
    [
      [0.13, 1],
      [0.22, 0.02],
      [0.68, 0.03],
      [0.91, 0.22],
      [0.77, 0.49],
      [0.18, 0.53],
    ],
    [
      [0.56, 0.51],
      [0.91, 1],
    ],
  ],
  S: [
    [
      [0.92, 0.14],
      [0.6, 0.02],
      [0.25, 0.13],
      [0.17, 0.36],
      [0.75, 0.64],
      [0.89, 0.85],
      [0.64, 1],
      [0.23, 0.95],
      [0.08, 0.82],
    ],
  ],
  T: [
    [
      [0.07, 0.04],
      [0.98, 0.02],
    ],
    [
      [0.55, 0.03],
      [0.45, 1],
    ],
  ],
  U: [
    [
      [0.18, 0],
      [0.1, 0.72],
      [0.27, 0.97],
      [0.58, 1],
      [0.84, 0.78],
      [0.94, 0.01],
    ],
  ],
  V: [
    [
      [0.1, 0.02],
      [0.39, 1],
      [0.96, 0],
    ],
  ],
  W: [
    [
      [0.06, 0.02],
      [0.2, 1],
      [0.55, 0.4],
      [0.7, 1],
      [0.99, 0],
    ],
  ],
  X: [
    [
      [0.13, 0],
      [0.91, 1],
    ],
    [
      [0.95, 0],
      [0.09, 1],
    ],
  ],
  Y: [
    [
      [0.09, 0],
      [0.51, 0.53],
      [0.98, 0.01],
    ],
    [
      [0.51, 0.53],
      [0.43, 1],
    ],
  ],
  Z: [
    [
      [0.12, 0.04],
      [0.96, 0.01],
      [0.09, 1],
      [0.92, 0.96],
    ],
  ],
  a: [
    [
      [0.85, 0.35],
      [0.55, 0.24],
      [0.2, 0.42],
      [0.16, 0.8],
      [0.45, 0.95],
      [0.79, 0.68],
      [0.85, 0.3],
      [0.78, 0.9],
      [1, 0.95],
    ],
  ],
  b: [
    [
      [0.18, 1],
      [0.3, 0],
    ],
    [
      [0.24, 0.56],
      [0.6, 0.27],
      [0.9, 0.42],
      [0.87, 0.8],
      [0.5, 0.99],
      [0.2, 0.85],
    ],
  ],
  c: [
    [
      [0.9, 0.35],
      [0.57, 0.24],
      [0.22, 0.4],
      [0.15, 0.78],
      [0.4, 0.98],
      [0.86, 0.87],
    ],
  ],
  d: [
    [
      [0.83, 0.37],
      [0.51, 0.24],
      [0.2, 0.44],
      [0.15, 0.8],
      [0.43, 0.98],
      [0.78, 0.68],
    ],
    [
      [0.78, 0.9],
      [0.94, 0],
    ],
  ],
  e: [
    [
      [0.2, 0.57],
      [0.85, 0.49],
      [0.75, 0.25],
      [0.43, 0.28],
      [0.17, 0.6],
      [0.23, 0.91],
      [0.57, 0.99],
      [0.9, 0.86],
    ],
  ],
  f: [
    [
      [0.2, 1.2],
      [0.39, 0.2],
      [0.62, -0.04],
      [0.88, 0.06],
    ],
    [
      [0.05, 0.47],
      [0.8, 0.43],
    ],
  ],
  g: [
    [
      [0.84, 0.35],
      [0.52, 0.24],
      [0.19, 0.44],
      [0.16, 0.8],
      [0.45, 0.97],
      [0.78, 0.65],
    ],
    [
      [0.84, 0.3],
      [0.71, 1.3],
      [0.43, 1.5],
      [0.12, 1.35],
    ],
  ],
  h: [
    [
      [0.15, 1],
      [0.32, 0],
    ],
    [
      [0.23, 0.6],
      [0.6, 0.29],
      [0.83, 0.4],
      [0.8, 0.94],
    ],
  ],
  i: [
    [
      [0.45, 0.35],
      [0.36, 0.95],
      [0.6, 0.96],
    ],
    [
      [0.48, 0.05],
      [0.5, 0.07],
    ],
  ],
  j: [
    [
      [0.61, 0.35],
      [0.52, 1.27],
      [0.28, 1.5],
      [0.05, 1.35],
    ],
    [
      [0.64, 0.05],
      [0.65, 0.07],
    ],
  ],
  k: [
    [
      [0.16, 1],
      [0.3, 0],
    ],
    [
      [0.88, 0.31],
      [0.23, 0.68],
      [0.8, 0.99],
    ],
  ],
  l: [
    [
      [0.48, 0],
      [0.32, 0.9],
      [0.53, 0.98],
    ],
  ],
  m: [
    [
      [0.12, 1],
      [0.22, 0.31],
      [0.18, 0.62],
      [0.45, 0.28],
      [0.57, 0.42],
      [0.53, 0.96],
    ],
    [
      [0.57, 0.56],
      [0.83, 0.3],
      [0.99, 0.45],
      [0.93, 0.96],
    ],
  ],
  n: [
    [
      [0.16, 1],
      [0.26, 0.31],
      [0.21, 0.62],
      [0.6, 0.28],
      [0.85, 0.45],
      [0.8, 0.97],
    ],
  ],
  o: [
    [
      [0.59, 0.26],
      [0.27, 0.35],
      [0.13, 0.72],
      [0.3, 0.96],
      [0.62, 0.98],
      [0.89, 0.67],
      [0.84, 0.37],
      [0.59, 0.26],
    ],
  ],
  p: [
    [
      [0.12, 1.5],
      [0.29, 0.32],
    ],
    [
      [0.25, 0.55],
      [0.6, 0.28],
      [0.9, 0.47],
      [0.83, 0.79],
      [0.48, 0.96],
      [0.21, 0.83],
    ],
  ],
  q: [
    [
      [0.84, 0.36],
      [0.51, 0.25],
      [0.18, 0.47],
      [0.18, 0.83],
      [0.43, 0.96],
      [0.77, 0.65],
    ],
    [
      [0.85, 0.29],
      [0.68, 1.5],
      [0.95, 1.28],
    ],
  ],
  r: [
    [
      [0.18, 1],
      [0.27, 0.32],
      [0.23, 0.63],
      [0.58, 0.3],
      [0.87, 0.4],
    ],
  ],
  s: [
    [
      [0.87, 0.35],
      [0.52, 0.24],
      [0.22, 0.39],
      [0.27, 0.57],
      [0.75, 0.71],
      [0.8, 0.88],
      [0.48, 1],
      [0.15, 0.88],
    ],
  ],
  t: [
    [
      [0.51, 0.04],
      [0.36, 0.84],
      [0.48, 0.99],
      [0.77, 0.89],
    ],
    [
      [0.1, 0.4],
      [0.86, 0.37],
    ],
  ],
  u: [
    [
      [0.22, 0.31],
      [0.15, 0.82],
      [0.35, 0.97],
      [0.75, 0.67],
      [0.82, 0.3],
      [0.75, 0.93],
      [0.96, 0.97],
    ],
  ],
  v: [
    [
      [0.16, 0.31],
      [0.39, 0.98],
      [0.91, 0.3],
    ],
  ],
  w: [
    [
      [0.08, 0.3],
      [0.22, 0.98],
      [0.54, 0.44],
      [0.65, 0.98],
      [0.98, 0.31],
    ],
  ],
  x: [
    [
      [0.18, 0.32],
      [0.83, 0.99],
    ],
    [
      [0.9, 0.3],
      [0.12, 0.99],
    ],
  ],
  y: [
    [
      [0.15, 0.31],
      [0.4, 0.93],
      [0.88, 0.3],
      [0.42, 1.35],
      [0.12, 1.49],
    ],
  ],
  z: [
    [
      [0.15, 0.35],
      [0.88, 0.3],
      [0.13, 0.97],
      [0.85, 0.94],
    ],
  ],
  '0': [
    [
      [0.63, 0.05],
      [0.3, 0.15],
      [0.12, 0.65],
      [0.26, 0.96],
      [0.6, 0.98],
      [0.86, 0.58],
      [0.85, 0.17],
      [0.63, 0.05],
    ],
  ],
  '1': [
    [
      [0.23, 0.26],
      [0.57, 0.03],
      [0.43, 0.97],
    ],
    [
      [0.15, 0.98],
      [0.77, 0.98],
    ],
  ],
  '2': [
    [
      [0.15, 0.25],
      [0.4, 0.04],
      [0.75, 0.07],
      [0.88, 0.3],
      [0.12, 0.99],
      [0.88, 0.95],
    ],
  ],
  '3': [
    [
      [0.2, 0.13],
      [0.58, 0.03],
      [0.85, 0.23],
      [0.54, 0.48],
      [0.87, 0.69],
      [0.73, 0.94],
      [0.35, 0.99],
      [0.13, 0.87],
    ],
  ],
  '4': [
    [
      [0.72, 0],
      [0.1, 0.68],
      [0.94, 0.65],
    ],
    [
      [0.77, 0.13],
      [0.67, 1],
    ],
  ],
  '5': [
    [
      [0.9, 0.06],
      [0.3, 0.07],
      [0.19, 0.5],
      [0.64, 0.45],
      [0.86, 0.69],
      [0.74, 0.94],
      [0.38, 1],
      [0.13, 0.85],
    ],
  ],
  '6': [
    [
      [0.85, 0.12],
      [0.56, 0.04],
      [0.22, 0.35],
      [0.14, 0.75],
      [0.32, 0.97],
      [0.68, 0.96],
      [0.88, 0.7],
      [0.7, 0.48],
      [0.35, 0.49],
      [0.15, 0.71],
    ],
  ],
  '7': [
    [
      [0.1, 0.1],
      [0.94, 0.05],
      [0.36, 1],
    ],
  ],
  '8': [
    [
      [0.6, 0.04],
      [0.25, 0.13],
      [0.2, 0.35],
      [0.73, 0.62],
      [0.84, 0.85],
      [0.59, 1],
      [0.23, 0.94],
      [0.11, 0.72],
      [0.76, 0.31],
      [0.8, 0.13],
      [0.6, 0.04],
    ],
  ],
  '9': [
    [
      [0.8, 0.53],
      [0.44, 0.58],
      [0.16, 0.4],
      [0.25, 0.13],
      [0.61, 0.04],
      [0.85, 0.2],
      [0.76, 0.71],
      [0.44, 1],
    ],
  ],
  '.': [
    [
      [0.4, 0.95],
      [0.43, 0.97],
    ],
  ],
  ',': [
    [
      [0.47, 0.9],
      [0.34, 1.13],
    ],
  ],
  ':': [
    [
      [0.47, 0.35],
      [0.49, 0.37],
    ],
    [
      [0.4, 0.9],
      [0.42, 0.92],
    ],
  ],
  ';': [
    [
      [0.47, 0.35],
      [0.49, 0.37],
    ],
    [
      [0.47, 0.9],
      [0.34, 1.13],
    ],
  ],
  '-': [
    [
      [0.15, 0.57],
      [0.85, 0.54],
    ],
  ],
  _: [
    [
      [0.05, 1.05],
      [0.95, 1.05],
    ],
  ],
  '/': [
    [
      [0.93, 0],
      [0.1, 1],
    ],
  ],
  '\\': [
    [
      [0.1, 0],
      [0.9, 1],
    ],
  ],
  '!': [
    [
      [0.55, 0.04],
      [0.43, 0.7],
    ],
    [
      [0.39, 0.95],
      [0.41, 0.97],
    ],
  ],
  '?': [
    [
      [0.16, 0.2],
      [0.43, 0.04],
      [0.79, 0.15],
      [0.85, 0.39],
      [0.48, 0.58],
      [0.45, 0.73],
    ],
    [
      [0.42, 0.96],
      [0.44, 0.98],
    ],
  ],
  '(': [
    [
      [0.7, 0],
      [0.38, 0.3],
      [0.26, 0.7],
      [0.5, 1.1],
    ],
  ],
  ')': [
    [
      [0.35, 0],
      [0.6, 0.3],
      [0.57, 0.7],
      [0.28, 1.1],
    ],
  ],
  '[': [
    [
      [0.75, 0],
      [0.3, 0],
      [0.2, 1],
      [0.7, 1],
    ],
  ],
  ']': [
    [
      [0.3, 0],
      [0.8, 0],
      [0.7, 1],
      [0.2, 1],
    ],
  ],
  '=': [
    [
      [0.1, 0.4],
      [0.9, 0.4],
    ],
    [
      [0.1, 0.7],
      [0.9, 0.7],
    ],
  ],
  '+': [
    [
      [0.1, 0.55],
      [0.9, 0.55],
    ],
    [
      [0.55, 0.2],
      [0.45, 0.9],
    ],
  ],
  '。': [
    [
      [0.3, 0.8],
      [0.16, 0.85],
      [0.17, 1],
      [0.32, 1.01],
      [0.4, 0.9],
      [0.3, 0.8],
    ],
  ],
  '，': [
    [
      [0.3, 0.8],
      [0.19, 1.08],
    ],
  ],
  '、': [
    [
      [0.18, 0.75],
      [0.4, 1],
    ],
  ],
  '：': [
    [
      [0.43, 0.35],
      [0.45, 0.38],
    ],
    [
      [0.4, 0.88],
      [0.43, 0.91],
    ],
  ],
  '“': [
    [
      [0.35, 0.05],
      [0.18, 0.3],
      [0.38, 0.28],
    ],
    [
      [0.75, 0.05],
      [0.57, 0.3],
      [0.77, 0.28],
    ],
  ],
  '”': [
    [
      [0.25, 0.04],
      [0.47, 0.05],
      [0.3, 0.29],
    ],
    [
      [0.65, 0.04],
      [0.87, 0.05],
      [0.7, 0.29],
    ],
  ],
  '—': [
    [
      [0.03, 0.6],
      [0.97, 0.6],
    ],
  ],
  '·': [
    [
      [0.48, 0.55],
      [0.5, 0.57],
    ],
  ],
}
/**
 * 机械笔尖当前的纸面坐标与落笔状态。
 */
export interface PenPoint {
  x: number
  y: number
  down: boolean
}
interface InkStroke {
  prepared?: {
    points: number[][]
    lengths: number[]
    total: number
  }
  points: number[][]
  outline?: string | undefined
  letter: Letter
  han: boolean
}
function strokesFor(letter: Letter): InkStroke[] {
  const glyph = glyphs.get(letter.char)
  if (glyph)
    return glyph.medians.map((points, index) => ({
      points,
      outline: glyph.strokes[index],
      letter,
      han: true,
    }))
  const latin = LATIN[letter.char] ?? LATIN[letter.char.toLowerCase()]
  return (latin ?? []).map(points => ({ points, letter, han: false }))
}
/**
 * 按笔顺推进墨迹，向机械臂提供相同轨迹的笔尖位置。
 */
export class InkWriter {
  private letters: Letter[] = []
  private letter = 0
  private stroke = 0
  private distance = 0
  private lift = 0
  private paths: InkStroke[] = []
  /**
   * 当前笔尖位置；down 为 false 时应抬笔。
   */
  point: PenPoint = { x: 800, y: 1100, down: false }
  /**
   * 当前页的全部字形是否写完。
   */
  completed = false
  /**
   * 当前页已经完成的字形数量。
   */
  written = 0
  constructor(private readonly ctx: CanvasRenderingContext2D) {}
  private isCompleted(): boolean {
    return this.completed
  }
  /**
   * 更换当前页并重置笔顺进度；调用者负责清空底图。
   * @param letters - 新页的排版字形。
   * @param instant - 是否立即绘制整页，用于历史手稿。
   */
  reset(letters: Letter[], instant = false): void {
    this.letters = letters
    this.letter = 0
    this.stroke = 0
    this.distance = 0
    this.paths = []
    this.lift = 0
    this.completed = false
    this.written = 0
    if (instant) {
      for (let i = 0; i < 100000 && !this.isCompleted(); i++)
        this.tick(0.2, 5000)
    }
  }
  /**
   * 更新当前页的字形列表，保留已经完成的书写进度。
   * @param letters - 包含已有前缀的完整字形列表。
   */
  append(letters: Letter[]): void {
    this.letters = letters
    if (this.letter < letters.length) this.completed = false
  }
  private xy(path: InkStroke, point: number[]): number[] {
    const l = path.letter
    const u = path.han
      ? (point[0] as number) / 1024
      : (point[0] as number) * 0.5
    const v = path.han
      ? (80 - (point[1] as number)) / 1024
      : -0.75 + (point[1] as number) * 0.72
    const x = (u + l.slant * v) * l.size,
      y = v * l.size,
      c = Math.cos(l.angle),
      s = Math.sin(l.angle)
    return [l.x + c * x - s * y, l.y + s * x + c * y]
  }
  /**
   * 按经过时间推进笔尖并向纸面落墨。
   * @param dt - 经过的秒数。
   * @param speed - 每秒前进的纹理像素数。
   * @returns 本次是否改变墨迹纹理。
   */
  tick(dt: number, speed = 700): boolean {
    if (this.completed) {
      this.point.down = false
      return false
    }
    if (this.lift > 0) {
      this.lift -= dt
      this.point.down = false
      return false
    }
    let budget = dt * speed,
      changed = false
    while (budget > 0 && this.letter < this.letters.length) {
      if (this.paths.length === 0)
        this.paths = strokesFor(this.letters[this.letter] as Letter)
      const path = this.paths[this.stroke]
      if (!path) {
        const l = this.letters[this.letter] as Letter
        if (this.paths.length === 0 && l.char.trim() !== '') {
          drawHandLetter(this.ctx, l)
          changed = true
        }
        this.letter++
        this.written = this.letter
        this.stroke = 0
        this.paths = []
        this.distance = 0
        continue
      }
      if (!path.prepared) {
        const raw = path.points.map(p => this.xy(path, p))
        const points: number[][] = []
        for (let i = 0; i < raw.length - 1; i++) {
          const a = raw[Math.max(0, i - 1)] as number[],
            b = raw[i] as number[],
            c = raw[i + 1] as number[],
            d = raw[Math.min(raw.length - 1, i + 2)] as number[]
          for (let step = 0; step < 5; step++) {
            const t = step / 5,
              t2 = t * t,
              t3 = t2 * t
            points.push(
              [0, 1].map(
                axis =>
                  0.5 *
                  (2 * (b[axis] as number) +
                    (-(a[axis] as number) + (c[axis] as number)) * t +
                    (2 * (a[axis] as number) -
                      5 * (b[axis] as number) +
                      4 * (c[axis] as number) -
                      (d[axis] as number)) *
                      t2 +
                    (-(a[axis] as number) +
                      3 * (b[axis] as number) -
                      3 * (c[axis] as number) +
                      (d[axis] as number)) *
                      t3),
              ),
            )
          }
        }
        points.push(raw.at(-1) as number[])
        const lengths = points
          .slice(1)
          .map((p, i) =>
            Math.hypot(
              (p[0] as number) - ((points[i] as number[])[0] as number),
              (p[1] as number) - ((points[i] as number[])[1] as number),
            ),
          )
        path.prepared = {
          points,
          lengths,
          total: lengths.reduce((a, b) => a + b, 0),
        }
      }
      const { points, lengths, total } = path.prepared
      if (this.distance === 0) {
        const first = points[0] as number[]
        const dx = (first[0] as number) - this.point.x,
          dy = (first[1] as number) - this.point.y,
          gap = Math.hypot(dx, dy)
        if (gap > 0.05) {
          const step = Math.min(1, (dt * speed * 1.6) / gap)
          this.point = {
            x: this.point.x + dx * step,
            y: this.point.y + dy * step,
            down: false,
          }
          return false
        }
      }
      const end = Math.min(total, this.distance + budget)
      this.ctx.save()
      this.ctx.strokeStyle = '#293b43'
      this.ctx.lineCap = 'round'
      this.ctx.lineJoin = 'round'
      let passed = 0
      for (let i = 0; i < lengths.length; i++) {
        const length = lengths[i] as number,
          a = points[i] as number[],
          b = points[i + 1] as number[]
        const startT = Math.max(
            0,
            (this.distance - passed) / Math.max(0.001, length),
          ),
          endT = Math.min(1, (end - passed) / Math.max(0.001, length))
        if (startT <= 1 && endT >= 0 && endT >= startT) {
          const progress =
            (passed + length * (startT + endT) * 0.5) / Math.max(total, 0.001)
          const pressure =
            0.48 + 0.52 * Math.pow(Math.sin(Math.PI * progress), 0.55)
          const nib =
            0.75 +
            0.25 *
              Math.abs(
                Math.sin(
                  Math.atan2(
                    (b[1] as number) - (a[1] as number),
                    (b[0] as number) - (a[0] as number),
                  ) + 0.6,
                ),
              )
          this.ctx.lineWidth =
            ((path.han ? 3.35 : 2.1) * pressure * nib * path.letter.size) / 60
          this.ctx.globalAlpha = 0.88
          this.ctx.beginPath()
          this.ctx.moveTo(
            (a[0] as number) + ((b[0] as number) - (a[0] as number)) * startT,
            (a[1] as number) + ((b[1] as number) - (a[1] as number)) * startT,
          )
          const x =
              (a[0] as number) + ((b[0] as number) - (a[0] as number)) * endT,
            y = (a[1] as number) + ((b[1] as number) - (a[1] as number)) * endT
          this.ctx.lineTo(x, y)
          this.ctx.stroke()
          this.point = { x, y, down: true }
        }
        passed += length
      }
      this.ctx.restore()
      changed = true
      budget -= end - this.distance
      this.distance = end
      if (end >= total) {
        this.stroke++
        this.distance = 0
        this.lift = 0.03 + Math.sin(this.stroke * 1.7) ** 2 * 0.018
        break
      }
    }
    if (this.letter >= this.letters.length) {
      this.completed = true
      this.point.down = false
    }
    return changed
  }
}
