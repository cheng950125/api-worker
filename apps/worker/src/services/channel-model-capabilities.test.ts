import { describe, expect, it } from "vitest";
import { resolveChannelDisableState } from "./channel-model-capabilities";

describe("resolveChannelDisableState", () => {
	it("temporarily disables the channel before the threshold is reached", () => {
		expect(
			resolveChannelDisableState(
				1,
				{
					disableDurationSeconds: 600,
					disableThreshold: 3,
				},
				1_700_000_000,
			),
		).toEqual({
			channelTempDisabled: true,
			channelDisabled: false,
			autoDisabledUntil: 1_700_000_600,
		});
	});

	it("disables the channel once the threshold is reached", () => {
		expect(
			resolveChannelDisableState(
				3,
				{
					disableDurationSeconds: 600,
					disableThreshold: 3,
				},
				1_700_000_000,
			),
		).toEqual({
			channelTempDisabled: false,
			channelDisabled: true,
			autoDisabledUntil: null,
		});
	});

	it("keeps the channel active when temporary disable duration is zero", () => {
		expect(
			resolveChannelDisableState(
				1,
				{
					disableDurationSeconds: 0,
					disableThreshold: 3,
				},
				1_700_000_000,
			),
		).toEqual({
			channelTempDisabled: false,
			channelDisabled: false,
			autoDisabledUntil: null,
		});
	});
});
