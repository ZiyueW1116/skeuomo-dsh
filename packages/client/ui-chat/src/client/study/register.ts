import { zh } from './locales.ts'
import type { Context } from '@deepseek-ai/cordis'
import type { IConversation } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { Study, StudyPanel } from './Study.tsx'
import type { StudyActions } from './types.ts'
/**
 * 使用 Harness 的会话、消息、凭据协议注册书桌及其业务操作。
 * @param ctx - 当前插件作用域。
 */
export function registerStudy(ctx: Context): void {
  ctx.effect(
    () => ctx.locale.register('study', { zh, en: zh }),
    'study: dictionaries',
  )
  const t = ctx.locale.bind('study')
  ctx.inject(['remote.credentials'], (ctx) => {
    const conversation = (id: SessionId): IConversation => {
      const face = ctx.sessions.scope(id)?.get('conversation')
      if (!face) throw new Error(t('session.notReady'))
      return face
    }
    const create = async (cwd: string) => {
      const id = await ctx.sessions.create(
        cwd.trim() ? { cwd: cwd.trim() } : {},
      )
      ctx.uiWorkspace.openSession(id)
      return id
    }
    const actions: StudyActions = {
      async send(id, text, cwd) {
        const target = id ?? (await create(cwd))
        await ctx.sessions.using(
          target,
          { source: 'controllerOperation' },
          async () => {
            await conversation(target).send(text)
          },
        )
      },
      stop: async (id) => {
        await conversation(id).cancel()
      },
      create,
      open: (id) => {
        ctx.uiWorkspace.openSession(id)
      },
      older: async (id) => {
        await conversation(id).loadOlder()
      },
      catalog: async () => {
        const result = await ctx.remote.session.modelCatalog()
        if (!result.ok) throw new Error(result.error.message)
        return result.value.groups.flatMap(group =>
          group.models.map(model => ({
            provider: group.id,
            model: model.id,
            name: model.name,
            available: true,
          })),
        )
      },
      model: async (id, provider, model) => {
        const result = await ctx.remote.session.selectModel({
          sessionId: id,
          provider,
          model,
        })
        if (!result.ok) throw new Error(result.error.message)
      },
      credential: async (key) => {
        const result = await ctx.remote.credentials.set(
          'DEEPSEEK_API_KEY',
          key.trim(),
        )
        if (!result.ok) throw new Error(result.error.message)
      },
    }
    ctx.slots.inject('main', function* () {
      yield ctx.slots.register(
        {
          name: 'main',
          key: 'study',
          children: {
            'main.study': { kind: 'single', scope: 'session-maybe' },
          },
        },
        StudyPanel,
      )
      yield ctx.slots.register(
        { name: 'main.study', locale: 'study', inject: () => actions },
        Study,
      )
    })
  })
}
