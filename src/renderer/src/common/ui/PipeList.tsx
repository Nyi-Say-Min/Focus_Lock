import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Sprite } from "./Scenery";
export function PipeList({ children }: { children: ReactNode }) {
  const list = useRef<HTMLUListElement>(null),
    track = useRef<HTMLDivElement>(null);
  const id = useId();
  const [scroll, setScroll] = useState({ top: 0, max: 0 });
  useEffect(() => {
    const node = list.current!;
    const update = () => {
      const max = Math.max(0, node.scrollHeight - node.clientHeight);
      setScroll({ top: max - node.scrollTop < 1 ? max : node.scrollTop, max });
    };
    const resize = new ResizeObserver(update),
      mutation = new MutationObserver(update);
    resize.observe(node);
    mutation.observe(node, { childList: true, subtree: true });
    node.addEventListener("scroll", update);
    update();
    return () => {
      resize.disconnect();
      mutation.disconnect();
      node.removeEventListener("scroll", update);
    };
  }, []);
  function move(top: number) {
    if (list.current) list.current.scrollTop = top;
  }
  function seek(clientY: number) {
    const box = track.current!.getBoundingClientRect(),
      thumb = track.current!.firstElementChild!.getBoundingClientRect().height;
    move(((clientY - box.top - thumb / 2) / Math.max(1, box.height - thumb)) * scroll.max);
  }
  return (
    <div className="pipe-list">
      <ul id={id} ref={list} tabIndex={0} className="configured-apps" aria-label="Configured applications">
        {children}
      </ul>
      <div className="pipe-rail">
        <button
          type="button"
          aria-label="Scroll applications up"
          disabled={!scroll.top}
          onClick={() => move(scroll.top - 80)}
        >
          ⌃
        </button>
        <div
          ref={track}
          role="scrollbar"
          tabIndex={0}
          aria-label="Application list position"
          aria-controls={id}
          aria-orientation="vertical"
          aria-valuemin={0}
          aria-valuemax={Math.round(scroll.max)}
          aria-valuenow={Math.round(scroll.top)}
          onKeyDown={(event) => {
            const actions: Record<string, number> = {
              ArrowDown: scroll.top + 60,
              ArrowUp: scroll.top - 60,
              PageDown: scroll.top + list.current!.clientHeight,
              PageUp: scroll.top - list.current!.clientHeight,
              Home: 0,
              End: scroll.max,
            };
            if (event.key in actions) {
              event.preventDefault();
              move(actions[event.key]);
            }
          }}
          onPointerDown={(event) => {
            event.preventDefault();
            event.currentTarget.focus();
            event.currentTarget.setPointerCapture(event.pointerId);
            seek(event.clientY);
          }}
          onPointerMove={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) seek(event.clientY);
          }}
        >
          <span
            className="coin-thumb"
            style={{ top: `calc(${scroll.max ? scroll.top / scroll.max : 0} * (100% - 1.4em))` }}
          >
            <Sprite kind="coin" />
          </span>
        </div>
        <button
          type="button"
          aria-label="Scroll applications down"
          disabled={scroll.top >= scroll.max}
          onClick={() => move(scroll.top + 80)}
        >
          ⌄
        </button>
      </div>
    </div>
  );
}
