import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { reviewReleaseNotes } from '../lib/notes.mjs'

const zh = `修复插件启动时的兼容性识别问题

## 更新内容

- 宿主现在可以读取插件声明的兼容范围

## 安装与升级

### 运行要求

- 使用受支持的宿主版本

### 安装方式

- 从本次发行附件安装插件包

## 兼容性与已知限制

- 保留既有配置，升级前查看宿主版本

<details>
<summary>校验与验证记录</summary>

**校验信息**

校验值随发行资产提供

**验证范围**

兼容性声明已核对，其他使用流程仍按文档说明

**源码**

对应版本的源码 tag

</details>`

const check = notes => reviewReleaseNotes({notes,title:'Bridge v0.6.3',format:'tangyixiao-zh-v1'})

test('one format accepts both a feature release and a single-fix release', async () => {
  for (const version of ['0.6.3','0.5.1']) {
    const notes = await readFile(new URL(`../examples/release-notes/zcode-${version}.md`,import.meta.url),'utf8')
    const result = check(notes)
    assert.equal(result.ok,true,JSON.stringify(result.checks.filter(item => !item.ok)))
  }
})

test('synonym headings, changed order and evidence-label drift are rejected', () => {
  assert.equal(check(zh).ok,true)
  for (const notes of [zh.replace('## 更新内容','## 修复内容'),zh.replace('## 兼容性与已知限制','## 使用限制'),zh.replace('校验与验证记录','校验信息与源码'),zh.replace('**验证范围**','**验证过程**'),zh.replace('### 运行要求','### 安装方式').replace('### 安装方式\n\n- 从','### 运行要求\n\n- 从')]) {
    assert.equal(check(notes).ok,false)
  }
})

test('whole-paragraph changes and missing summary/evidence cannot pass the fixed format', () => {
  assert.equal(check(zh.replace('- 宿主现在','宿主现在')).ok,false)
  assert.equal(check(zh.slice(zh.indexOf('## 更新内容'))).ok,false)
  assert.equal(check(zh.slice(0,zh.indexOf('<details>'))).ok,false)
  const evidence = zh.slice(zh.indexOf('<details>'))
  const main = zh.slice(0,zh.indexOf('<details>'))
  assert.equal(check(evidence+'\n\n'+main).ok,false)
  assert.equal(check(zh+'\n\nUnstructured trailing notes').ok,false)
})

test('English uses the corresponding complete heading set', () => {
  let en = zh
  for (const [from,to] of [['更新内容','Changes'],['安装与升级','Installation and upgrade'],['运行要求','Requirements'],['安装方式','Installation'],['兼容性与已知限制','Compatibility and known limitations'],['校验与验证记录','Checksums and validation'],['校验信息','Checksum'],['验证范围','Validation'],['源码','Source']]) en = en.replaceAll(from,to)
  assert.equal(reviewReleaseNotes({notes:en,title:'Bridge v0.6.3',format:'tangyixiao-en-v1'}).ok,true)
  assert.equal(reviewReleaseNotes({notes:en,title:'Bridge v0.6.3',format:'tangyixiao-zh-v1'}).ok,false)
})

test('generic hygiene remains usable without a project format, and unknown formats fail', () => {
  assert.equal(reviewReleaseNotes({notes:'修复启动问题，安装方式见发行附件',title:'Bridge v0.6.3'}).ok,true)
  assert.throws(() => reviewReleaseNotes({notes:zh,title:'Bridge v0.6.3',format:'misspelled-format'}),/Unknown release-note format/)
})
