import { describe, expect, it, vi } from "vitest";

vi.mock("../wasm/core", () => ({
	normalizeUsageViaWasm: vi.fn(() => null),
	parseUsageFromJsonViaWasm: vi.fn(() => null),
	parseUsageFromSseLineViaWasm: vi.fn((line: string) => {
		const payload = line.replace(/^data:\s*/, "");
		const parsed = JSON.parse(payload) as {
			type?: string;
			response?: {
				usage?: {
					input_tokens?: number;
					output_tokens?: number;
					total_tokens?: number;
				};
			};
		};
		if (parsed.type !== "response.completed") {
			return null;
		}
		const usage = parsed.response?.usage;
		if (!usage) {
			return null;
		}
		return {
			promptTokens: usage.input_tokens ?? 0,
			completionTokens: usage.output_tokens ?? 0,
			totalTokens:
				usage.total_tokens ??
				(usage.input_tokens ?? 0) + (usage.output_tokens ?? 0),
		};
	}),
}));

import { parseUsageFromSse } from "./usage";

function buildSseResponse(lines: string[]): Response {
	const payload = `${lines.join("\n")}\n`;
	return new Response(payload, {
		headers: {
			"content-type": "text/event-stream",
		},
	});
}

describe("parseUsageFromSse", () => {
	it("parses usage from a long SSE tail without byte truncation", async () => {
		const filler = "x".repeat(130_000);
		const response = buildSseResponse([
			`data: ${JSON.stringify({
				type: "response.output_text.delta",
				delta: filler,
			})}`,
			`data: ${JSON.stringify({
				type: "response.completed",
				response: {
					usage: {
						input_tokens: 11,
						output_tokens: 29,
						total_tokens: 40,
					},
				},
			})}`,
			"data: [DONE]",
		]);

		const parsed = await parseUsageFromSse(response, {
			mode: "full",
		});

		expect(parsed.usage).toEqual({
			promptTokens: 11,
			completionTokens: 29,
			totalTokens: 40,
		});
		expect(parsed.bytesRead).toBeGreaterThan(96 * 1024);
		expect(parsed.eventsSeen).toBe(2);
		expect(parsed.timedOut).toBe(false);
	});
});
