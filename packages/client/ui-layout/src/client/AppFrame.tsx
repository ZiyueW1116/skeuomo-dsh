import type { InjectFace, PropsLocale, PropsRenderSlots, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type { MainPanelId } from './service.ts'
import type { createLayoutStore } from './stores.ts'
export interface AppFrameInjected { navigate: (id: MainPanelId | null) => void }
/** Full composed props: runtime share + child-slot render share + store share. */
export type AppFrameProps =
  & PropsRuntime<'root'>
  & PropsRenderSlots<'sidebar' | 'main' | 'rightbar' | 'shell.bottom' | 'shell.overlay' | 'shell.leading'>
  & PropsStore<ReturnType<typeof createLayoutStore>>
  & PropsLocale<'desk'>
  & InjectFace<AppFrameInjected>


/** 将整个客户区交给书桌入口。 */
export function AppFrame({ renderSlot }:Pick<AppFrameProps,'renderSlot'>) {
  return <main style={{ position:'fixed',inset:0,overflow:'hidden',background:'#221b15' }}>{renderSlot('main', {}, { entryKey:'study' })}</main>
}
