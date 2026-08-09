import type {
	GuestPracticeSession,
	PracticeQuestionsState
} from '$lib/types/quiz';


export function isPracticeQuestionsState(
	value: unknown
): value is PracticeQuestionsState {
	if (
		typeof value !== 'object' ||
		value === null
	) {
		return false;
	}

	const state =
		value as Record<
			string,
			unknown
		>;

	if (state.version !== 1) {
		return false;
	}

	if (
		state.coverage !== 30 &&
		state.coverage !== 50 &&
		state.coverage !== 100
	) {
		return false;
	}

	if (
		typeof state.shuffleOptions !==
			'boolean'
	) {
		return false;
	}

	if (!Array.isArray(state.questions)) {
		return false;
	}

	return state.questions.every(
		(question) => {
			if (
				typeof question !==
					'object' ||
				question === null
			) {
				return false;
			}

			const item =
				question as Record<
					string,
					unknown
				>;

			return (
				typeof item.questionId ===
					'string' &&
				item.questionId.length > 0 &&
				Array.isArray(
					item.optionIds
				) &&
				item.optionIds.length > 0 &&
				item.optionIds.every(
					(optionId) =>
						typeof optionId ===
							'string' &&
						optionId.length > 0
				)
			);
		}
	);
}


function parseCount(
	value: unknown
): number | null {
	if (
		typeof value !== 'number' ||
		!Number.isInteger(value) ||
		value < 0
	) {
		return null;
	}

	return value;
}


export function parseGuestPracticeSession(
	value: unknown
): GuestPracticeSession | null {
	/*
	 * 舊版本直接把 PracticeQuestionsState 存入
	 * sessionStorage。保留相容性，統計從 0 開始。
	 */
	if (isPracticeQuestionsState(value)) {
		return {
			questionsState: value,
			currentIndex: 0,
			answeredCount: 0,
			correctCount: 0
		};
	}

	if (
		typeof value !== 'object' ||
		value === null
	) {
		return null;
	}

	const session =
		value as Record<
			string,
			unknown
		>;

	if (
		!isPracticeQuestionsState(
			session.questionsState
		)
	) {
		return null;
	}

	const currentIndex =
		parseCount(
			session.currentIndex
		);

	if (
		currentIndex === null ||
		currentIndex >
			session.questionsState
				.questions.length
	) {
		return null;
	}

	/*
	 * 相容上一個 phase 已有 currentIndex、
	 * 但尚未保存正確率統計的 Guest session。
	 */
	const answeredCount =
		session.answeredCount === undefined
			? 0
			: parseCount(
				session.answeredCount
			);

	const correctCount =
		session.correctCount === undefined
			? 0
			: parseCount(
				session.correctCount
			);

	if (
		answeredCount === null ||
		correctCount === null ||
		correctCount > answeredCount
	) {
		return null;
	}

	return {
		questionsState:
			session.questionsState,
		currentIndex,
		answeredCount,
		correctCount
	};
}
