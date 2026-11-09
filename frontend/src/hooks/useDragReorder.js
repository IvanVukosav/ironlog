import { useEffect, useEffectEvent, useId, useState } from "react";

// Where the dragged row would land: before the first of this list's rows whose middle is below
// the pointer, or after the last row. Going by midpoints keeps the target steady in the gaps
// between rows. Rows of other (nested) lists carry a different list id and are never matched.
function findDropTarget(listId, clientX, clientY) {
  const rows = [...document.querySelectorAll(`[data-drag-list="${listId}"]`)];
  if (rows.length === 0) return null;
  const rects = rows.map((row) => row.getBoundingClientRect());
  const first = rects[0];
  const last = rects[rects.length - 1];
  const isOutside =
    clientX < Math.min(...rects.map((rect) => rect.left)) ||
    clientX > Math.max(...rects.map((rect) => rect.right)) ||
    clientY < first.top - first.height / 2 ||
    clientY > last.bottom + last.height / 2;
  if (isOutside) return null;

  const index = rects.findIndex((rect) => clientY < rect.top + rect.height / 2);
  return index === -1
    ? { id: rows[rows.length - 1].getAttribute("data-drag-id"), position: "after" }
    : { id: rows[index].getAttribute("data-drag-id"), position: "before" };
}

// The move a drop on `target` makes, or null when the dragged item would stay where it is.
function getMove(ids, draggedId, target) {
  const fromIndex = ids.indexOf(draggedId);
  const targetIndex = target ? ids.indexOf(target.id) : -1;
  if (fromIndex === -1 || targetIndex === -1) return null;
  const slot = target.position === "before" ? targetIndex : targetIndex + 1;
  // Right above or right below the dragged item itself is where it already is.
  if (slot === fromIndex || slot === fromIndex + 1) return null;
  return { fromIndex, toIndex: slot > fromIndex ? slot - 1 : slot };
}

function moveItem(list, fromIndex, toIndex) {
  const next = [...list];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

export function useDragReorder(items, onReorder) {
  const listId = useId();
  // Ids are kept as strings, since that is what comes back from the DOM.
  const [draggedId, setDraggedId] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const ids = items.map((item) => String(item.id));
  const lineTarget = getMove(ids, draggedId, dropTarget) ? dropTarget : null;

  const drop = useEffectEvent((target) => {
    const move = getMove(ids, draggedId, target);
    if (move) onReorder(moveItem(items, move.fromIndex, move.toIndex));
  });

  // Listeners exist only while a drag is active; the cleanup also covers unmounting mid-drag.
  useEffect(() => {
    if (draggedId === null) return undefined;

    const stopDrag = () => {
      setDraggedId(null);
      setDropTarget(null);
    };
    const handlePointerMove = (event) => {
      const next = findDropTarget(listId, event.clientX, event.clientY);
      // Keep the same object while the slot is unchanged, so React skips the re-render.
      setDropTarget((current) =>
        current?.id === next?.id && current?.position === next?.position ? current : next,
      );
    };
    const handlePointerUp = (event) => {
      drop(findDropTarget(listId, event.clientX, event.clientY));
      stopDrag();
    };

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);
    // A touch the browser takes over (scroll, system gesture) ends with pointercancel, not pointerup.
    document.addEventListener("pointercancel", stopDrag);
    return () => {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
      document.removeEventListener("pointercancel", stopDrag);
    };
  }, [draggedId, listId]);

  return {
    isDragging: (id) => draggedId === String(id),
    // "before" or "after" when the insertion line belongs on this row's edge, otherwise null.
    dropPosition: (id) => (lineTarget?.id === String(id) ? lineTarget.position : null),
    getItemProps: (id) => ({ "data-drag-list": listId, "data-drag-id": id }),
    getHandleProps: (id) => ({
      onPointerDown: (event) => {
        event.preventDefault();
        setDraggedId(String(id));
      },
    }),
  };
}
