import {
	asc,
	eq
} from 'drizzle-orm';


import {
	db
} from '$lib/server/db';


import {
	questionOptions,
	questions
} from '$lib/server/db/schema';


import type {
	ExamAnswers,
	ExamResult,
	PublicQuizQuestion
} from '$lib/types/quiz';


import {
	shuffle
} from './shuffle';


type ExamSourceQuestion = {
	id: string;
	prompt: string;
	options: Array<{
		id: string;
		content: string;
		isCorrect: boolean;
	}>;
};


export class ExamError extends Error {
	status: number;

	constructor(
		status: number,
		message: string
	) {
		super(message);
		this.name = 'ExamError';
		this.status = status;
	}
}


async function getExamSourceQuestions(
	bankId: string
): Promise<ExamSourceQuestion[]> {
	const rows = await db
		.select({
			questionId: questions.id,
			prompt: questions.prompt,
			optionId: questionOptions.id,
			optionContent: questionOptions.content,
			isCorrect: questionOptions.isCorrect
		})
		.from(questions)
		.innerJoin(
			questionOptions,
			eq(
				questionOptions.questionId,
				questions.id
			)
		)
		.where(
			eq(
				questions.bankId,
				bankId
			)
		)
		.orderBy(
			asc(questions.id),
			asc(questionOptions.position)
		);

	const questionMap =
		new Map<string, ExamSourceQuestion>();

	for (const row of rows) {
		const existing =
			questionMap.get(
				row.questionId
			);

		if (existing) {
			existing.options.push({
				id: row.optionId,
				content: row.optionContent,
				isCorrect: row.isCorrect
			});

			continue;
		}

		questionMap.set(
			row.questionId,
			{
				id: row.questionId,
				prompt: row.prompt,
				options: [{
					id: row.optionId,
					content: row.optionContent,
					isCorrect: row.isCorrect
				}]
			}
		);
	}

	return [
		...questionMap.values()
	];
}


function assertValidExamQuestions(
	questions: ExamSourceQuestion[]
): void {
	if (questions.length === 0) {
		throw new ExamError(
			400,
			'此題庫沒有可供考試的題目'
		);
	}

	for (const question of questions) {
		const correctCount =
			question.options.filter(
				(option) => option.isCorrect
			).length;

		if (correctCount !== 1) {
			throw new ExamError(
				409,
				'題庫包含正確答案設定異常的題目'
			);
		}
	}
}


export async function createExamQuestions(
	bankId: string
): Promise<PublicQuizQuestion[]> {
	const source =
		await getExamSourceQuestions(
			bankId
		);

	assertValidExamQuestions(source);

	return shuffle(source).map(
		(question) => ({
			id: question.id,
			prompt: question.prompt,
			options: shuffle(
				question.options
			).map(
				(option) => ({
					id: option.id,
					content: option.content
				})
			)
		})
	);
}


export async function gradeExam(
	bankId: string,
	answers: ExamAnswers,
	startedAt: number,
	endedAt = Date.now()
): Promise<ExamResult> {
	const source =
		await getExamSourceQuestions(
			bankId
		);

	assertValidExamQuestions(source);

	const now = Date.now();

	if (
		!Number.isFinite(startedAt) ||
		startedAt <= 0 ||
		startedAt > now + 60_000
	) {
		throw new ExamError(
			400,
			'考試開始時間無效'
		);
	}

	if (
		!Number.isFinite(endedAt) ||
		endedAt < startedAt ||
		endedAt > now + 60_000
	) {
		throw new ExamError(
			400,
			'考試結束時間無效'
		);
	}

	let answeredCount = 0;
	let correctCount = 0;

	const questionResults =
		source.map(
			(question) => {
				const selectedOptionId =
					answers[question.id] ??
					null;

				const correctOptionIds =
					question.options
						.filter(
							(option) =>
								option.isCorrect
						)
						.map(
							(option) => option.id
						);

				if (selectedOptionId) {
					const selectedExists =
						question.options.some(
							(option) =>
								option.id ===
									selectedOptionId
						);

					if (!selectedExists) {
						throw new ExamError(
							400,
							'作答資料包含不屬於題目的選項'
						);
					}

					answeredCount++;
				}

				const correct =
					selectedOptionId !== null &&
					correctOptionIds.includes(
						selectedOptionId
					);

				if (correct) {
					correctCount++;
				}

				return {
					questionId: question.id,
					selectedOptionId,
					correctOptionIds,
					correct
				};
			}
		);

	const totalQuestions =
		source.length;

	const unansweredCount =
		totalQuestions -
		answeredCount;

	const incorrectCount =
		totalQuestions -
		correctCount;

	return {
		totalQuestions,
		answeredCount,
		unansweredCount,
		correctCount,
		incorrectCount,
		accuracy:
			totalQuestions === 0
				? 0
				: correctCount /
					totalQuestions *
					100,
		elapsedSeconds:
			Math.max(
				0,
				Math.floor(
					(endedAt - startedAt) /
						1000
				)
			),
		questions:
			questionResults
	};
}
