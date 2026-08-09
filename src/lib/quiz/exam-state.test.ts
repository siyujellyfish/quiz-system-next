import {
	describe,
	expect,
	it
} from 'vitest';

import {
	parseExamSession
} from './exam-state';


const activeSession = {
	version: 1,
	startedAt: 1_700_000_000_000,
	currentIndex: 0,
	questions: [
		{
			id: 'question-1',
			prompt: 'Question?',
			options: [
				{
					id: 'option-1',
					content: 'A'
				},
				{
					id: 'option-2',
					content: 'B'
				}
			]
		}
	],
	answers: {
		'question-1': null
	},
	result: null
};


describe('parseExamSession', () => {
	it('restores an unfinished exam session', () => {
		expect(
			parseExamSession(activeSession)
		).toEqual(activeSession);
	});

	it('rejects a completed exam session', () => {
		expect(
			parseExamSession({
				...activeSession,
				result: {
					totalQuestions: 1,
					answeredCount: 0,
					unansweredCount: 1,
					correctCount: 0,
					incorrectCount: 1,
					accuracy: 0,
					elapsedSeconds: 3,
					questions: [
						{
							questionId: 'question-1',
							selectedOptionId: null,
							correctOptionIds: [
								'option-1'
							],
							correct: false
						}
					]
				}
			})
		).toBeNull();
	});
});
