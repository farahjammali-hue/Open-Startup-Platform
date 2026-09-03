# ✏️ How to make small survey edits yourself

These are quick changes you can do in VSCode. **You do NOT need to run
3-update-database.bat** for these — that's only for brand-new fields. Just
save the file, then refresh your browser. (Keep `2-start.bat` running.)

---

## Make a question REQUIRED or OPTIONAL

A field's "required" status lives in **three small spots**, in two files.
Use VSCode search (Ctrl + F inside a file, or Ctrl + Shift + F across the
project) to jump to them.

### Spot 1 - the red "*" marker
**File:** `client/src/components/StartupForm.tsx`

Each question is wrapped in a `<Field ...>`. A required one has the word
`required`:

```
<Field label="Where are you located?" required error={errors.location}>
```

- To make it OPTIONAL: delete the word `required` (and the space).
- To make it REQUIRED: add `required` after the label.

### Spot 2 - the browser check
**File:** `client/src/components/StartupForm.tsx`, inside `function validate()`

Required fields have a line here. Example for location:

```
if (!location.trim()) e.location = "Required";
```

- To make it OPTIONAL: delete that one line.
- To make it REQUIRED: add a line following the same pattern.

### Spot 3 - the server check (the real rule)
**File:** `shared/schema.ts`, inside `startupSurveySchema`

- A REQUIRED text field looks like:
  ```
  location: z.string().min(1, "Location is required"),
  ```
- An OPTIONAL text field looks like:
  ```
  investorsEquityHolders: z.string().optional().or(z.literal("")),
  ```

So to flip one, swap its line between those two shapes (keep the field name
the same on the left).

---

## Worked example A - make "Investors & equity holders" REQUIRED

1. `StartupForm.tsx` - find this line:
   ```
   <Field label="Investors & equity holders">
   ```
   change it to:
   ```
   <Field label="Investors & equity holders" required error={errors.investorsEquityHolders}>
   ```
2. `StartupForm.tsx` - in `validate()`, add a line (next to the others):
   ```
   if (!investorsEquityHolders.trim()) e.investorsEquityHolders = "Required";
   ```
3. `shared/schema.ts` - change:
   ```
   investorsEquityHolders: z.string().optional().or(z.literal("")),
   ```
   to:
   ```
   investorsEquityHolders: z.string().min(1, "Required"),
   ```
4. Save all files (Ctrl + S) and refresh the browser.

## Worked example B - make "Location" OPTIONAL

1. `StartupForm.tsx` - change:
   ```
   <Field label="Where are you located?" required error={errors.location}>
   ```
   to:
   ```
   <Field label="Where are you located?" error={errors.location}>
   ```
2. `StartupForm.tsx` - in `validate()`, delete:
   ```
   if (!location.trim()) e.location = "Required";
   ```
3. `shared/schema.ts` - change:
   ```
   location: z.string().min(1, "Location is required"),
   ```
   to:
   ```
   location: z.string().optional().or(z.literal("")),
   ```
4. Save and refresh.

---

## Other easy edits

- **Change a question's wording:** edit the text inside `label="..."` in
  `StartupForm.tsx`.
- **Add/rename a choice** (e.g. a stage or customer type): edit the lists at
  the top of `StartupForm.tsx` (`STAGES`, `CUSTOMER_TYPES`, `INTERACTIONS`).
  If you add a brand-new option value, also add it to the matching list in
  `shared/schema.ts` so the server accepts it.

## Rules of thumb
- For required/optional, change **all three spots** so the browser and server
  agree. (If you only change the browser, the server may still reject or accept
  it differently.)
- Save -> the app reloads automatically -> refresh the browser to see it.
- If the page goes blank after an edit, you probably removed a comma or bracket.
  Press Ctrl + Z to undo and try again, or send me the file.
- Tip: in VSCode, right-click a file > "Open Timeline" to see/restore previous
  saved versions if an edit goes wrong.
