import { Suspense } from "react";
import NookApp from "@/components/NookApp";

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="loader">
          <b>
            Kriti’s <i>Book</i>
          </b>
          <span>tidying up the desk…</span>
        </div>
      }
    >
      <NookApp />
    </Suspense>
  );
}
