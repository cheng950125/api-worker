import { describe, expect, it } from "vitest";
import { extractProbeText, pickRandomItem } from "./channel-recovery";

describe("pickRandomItem", () => {
	it("returns null for empty array", () => {
		expect(pickRandomItem([])).toBeNull();
	});

	it("picks item by random index", () => {
		expect(pickRandomItem(["a", "b", "c"], () => 0)).toBe("a");
		expect(pickRandomItem(["a", "b", "c"], () => 0.8)).toBe("c");
	});
});

describe("extractProbeText", () => {
	it("extracts from output_text", () => {
		expect(extractProbeText({ output_text: " ok " })).toBe("ok");
	});

	it("extracts from choices text", () => {
		expect(extractProbeText({ choices: [{ text: "hello" }] })).toBe("hello");
	});

	it("extracts from message string content", () => {
		expect(
			extractProbeText({
				choices: [{ message: { content: "world" } }],
			}),
		).toBe("world");
	});

	it("extracts from message array content", () => {
		expect(
			extractProbeText({
				choices: [{ message: { content: [{ text: "array text" }] } }],
			}),
		).toBe("array text");
	});
});
