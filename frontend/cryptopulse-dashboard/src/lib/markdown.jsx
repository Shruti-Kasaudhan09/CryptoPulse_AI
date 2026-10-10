// Tiny, safe renderer for the assistant's answers: paragraphs, "- " bullet
// lists and **bold**. No HTML is injected - everything is React text nodes.
function inline(text, key) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") && p.length > 4
      ? <strong key={`${key}-${i}`} className="font-semibold text-ink">{p.slice(2, -2)}</strong>
      : <span key={`${key}-${i}`}>{p}</span>,
  );
}

export function Markdown({ text }) {
  const blocks = String(text || "").split(/\n{2,}/);
  return (
    <div className="space-y-2.5">
      {blocks.map((block, bi) => {
        const lines = block.split("\n");
        const items = lines.filter((l) => /^\s*[-•*]\s+/.test(l));
        const head = lines.filter((l) => !/^\s*[-•*]\s+/.test(l));
        return (
          <div key={bi} className="space-y-1.5">
            {head.length > 0 && <p>{inline(head.join(" "), `p${bi}`)}</p>}
            {items.length > 0 && (
              <ul className="space-y-1 pl-1">
                {items.map((l, li) => (
                  <li key={li} className="flex gap-2">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                    <span>{inline(l.replace(/^\s*[-•*]\s+/, ""), `l${bi}-${li}`)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
