import { useEffect, useEffectEvent, useId, useState } from "react";

// Rows carry the id of the list they belong to, so a nested list (sets inside an
// exercise card) never becomes a drop target for the outer one.
function findRowId(listId, clientX, clientY) {
  const row = document.elementFromPoint(clientX, clientY)?.closest(`[data-drag-list="${listId}"]`);
  return row ? row.getAttribute("data-drag-id") : null;
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
  const [hoveredId, setHoveredId] = useState(null);

  const drop = useEffectEvent((targetId) => {
    const ids = items.map((item) => String(item.id));
    const fromIndex = ids.indexOf(draggedId);
    const toIndex = ids.indexOf(targetId);
    if (fromIndex !== -1 && toIndex !== -1 && fromIndex !== toIndex) {
      onReorder(moveItem(items, fromIndex, toIndex));
    }
  });

  // Listeners exist only while a drag is active; the cleanup also covers unmounting mid-drag.
  useEffect(() => {
    if (draggedId === null) return undefined;

    const stopDrag = () => {
      setDraggedId(null);
      setHoveredId(null);
    };
    const handlePointerMove = (event) => {
      setHoveredId(findRowId(listId, event.clientX, event.clientY));
    };
    const handlePointerUp = (event) => {
      drop(findRowId(listId, event.clientX, event.clientY));
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
    isDropTarget: (id) => hoveredId === String(id) && draggedId !== String(id),
    getItemProps: (id) => ({ "data-drag-list": listId, "data-drag-id": id }),
    getHandleProps: (id) => ({
      onPointerDown: (event) => {
        event.preventDefault();
        setDraggedId(String(id));
      },
    }),
  };
}
