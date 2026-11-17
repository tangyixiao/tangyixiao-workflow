import test from 'node:test'
import assert from 'node:assert/strict'
import { reviewReleaseNotes } from '../lib/notes.mjs'

test('public product changes preserve real authorization behavior and known limits', () => {
  const result = reviewReleaseNotes({title:'Bridge v0.6.3',notes:'新增账号管理。用户授权 OAuth 登录后可以切换账号。\n\n安装：下载附件，在插件管理器中添加。自动换号尚未完成真实账号场景验证。'})
  assert.equal(result.ok,true)
  assert.equal(result.editorialReview,'required')
})

test('private publication authorization and redundant title fail with actionable findings', () => {
  const result = reviewReleaseNotes({title:'Bridge v0.5.1',notes:'# Bridge v0.5.1\n\nPublished from this reviewed diff with user authorization; the PR remains unmerged. This release does not downgrade the local preview.'})
  assert.equal(result.ok,false)
  assert.deepEqual(result.checks.filter(check => !check.ok).map(check => check.id),['notes-no-duplicate-title','notes-no-private-instructions','notes-no-private-machine-state'])
})

test('test counts and local retry diaries call for editing without suppressing known defects', () => {
  const result = reviewReleaseNotes({title:'Bridge v0.6.0',notes:'修复模型列表无法加载。\n\n验证：自动测试 219 项测试通过，本机 9229 端口冲突后重跑。\n\n已知问题：其他程序占用端口时服务可能无法启动，请修改监听端口。'})
  assert.equal(result.ok,true)
  assert(result.advisories.some(item => item.id === 'local-debug-history'))
  assert(result.advisories.some(item => item.id === 'validation-in-main-copy'))
})

test('folded evidence is kept without claiming semantic correctness', () => {
  const result = reviewReleaseNotes({title:'Bridge v0.6.3',notes:'修复模型列表加载。\n\n<details><summary>验证记录</summary>283 offline tests passed.</details>\n\n安装与已知限制见文档。'})
  assert.equal(result.advisories.length,0)
  assert.equal(result.editorialReview,'required')
})
