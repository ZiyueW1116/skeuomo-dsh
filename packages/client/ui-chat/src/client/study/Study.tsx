import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  StudyAction,
  StudyDocument,
  StudyPanelProps,
  StudyProps,
  StudyModel,
} from './types.ts'
import { loadStudySurfaces, disposeStudySurfaces } from './surfaces.ts'
import { StudyScene } from './scene.ts'
import css from './Study.module.css'
export function StudyPanel({ renderSlot }: StudyPanelProps) {
  return renderSlot('main.study', {})
}
/** 数据来自现有会话投影；可见内容全部绘入三维纸面。 */
export function Study(props: StudyProps) {
  const { t } = props
  const session = props.useSession(s => s)
  const chat = props.useConversation(s => s.views.get('chat'))
  const summaries = props.useSessions(s => s.byId)
  const pending = props.useSessionStatus(s =>
    props.sessionId ? s.get(props.sessionId)?.pendingInteraction : undefined,
  )
  const draft = props.useInput(s => s.draft) ?? ''
  const [answer, setAnswer] = useState('')
  const question = questionOf(pending)
  const [blankDraft, setBlankDraft] = useState('')
  const [status, setStatus] = useState('')
  const [cwd, setCwd] = useState('')
  const [credential, setCredential] = useState('')
  const [field, setField] = useState<
    'draft' | 'credential' | 'workspace' | 'answer'
  >('draft')
  const [models, setModels] = useState<StudyModel[]>([])
  const [modelIndex, setModelIndex] = useState(0)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [points, setPoints] = useState<
    {
      label: string
      action: StudyAction
      x: number
      y: number
    }[]
  >([])
  const host = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)
  const scene = useRef<StudyScene>()
  const sending = useRef(false)
  const actualDraft = props.sessionId ? draft : blankDraft
  const documents = useMemo(() => {
    const result: StudyDocument[] = []
    for (const node of chat?.legacy.nodes ?? []) {
      if (node.kind === 'user' || node.kind === 'steering')
        result.push({
          id: `user:${node.seq}`,
          title: t('letter.user'),
          text: node.content
            .filter(c => c.type === 'text')
            .map(c => c.text)
            .join('\n'),
          live: false,
        })
      if (node.kind === 'assistant') {
        const text = node.blocks
          .filter(block => block.kind === 'text')
          .map(block => block.text)
          .join('\n')
        if (text)
          result.push({
            id: `assistant:${node.seq}`,
            title: t('letter.assistant'),
            text,
            live: false,
          })
      }
      if (node.kind === 'turn-error')
        result.push({
          id: `error:${node.seq}`,
          title: t('letter.failed'),
          text: node.message || node.code || t('failure.incomplete'),
          live: false,
        })
    }
    const partial = chat?.legacy.partial
    if (partial) {
      const text = partial.blocks
        .filter(block => block.kind === 'text')
        .map(block => block.text)
        .join('\n')
      if (text)
        result.push({
          id: `partial:${partial.turn}:${partial.step}`,
          title: t('letter.assistant'),
          text,
          live: true,
        })
    }
    return result
  }, [chat])
  const archive = useMemo(
    () =>
      Object.values(summaries).map(s => ({
        id: s.id,
        title: s.title || t('archive.untitled'),
      })),
    [summaries],
  )
  const approval =
    pending?.kind === 'approval'
      ? {
        title: pending.toolName,
        reason:
            pending.displayReason?.['zh'] ??
            pending.reason ??
            t('approval.prompt'),
      }
      : question
        ? {
          title: t('question.title'),
          reason:
              question.questions
                .map(
                  (q, i) =>
                    `${i + 1}. ${q.question}\n${q.detail ?? ''}\n${q.options?.map(o => o.label).join(' / ') ?? ''}`,
                )
                .join('\n\n') + t('question.instructions'),
        }
        : undefined
  const lastDocument = documents.at(-1)
  const failure =
    session?.promptError?.error.message ??
    (!session?.running && lastDocument?.id.startsWith('error:')
      ? lastDocument.text
      : '')
  const failureMessage = failure.includes('no API key')
    ? t('failure.missingCredential')
    : failure
  const feedback =
    failureMessage ||
    (session?.running
      ? t('status.thinking')
      : lastDocument?.id.startsWith('assistant:') && status === t('status.sent')
        ? t('status.received')
        : status)
  const state = {
    failure: failureMessage,
    draft: question ? answer : actualDraft,
    documents,
    running: session?.running ?? false,
    status: feedback,
    session: props.sessionId ?? '',
    archive,
    cwd,
    models,
    modelIndex,
    approval,
    credential: credential ? '•'.repeat(Math.min(32, credential.length)) : '',
    field,
  }
  const current = useRef(state)
  current.current = state
  const actionRef = useRef<(action: StudyAction, value?: string) => void>(
    () => {},
  )
  const perform = async (work: () => Promise<void>, success: string) => {
    try {
      await work()
      setStatus(success)
      return true
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err))
      return false
    }
  }
  const edit = (value: string) => {
    if (props.sessionId) props.inputActions?.setDraft(value)
    else setBlankDraft(value)
  }
  actionRef.current = (action, value) => {
    if (action === 'close') {
      setField('draft')
      input.current?.blur()
      setStatus('')
      return
    }
    if (action === 'input') {
      setField(question ? 'answer' : 'draft')
      input.current?.focus({ preventScroll: true })
      return
    }
    if (action === 'credential') {
      setField('credential')
      input.current?.focus({ preventScroll: true })
      setStatus(t('status.enterCredential'))
      return
    }
    if (action === 'workspace') {
      setField('workspace')
      input.current?.focus({ preventScroll: true })
      return
    }
    if (action === 'send' && question) {
      const lines = answer.trim().split('\n').filter(Boolean)
      if (lines.length < question.questions.length) {
        setStatus(t('question.incomplete'))
        return
      }
      void perform(
        () =>
          question.answer({
            answers: question.questions.map((q, i) => {
              const text = lines[i] as string
              return q.options?.some(o => o.label === text)
                ? { id: q.id, selected: [text], custom: '' }
                : { id: q.id, selected: [], custom: text }
            }),
          }),
        t('status.answered'),
      ).then((ok) => {
        if (ok) setAnswer('')
      })
      return
    }
    if (action === 'send') {
      if (sending.current || !actualDraft.trim()) return
      sending.current = true
      setStatus(t('status.sending'))
      void perform(async () => {
        await props.send(props.sessionId, actualDraft, cwd)
        if (
          current.current.session === (props.sessionId ?? '') &&
          current.current.draft === actualDraft
        )
          edit('')
        setBlankDraft(value => (value === actualDraft ? '' : value))
      }, t('status.sent')).finally(() => {
        sending.current = false
      })
    }
    if (action === 'stop' && props.sessionId)
      void perform(
        () =>
          props.stop(
            props.sessionId as import('@deepseek-ai/dsh-session/types').SessionId,
          ),
        t('status.stopped'),
      )
    if (action === 'new')
      void perform(async () => {
        await props.create(cwd)
      }, t('status.created'))
    if (action === 'archive' && value) {
      const id = Object.keys(summaries).find(id => id === value)
      if (id)
        props.open(
          (
            summaries[
              id as keyof typeof summaries
            ] as import('@deepseek-ai/dsh-api-session-controller/client').SessionSummary
          ).id,
        )
    }
    if (action === 'setup')
      void perform(async () => {
        const list = await props.catalog()
        setModels(list)
        setModelIndex(0)
      }, t('status.registerOpened'))
    if (action === 'model' && models.length)
      setModelIndex(
        index => (index + Number(value) + models.length) % models.length,
      )
    if (action === 'previous' && props.sessionId)
      void perform(
        () =>
          props.older(
            props.sessionId as import('@deepseek-ai/dsh-session/types').SessionId,
          ),
        t('status.older'),
      )
    if (action === 'save')
      void perform(async () => {
        if (credential.trim()) {
          await props.credential(credential)
          setCredential('')
        }
        const model = models[modelIndex]
        let id = props.sessionId
        if (!id || (cwd.trim() && cwd !== summaries[id]?.cwd))
          id = await props.create(cwd)
        if (model) await props.model(id, model.provider, model.model)
        setField('draft')
        scene.current?.activate('close')
      }, t('status.saved'))
    if ((action === 'approve' || action === 'reject') && !pending)
      setStatus(t('approval.none'))
    if (
      (action === 'approve' || action === 'reject') &&
      pending?.kind === 'approval'
    )
      void perform(
        () =>
          pending.answer(action === 'approve' ? 'allowed-once' : 'rejected'),
        action === 'approve' ? t('approval.allowed') : t('approval.rejected'),
      )
    if (action === 'export') {
      const blob = new Blob(
          [documents.map(d => `${d.title}\n\n${d.text}`).join('\n\n')],
          { type: 'text/plain;charset=utf-8' },
        ),
        url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = t('export.filename')
      link.click()
      setTimeout(() => {
        URL.revokeObjectURL(url)
      }, 1000)
    }
  }
  useEffect(() => {
    const target = host.current
    if (target === null) return
    const lifetime = { disposed: false }
    document.title = t('title')
    void (async () => {
      await document.fonts.load('44px StudyHand')
      const surfaces = await loadStudySurfaces(t)
      if (lifetime.disposed) {
        disposeStudySurfaces(surfaces)
        return
      }
      try {
        const desk = new StudyScene(
          target,
          (a, v) => {
            actionRef.current(a, v)
          },
          surfaces,
          t,
        )
        scene.current = desk
        desk.onProjectedPoints(setPoints)
        desk.update(current.current)
        setReady(true)
      } catch (err) {
        disposeStudySurfaces(surfaces)
        throw err
      }
    })().catch((err: unknown) => {
      if (!lifetime.disposed)
        setError(err instanceof Error ? err.message : String(err))
    })
    return () => {
      lifetime.disposed = true
      scene.current?.dispose()
      scene.current = undefined
    }
  }, [])
  useEffect(() => {
    scene.current?.update(state)
  }, [
    actualDraft,
    documents,
    session?.running,
    status,
    props.sessionId,
    archive,
    cwd,
    models,
    modelIndex,
    credential,
    field,
    answer,
    pending,
    session?.promptError,
  ])
  useEffect(() => {
    if (props.sessionId && summaries[props.sessionId]?.cwd)
      setCwd(
        (
          summaries[
            props.sessionId
          ] as import('@deepseek-ai/dsh-api-session-controller/client').SessionSummary
        ).cwd as string,
      )
  }, [props.sessionId])
  const inputValue =
    field === 'answer'
      ? answer
      : field === 'credential'
        ? credential
        : field === 'workspace'
          ? cwd
          : actualDraft
  const center = points.find(
    p =>
      p.action ===
      (field === 'credential' || field === 'workspace'
        ? 'credential'
        : 'input'),
  )
  return (
    <div className={css.study}>
      <div ref={host} className={css.scene} data-study-scene />
      {!ready && <div className={css.loading}>{error || t('loading')}</div>}
      {ready && (
        <>
          {points.map((p, i) => (
            <button
              key={`${p.action}:${i}`}
              className={css.access}
              style={{ left: p.x, top: p.y }}
              aria-label={p.label}
              onClick={() => scene.current?.activate(p.action)}
            />
          ))}
          <textarea
            ref={input}
            className={css.keyboard}
            style={{ left: center?.x ?? 0, top: center?.y ?? 0 }}
            aria-label={
              field === 'answer'
                ? t('input.answer')
                : field === 'draft'
                  ? t('input.draft')
                  : field === 'credential'
                    ? t('input.credential')
                    : t('input.cwd')
            }
            autoComplete="off"
            spellCheck={false}
            value={inputValue}
            onChange={(e) => {
              if (field === 'answer') setAnswer(e.target.value)
              else if (field === 'credential') setCredential(e.target.value)
              else if (field === 'workspace') setCwd(e.target.value)
              else edit(e.target.value)
            }}
            onFocus={() => scene.current?.focus(true)}
            onBlur={() => {
              scene.current?.focus(false)
              props.inputActions?.persistDraft()
            }}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing) return
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                scene.current?.activate('send')
              }
              if (
                e.key === 'Tab' &&
                (field === 'credential' || field === 'workspace')
              ) {
                e.preventDefault()
                setField(field === 'credential' ? 'workspace' : 'credential')
              }
            }}
          />
          <div className={css.screenReader} role="status" aria-live="polite">
            {feedback}
          </div>
          <article className={css.screenReader} aria-label={t('transcript')}>
            {documents.map(doc => (
              <section key={doc.id}>
                <h2>{doc.title}</h2>
                <p>{doc.text}</p>
              </section>
            ))}
          </article>
        </>
      )}
    </div>
  )
}
interface QuestionCarrier {
  kind: 'question' | 'plan-review'
  questions: readonly {
    id: string
    question: string
    detail?: string
    options?: readonly {
      label: string
    }[]
  }[]
  answer(value: {
    answers: {
      id: string
      selected: string[]
      custom: string
    }[]
  }): Promise<void>
}
/** 跨插件的待答对象以公开的问题、回答方法识别，避免倒置插件依赖。 */
function questionOf(value: unknown): QuestionCarrier | undefined {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('kind' in value) ||
    (value.kind !== 'question' && value.kind !== 'plan-review')
  )
    return undefined
  if (
    !('questions' in value) ||
    !Array.isArray(value.questions) ||
    !('answer' in value) ||
    typeof value.answer !== 'function'
  )
    return undefined
  return value as QuestionCarrier
}
