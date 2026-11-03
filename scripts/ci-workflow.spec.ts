/** 验证 macOS 检查能在无凭据环境运行，并按构建依赖排序。 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import { load } from 'js-yaml'
import { describe, expect, it } from 'vitest'

interface Workflow {
  on: Record<string, unknown>
  permissions: Record<string, string>
  concurrency: { 'cancel-in-progress': boolean }
  jobs: Record<string, {
    'runs-on': string
    strategy?: unknown
    permissions?: Record<string, string>
    steps: Array<{ uses?: string; run?: string; with?: Record<string, unknown>; env?: Record<string, string> }>
  }>
}

const root = resolve(import.meta.dirname, '..')
const source = readFileSync(resolve(root, '.github/workflows/ci.yml'), 'utf8')
const workflow = load(source) as Workflow
const job = workflow.jobs.macos!
const commands = job.steps.flatMap(step => step.run ? [step.run] : [])

describe('macOS CI', () => {
  it('使用受信任的改动前版本检查归档，防止重新封存被改写的历史', () => {
    const expression = job.steps.find(step => step.run === 'pnpm run doc-sync')?.env?.DSH_ARCHIVE_BASE_REF
    expect(expression).toBeTypeOf('string')
    for (const [event, expected] of [
      [{ pull_request: { base: { sha: 'pull-base' } } }, 'pull-base'],
      [{ before: 'push-before' }, 'push-before'],
      [{ before: '0000000000000000000000000000000000000000' }, 'current-head'],
      [{}, 'current-head'],
    ] as const) {
      const baseline: unknown = runInNewContext(expression!.slice(3, -2), {
        github: { sha: 'current-head', event: { pull_request: { base: { sha: '' } }, before: '', ...event } },
      }, { timeout: 1000 })
      expect(baseline).toBe(expected)
    }
  })

  it('校验 main 推送和外部拉取请求，并取消过期运行', () => {
    expect(workflow.on).toEqual({ push: { branches: ['main'] }, pull_request: null, workflow_dispatch: null })
    expect(workflow.concurrency['cancel-in-progress']).toBe(true)
    expect(workflow.permissions).toEqual({ contents: 'read' })
    expect(job.permissions).toBeUndefined()
    expect(source).not.toMatch(/secrets\.|pull_request_target|self-hosted|blacksmith/)
    expect(job.steps[0]).toMatchObject({ with: { 'fetch-depth': 0, 'persist-credentials': false } })
  })

  it('只调度 macOS，不调度兼容性矩阵或发布流程', () => {
    expect(readdirSync(resolve(root, '.github/workflows'))).toEqual(['ci.yml'])
    expect(Object.keys(workflow.jobs)).toEqual(['macos'])
    expect(job['runs-on']).toMatch(/^macos-/)
    expect(job.strategy).toBeUndefined()
    expect(existsSync(resolve(root, '.github/dependabot.yml'))).toBe(false)
    expect(existsSync(resolve(root, '.gitlab-ci.yml'))).toBe(false)
    expect(source).not.toMatch(/npm publish|twine upload|wrangler|deploy-pages|release:publish/)
  })

  it('使用锁文件，且在回放和窗口构建前完成产物构建', () => {
    const install = commands.indexOf('pnpm install --frozen-lockfile')
    const build = commands.indexOf('pnpm run build')
    const browser = commands.indexOf('pnpm --dir apps/web exec playwright install chromium')
    const replay = commands.indexOf('pnpm exec vitest run --config vitest.web.config.ts apps/web/tests/study-desk.e2e.ts')
    const window = commands.indexOf('python3 scripts/study-macos/build.py')
    expect(install).toBeGreaterThanOrEqual(0)
    expect(build).toBeGreaterThan(install)
    expect(browser).toBeGreaterThan(build)
    expect(replay).toBeGreaterThan(browser)
    expect(window).toBeGreaterThan(replay)
    const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as { scripts: Record<string, string> }
    for (const command of commands) {
      const script = /^pnpm run (\S+)$/.exec(command)?.[1]
      if (script) expect(manifest.scripts[script], command).toBeTypeOf('string')
    }
    expect(commands).toContain('pnpm run lint')
    expect(commands).toContain('pnpm run doc-sync')
    expect(commands).toContain('pnpm run test:gui')
  })
})
