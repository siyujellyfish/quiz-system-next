import {
	describe,
	expect,
	it
} from 'vitest';

import {
	issueAiContextToken,
	verifyAiContextToken
} from './context-token';

describe('AskAI context token', () => {
	const sessionTokenHash = 'a'.repeat(64);
	const otherSessionTokenHash = 'b'.repeat(64);
	const userId = 'user-1';
	const questionId = 'question-1';
	const now = 1_800_000_000_000;

	it('verifies a token for the same session, user and question', () => {
		const token = issueAiContextToken({
			sessionTokenHash,
			userId,
			questionId,
			selectedOptionId: 'option-1',
			mode: 'practice',
			now
		});

		expect(
			verifyAiContextToken({
				token,
				sessionTokenHash,
				userId,
				questionId,
				now: now + 1000
			})
		).toMatchObject({
			userId,
			questionId,
			selectedOptionId: 'option-1',
			mode: 'practice'
		});
	});

	it('rejects another session, user or question', () => {
		const token = issueAiContextToken({
			sessionTokenHash,
			userId,
			questionId,
			selectedOptionId: null,
			mode: 'exam',
			examAttemptId: 'attempt-1',
			now
		});

		expect(
			verifyAiContextToken({
				token,
				sessionTokenHash:
					otherSessionTokenHash,
				userId,
				questionId,
				now: now + 1000
			})
		).toBeNull();

		expect(
			verifyAiContextToken({
				token,
				sessionTokenHash,
				userId: 'user-2',
				questionId,
				now: now + 1000
			})
		).toBeNull();

		expect(
			verifyAiContextToken({
				token,
				sessionTokenHash,
				userId,
				questionId: 'question-2',
				now: now + 1000
			})
		).toBeNull();
	});

	it('rejects an expired token', () => {
		const token = issueAiContextToken({
			sessionTokenHash,
			userId,
			questionId,
			selectedOptionId: 'option-1',
			mode: 'wrong',
			now
		});

		expect(
			verifyAiContextToken({
				token,
				sessionTokenHash,
				userId,
				questionId,
				now:
					now + 13 * 60 * 60 * 1000
			})
		).toBeNull();
	});
});
