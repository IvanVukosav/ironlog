import { useCallback, useEffect, useRef, useState } from "react";

// How far below the top of the window a section's top must have scrolled to count as the one
// being read.
const READING_LINE_PX = 140;
// A jump has ended when the page has not scrolled for this long.
const SETTLE_MS = 150;

/**
 * Which of the elements with these ids is being read: the last one whose top has scrolled up to
 * the reading line, or the last of all once the page is scrolled to its end. The first until the
 * page scrolls. `select(id)` marks one at once, for a jump to it: until the page stops, the
 * sections it passes on the way don't count. Off (and not listening) while `enabled` is false.
 * Returns [current id, select].
 */
export function useScrollSpy(ids, enabled) {
  const [current, setCurrent] = useState(ids[0]);
  const isJumping = useRef(false);
  const settleTimer = useRef(0);

  const endJumpWhenStill = useCallback(() => {
    clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      isJumping.current = false;
    }, SETTLE_MS);
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    let frame = 0;
    const update = () => {
      frame = 0;
      const page = document.documentElement;
      const canScroll = page.scrollHeight > window.innerHeight + 2;
      const atEnd = canScroll && window.innerHeight + window.scrollY >= page.scrollHeight - 2;
      let reading = ids[0];
      for (const id of ids) {
        const top = document.getElementById(id)?.getBoundingClientRect().top;
        if (top !== undefined && top <= READING_LINE_PX) reading = id;
      }
      setCurrent(atEnd ? ids.at(-1) : reading);
    };
    const onScroll = () => {
      if (isJumping.current) endJumpWhenStill();
      else if (!frame) frame = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
      clearTimeout(settleTimer.current);
    };
  }, [ids, enabled, endJumpWhenStill]);

  const select = useCallback(
    (id) => {
      isJumping.current = true;
      endJumpWhenStill();
      setCurrent(id);
    },
    [endJumpWhenStill],
  );

  return [current, select];
}
