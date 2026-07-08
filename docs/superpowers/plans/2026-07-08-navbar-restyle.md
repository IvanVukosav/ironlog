# Navbar Restyle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Commit workflow:** After task, stage, show diff, commit directly (user has pre-approved autonomous execution).

**Goal:** Update `Navbar.css` to use monospace font and CSS custom property tokens instead of hardcoded hex values.

**Architecture:** `Navbar.css` stays as global CSS (appropriate for top-level navigation). No migration to CSS Modules. Just update the color/font values to use tokens from `index.css`.

---

### Task 1: Update `Navbar.css`

**Files:**
- Modify: `frontend/src/components/Navbar.css`

- [ ] **Step 1: Replace the file**

Current:
```css
nav {
  display: flex;
  gap: 1.5rem;
  padding: 1rem 1.5rem;
  background-color: #111;
  border-bottom: 1px solid #222;
}

nav a {
  color: #f0f0f0;
  font-size: 0.875rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.0625rem;
}

nav a:hover {
  color: #ff3b3b;
}
```

Replace with:
```css
nav {
  display: flex;
  gap: 1.5rem;
  padding: 1rem 1.5rem;
  background-color: #111;
  border-bottom: 1px solid var(--color-border-subtle);
}

nav a {
  color: var(--color-text);
  font-family: var(--font-mono);
  font-size: 0.875rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.0625rem;
}

nav a:hover {
  color: var(--color-accent);
}
```

Note: `background-color: #111` is intentionally kept as a literal — it's slightly darker than `--color-bg` (`#0d0d0d`) to visually separate the nav from the page. It's the only value not tokenized here.

- [ ] **Step 2: Verify build**

Run from `frontend/`: `npm run build` — expected: success.

- [ ] **Step 3: Stage and commit**

```bash
git add frontend/src/components/Navbar.css
git diff --cached
git commit -m "style: update Navbar to use CSS tokens and monospace font"
```
