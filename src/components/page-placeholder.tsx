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
		<div className="grid gap-4 p-4 pt-0">
			<div className="flex flex-wrap items-end justify-between gap-4">
				<div>
					<h1 className="text-foreground text-xl font-semibold">{title}</h1>
					<p className="text-muted mt-1 max-w-2xl text-sm">{description}</p>
				</div>
				{stat}
			</div>
			<div className="grid grid-cols-3 gap-4">
				<div className="bg-surface rounded-xl border p-6" />
				<div className="bg-surface rounded-xl border p-6" />
				<div className="bg-surface rounded-xl border p-6" />
			</div>
			<div className="bg-surface min-h-[50vh] rounded-xl border p-6" />
		</div>
	);
}
