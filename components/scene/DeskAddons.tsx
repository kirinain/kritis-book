"use client";

import { useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import DeskSpeaker from "@/components/scene/DeskSpeaker";
import NoteBoard from "@/components/scene/NoteBoard";
import ShelfBooks from "@/components/scene/ShelfBooks";
import PaperFlyer from "@/components/scene/PaperFlyer";
import PolaroidStack from "@/components/scene/PolaroidStack";
import QuoteFrame from "@/components/scene/QuoteFrame";
import SpinPencil from "@/components/scene/SpinPencil";

function setAddonTip(label: string | null) {
  const canvas = document.querySelector("#stage canvas") as HTMLElement | null;
  if (canvas) canvas.dataset.addonHover = label ? "1" : "";
  const tip = document.getElementById("tip");
  if (!tip) return;
  if (!label) {
    tip.hidden = true;
    return;
  }
  tip.textContent = label;
  tip.hidden = false;
}

export default function DeskAddons({ tick }: { tick: (now: number) => void }) {
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const tip = document.getElementById("tip");
      if (!tip || tip.hidden) return;
      tip.style.left = Math.min(e.clientX, window.innerWidth - tip.offsetWidth - 24) + "px";
      tip.style.top = `${e.clientY}px`;
    };
    window.addEventListener("pointermove", move);
    return () => window.removeEventListener("pointermove", move);
  }, []);

  useFrame(() => {
    if (!document.hidden) tick(performance.now());
  });

  return (
    <>
      <SpinPencil position={[-0.42, 0.76, 0.45]} onHoverChange={setAddonTip} />
      <PaperFlyer position={[0.5, 0.76, 0.42]} onHoverChange={setAddonTip} />
      <DeskSpeaker position={[0.33, 0.76, 0.42]} onHoverChange={setAddonTip} />
      <PolaroidStack position={[-0.19, 0.76, 0.075]} onHoverChange={setAddonTip} />
      <NoteBoard position={[0.02, 1.17, 0.016]} onHoverChange={setAddonTip} />
      <ShelfBooks position={[-0.544, 1.567, 0.2]} onHoverChange={setAddonTip} />
      <QuoteFrame position={[-0.15, 1.967, 0.05]} onHoverChange={setAddonTip} />
    </>
  );
}
