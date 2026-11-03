import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type {
  InjectFace,
  PropsRuntime,
  PropsRenderSlots,
  PropsLocale,
} from '@deepseek-ai/dsh-client-ui-slots'
/**
 * 登记簿中可选的模型标识和显示名称。
 */
export interface StudyModel {
  provider: string
  model: string
  name: string
  available: boolean
}
/**
 * 由插件作用域注入的真实 Harness 会话与凭据操作。
 */
export interface StudyActions {
  send(
    sessionId: SessionId | undefined,
    text: string,
    cwd: string,
  ): Promise<void>
  stop(sessionId: SessionId): Promise<void>
  create(cwd: string): Promise<SessionId>
  open(sessionId: SessionId): void
  older(sessionId: SessionId): Promise<void>
  catalog(): Promise<StudyModel[]>
  model(sessionId: SessionId, provider: string, model: string): Promise<void>
  credential(key: string): Promise<void>
}
/**
 * 书桌接收的会话运行时与注入业务操作。
 */
export type StudyProps = PropsRuntime<'main.study'> &
  InjectFace<StudyActions> &
  PropsLocale<'study'>
/**
 * 书桌入口接收的主区域运行时与子插槽渲染器。
 */
export type StudyPanelProps = PropsRuntime<'main'> &
  PropsRenderSlots<'main.study'>
declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    /**
     * 注册书桌主界面，无需传入 owner props。组件接收可为空的会话运行时，
     * 业务操作由注册者通过 inject 提供；单项注册占据整个书桌区域。
     * 未注册时主区域为空，替换该项即替换完整书桌呈现。
     */
    'main.study': {
      kind: 'single'
      scope: 'session-maybe'
    }
  }
}
/**
 * 从会话投影读取的一段手稿及其流式状态。
 */
export interface StudyDocument {
  id: string
  title: string
  text: string
  live: boolean
}
/**
 * 三维物件显示所需的数据快照，不持有运行时服务。
 */
export interface StudyState {
  draft: string
  documents: StudyDocument[]
  running: boolean
  status: string
  session: string
  archive: {
    id: string
    title: string
  }[]
  cwd: string
  models: StudyModel[]
  modelIndex: number
  /** 当前请求的失败原因，立即显示，不经过笔顺动画。 */
  failure?: string
  credential?: string
  field?: string
  approval?:
    | {
      title: string
      reason: string
    }
    | undefined
}
/**
 * 实体物件和键盘可触发的书桌操作。
 */
export type StudyAction =
  | 'open-letter'
  | 'read'
  | 'input'
  | 'send'
  | 'stop'
  | 'new'
  | 'archive'
  | 'previous'
  | 'next'
  | 'setup'
  | 'lamp'
  | 'demo'
  | 'speed'
  | 'close'
  | 'credential'
  | 'workspace'
  | 'model'
  | 'save'
  | 'approve'
  | 'reject'
  | 'export'
