"use client";

import { useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import DeskSpeaker from "@/components/scene/DeskSpeaker";
import PaperFlyer from "@/components/scene/PaperFlyer";
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
    </>
  );
}
