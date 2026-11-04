/** 三维书桌的真实浏览器回归：数据读取、草稿、物理控制与笔顺动画。 */
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium } from 'playwright'
import { startMockLlmServer } from '@deepseek-ai/dsh-llm-mock-server'
import { expect, it, onTestFinished } from 'vitest'
import { launchWebScaffold, seedSession, watchConsole } from './scaffold.ts'
import { withDefaultWeb } from '../../cli/tests/profiles/web/tests/default-web-process.ts'
import { createChatScrollFixture } from './chat-scroll-fixture.ts'

it('书桌只呈现三维物件，保留会话并逐笔书写', async () => {
  const scaffold = await launchWebScaffold({})
  onTestFinished(() => scaffold.close())
  const browser = await chromium.launch({ args: ['--use-angle=metal'] })
  onTestFinished(() => browser.close())
  const fixture = createChatScrollFixture({
    markerPrefix: 'STUDY_PEN',
    title: '一封旧信',
    turns: 1,
  })
  await seedSession(scaffold, fixture.log, 'study-pen-replay')
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    locale: 'zh-CN',
  })
  const logs = watchConsole(page)
  page.on('pageerror', error =>
    process.stderr.write(`PAGE ERROR ${error.message}\n`),
  )
  page.on('console', (message) => {
    if (message.type() === 'error')
      process.stderr.write(`CONSOLE ${message.text()}\n`)
  })
  await page.goto(scaffold.authenticatedUrl, { waitUntil: 'load' })
  await page
    .getByRole('button', { name: '试写一封欢迎信' })
    .waitFor({ timeout: 40000 })
  await page.screenshot({ path: '/tmp/study-3d-desktop.png' })
  expect(await page.getByRole('dialog').count()).toBe(0)
  expect(await page.getByRole('combobox').count()).toBe(0)
  expect(await page.getByRole('tree').count()).toBe(0)
  const scene = page.locator('[data-study-scene]')
  await expect
    .poll(() => scene.getAttribute('data-camera-moving'), { timeout: 6000 })
    .toBe('false')
  const pageSpan = async () => {
    const previous = await page
      .getByRole('button', { name: '上一页', exact: true })
      .boundingBox()
    const next = await page
      .getByRole('button', { name: '下一页', exact: true })
      .boundingBox()
    return next!.x - previous!.x
  }
  const seatedSpan = await pageSpan()
  const leftPage = await page
    .getByRole('button', { name: '在左页写下问题' })
    .boundingBox()
  expect(leftPage).not.toBeNull()
  // 点击可见纸面，绕开中央无障碍按钮，不由填值 API 代替焦点交接。
  await page.mouse.click(leftPage!.x + 65, leftPage!.y - 45)
  await expect
    .poll(() =>
      page.evaluate(() => document.activeElement?.getAttribute('aria-label')),
    )
    .toBe('信纸内容')
  await page.keyboard.type('desk')
  await page.keyboard.press('Backspace')
  await page.keyboard.press('Backspace')
  await page.keyboard.press('Backspace')
  await page.keyboard.press('Backspace')
  await page.keyboard.insertText('把一个好想法，变成可以运行的作品。')
  expect(
    await page.getByRole('textbox', { name: '信纸内容' }).inputValue(),
  ).toBe('把一个好想法，变成可以运行的作品。')
  await expect.poll(() => scene.getAttribute('data-posture')).toBe('leaning')
  await expect
    .poll(() => scene.getAttribute('data-camera-moving'), { timeout: 6000 })
    .toBe('false')
  expect(await pageSpan()).toBeGreaterThan(seatedSpan * 1.3)
  await page.screenshot({ path: '/tmp/study-leaning-input.png' })
  await page.keyboard.press('Escape')
  await expect.poll(() => scene.getAttribute('data-posture')).toBe('seated')
  await expect
    .poll(() => scene.getAttribute('data-camera-moving'), { timeout: 6000 })
    .toBe('false')
  await page.getByRole('button', { name: '翻开书桌登记簿' }).click()
  await expect
    .poll(() => page.locator('[data-study-scene]').getAttribute('data-mode'))
    .toBe('setup')
  await page.screenshot({ path: '/tmp/study-3d-register.png' })
  await page.getByRole('button', { name: '填写登记簿' }).click()
  await page.getByRole('textbox', { name: 'DeepSeek API Key' }).press('Tab')
  await expect
    .poll(() => page.getByRole('textbox', { name: '工作目录' }).count())
    .toBe(1)
  await page.getByRole('textbox', { name: '工作目录' }).press('Escape')
  await expect
    .poll(() => page.locator('[data-study-scene]').getAttribute('data-mode'))
    .toBe('write')
  expect(
    await page.getByRole('textbox', { name: '信纸内容' }).inputValue(),
  ).toBe('把一个好想法，变成可以运行的作品。')
  await page.getByRole('button', { name: '试写一封欢迎信' }).click()
  await expect
    .poll(() => page.locator('[data-study-scene]').getAttribute('data-writing'))
    .toBe('true')
  await expect
    .poll(
      async () =>
        Number(
          await page
            .locator('[data-study-scene]')
            .getAttribute('data-ink-letters'),
        ),
      { timeout: 20000 },
    )
    .toBeGreaterThan(2)
  await expect.poll(() => scene.getAttribute('data-posture')).toBe('leaning')
  await expect
    .poll(() => scene.getAttribute('data-camera-moving'), { timeout: 6000 })
    .toBe('false')
  await page.screenshot({ path: '/tmp/study-3d-writing.png' })
  await page.keyboard.press('Escape')
  await expect
    .poll(() => scene.getAttribute('data-camera-moving'), { timeout: 6000 })
    .toBe('false')
  await page.getByRole('button', { name: '抽出往来书信' }).click()
  await page.getByRole('button', { name: '后一封书信' }).click()
  await page.screenshot({ path: '/tmp/study-3d-archive.png' })
  await page.getByRole('button', { name: '取出这封书信' }).click()
  await expect
    .poll(() => page.getByRole('article', { name: '手稿全文' }).textContent())
    .toContain(fixture.markers.assistant(1))
  await page.screenshot({ path: '/tmp/study-3d-history.png' })
  await page.setViewportSize({ width: 768, height: 1024 })
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true)
  await page.screenshot({ path: '/tmp/study-3d-portrait.png' })
  expect(logs.pageErrors).toEqual([])
}, 90000)

it('Command Enter 通过真实 Harness 会话流产生回信并清空已送出的草稿', async () => {
  const { mkdtemp, writeFile, rm } = await import('node:fs/promises')
  const { tmpdir } = await import('node:os')
  const path = await import('node:path')
  const join = (...parts: string[]) => path.join(...parts)
  const directory = await mkdtemp(join(tmpdir(), 'study-stream-'))
  onTestFinished(() => rm(directory, { recursive: true, force: true }))
  const text = '灯下读信，见字如面。这是一段经过真实会话流抵达纸面的回复。'
  const override = join(directory, 'replay.override.json')
  await writeFile(
    override,
    JSON.stringify([
      {
        kind: 'chunks',
        chunks: [
          { type: 'block-start', index: 0, blockType: 'text' },
          ...Array.from(text).map(char => ({
            type: 'text-delta',
            index: 0,
            text: char,
          })),
          { type: 'block-end', index: 0, block: { type: 'text', text } },
          { type: 'usage', usage: { inputTokens: 20, outputTokens: 40 } },
          { type: 'finish', reason: { kind: 'stop' } },
        ],
      },
    ]),
  )
  const scaffold = await launchWebScaffold({
    replayFixture: join(directory, 'override-only.jsonl'),
    replayOverride: override,
    paceMs: 50,
  })
  onTestFinished(() => scaffold.close())
  const browser = await chromium.launch({ args: ['--use-angle=metal'] })
  onTestFinished(() => browser.close())
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    locale: 'zh-CN',
  })
  const logs = watchConsole(page)
  await page.goto(scaffold.authenticatedUrl, { waitUntil: 'load' })
  await page
    .getByRole('button', { name: '在左页写下问题' })
    .waitFor({ timeout: 30000 })
  await page.getByRole('button', { name: '调节书写速度' }).click()
  await page.getByRole('button', { name: '在左页写下问题' }).click()
  await page.getByRole('textbox', { name: '信纸内容' }).fill('请写一封短信。')
  await page.keyboard.press('Meta+Enter')
  await expect
    .poll(() => page.getByRole('article', { name: '手稿全文' }).textContent(), {
      timeout: 30000,
    })
    .toContain(text)
  await expect
    .poll(() => page.getByRole('textbox', { name: '信纸内容' }).inputValue())
    .toBe('')
  await expect
    .poll(
      () => page.locator('[data-study-scene]').getAttribute('data-writing'),
      { timeout: 15000 },
    )
    .toBe('true')
  await expect
    .poll(() => page.locator('[data-study-scene]').getAttribute('data-posture'))
    .toBe('leaning')
  await expect
    .poll(
      () =>
        page.locator('[data-study-scene]').getAttribute('data-camera-moving'),
      { timeout: 6000 },
    )
    .toBe('false')
  await page.screenshot({ path: '/tmp/study-3d-real-stream.png' })
  await expect
    .poll(
      () => page.locator('[data-study-scene]').getAttribute('data-writing'),
      { timeout: 45000 },
    )
    .toBe('false')
  expect(
    await page.locator('[data-study-scene]').getAttribute('data-posture'),
  ).toBe('leaning')
  await page.keyboard.press('Escape')
  await expect
    .poll(() => page.locator('[data-study-scene]').getAttribute('data-posture'))
    .toBe('seated')
  expect(logs.pageErrors).toEqual([])
}, 90000)

it('缺少凭据时立即在纸面报告失败，不继续显示等待回信', async () => {
  const scaffold = await launchWebScaffold({ deepSeekMissingCredential: true })
  onTestFinished(() => scaffold.close())
  const browser = await chromium.launch({ args: ['--use-angle=metal'] })
  onTestFinished(() => browser.close())
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    locale: 'zh-CN',
  })
  const logs = watchConsole(page)
  await page.goto(scaffold.authenticatedUrl, { waitUntil: 'load' })
  await page
    .getByRole('button', { name: '在左页写下问题' })
    .waitFor({ timeout: 30000 })
  await page.getByRole('button', { name: '在左页写下问题' }).click()
  await page
    .getByRole('textbox', { name: '信纸内容' })
    .fill('测试缺少凭据时的交稿反馈。')
  await page.keyboard.press('Meta+Enter')
  await expect
    .poll(() => page.getByRole('status').textContent(), { timeout: 20000 })
    .toContain('当前模型没有可用的 API Key')
  expect(await page.getByRole('status').textContent()).not.toContain('等待回信')
  expect(
    await page.getByRole('article', { name: '手稿全文' }).textContent(),
  ).toContain('测试缺少凭据时的交稿反馈。')
  await expect
    .poll(() => page.locator('[data-study-scene]').getAttribute('data-writing'))
    .toBe('false')
  await expect
    .poll(
      () =>
        page.locator('[data-study-scene]').getAttribute('data-camera-moving'),
      { timeout: 6000 },
    )
    .toBe('false')
  await page.screenshot({ path: '/tmp/study-missing-credential.png' })
  expect(logs.pageErrors).toEqual([])
}, 60000)

it('书桌向 DeepSeek 发送信纸内容，省略额外的会话日志', async (test) => {
  const reply = '来信收悉。'
  const letter = '请回信确认。'
  const server = await startMockLlmServer({ sequence: ['success'], repeatLast: true, successText: reply })
  test.onTestFinished(() => server.close())
  await withDefaultWeb(test, async ({ url, request }) => {
    const browser = await chromium.launch({ args: ['--use-angle=metal'] })
    test.onTestFinished(() => browser.close())
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
      locale: 'zh-CN',
    })
    await page.goto(url, { waitUntil: 'load' })
    await page.getByRole('button', { name: '在左页写下问题' }).click({ timeout: 30000 })
    await page.getByRole('textbox', { name: '信纸内容' }).fill(letter)
    await page.keyboard.press('Meta+Enter')
    await expect.poll(() => page.getByRole('article', { name: '手稿全文' }).textContent(), {
      timeout: 30000,
    }).toContain(reply)

    expect(server.requests.map(({ body }) => JSON.stringify(body)).join('\n')).toContain(letter)
    for (const { body } of server.requests) {
      expect(body).toHaveProperty('messages')
      expect(body).not.toHaveProperty('dsh_session_log')
    }
    const { client } = await request('roster')
    expect(client.entries.some(entry => entry.id === '@deepseek-ai/dsh-client-ui-settings-session-log')).toBe(false)
  }, {
    prepare: async (root) => {
      const home = join(root, 'home')
      await mkdir(home, { recursive: true })
      await writeFile(join(home, 'cordis.patch.yml'), JSON.stringify([
        { id: 'llm-deepseek', config: { baseURL: server.baseURL } },
        { id: 'session-log-deepseek', config: { enabled: true } },
      ]))
    },
  })
}, 90000)
