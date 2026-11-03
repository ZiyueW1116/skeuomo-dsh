/** 桌面物件及其操作的本地化文案。 */
export const zh = {
  title: '深潜书桌', edition: 'DEEPSEEK HARNESS · PRIVATE STUDY',
  archives: '会话档案', tools: '工具与插件', schedules: '日程计划',
  desk: '回到书桌', paper: '研究手稿', fold: '折起手稿', unfold: '展开手稿',
  focus: '专注阅读', unfocus: '返回桌面', drawer: '打开工具抽屉', closeDrawer: '收好抽屉',
  lamp: '台灯', light: '调节灯光', memo: '临时便笺', memoHint: '把稍纵即逝的想法…\n留在这里。',
  memoFoot: '本次打开期间保留', date: '今日', clock: '本地时间',
  welcome: '慢下来，想深一点。', archiveHint: '你的项目、会话与设置',
  folio: '工作手稿 / 01', restore: '手稿已折好，点击继续工作',
  inscription: '给思考，留一张书桌。', navigation: '书桌导航',
} satisfies Record<string, string>
/** 书桌装饰的英语文案。 */
export const en: Record<keyof typeof zh, string> = {
  title: 'DeepSeek Study', edition: 'DEEPSEEK HARNESS · PRIVATE STUDY',
  archives: 'Session archive', tools: 'Tools & plugins', schedules: 'Schedules',
  desk: 'Back to desk', paper: 'Research notes', fold: 'Fold paper', unfold: 'Unfold paper',
  focus: 'Focus on paper', unfocus: 'Return to desk', drawer: 'Open tool drawer', closeDrawer: 'Close drawer',
  lamp: 'Desk lamp', light: 'Adjust lamplight', memo: 'Scratchpad', memoHint: 'Leave a passing thought…\nright here.',
  memoFoot: 'Kept while this desk is open', date: 'Today', clock: 'Local time',
  welcome: 'Slow down. Think deeper.', archiveHint: 'Your projects, sessions & settings',
  folio: 'WORKING PAPER / 01', restore: 'Your paper is folded. Click to continue.',
  inscription: 'A little room for deep thinking.', navigation: 'Desk navigation',
}
