import {
	and,
	eq
} from 'drizzle-orm';


import {
	db
} from '$lib/server/db';


import {
	practiceProgress,
	questionOptions,
	questions,
	userWrongQuestions
} from '$lib/server/db/schema';


import type {
	QuizAnswerResult
} from '$lib/types/quiz';


export class PracticeAnswerError extends Error {
	status: number;

	constructor(
		status: number,
		message: string
	) {
		super(message);
		this.name = 'PracticeAnswerError';
		this.status = status;
	}
}


async function checkAnswer(
	bankId: string,
	questionId: string,
	selectedOptionId: string
): Promise<QuizAnswerResult> {
	const options =
		await db
			.select({
				id: questionOptions.id,
				isCorrect: questionOptions.isCorrect
			})
			.from(questionOptions)
			.innerJoin(
				questions,
				and(
					eq(
						questions.id,
						questionOptions.questionId
					),
					eq(
						questions.bankId,
						bankId
					)
				)
			)
			.where(
				eq(
					questionOptions.questionId,
					questionId
				)
			);

	if (options.length === 0) {
		throw new PracticeAnswerError(
			404,
			'找不到指定的題目'
		);
	}

	const selectedOption =
		options.find(
			(option) =>
				option.id === selectedOptionId
		);

	if (!selectedOption) {
		throw new PracticeAnswerError(
			400,
			'選項不屬於目前題目'
		);
	}

	const correctOptionIds =
		options
			.filter(
				(option) => option.isCorrect
			)
			.map(
				(option) => option.id
			);

	if (correctOptionIds.length !== 1) {
		throw new PracticeAnswerError(
			409,
			'題目正確答案設定異常'
		);
	}

	return {
		selectedOptionId,
		correct:
			selectedOption.isCorrect,
		correctOptionIds,
		completed: false
	};
}


export async function answerGuestPracticeQuestion(
	bankId: string,
	questionId: string,
	selectedOptionId: string
): Promise<QuizAnswerResult> {
	return checkAnswer(
		bankId,
		questionId,
		selectedOptionId
	);
}


export async function answerUserPracticeQuestion(
	userId: string,
	bankId: string,
	questionId: string,
	selectedOptionId: string
): Promise<QuizAnswerResult> {
	const [progress] =
		await db
			.select()
			.from(practiceProgress)
			.where(
				and(
					eq(
						practiceProgress.userId,
						userId
					),
					eq(
						practiceProgress.bankId,
						bankId
					)
				)
			)
			.limit(1);

	if (!progress) {
		throw new PracticeAnswerError(
			409,
			'目前沒有進行中的練習'
		);
	}

	const questionState =
		progress.questionsState
			.questions[
				progress.currentIndex
			];

	if (
		!questionState ||
		questionState.questionId !==
			questionId
	) {
		throw new PracticeAnswerError(
			409,
			'作答題目與目前練習進度不一致'
		);
	}

	if (
		!questionState.optionIds.includes(
			selectedOptionId
		)
	) {
		throw new PracticeAnswerError(
			400,
			'選項不屬於目前練習題目'
		);
	}

	const result =
		await checkAnswer(
			bankId,
			questionId,
			selectedOptionId
		);

	const nextIndex =
		progress.currentIndex + 1;

	const completed =
		nextIndex >=
		progress.questionsState
			.questions.length;

	await db.transaction(
		async (tx) => {
			if (!result.correct) {
				await tx
					.insert(userWrongQuestions)
					.values({
						userId,
						questionId
					})
					.onConflictDoNothing();
			}

			if (completed) {
				await tx
					.delete(practiceProgress)
					.where(
						and(
							eq(
								practiceProgress.userId,
								userId
							),
							eq(
								practiceProgress.bankId,
								bankId
							),
							eq(
								practiceProgress.currentIndex,
								progress.currentIndex
							)
						)
					);

				return;
			}

			await tx
				.update(practiceProgress)
				.set({
					currentIndex: nextIndex
				})
				.where(
					and(
						eq(
							practiceProgress.userId,
							userId
						),
						eq(
							practiceProgress.bankId,
							bankId
						),
						eq(
							practiceProgress.currentIndex,
							progress.currentIndex
						)
					)
				);
		}
	);

	return {
		...result,
		completed
	};
}
