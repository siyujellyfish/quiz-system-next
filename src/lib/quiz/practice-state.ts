import type {
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

	if (
		state.version !== 1
	) {
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

	if (
		!Array.isArray(
			state.questions
		)
	) {
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
				Array.isArray(
					item.optionIds
				) &&
				item.optionIds.every(
					(optionId) =>
						typeof optionId ===
							'string'
				)
			);
		}
	);
}