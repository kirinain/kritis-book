import Link from "next/link";

const pages = [
  {
    folio: "Title",
    title: "Kriti’s Book",
    body: "Things I’ve built, things I’ve learned, and the questions I’m still exploring. Written and kept by Kriti Nain.",
  },
  {
    folio: "iii",
    title: "Contents",
    body: "02 Product Management · 01 Robotics · Interlude: The Margins · About the Author. Tap a chapter in the 3D book to jump there.",
  },
  {
    folio: "3",
    title: "Chapter two · Product Management",
    body: "[Two or three lines in your voice: why you moved from building robots to building products, and what you look for in a problem.]",
  },
  {
    folio: "4–7",
    title: "Case 01 · NikahForever",
    body: "Live product · PM Intern. [A title that states the problem, not the feature.] Problem, insight, decision, result — then the question, the people, the decisions, and the outcome.",
  },
  {
    folio: "8–9",
    title: "Case 02 · Matikaya",
    body: "Prototype. Designing a reasoning experience: the core daily session, and what was cut from v1.",
  },
  {
    folio: "10–13",
    title: "Chapter one · Robotics",
    body: "[Where it started.] Build log, competition photos, and what robots taught me about products.",
  },
  {
    folio: "14",
    title: "The Margins",
    body: "Short notes on product thinking, books, and things I noticed.",
  },
  {
    folio: "15–16",
    title: "About the Author",
    body: "Kriti Nain studies Electrical and Electronics Engineering at MAIT, Delhi, and is a product intern at NikahForever. The next chapter is unwritten.",
  },
];

export default function ReadPage() {
  return (
    <main className="read">
      <div className="read-bar">
        <strong style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 400 }}>
          Kriti’s <i>Book</i>
        </strong>
        <Link href="/?book=1">Try the 3D book</Link>
      </div>
      <div className="read-stack">
        {pages.map((p) => (
          <article
            key={p.folio}
            style={{
              background: "#F7F1E3",
              padding: "36px 32px 40px",
              boxShadow: "0 18px 40px -24px rgba(80,50,40,.45)",
            }}
          >
            <p
              style={{
                fontSize: 12,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "#5E574C",
                margin: "0 0 12px",
              }}
            >
              · {p.folio} ·
            </p>
            <h1
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 400,
                fontSize: 36,
                margin: "0 0 16px",
              }}
            >
              {p.title}
            </h1>
            <p style={{ fontSize: 18, lineHeight: 1.55, margin: 0, color: "#3D372F" }}>{p.body}</p>
          </article>
        ))}
      </div>
    </main>
  );
}
