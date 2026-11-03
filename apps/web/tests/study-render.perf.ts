/** 同一 Retina 分辨率下测量真实书写场景的帧间隔与 JavaScript 堆。 */
import { chromium } from 'playwright'
import { expect, it, onTestFinished } from 'vitest'
import { launchWebScaffold } from './scaffold.ts'

it('记录机械笔连续书写的渲染开销', async () => {
  const scaffold = await launchWebScaffold({})
  onTestFinished(() => scaffold.close())
  const browser = await chromium.launch({
    args: ['--use-angle=metal', '--enable-precise-memory-info'],
  })
  onTestFinished(() => browser.close())
  const page = await browser.newPage({
    viewport: { width: 1440, height: 810 },
    deviceScaleFactor: 2,
  })
  await page.goto(scaffold.authenticatedUrl, { waitUntil: 'load' })
  await page
    .getByRole('button', { name: '试写一封欢迎信' })
    .waitFor({ timeout: 40000 })
  await page.getByRole('button', { name: '试写一封欢迎信' }).click()
  await expect
    .poll(
      () => page.locator('[data-study-scene]').getAttribute('data-writing'),
      { timeout: 15000 },
    )
    .toBe('true')
  await expect
    .poll(
      () =>
        page.locator('[data-study-scene]').getAttribute('data-camera-moving'),
      { timeout: 15000 },
    )
    .toBe('false')
  const result = await page.evaluate(async () => {
    const canvas = document.querySelector<HTMLCanvasElement>(
      '[data-study-scene] canvas',
    )!
    const gl = canvas.getContext('webgl2')!
    const debug = gl.getExtension('WEBGL_debug_renderer_info')
    const heap = () => {
      const memory: unknown = Reflect.get(performance, 'memory')
      return typeof memory === 'object' && memory !== null
        ? Number(Reflect.get(memory, 'usedJSHeapSize'))
        : 0
    }
    const times: number[] = []
    const before = heap()
    let peak = before
    await new Promise<void>((resolve) => {
      let start = 0,
        last = 0
      const sample = (now: number) => {
        if (!start) start = now
        else times.push(now - last)
        last = now
        peak = Math.max(peak, heap())
        if (now - start < 10000) requestAnimationFrame(sample)
        else resolve()
      }
      requestAnimationFrame(sample)
    })
    const sorted = [...times].sort((a, b) => a - b)
    return {
      renderer: String(
        debug
          ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)
          : gl.getParameter(gl.RENDERER),
      ),
      width: canvas.width,
      height: canvas.height,
      frames: times.length,
      fps: (1000 * times.length) / times.reduce((a, b) => a + b, 0),
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      heapStart: before,
      heapPeak: peak,
      heapEnd: heap(),
      drawCalls:
        document.querySelector<HTMLElement>('[data-study-scene]')!.dataset[
          'drawCalls'
        ],
    }
  })
  console.log('STUDY_RENDER', JSON.stringify(result))
  await page.screenshot({ path: '/tmp/study-render-performance.png' })
})
