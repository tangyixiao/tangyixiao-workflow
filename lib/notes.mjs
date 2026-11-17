// These checks catch specific public/private boundary failures. They do not
// establish editorial quality or replace review of the actual product changes.
export function reviewReleaseNotes({ notes, title }) {
  if (typeof notes !== 'string' || !notes.trim()) throw new Error('Release notes must be nonempty text')
  if (typeof title !== 'string' || !title.trim()) throw new Error('Provide the public release title')
  const text = notes.replace(/\r\n/g, '\n')
  const prose = text.replace(/```[^\n]*\n[\s\S]*?```/g, '')
  const lead = prose.split('\n').find(line => line.trim())?.trim() ?? ''
  const heading = lead.replace(/^#{1,6}\s+/, '').replace(/[*_`]/g, '').trim()
  const checks = [
    { id:'notes-no-duplicate-title', ok:!/^#{1,6}\s+/.test(lead) || heading !== title.trim(), message:'The Release page already shows its title; start the body with useful changes.' },
    { id:'notes-no-private-instructions', ok:!/(?:按(?:照)?用户(?:要求|指示)|根据用户(?:要求|指示)|用户要求我们|经用户授权.{0,12}(?:发布|合并|执行)|published[^\n]{0,100}with user authorization|as (?:requested|instructed) by (?:the )?user|approved (?:design )?(?:option|concept) [a-z][0-9]?)/i.test(prose), message:'Describe project behavior instead of private instructions or approval history.' },
    { id:'notes-no-private-machine-state', ok:!/(?:this release does not downgrade (?:the )?(?:local|existing local) preview|未(?:替换|降级)(?:你|用户)(?:的)?(?:本机|本地)预览|本机预览(?:保持|未被替换))/i.test(prose), message:'Private machine state belongs in the task record, not the public release.' }
  ]
  const main = prose.replace(/<details\b[^>]*>[\s\S]*?<\/details>/gi, '')
  const advisories = []
  if (/(?:端口冲突|port conflict|(?:本机|本地)[^\n]{0,40}(?:重跑|重试)|reran[^\n]{0,40}(?:local|port))/i.test(main)) advisories.push({ id:'local-debug-history', message:'Move local debugging history to a linked development record unless it explains a user-facing known issue.' })
  if (/(?:\b\d+ (?:local |offline |serial )*(?:tests|checks)|\d+\s*(?:项|个)(?:自动)?测试|合并后.{0,24}测试)/i.test(main)) advisories.push({ id:'validation-in-main-copy', message:'Keep test evidence concise and linked or folded; lead with changes and installation impact.' })
  if (/(?:source, installation, host loading|源码、(?:本地)?检查、CI|source and (?:local )?validation are separate)/i.test(main)) advisories.push({ id:'delivery-report-in-main-copy', message:'Keep evidence boundaries in verification records. Retain concrete user-facing limitations in the release.' })
  return { ok:checks.every(check => check.ok), checks, advisories, editorialReview:'required', scope:'specific-publishing-hygiene-checks' }
}
