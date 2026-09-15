# Bodyweight Entry Delete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user delete a bodyweight entry from the Calendar's bodyweight modal.

**Architecture:** A new `DELETE /api/bodyweight/:id` route on the existing Express router, plus a small "✕" control in the Calendar page's bodyweight modal that calls it and removes the entry from local state.

**Tech Stack:** Express + Prisma (backend), React + CSS Modules (frontend). No test framework exists in either package (`backend`'s `test` script is a stub, `frontend` has no test runner) — verification is `npm run build` for the frontend and manual curl checks for the backend, matching this project's existing convention (see prior plans in `docs/superpowers/plans/`).

**Spec:** `docs/superpowers/specs/2026-09-15-bodyweight-delete-design.md`

---

### Task 1: Backend — `DELETE /api/bodyweight/:id`

**Files:**
- Modify: `backend/routes/bodyweight.js`

- [ ] **Step 1: Add the delete route**

Open `backend/routes/bodyweight.js`. Add this route after the existing `router.post("/", ...)` block (before `module.exports = router;`):

```js
router.delete("/:id", async (req, res) => {
  try {
    await prisma.bodyweight.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});
```

The full file should now read:

```js
const express = require("express");
const router = express.Router();
const prisma = require("../prisma/client");

router.get("/", async (req, res) => {
  try {
    let where = {};
    if (req.query.year && req.query.month) {
      const start = new Date(Date.UTC(req.query.year, req.query.month - 1, 1));
      const end = new Date(Date.UTC(req.query.year, req.query.month, 1));
      where = { date: { gte: start, lt: end } };
    } else {
      const days = parseInt(req.query.days) || 30;
      const since = new Date();
      since.setDate(since.getDate() - days);
      where = { date: { gte: since } };
    }
    const entries = await prisma.bodyweight.findMany({
      where,
      orderBy: { date: "asc" },
    });
    res.json(entries);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { date, weight } = req.body;
    if (!date || !weight) {
      return res.status(400).json({ error: "date and weight are required" });
    }
    const entry = await prisma.bodyweight.upsert({
      where: { date: new Date(date) },
      update: { weight: parseFloat(weight) },
      create: { date: new Date(date), weight: parseFloat(weight) },
    });
    res.json(entry);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await prisma.bodyweight.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
```

- [ ] **Step 2: Start the backend**

Run from `backend/`: `npm start`

Expected output: `Server running on port 3001` (leave it running in this terminal/background process).

- [ ] **Step 3: Verify with a throwaway entry**

In a second terminal, create a test entry on an obscure date so it can't collide with real data:

```bash
curl -s -X POST http://localhost:3001/api/bodyweight \
  -H "Content-Type: application/json" \
  -d '{"date":"2099-01-01","weight":1.5}'
```

Expected: JSON body with an `id` field, e.g. `{"id":42,"date":"2099-01-01T00:00:00.000Z","weight":1.5}`. Note the `id`.

- [ ] **Step 4: Delete it and verify**

```bash
curl -s -X DELETE http://localhost:3001/api/bodyweight/<id-from-step-3>
```

Expected: `{"success":true}`

Then confirm it's gone:

```bash
curl -s "http://localhost:3001/api/bodyweight?year=2099&month=1"
```

Expected: `[]`

- [ ] **Step 5: Stop the backend**

Stop the process started in Step 2.

- [ ] **Step 6: Review and commit**

```bash
git add backend/routes/bodyweight.js
git diff --cached
```

STOP. Report full diff. Wait for confirmation.

After confirmation: `git commit -m "feat: add DELETE /api/bodyweight/:id"`

---

### Task 2: Frontend — delete control in the Calendar bodyweight modal

**Files:**
- Modify: `frontend/src/pages/Calendar.jsx`
- Modify: `frontend/src/pages/Calendar.module.css`

- [ ] **Step 1: Add `bwEntryId` state**

In `frontend/src/pages/Calendar.jsx`, find this state declaration block:

```js
  const [bwModalDate, setBwModalDate] = useState(null);
  const [bwWeight, setBwWeight] = useState("");
```

Replace with:

```js
  const [bwModalDate, setBwModalDate] = useState(null);
  const [bwWeight, setBwWeight] = useState("");
  const [bwEntryId, setBwEntryId] = useState(null);
```

- [ ] **Step 2: Add a `getBwEntryId` helper**

Find the existing `getBwWeight` helper:

```js
  const getBwWeight = (day) => {
    const entry = monthBwEntries.find((bwEntry) => matchesCurrentMonthDay(bwEntry.date, day));
    return entry ? entry.weight : null;
  };
```

Add a sibling helper directly below it:

```js
  const getBwWeight = (day) => {
    const entry = monthBwEntries.find((bwEntry) => matchesCurrentMonthDay(bwEntry.date, day));
    return entry ? entry.weight : null;
  };

  const getBwEntryId = (day) => {
    const entry = monthBwEntries.find((bwEntry) => matchesCurrentMonthDay(bwEntry.date, day));
    return entry ? entry.id : null;
  };
```

- [ ] **Step 3: Set `bwEntryId` when opening the modal**

Find `handleBwClick`:

```js
  const handleBwClick = (day) => {
    const dateString = `${currentYear}-${String(currentMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    setActiveDropdown(null);
    setBwModalDate(dateString);
    const existingWeight = getBwWeight(day);
    setBwWeight(existingWeight !== null ? String(existingWeight) : "");
  };
```

Replace with:

```js
  const handleBwClick = (day) => {
    const dateString = `${currentYear}-${String(currentMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    setActiveDropdown(null);
    setBwModalDate(dateString);
    const existingWeight = getBwWeight(day);
    setBwWeight(existingWeight !== null ? String(existingWeight) : "");
    setBwEntryId(getBwEntryId(day));
  };
```

- [ ] **Step 4: Add the `deleteBw` handler**

Find `saveBw` (it ends with a `.catch` block calling `showError`). Add `deleteBw` directly after the closing of `saveBw`:

```js
  const deleteBw = () => {
    if (bwEntryId === null) return;
    fetchJson(`/api/bodyweight/${bwEntryId}`, { method: "DELETE" })
      .then(() => {
        setBwModalDate(null);
        setMonthBwEntries((prev) => prev.filter((entry) => entry.id !== bwEntryId));
      })
      .catch((err) => {
        console.error(err);
        showError(err.message);
      });
  };
```

- [ ] **Step 5: Add footer CSS**

In `frontend/src/pages/Calendar.module.css`, find the `.bwSaveButton` rules:

```css
.bwSaveButton {
  background: transparent;
  border: none;
  color: var(--color-accent);
  font-family: var(--font-mono);
  font-size: 0.85rem;
  cursor: pointer;
  padding: 4px 0;
}

.bwSaveButton::before {
  content: "[ ";
}

.bwSaveButton::after {
  content: " ]";
}
```

Add these new rules directly after that block:

```css
.bwModalFooter {
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.bwDeleteButton {
  background: none;
  border: none;
  color: var(--color-text-dim);
  font-family: var(--font-mono);
  font-size: 0.85rem;
  cursor: pointer;
  padding: 4px 0;
  margin-right: auto;
}

.bwDeleteButton:hover {
  color: var(--color-accent);
}
```

`.bwModalFooter` uses `justify-content: flex-end` so `bwSaveButton` sits at the right by default; `.bwDeleteButton`'s `margin-right: auto` pushes it to the left only when it's actually rendered, without needing a placeholder element for the no-delete-button case.

- [ ] **Step 6: Wire the footer into the modal JSX**

Find this block inside the `bwModal` JSX:

```jsx
            <input
              className={styles.bwInput}
              type="number"
              placeholder="kg"
              autoFocus
              value={bwWeight}
              onChange={(event) => setBwWeight(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") saveBw();
                if (event.key === "Escape") setBwModalDate(null);
              }}
            />
            <button className={styles.bwSaveButton} onClick={saveBw}>
              Spremi
            </button>
```

Replace with:

```jsx
            <input
              className={styles.bwInput}
              type="number"
              placeholder="kg"
              autoFocus
              value={bwWeight}
              onChange={(event) => setBwWeight(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") saveBw();
                if (event.key === "Escape") setBwModalDate(null);
              }}
            />
            <div className={styles.bwModalFooter}>
              {bwEntryId !== null && (
                <button className={styles.bwDeleteButton} onClick={deleteBw}>
                  ✕
                </button>
              )}
              <button className={styles.bwSaveButton} onClick={saveBw}>
                Spremi
              </button>
            </div>
```

- [ ] **Step 7: Build check**

Run from `frontend/`: `npm run build`

Expected: success, no errors.

- [ ] **Step 8: Manual verification**

Start both servers (`backend/`: `npm start`; `frontend/`: `npm run dev`). Open the app in a browser and do a **hard refresh** (this file's fetch/state logic changed — stale HMR state has caused confusion before).

1. Go to `/calendar`, click a day with no logged weight, click "Bodyweight" in the dropdown. Confirm the modal opens with an empty input and **no** ✕ button.
2. Enter a weight, click "Spremi". Confirm the day cell now shows the ⚖ weight.
3. Click that same day again → "Bodyweight". Confirm the modal opens prefilled with the weight **and** the ✕ button is now visible, positioned to the left of "Spremi".
4. Click ✕. Confirm the modal closes and the ⚖ indicator disappears from the day cell.
5. Click that day again → "Bodyweight". Confirm the modal opens empty again (no stale prefill).

- [ ] **Step 9: Review and commit**

```bash
git add frontend/src/pages/Calendar.jsx frontend/src/pages/Calendar.module.css
git diff --cached
```

STOP. Report full diff. Wait for confirmation.

After confirmation: `git commit -m "feat: delete bodyweight entries from the Calendar modal"`
