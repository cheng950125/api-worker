import { describe, expect, it } from "vitest";
import {
	buildProxyErrorCodeSet,
	buildProxyErrorLookupKeys,
	resolveProxyErrorAction,
} from "./proxy-error-policy";

describe("proxy-error-policy", () => {
	it("maps pond_hub no-available-channel failures to model_not_found", () => {
		expect(
			buildProxyErrorLookupKeys(
				"pond_hub_error",
				"no available channel for requested model",
			),
		).toEqual(["model_not_found", "pond_hub_error"]);
	});

	it("prioritizes return over disable and sleep", () => {
		const action = resolveProxyErrorAction(
			{
				sleepErrorCodeSet: buildProxyErrorCodeSet([
					"stream_options_unsupported",
				]),
				disableErrorCodeSet: buildProxyErrorCodeSet([
					"stream_options_unsupported",
				]),
				returnErrorCodeSet: buildProxyErrorCodeSet([
					"stream_options_unsupported",
				]),
			},
			"stream_options_unsupported",
			null,
		);
		expect(action).toBe("return");
	});

	it("returns disable for direct channel issues", () => {
		const action = resolveProxyErrorAction(
			{
				sleepErrorCodeSet: new Set(),
				disableErrorCodeSet: buildProxyErrorCodeSet(["model_not_found"]),
				returnErrorCodeSet: new Set(),
			},
			"model_not_found",
			null,
		);
		expect(action).toBe("disable");
	});

	it("returns sleep only for configured wait codes", () => {
		const action = resolveProxyErrorAction(
			{
				sleepErrorCodeSet: buildProxyErrorCodeSet(["system_cpu_overloaded"]),
				disableErrorCodeSet: new Set(),
				returnErrorCodeSet: new Set(),
			},
			"system_cpu_overloaded",
			null,
		);
		expect(action).toBe("sleep");
	});

	it("returns retry for unmatched errors", () => {
		const action = resolveProxyErrorAction(
			{
				sleepErrorCodeSet: new Set(),
				disableErrorCodeSet: new Set(),
				returnErrorCodeSet: new Set(),
			},
			"proxy_upstream_fetch_exception",
			null,
		);
		expect(action).toBe("retry");
	});
});
