import { Link } from "@heroui/react";
import { useEffect, useRef, useState } from "react";

/** Long prose clamped to a few lines, with a Read more toggle on overflow. */
export function ClampedText({
  text,
  lines = 5,
  className = "text-muted text-sm leading-relaxed",
}: {
  text: string;
  lines?: 3 | 4 | 5;
  className?: string;
}) {
  const [isExpanded, setExpanded] = useState(false);
  const [isClampable, setClampable] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-measure when the text changes
  useEffect(() => {
    const element = textRef.current;
    if (element) setClampable(element.scrollHeight > element.clientHeight + 1);
  }, [text]);

  const clamp =
    lines === 3
      ? "line-clamp-3"
      : lines === 4
        ? "line-clamp-4"
        : "line-clamp-5";

  return (
    <div className="max-w-prose">
      <p ref={textRef} className={`${className} ${isExpanded ? "" : clamp}`}>
        {text}
      </p>
      {isClampable || isExpanded ? (
        <Link
          className="mt-1 text-xs"
          onPress={() => setExpanded((value) => !value)}
        >
          {isExpanded ? "Show less" : "Read more"}
        </Link>
      ) : null}
    </div>
  );
}
