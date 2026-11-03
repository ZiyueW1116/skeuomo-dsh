import { expect, it } from 'vitest'
import { InkWriter, paginate } from '../src/client/study/handwriting.ts'

it('非整数帧预算下每帧有限推进，最终完成全部笔画', () => {
  let segments = 0
  const context: Partial<CanvasRenderingContext2D> = {
    save() {}, restore() {}, beginPath() {}, moveTo() {}, lineTo() {},
    stroke() {
      // 将无法推进的同步循环转成确定的失败，避免挂住测试进程。
      if (++segments > 1000) throw new Error('单帧笔触没有消耗剩余预算')
    },
  }
  const writer = new InkWriter(context as CanvasRenderingContext2D)
  const [letters] = paginate('AaBbCc0123')
  expect(letters).toBeDefined()
  writer.reset(letters!)
  for (let frame = 0; frame < 2000 && !writer.completed; frame++) {
    segments = 0
    writer.tick(1 / 60, 1000)
  }
  expect(writer.completed).toBe(true)
  expect(writer.written).toBe(10)
})
