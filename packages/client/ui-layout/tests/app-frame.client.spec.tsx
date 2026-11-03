// @vitest-environment jsdom
import { cleanup,render } from '@testing-library/react'
import { afterEach,expect,it } from 'vitest'
import { AppFrame,type AppFrameProps } from '../src/client/AppFrame.tsx'
afterEach(cleanup)
it('客户区只挂载三维书桌，不再请求侧栏或悬浮窗口',()=>{
  const calls:{ name:string;entry:string|undefined }[]=[]
  const renderSlot:AppFrameProps['renderSlot']=(name,_owner,options)=>{
    calls.push({ name,entry:options?.entryKey })
    return <div data-testid="physical-study" />
  }
  const view=render(<AppFrame renderSlot={renderSlot} />)
  expect(view.getByTestId('physical-study')).toBeTruthy()
  expect(calls).toEqual([{ name:'main',entry:'study' }])
  expect(view.queryByRole('dialog')).toBeNull()
  expect(view.queryByRole('navigation')).toBeNull()
})
