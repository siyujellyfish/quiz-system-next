import type {
	PracticeConfig,
	PracticeQuestionState,
	PracticeQuestionsState
} from '$lib/types/quiz';


import {
	getPracticeOptionRows,
	getPracticeQuestionIds,
	getPracticeSourceRows,
	replacePracticeProgress
} from './practice.repository';


import {
	shuffle
} from './shuffle';


type QuestionSource = {
	questionId: string;
	optionIds: string[];
};


export class PracticeStateError extends Error {
	constructor(message: string) {
		super(message);

		this.name =
			'PracticeStateError';
	}
}


export async function startPractice(
	userId: string,
	bankId: string,
	config: PracticeConfig
): Promise<PracticeQuestionsState> {
	const questionsState =
		await generatePracticeState(
			bankId,
			config
		);

	await replacePracticeProgress(
		userId,
		bankId,
		questionsState
	);

	return questionsState;
}


export async function generatePracticeState(
	bankId: string,
	config: PracticeConfig
): Promise<PracticeQuestionsState> {
	const allQuestions =
		config.coverage === 100
			? await loadAllQuestionSources(
				bankId
			)
			: await loadSampledQuestionSources(
				bankId,
				config.coverage
			);

	if (allQuestions.length === 0) {
		throw new PracticeStateError(
			'此題庫沒有可供練習的題目'
		);
	}

	const selectedQuestions =
		config.coverage === 100
			? shuffle(allQuestions)
			: allQuestions;

	const questions:
		PracticeQuestionState[] =
		selectedQuestions.map(
			(question) => ({
				questionId:
					question.questionId,

				optionIds:
					config.shuffleOptions
						? shuffle(
							question.optionIds
						)
						: [
							...question.optionIds
						]
			})
		);

	return {
		version: 1,
		coverage:
			config.coverage,
		shuffleOptions:
			config.shuffleOptions,
		questions
	};
}


async function loadAllQuestionSources(
	bankId: string
): Promise<QuestionSource[]> {
	const rows =
		await getPracticeSourceRows(
			bankId
		);

	return groupQuestionSources(rows);
}


async function loadSampledQuestionSources(
	bankId: string,
	coverage: Exclude<
		PracticeConfig['coverage'],
		100
	>
): Promise<QuestionSource[]> {
	const questionIds =
		await getPracticeQuestionIds(
			bankId
		);

	if (questionIds.length === 0) {
		return [];
	}

	const questionCount =
		calculateQuestionCount(
			questionIds.length,
			coverage
		);

	const selectedQuestionIds =
		shuffle(questionIds)
			.slice(
				0,
				questionCount
			);

	const rows =
		await getPracticeOptionRows(
			selectedQuestionIds
		);

	const sourceMap = new Map(
		groupQuestionSources(rows)
			.map(
				(question) => [
					question.questionId,
					question
				] as const
			)
	);

	return selectedQuestionIds
		.map(
			(questionId) =>
				sourceMap.get(questionId)
		)
		.filter(
			(question): question is QuestionSource =>
				question !== undefined
		);
}


function groupQuestionSources(
	rows: Array<{
		questionId: string;
		optionId: string;
	}>
): QuestionSource[] {
	const questionMap =
		new Map<string, QuestionSource>();

	for (const row of rows) {
		const existing =
			questionMap.get(
				row.questionId
			);

		if (existing) {
			existing.optionIds.push(
				row.optionId
			);

			continue;
		}

		questionMap.set(
			row.questionId,
			{
				questionId:
					row.questionId,

				optionIds: [
					row.optionId
				]
			}
		);
	}

	return [
		...questionMap.values()
	];
}


function calculateQuestionCount(
	totalQuestions: number,
	coverage: PracticeConfig['coverage']
): number {
	return Math.min(
		totalQuestions,
		Math.max(
			1,
			Math.ceil(
				totalQuestions *
				coverage /
				100
			)
		)
	);
}
