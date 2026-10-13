"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function NookApp() {
  const router = useRouter();
  const search = useSearchParams();

  useEffect(() => {
    document.body.classList.add("nook");
    const forceBook = search.get("book") === "1";
    if (!forceBook && window.innerWidth < 600) {
      router.replace("/read");
      return;
    }
    let stop: (() => void) | undefined;
    let gone = false;
    import("@/lib/nook-boot").then(async ({ bootNook }) => {
      if (gone) return;
      const nook = bootNook({ externalLoop: true });
      if (!nook.canvas || !nook.renderer || !nook.scene || !nook.camera) {
        stop = () => nook.dispose();
        return;
      }
      const [{ createRoot, events, extend }, THREE, { default: DeskAddons }] = await Promise.all([
        import("@react-three/fiber"),
        import("three"),
        import("@/components/scene/DeskAddons"),
      ]);
      if (gone) {
        nook.dispose();
        return;
      }
      extend(THREE);
      const root = createRoot(nook.canvas);
      await root.configure({
        gl: nook.renderer,
        camera: nook.camera,
        scene: nook.scene,
        events,
        frameloop: "always",
        shadows: true,
        dpr: [1, 2],
        onCreated: (state) => {
          state.set({ controls: nook.controls });
        },
      });
      if (gone) {
        root.unmount();
        nook.dispose();
        return;
      }
      root.render(<DeskAddons tick={nook.tick} />);
      stop = () => {
        root.unmount();
        nook.dispose();
      };
    });
    return () => {
      gone = true;
      stop?.();
      document.body.classList.remove("nook");
    };
  }, [router, search]);

  return (
    <>
      <div id="stage" aria-label="Kiti's Book, a 3D study nook" />
      <header className="top">
        <div className="brand">
          Kiti's <i>Book</i>
        </div>
        <div style={{ display: "flex", gap: 8, pointerEvents: "auto", flexWrap: "wrap", justifyContent: "flex-end" }}>
          <Link className="flat-link" href="/read">
            Read without the book
          </Link>
          <button type="button" className="chip" id="dayChip" aria-label="Switch between day and night">
            <svg id="dayIcon" aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
            </svg>
            <span id="dayLabel">Daytime</span>
            <small id="dayLeft">night in 5:00</small>
          </button>
        </div>
      </header>
      <p className="hint" id="hint" />
      <nav className="hud" id="hud" aria-label="Controls">
        <button type="button" id="btnOpen" className="primary">
          Open the book
        </button>
        <button type="button" id="btnPrev" aria-label="Previous page">
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 6l-6 6 6 6" />
          </svg>
          Back
        </button>
        <span className="folio" id="folio" aria-live="polite">
          Title page
        </span>
        <button type="button" id="btnNext" aria-label="Next page">
          Turn
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
        <button type="button" id="btnContents">
          Contents
        </button>
        <button type="button" id="btnClose">
          Close
        </button>
        <button type="button" id="btnStand">
          Stand up
        </button>
        <span className="sep" aria-hidden="true" />
        <button type="button" id="btnView">
          Reset view
        </button>
      </nav>
      <div className="tip" id="tip" hidden />
      <div className="loader" id="loader">
        <b>
          Kiti's <i>Book</i>
        </b>
        <span>tidying up the desk…</span>
      </div>
    </>
  );
}
