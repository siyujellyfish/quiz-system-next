import type {
	PracticeConfig,
	PracticeQuestionState,
	PracticeQuestionsState
} from '$lib/types/quiz';


import {
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
	const rows =
		await getPracticeSourceRows(
			bankId
		);

	if (rows.length === 0) {
		throw new PracticeStateError(
			'此題庫沒有可供練習的題目'
		);
	}

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

	const allQuestions = [
		...questionMap.values()
	];

	const questionCount =
		calculateQuestionCount(
			allQuestions.length,
			config.coverage
		);

	const selectedQuestions =
		shuffle(allQuestions)
			.slice(
				0,
				questionCount
			);

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