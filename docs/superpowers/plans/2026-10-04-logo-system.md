# Qifa Talk Website Logo System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace emoji branding with the supplied transparent Qifa Talk emblem everywhere it is appropriate, while retaining accessible live text and reliable metadata.

**Architecture:** Store one canonical PNG asset and render it through focused Liquid includes for header, footer, and document metadata. Keep the four layouts' existing navigation behavior intact, add a larger standalone hero mark on the homepage, and lock the structure down with a repository-level Ruby regression test.

**Tech Stack:** Jekyll, Liquid, Tailwind CSS utility classes, HTML metadata, Ruby assertion scripts

---

## File Structure

- Create `assets/images/qifa-talk-logo.png`: unchanged canonical transparent emblem.
- Create `_includes/site-brand-header.html`: linked 40px emblem with live Chinese name.
- Create `_includes/site-brand-footer.html`: compact decorative emblem with live location/name text.
- Create `_includes/site-brand-meta.html`: favicon, Apple touch icon, Open Graph, and Twitter metadata.
- Create `test/logo_system_test.rb`: structural, accessibility, asset-integrity, and reuse assertions.
- Modify `_layouts/default.html`: shared metadata, header, and footer includes.
- Modify `_layouts/home.html`: shared metadata/header/footer includes and larger hero emblem.
- Modify `_layouts/timer.html`: shared metadata and header include.
- Modify `_layouts/handsup.html`: shared metadata and header include.

### Task 1: Define the logo-system contract

**Files:**
- Create: `test/logo_system_test.rb`

- [ ] **Step 1: Write the failing structural test**

Create a Ruby script that asserts the canonical asset exists with SHA-256 `8c2e5b84df1be93c956b2bdc0a760224d108af7d1abd2eedd311f17e87e54d8e`; the three includes exist; all four layouts render `site-brand-header.html` and `site-brand-meta.html`; home and default render `site-brand-footer.html`; home contains the standalone hero image with meaningful alt text; the header contains a linked image and live `启发说` text; the footer image has empty alt text beside live `西雅图 · 启发说`; metadata uses `relative_url` for icons and `absolute_url` for sharing images; and no layout retains `🌟 启发说` or `🌟 西雅图 · 启发说`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `ruby test/logo_system_test.rb`

Expected: `Logo asset missing` because no production logo-system files exist yet.

- [ ] **Step 3: Commit the red test**

Run:

```bash
git add test/logo_system_test.rb
git commit -m "test: define website logo system"
```

### Task 2: Add the canonical brand asset and reusable includes

**Files:**
- Create: `assets/images/qifa-talk-logo.png`
- Create: `_includes/site-brand-header.html`
- Create: `_includes/site-brand-footer.html`
- Create: `_includes/site-brand-meta.html`

- [ ] **Step 1: Copy and verify the supplied emblem**

Copy `/var/folders/bm/7gqcd46s67g4z0bl3c8fcpvw0000gn/T/codex-clipboard-695f32c9-ee82-4a34-85e1-aa03ec42f327.png` to `assets/images/qifa-talk-logo.png`, then run `shasum -a 256` and verify the digest matches the test.

- [ ] **Step 2: Implement the header include**

Render a homepage link with `inline-flex items-center gap-2`, a 40×40 emblem (`alt="启发说标志"`), and a live `启发说` span. Preserve the existing typography, color, hover, and transition utility classes.

- [ ] **Step 3: Implement the footer include**

Render a centered inline-flex group with a 28×28 decorative emblem (`alt=""`, `aria-hidden="true"`) and live `西雅图 · 启发说` text.

- [ ] **Step 4: Implement the metadata include**

Render a PNG favicon and Apple touch icon with `relative_url`, plus Open Graph and Twitter image metadata with `absolute_url`. Set `twitter:card` to `summary` and include a useful Open Graph image alt value.

- [ ] **Step 5: Run the logo test and confirm it still fails at layout integration**

Run: `ruby test/logo_system_test.rb`

Expected: failure stating a layout does not include shared branding.

- [ ] **Step 6: Commit the asset and components**

Run:

```bash
git add assets/images/qifa-talk-logo.png _includes/site-brand-header.html _includes/site-brand-footer.html _includes/site-brand-meta.html
git commit -m "feat: add reusable Qifa Talk branding"
```

### Task 3: Integrate branding into every layout

**Files:**
- Modify: `_layouts/default.html`
- Modify: `_layouts/home.html`
- Modify: `_layouts/timer.html`
- Modify: `_layouts/handsup.html`

- [ ] **Step 1: Add shared metadata to all document heads**

Place `{% include site-brand-meta.html %}` after each description meta element.

- [ ] **Step 2: Replace all four emoji header links**

Replace each duplicated `🌟 启发说` anchor with `{% include site-brand-header.html %}` without changing its surrounding navigation container or menu behavior.

- [ ] **Step 3: Add the standalone homepage hero mark**

Above the homepage `h1`, add the canonical image through `relative_url`, with `alt="启发说标志"`, centered dimensions responsive up to 132px, and spacing that retains the existing compact hero.

- [ ] **Step 4: Replace both site-footer emoji marks**

Replace the branded paragraph in the home and default layouts with `{% include site-brand-footer.html %}` while retaining the tagline below it.

- [ ] **Step 5: Run the focused and existing regression tests**

Run:

```bash
ruby test/logo_system_test.rb
ruby test/wechat_join_test.rb
```

Expected: both scripts print `PASS` and exit zero.

- [ ] **Step 6: Check formatting and commit layout integration**

Run `git diff --check`, then:

```bash
git add _layouts/default.html _layouts/home.html _layouts/timer.html _layouts/handsup.html
git commit -m "feat: apply Qifa Talk logo across the site"
```

### Task 4: Build and visually verify the result

**Files:**
- Verify only; no planned edits.

- [ ] **Step 1: Run all repository tests**

Run the two Ruby tests and `npm test` if the repository package scripts define a test command. Expected: all applicable tests pass.

- [ ] **Step 2: Build the Jekyll site**

Run `bundle exec jekyll build`. If the host Ruby cannot satisfy the lockfile, record that local environment limitation and use the GitHub Pages workflow as the authoritative build check after integration.

- [ ] **Step 3: Inspect rendered desktop and mobile pages**

Serve the build or use the existing local preview. Check `/`, `/about/`, `/timer/`, and `/handsup/` at desktop size and 375×812. Confirm the emblem loads, the header remains aligned, the hero/footer are unclipped, and the mobile menu still works.

- [ ] **Step 4: Verify links and metadata**

Confirm the logo homepage link, favicon, Apple icon, Open Graph image, Twitter image, and internal navigation resolve correctly; ensure no browser console errors were introduced.

- [ ] **Step 5: Review final changes**

Run:

```bash
git status --short
git log --oneline origin/main..HEAD
git diff --stat origin/main...HEAD
```

Expected: only the approved design document, plan, logo asset, includes, regression test, and four layout integrations are present.
