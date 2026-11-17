// These checks catch specific public/private boundary failures. They do not
// establish editorial quality or replace review of the actual product changes.
const FORMATS = {
  'tangyixiao-zh-v1': {
    sections: ['更新内容', '安装与升级', '兼容性与已知限制'],
    installation: ['运行要求', '安装方式'],
    evidence: '校验与验证记录', labels: ['校验信息', '验证范围', '源码']
  },
  'tangyixiao-en-v1': {
    sections: ['Changes', 'Installation and upgrade', 'Compatibility and known limitations'],
    installation: ['Requirements', 'Installation'],
    evidence: 'Checksums and validation', labels: ['Checksum', 'Validation', 'Source']
  }
}

function formatChecks(prose, format) {
  const style = Object.hasOwn(FORMATS, format) ? FORMATS[format] : undefined
  if (!style) throw new Error(`Unknown release-note format: ${format}`)
  const blocks = [...prose.matchAll(/<details\b[^>]*>([\s\S]*?)<\/details>/gi)]
  const main = prose.replace(/<details\b[^>]*>[\s\S]*?<\/details>/gi, '').trim()
  const headings = [...main.matchAll(/^(#{1,6})[ \t]+(.+?)\s*$/gm)]
  const actual = headings.map(match => [match[1].length, match[2].trim()])
  const expected = [[2,style.sections[0]],[2,style.sections[1]],[3,style.installation[0]],[3,style.installation[1]],[2,style.sections[2]]]
  const intro = main.slice(0, headings[0]?.index ?? main.length).trim()
  const sections = [...main.matchAll(/^##[ \t]+(.+?)\s*$/gm)]
  const body = name => {
    const index = sections.findIndex(match => match[1].trim() === name)
    if (index < 0) return ''
    return main.slice(sections[index].index + sections[index][0].length, sections[index+1]?.index ?? main.length).trim()
  }
  const list = text => {
    const lines = text.split('\n').filter(line => line.trim())
    return lines.some(line => /^-\s+\S/.test(line)) && lines.every(line => /^-\s+\S|^[ \t]{2,}\S/.test(line))
  }
  const evidence = blocks[0]?.[1] ?? ''
  const evidenceLast = blocks.length === 1 && !prose.slice(blocks[0].index + blocks[0][0].length).trim()
  const summary = evidence.match(/<summary>[ \t]*([^<]+?)[ \t]*<\/summary>/i)?.[1]?.trim()
  const labels = [...evidence.matchAll(/^\*\*(.+?)\*\*[ \t]*$/gm)]
  const evidenceFilled = labels.length === style.labels.length && labels.every((match,index) => match[1] === style.labels[index] && evidence.slice(match.index + match[0].length, labels[index+1]?.index ?? evidence.length).trim())
  return [
    {id:'format.summary',ok:Boolean(intro) && !/^[#<*-]/.test(intro) && !/\n[ \t]*\n/.test(intro),message:'Start with one prose summary paragraph before the fixed sections.'},
    {id:'format.headings',ok:JSON.stringify(actual) === JSON.stringify(expected),message:`Use the fixed heading sequence: ${expected.map(([level,label]) => `${'#'.repeat(level)} ${label}`).join(' → ')}`},
    {id:'format.lists',ok:list(body(style.sections[0])) && list(body(style.sections[2])),message:'Changes and compatibility/known limitations use nonempty bullet lists.'},
    {id:'format.evidence',ok:evidenceLast && summary === style.evidence && evidenceFilled,message:`Finish with one ${style.evidence} disclosure with nonempty ${style.labels.join(' → ')} entries.`}
  ]
}

export function reviewReleaseNotes({ notes, title, format }) {
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
  if (format !== undefined) checks.push(...formatChecks(prose, format))
  const main = prose.replace(/<details\b[^>]*>[\s\S]*?<\/details>/gi, '')
  const advisories = []
  if (/(?:端口冲突|port conflict|(?:本机|本地)[^\n]{0,40}(?:重跑|重试)|reran[^\n]{0,40}(?:local|port))/i.test(main)) advisories.push({ id:'local-debug-history', message:'Move local debugging history to a linked development record unless it explains a user-facing known issue.' })
  if (/(?:\b\d+ (?:local |offline |serial )*(?:tests|checks)|\d+\s*(?:项|个)(?:自动)?测试|合并后.{0,24}测试)/i.test(main)) advisories.push({ id:'validation-in-main-copy', message:'Keep test evidence concise and linked or folded; lead with changes and installation impact.' })
  if (/(?:source, installation, host loading|源码、(?:本地)?检查、CI|source and (?:local )?validation are separate)/i.test(main)) advisories.push({ id:'delivery-report-in-main-copy', message:'Keep evidence boundaries in verification records. Retain concrete user-facing limitations in the release.' })
  return { ok:checks.every(check => check.ok), checks, advisories, format:format ?? 'unrestricted', editorialReview:'required', scope:'specific-publishing-hygiene-checks' }
}
