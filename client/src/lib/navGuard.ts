// Tiny module to warn before navigating away with unsaved changes.
// The edit form sets the dirty flag; navigation buttons call confirmLeave().
let dirty = false;

export function setNavDirty(value: boolean) {
  dirty = value;
}

export function isNavDirty() {
  return dirty;
}

/** Returns true if it's safe to leave. Asks the user when there are changes. */
export function confirmLeave(): boolean {
  if (!dirty) return true;
  const ok = window.confirm(
    "You have unsaved changes. Leave this page and discard them?",
  );
  if (ok) dirty = false;
  return ok;
}
