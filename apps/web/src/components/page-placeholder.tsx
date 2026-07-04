import type { ReactNode } from "react";

export function PagePlaceholder({
	title,
	description,
	stat,
}: {
	title: string;
	description: string;
	stat?: ReactNode;
}) {
	return (
		<div className="flex flex-wrap items-end justify-between gap-4 p-4 pt-0">
			<div>
				<h1 className="text-foreground text-xl font-semibold">{title}</h1>
				<p className="text-muted mt-1 max-w-2xl text-sm">{description}</p>
			</div>
			{stat}
		</div>
	);
}
