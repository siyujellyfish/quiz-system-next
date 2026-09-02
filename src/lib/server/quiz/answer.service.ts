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
	PracticeQuestionState,
	PublicQuizQuestion,
	QuizAnswerResult,
	UserPracticeAnswerResult
} from '$lib/types/quiz';


import {
	getPracticeAnswerProgress,
	getPracticeQuestionStateAtIndex
} from './practice.repository';


import {
	getPublicPracticeQuestion
} from './question.service';


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


type NextPracticeQuestion = {
	currentIndex: number;
	question: PublicQuizQuestion;
};


async function findNextPracticeQuestion(
	userId: string,
	bankId: string,
	totalQuestions: number,
	startIndex: number,
	initialQuestionState:
		PracticeQuestionState | null
): Promise<NextPracticeQuestion | null> {
	for (
		let currentIndex = startIndex;
		currentIndex < totalQuestions;
		currentIndex++
	) {
		const questionState =
			currentIndex === startIndex
				? initialQuestionState
				: await getPracticeQuestionStateAtIndex(
					userId,
					bankId,
					currentIndex
				);

		if (!questionState) {
			continue;
		}

		const question =
			await getPublicPracticeQuestion(
				bankId,
				questionState.questionId,
				questionState.optionIds
			);

		if (!question) {
			continue;
		}

		return {
			currentIndex,
			question
		};
	}

	return null;
}


export async function checkQuestionAnswer(
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
	return checkQuestionAnswer(
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
): Promise<UserPracticeAnswerResult> {
	const progress =
		await getPracticeAnswerProgress(
			userId,
			bankId
		);

	if (!progress) {
		throw new PracticeAnswerError(
			409,
			'目前沒有進行中的練習'
		);
	}

	const questionState =
		progress.questionState;

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

	const [
		result,
		next
	] = await Promise.all([
		checkQuestionAnswer(
			bankId,
			questionId,
			selectedOptionId
		),
		findNextPracticeQuestion(
			userId,
			bankId,
			progress.totalQuestions,
			progress.currentIndex + 1,
			progress.nextQuestionState
		)
	]);

	const answeredCount =
		progress.answeredCount + 1;

	const correctCount =
		progress.correctCount +
		(result.correct ? 1 : 0);

	const nextIndex =
		next?.currentIndex ??
		progress.totalQuestions;

	const completed = next === null;

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
				const deleted = await tx
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
					)
					.returning({
						userId:
							practiceProgress.userId
					});

				if (deleted.length === 0) {
					throw new PracticeAnswerError(
						409,
						'練習進度已被其他操作更新，請重新整理後再試'
					);
				}

				return;
			}

			const updated = await tx
				.update(practiceProgress)
				.set({
					currentIndex: nextIndex,
					answeredCount,
					correctCount
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
				)
				.returning({
					currentIndex:
						practiceProgress.currentIndex
				});

			if (updated.length === 0) {
				throw new PracticeAnswerError(
					409,
					'練習進度已被其他操作更新，請重新整理後再試'
				);
			}
		}
	);

	return {
		...result,
		completed,
		currentIndex: nextIndex,
		answeredCount,
		correctCount,
		nextQuestion:
			next?.question ?? null
	};
}
