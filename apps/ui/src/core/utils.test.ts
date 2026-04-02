import { describe, expect, it } from "vitest";

import { buildUsageStatusDetail } from "./utils";

describe("buildUsageStatusDetail", () => {
	it("returns warning tone for warn usage rows", () => {
		expect(
			buildUsageStatusDetail({
				id: "1",
				model: null,
				channel_id: null,
				token_id: null,
				total_tokens: null,
				latency_ms: null,
				status: "warn",
				upstream_status: 200,
				created_at: "2026-01-01T00:00:00.000Z",
			}),
		).toEqual({
			label: "200",
			tone: "warning",
		});
	});

	it("returns danger tone for error rows", () => {
		expect(
			buildUsageStatusDetail({
				id: "2",
				model: null,
				channel_id: null,
				token_id: null,
				total_tokens: null,
				latency_ms: null,
				status: "error",
				error_code: "upstream_http_500",
				upstream_status: 500,
				created_at: "2026-01-01T00:00:00.000Z",
			}),
		).toEqual({
			label: "500",
			tone: "danger",
		});
	});
});
