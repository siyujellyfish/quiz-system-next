import type {
	ExamResult,
	ExamSession,
	PublicQuizQuestion
} from '$lib/types/quiz';


function isPublicQuizQuestion(
	value: unknown
): value is PublicQuizQuestion {
	if (
		typeof value !== 'object' ||
		value === null
	) {
		return false;
	}

	const question =
		value as Record<string, unknown>;

	if (
		typeof question.id !== 'string' ||
		!question.id ||
		typeof question.prompt !== 'string' ||
		!Array.isArray(question.options) ||
		question.options.length === 0
	) {
		return false;
	}

	return question.options.every(
		(option) => {
			if (
				typeof option !== 'object' ||
				option === null
			) {
				return false;
			}

			const item =
				option as Record<string, unknown>;

			return (
				typeof item.id === 'string' &&
				item.id.length > 0 &&
				typeof item.content === 'string'
			);
		}
	);
}


function isExamResult(
	value: unknown
): value is ExamResult {
	if (
		typeof value !== 'object' ||
		value === null
	) {
		return false;
	}

	const result =
		value as Record<string, unknown>;

	const numericKeys = [
		'totalQuestions',
		'answeredCount',
		'unansweredCount',
		'correctCount',
		'incorrectCount',
		'accuracy',
		'elapsedSeconds'
	];

	if (
		!numericKeys.every(
			(key) =>
				typeof result[key] ===
					'number'
		) ||
		!Array.isArray(result.questions)
	) {
		return false;
	}

	return result.questions.every(
		(question) => {
			if (
				typeof question !== 'object' ||
				question === null
			) {
				return false;
			}

			const item =
				question as Record<string, unknown>;

			return (
				typeof item.questionId === 'string' &&
				(
					item.selectedOptionId === null ||
					typeof item.selectedOptionId ===
						'string'
				) &&
				Array.isArray(
					item.correctOptionIds
				) &&
				item.correctOptionIds.every(
					(optionId) =>
						typeof optionId ===
							'string'
				) &&
				typeof item.correct === 'boolean'
			);
		}
	);
}


export function parseExamSession(
	value: unknown
): ExamSession | null {
	if (
		typeof value !== 'object' ||
		value === null
	) {
		return null;
	}

	const session =
		value as Record<string, unknown>;

	if (
		session.version !== 1 ||
		typeof session.startedAt !== 'number' ||
		!Number.isFinite(session.startedAt) ||
		typeof session.currentIndex !== 'number' ||
		!Number.isInteger(session.currentIndex) ||
		session.currentIndex < 0 ||
		!Array.isArray(session.questions) ||
		session.questions.length === 0 ||
		!session.questions.every(
			isPublicQuizQuestion
		) ||
		session.currentIndex >=
			session.questions.length ||
		typeof session.answers !== 'object' ||
		session.answers === null ||
		Array.isArray(session.answers)
	) {
		return null;
	}

	const answers: Record<
		string,
		string | null
	> = {};

	for (const [questionId, optionId] of
		Object.entries(session.answers)) {
		if (
			optionId !== null &&
			typeof optionId !== 'string'
		) {
			return null;
		}

		answers[questionId] = optionId;
	}

	if (
		session.result !== null &&
		!isExamResult(session.result)
	) {
		return null;
	}

	return {
		version: 1,
		startedAt: session.startedAt,
		currentIndex: session.currentIndex,
		questions:
			session.questions as PublicQuizQuestion[],
		answers,
		result:
			session.result as ExamResult | null
	};
}
