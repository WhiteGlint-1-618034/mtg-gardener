export function Hint({
  text,
  side = "right",
  children,
}: {
  text: string;
  side?: "right" | "bottom" | "top";
  children: React.ReactNode;
}) {
  return (
    <span className="hint" data-side={side}>
      {children}
      <span role="tooltip">{text}</span>
    </span>
  );
}
