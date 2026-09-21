import { useCallback, useRef, useState } from "react";

function findRowId(clientX, clientY) {
  const el = document.elementFromPoint(clientX, clientY);
  const row = el?.closest("[data-drag-id]");
  return row ? row.getAttribute("data-drag-id") : null;
}

export function useDragReorder(items, onReorder) {
  const [draggedId, setDraggedId] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);
  const draggedIdRef = useRef(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const finishDrag = useCallback((targetId) => {
    const sourceId = draggedIdRef.current;
    if (sourceId !== null && targetId !== null && String(sourceId) !== String(targetId)) {
      const list = [...itemsRef.current];
      const sourceIndex = list.findIndex((item) => String(item.id) === String(sourceId));
      const targetIndex = list.findIndex((item) => String(item.id) === String(targetId));
      if (sourceIndex !== -1 && targetIndex !== -1) {
        const [moved] = list.splice(sourceIndex, 1);
        list.splice(targetIndex, 0, moved);
        onReorder(list);
      }
    }
    draggedIdRef.current = null;
    setDraggedId(null);
    setHoveredId(null);
  }, [onReorder]);

  const startDrag = useCallback((id) => {
    draggedIdRef.current = id;
    setDraggedId(id);

    const handlePointerMove = (event) => {
      setHoveredId(findRowId(event.clientX, event.clientY));
    };

    const handlePointerUp = (event) => {
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
      finishDrag(findRowId(event.clientX, event.clientY));
    };

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);
  }, [finishDrag]);

  return { draggedId, hoveredId, startDrag };
}
