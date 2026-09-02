import {
	describe,
	expect,
	it
} from 'vitest';

import {
	parseCodexUsage
} from './chatgpt';

describe('parseCodexUsage', () => {
	it('parses Codex backend rate-limit windows', () => {
		const usage = parseCodexUsage({
			rate_limit: {
				primary_window: {
					used_percent: 42,
					limit_window_seconds: 18_000,
					reset_at: 2_000_000_000
				},
				secondary_window: {
					used_percent: 68.5,
					limit_window_seconds: 604_800,
					reset_at: 2_000_010_000
				}
			}
		});

		expect(usage.primary).toEqual({
			usedPercent: 42,
			windowMinutes: 300,
			resetsAt: new Date(
				2_000_000_000 * 1000
			).toISOString()
		});
		expect(usage.secondary).toEqual({
			usedPercent: 68.5,
			windowMinutes: 10_080,
			resetsAt: new Date(
				2_000_010_000 * 1000
			).toISOString()
		});
	});

	it('parses a codex entry from a rate-limit collection', () => {
		const usage = parseCodexUsage({
			rate_limits_by_limit_id: {
				codex: {
					primary: {
						usedPercent: 12.5,
						windowMinutes: 60,
						resetAt: 2_000_000_000
					}
				}
			}
		});

		expect(usage.primary).toMatchObject({
			usedPercent: 12.5,
			windowMinutes: 60
		});
		expect(usage.secondary).toBeNull();
	});

	it('rejects payloads without rate-limit windows', () => {
		expect(() => parseCodexUsage({}))
			.toThrow(
				'Codex usage response does not contain rate-limit windows'
			);
	});
});
