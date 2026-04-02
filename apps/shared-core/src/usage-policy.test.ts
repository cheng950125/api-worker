import { describe, expect, it } from "vitest";

import {
	normalizeProxyStreamUsageMode,
	resolveStreamMetaPartialReason,
	shouldMarkStreamMetaPartial,
	shouldParseFailureStreamUsage,
	shouldParseSuccessStreamUsage,
} from "./usage-policy";

describe("usage-policy", () => {
	it("normalizes stream usage mode", () => {
		expect(normalizeProxyStreamUsageMode("FULL")).toBe("full");
		expect(normalizeProxyStreamUsageMode("lite")).toBe("lite");
		expect(normalizeProxyStreamUsageMode("unknown")).toBe("lite");
	});

	it("parses success and failure streams by mode", () => {
		expect(shouldParseSuccessStreamUsage("full")).toBe(true);
		expect(shouldParseSuccessStreamUsage("lite")).toBe(true);
		expect(shouldParseSuccessStreamUsage("off")).toBe(false);
		expect(shouldParseFailureStreamUsage("full")).toBe(true);
		expect(shouldParseFailureStreamUsage("lite")).toBe(false);
		expect(shouldParseFailureStreamUsage("off")).toBe(false);
	});

	it("marks stream meta partial only when usage is still missing", () => {
		expect(
			shouldMarkStreamMetaPartial({
				mode: "off",
				hasImmediateUsage: false,
				hasParsedUsage: false,
			}),
		).toBe(true);
		expect(
			shouldMarkStreamMetaPartial({
				mode: "lite",
				hasImmediateUsage: false,
				hasParsedUsage: false,
				eventsSeen: 3,
			}),
		).toBe(true);
		expect(
			shouldMarkStreamMetaPartial({
				mode: "lite",
				hasImmediateUsage: false,
				hasParsedUsage: true,
				eventsSeen: 3,
			}),
		).toBe(false);
	});

	it("returns a stable partial reason", () => {
		expect(resolveStreamMetaPartialReason({ mode: "off" })).toBe(
			"stream_usage_mode_off",
		);
		expect(
			resolveStreamMetaPartialReason({
				mode: "full",
				timedOut: true,
			}),
		).toBe("usage_parse_timeout");
	});
});
