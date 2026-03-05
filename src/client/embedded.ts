import { type App } from "obsidian";

export type EmbeddedContext = {
	log: typeof console["log"];
}

type EmbeddedFn = (this: EmbeddedContext, app: App) => void | Promise<void>;

let embeds: Array<EmbeddedFn> = [];

export function embedded(fn: EmbeddedFn) {
	embeds.push(fn);
}

export async function run(ctx: EmbeddedContext, app: App) {
	for (const fn of embeds) {
		await fn.call(ctx, app);
	}
}
