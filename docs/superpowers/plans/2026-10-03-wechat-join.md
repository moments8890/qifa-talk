# WeChat Join Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the expired Xiaohongshu join path with the supplied WeChat QR code on the homepage and join page.

**Architecture:** Keep the static Jekyll structure unchanged. Add the untouched QR PNG as a local asset, route the homepage participation card to the existing `/join/` page, and render the QR there with responsive inline styling and WeChat-specific copy.

**Tech Stack:** Jekyll, Markdown/Kramdown, Liquid `relative_url`, HTML, Ruby assertion script, GitHub Pages

---

## File Map

- Create `assets/images/qifa-talk-wechat-qr.png`: original supplied QR image.
- Create `test/wechat_join_test.rb`: regression assertions for the asset and join copy/link behavior.
- Modify `index.md`: replace the external Xiaohongshu card with an internal WeChat join card.
- Modify `join.md`: replace Xiaohongshu content with the QR image and WeChat registration instructions.

### Task 1: Add a failing join-experience regression test

**Files:**
- Create: `test/wechat_join_test.rb`

- [ ] **Step 1: Write the failing test**

```ruby
index = File.read('index.md')
join = File.read('join.md')
asset = 'assets/images/qifa-talk-wechat-qr.png'

abort 'QR asset missing' unless File.file?(asset)
abort 'homepage must link to /join/' unless index.include?("{{ '/join/' | relative_url }}")
abort 'homepage must mention WeChat group' unless index.include?('加入微信群')
abort 'join page must render QR asset' unless join.include?("{{ '/assets/images/qifa-talk-wechat-qr.png' | relative_url }}")
abort 'join page must include scan instruction' unless join.include?('打开微信扫一扫')
abort 'Xiaohongshu URL remains' if [index, join].any? { |content| content.include?('xhslink.com') }
abort 'Xiaohongshu copy remains' if [index, join].any? { |content| content.include?('小红书') }

puts 'PASS: WeChat join experience is complete'
```

- [ ] **Step 2: Run the test and verify the expected failure**

Run: `ruby test/wechat_join_test.rb`

Expected: exit 1 with `QR asset missing`.

- [ ] **Step 3: Commit the regression test**

```bash
git add test/wechat_join_test.rb
git commit -m "test: cover WeChat join experience"
```

### Task 2: Add the supplied QR asset

**Files:**
- Create: `assets/images/qifa-talk-wechat-qr.png`

- [ ] **Step 1: Copy the attached PNG without recompression**

```bash
cp /var/folders/bm/7gqcd46s67g4z0bl3c8fcpvw0000gn/T/codex-clipboard-a09ba152-ee69-489d-b437-518b39ef9781.png assets/images/qifa-talk-wechat-qr.png
```

- [ ] **Step 2: Verify the copied asset matches the attachment byte-for-byte**

Run: `shasum -a 256 /var/folders/bm/7gqcd46s67g4z0bl3c8fcpvw0000gn/T/codex-clipboard-a09ba152-ee69-489d-b437-518b39ef9781.png assets/images/qifa-talk-wechat-qr.png`

Expected: both SHA-256 values are identical.

### Task 3: Replace Xiaohongshu with the WeChat join flow

**Files:**
- Modify: `index.md:117-121`
- Modify: `join.md:13-40`

- [ ] **Step 1: Update the homepage participation card**

Replace the external link with:

```html
<a href="{{ '/join/' | relative_url }}" class="card-btn">
  <div class="card-icon">💬</div>
  <div class="card-title">加入微信群</div>
  <div class="card-desc">扫描二维码加入启发说</div>
</a>
```

- [ ] **Step 2: Update the join page**

Replace the first step with a centered card that renders:

```html
<img src="{{ '/assets/images/qifa-talk-wechat-qr.png' | relative_url }}" alt="启发说微信群二维码" style="display:block;width:100%;max-width:320px;height:auto;margin:0 auto 16px;">
```

The surrounding copy must use the heading `## 第一步：扫码加入微信群`, include `打开微信扫一扫`, and state that activity registration happens in the WeChat group.

- [ ] **Step 3: Run the regression test**

Run: `ruby test/wechat_join_test.rb`

Expected: `PASS: WeChat join experience is complete`.

- [ ] **Step 4: Check source cleanliness**

Run: `rg -n 'xhslink|小红书' index.md join.md`

Expected: no output and exit 1 because no obsolete references remain.

- [ ] **Step 5: Commit the implementation and asset**

```bash
git add assets/images/qifa-talk-wechat-qr.png index.md join.md
git commit -m "feat: replace Xiaohongshu join link with WeChat QR"
```

### Task 4: Build and visually verify

**Files:**
- Verify: generated `/join/` and homepage

- [ ] **Step 1: Run the Jekyll build**

Run: `bundle exec jekyll build --destination /tmp/qifatalk-wechat-site`

Expected: exit 0. If the host Ruby cannot run the locked Bundler version, use the GitHub Pages workflow as the authoritative build and report the local environment limitation.

- [ ] **Step 2: Verify rendered asset references**

Run: `ruby test/wechat_join_test.rb && git diff --check`

Expected: regression test passes and `git diff --check` prints nothing.

- [ ] **Step 3: Push the branch and verify GitHub Actions**

```bash
git push -u origin qa/navigation-paths
```

Expected: GitHub accepts the branch. Merge or fast-forward the verified commits to `main`, then confirm the Pages deployment completes successfully.

- [ ] **Step 4: Perform browser QA on production**

Verify:

- The homepage “加入微信群” card opens `/join/`.
- The QR image request returns HTTP 200.
- The join page contains no Xiaohongshu link or copy.
- Desktop and 375×812 mobile screenshots show the full QR code without clipping.
- The recursive internal-link crawl returns zero broken internal pages.

### Task 5: Final handoff

**Files:**
- Verify: repository and production state

- [ ] **Step 1: Confirm the original checkout is untouched**

Run: `git -C /Volumes/ORICO/Code/qifa-talk status --short`

Expected: only the pre-existing `.gitignore` modification and `_site/` directory are present.

- [ ] **Step 2: Report deployment evidence**

Include the implementation commit, successful GitHub Pages run, production URLs, browser QA results, and any remaining unrelated warnings.
