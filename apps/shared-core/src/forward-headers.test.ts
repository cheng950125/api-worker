import { describe, expect, it } from "vitest";
import { sanitizeUpstreamRequestHeaders } from "./forward-headers";

describe("sanitizeUpstreamRequestHeaders", () => {
	it("removes hop-by-hop headers including expect 100-continue", () => {
		const headers = new Headers({
			authorization: "Bearer test",
			connection: "keep-alive, x-debug-token",
			"content-type": "application/json",
			expect: "100-continue",
			"keep-alive": "timeout=5",
			te: "trailers",
			"x-debug-token": "secret",
			"x-request-id": "req_123",
		});

		const sanitized = sanitizeUpstreamRequestHeaders(headers);

		expect(sanitized.get("authorization")).toBe("Bearer test");
		expect(sanitized.get("content-type")).toBe("application/json");
		expect(sanitized.get("x-request-id")).toBe("req_123");
		expect(sanitized.has("connection")).toBe(false);
		expect(sanitized.has("expect")).toBe(false);
		expect(sanitized.has("keep-alive")).toBe(false);
		expect(sanitized.has("te")).toBe(false);
		expect(sanitized.has("x-debug-token")).toBe(false);
	});
});
