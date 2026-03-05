import { Notice, Plugin as ObsidianPlugin } from "obsidian";
import assert from "assert";

import "virtual:tests";
import { run } from "./runners/dynamic.js";

export default class TestPlugin extends ObsidianPlugin {
	async onload() {
		const data = await this.loadData();
		const output = data.output;
		assert(typeof output === "number" || typeof output === "string");

		new Notice("Running tests...");
		run(this.app, output);
	}
}






























