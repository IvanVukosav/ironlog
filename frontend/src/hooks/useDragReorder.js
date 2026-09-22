import { useCallback, useEffect, useRef, useState } from "react";

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
  const activeListenersRef = useRef(null);

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
      activeListenersRef.current = null;
      finishDrag(findRowId(event.clientX, event.clientY));
    };

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);
    activeListenersRef.current = { handlePointerMove, handlePointerUp };
  }, [finishDrag]);

  useEffect(() => {
    return () => {
      if (activeListenersRef.current) {
        document.removeEventListener("pointermove", activeListenersRef.current.handlePointerMove);
        document.removeEventListener("pointerup", activeListenersRef.current.handlePointerUp);
        activeListenersRef.current = null;
      }
    };
  }, []);

  return { draggedId, hoveredId, startDrag };
}
