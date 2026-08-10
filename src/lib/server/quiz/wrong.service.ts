import type {
	PublicQuizQuestion,
	WrongAnswerResult
} from '$lib/types/quiz';


import {
	checkQuestionAnswer,
	PracticeAnswerError
} from './answer.service';


import {
	getQuestionByIdAndBank,
	getQuestionOptions
} from './question.repository';


import {
	deleteWrongQuestion,
	deleteWrongQuestionsByBank,
	getWrongQuestionIds,
	hasWrongQuestion
} from './wrong.repository';


import {
	shuffle
} from './shuffle';


export type WrongQuestionView = {
	remainingCount: number;
	question: PublicQuizQuestion | null;
};


export async function getWrongQuestionView(
	userId: string,
	bankId: string,
	excludeQuestionId?: string | null
): Promise<WrongQuestionView> {
	const questionIds =
		await getWrongQuestionIds(
			userId,
			bankId
		);

	const remainingCount =
		questionIds.length;

	if (remainingCount === 0) {
		return {
			remainingCount: 0,
			question: null
		};
	}

	let candidates =
		shuffle(questionIds);

	if (
		excludeQuestionId &&
		candidates.length > 1
	) {
		candidates =
			candidates.filter(
				(questionId) =>
					questionId !==
						excludeQuestionId
			);
	}

	for (const questionId of candidates) {
		const question =
			await getQuestionByIdAndBank(
				questionId,
				bankId
			);

		if (!question) {
			continue;
		}

		const options =
			await getQuestionOptions(
				questionId
			);

		if (options.length === 0) {
			continue;
		}

		return {
			remainingCount,
			question: {
				id: question.id,
				prompt: question.prompt,
				options:
					shuffle(options).map(
						(option) => ({
							id: option.id,
							content:
								option.content
						})
					)
			}
		};
	}

	return {
		remainingCount: 0,
		question: null
	};
}


export async function answerWrongQuestion(
	userId: string,
	bankId: string,
	questionId: string,
	selectedOptionId: string
): Promise<WrongAnswerResult> {
	const isWrongQuestion =
		await hasWrongQuestion(
			userId,
			bankId,
			questionId
		);

	if (!isWrongQuestion) {
		throw new PracticeAnswerError(
			409,
			'此題已不在目前的錯題集合中'
		);
	}

	const result =
		await checkQuestionAnswer(
			bankId,
			questionId,
			selectedOptionId
		);

	if (result.correct) {
		await deleteWrongQuestion(
			userId,
			questionId
		);
	}

	const remainingCount =
		(
			await getWrongQuestionIds(
				userId,
				bankId
			)
		).length;

	return {
		...result,
		completed:
			remainingCount === 0,
		remainingCount
	};
}


export async function clearWrongQuestions(
	userId: string,
	bankId: string
): Promise<number> {
	return deleteWrongQuestionsByBank(
		userId,
		bankId
	);
}
