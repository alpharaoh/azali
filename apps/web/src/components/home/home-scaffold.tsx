import { IconCircleCheck } from "@central-icons-react/square-outlined-radius-0-stroke-1.5";
import { Button, Skeleton } from "@heroui/react";
import { Widget } from "@heroui-pro/react";

/* -------------------------------------------------------------------------------------------------
 * Snippet scaffolding — every home card shares the header-with-link + list shell
 * -----------------------------------------------------------------------------------------------*/
export function SnippetCard({
  children,
  className,
  linkLabel,
  onLink,
  title,
}: {
  children: React.ReactNode;
  className?: string;
  linkLabel?: string;
  onLink?: () => void;
  title: string;
}) {
  return (
    <Widget className={className}>
      <Widget.Header>
        <Widget.Title>{title}</Widget.Title>
        {linkLabel && onLink ? (
          <Button
            className="text-muted"
            size="sm"
            variant="ghost"
            onPress={onLink}
          >
            {linkLabel}
          </Button>
        ) : null}
      </Widget.Header>
      <Widget.Content className="flex flex-col">{children}</Widget.Content>
    </Widget>
  );
}

export function RowSkeletons({ rows }: { rows: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder list
        <div key={index} className="flex items-center gap-3 py-2.5">
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5 w-1/2 rounded" />
            <Skeleton className="h-3 w-3/4 rounded" />
          </div>
        </div>
      ))}
    </>
  );
}

export function SnippetEmpty({
  detail,
  title,
}: {
  detail: string;
  title: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
      <div className="bg-default/60 flex size-10 items-center justify-center rounded-xl">
        <IconCircleCheck className="text-muted size-4" />
      </div>
      <span className="text-foreground text-sm font-medium">{title}</span>
      <span className="text-muted max-w-[280px] text-xs">{detail}</span>
    </div>
  );
}
