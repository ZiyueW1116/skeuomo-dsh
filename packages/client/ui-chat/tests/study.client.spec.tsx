// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { Study } from '../src/client/study/Study.tsx'
import { zh } from '../src/client/study/locales.ts'
import type { StudyAction, StudyProps } from '../src/client/study/types.ts'

const scene = vi.hoisted(() => ({
  action: undefined as ((action: StudyAction) => void) | undefined,
  dispose: vi.fn(),
}))
vi.mock('../src/client/study/scene.ts', () => ({
  StudyScene: class {
    constructor(_host: HTMLElement, action: (action: StudyAction) => void) {
      scene.action = action
    }
    onProjectedPoints() {}
    update() {}
    focus() {}
    activate(action: StudyAction) {
      scene.action?.(action)
    }
    dispose() {
      scene.dispose()
    }
  },
}))
vi.mock('../src/client/study/surfaces.ts', () => ({
  loadStudySurfaces: async () => ({}),
  disposeStudySurfaces: vi.fn(),
}))

beforeEach(() => {
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: { load: async () => [] },
  })
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

async function mount(send = vi.fn(async () => {}), pending?: object) {
  const props = {
    t: (key: keyof typeof zh) => zh[key],
    sessionId: undefined,
    useSession: () => undefined,
    useConversation: () => undefined,
    useSessions: () => ({}),
    useSessionStatus: (select: (map: Map<string, object>) => unknown) =>
      select(new Map([['test', { pendingInteraction: pending }]])),
    useInput: () => undefined,
    send,
  }
  if (pending) Object.assign(props, { sessionId: 'test' })
  const typed: StudyProps = props as never
  const view = render(<Study {...typed} />)
  await screen.findByRole('textbox', { name: '信纸内容' })
  return view
}

it('等待交稿期间输入的新草稿在交稿成功后保留', async () => {
  let complete!: () => void
  const send = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        complete = resolve
      }),
  )
  await mount(send)
  const input = screen.getByRole('textbox', { name: '信纸内容' })
  fireEvent.change(input, { target: { value: '第一封信' } })
  fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true })
  expect(send).toHaveBeenCalledWith(undefined, '第一封信', '')
  fireEvent.change(input, { target: { value: '下一封信' } })
  await act(async () => {
    complete()
  })
  expect((input as HTMLTextAreaElement).value).toBe('下一封信')
})

it('交稿失败保留原稿并报告原因', async () => {
  await mount(
    vi.fn(async () => {
      throw new Error('连接暂不可用')
    }),
  )
  const input = screen.getByRole('textbox', { name: '信纸内容' })
  fireEvent.change(input, { target: { value: '请保留这封信' } })
  fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true })
  await waitFor(() => {
    expect(screen.getByRole('status').textContent).toContain('连接暂不可用')
  })
  expect((input as HTMLTextAreaElement).value).toBe('请保留这封信')
})

it('选择问笺选项时只提交选择，不同时提交自定义答案', async () => {
  const answer = vi.fn(async () => {})
  await mount(undefined, {
    kind: 'question',
    questions: [
      { id: 'choice', question: '请选择', options: [{ label: '继续' }] },
    ],
    answer,
  })
  act(() => {
    scene.action?.('input')
  })
  const input = screen.getByRole('textbox', { name: '问笺答复' })
  fireEvent.change(input, { target: { value: '继续' } })
  fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true })
  await waitFor(() => {
    expect(answer).toHaveBeenCalledWith({
      answers: [{ id: 'choice', selected: ['继续'], custom: '' }],
    })
  })
})

it('关闭书桌释放其场景', async () => {
  const view = await mount()
  view.unmount()
  expect(scene.dispose).toHaveBeenCalledOnce()
})
