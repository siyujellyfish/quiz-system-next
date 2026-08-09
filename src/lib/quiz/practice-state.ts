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


export function parseGuestPracticeSession(
	value: unknown
): GuestPracticeSession | null {
	/*
	 * 舊 phase 曾直接把 PracticeQuestionsState
	 * 存入 sessionStorage。保留向後相容並自動視為 index 0。
	 */
	if (isPracticeQuestionsState(value)) {
		return {
			questionsState: value,
			currentIndex: 0
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

	if (
		typeof session.currentIndex !==
			'number' ||
		!Number.isInteger(
			session.currentIndex
		) ||
		session.currentIndex < 0 ||
		session.currentIndex >
			session.questionsState
				.questions.length
	) {
		return null;
	}

	return {
		questionsState:
			session.questionsState,
		currentIndex:
			session.currentIndex
	};
}
