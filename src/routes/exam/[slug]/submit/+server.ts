import {
	error,
	json
} from '@sveltejs/kit';

import type {
	RequestHandler
} from './$types';
import type {
	ExamAnswers
} from '$lib/types/quiz';

import {
	getQuestionBankBySlug
} from '$lib/server/quiz/bank.repository';
import {
	ExamAttemptError,
	submitUserExamAttempt
} from '$lib/server/quiz/exam-attempt.service';
import {
	ExamError,
	gradeExam
} from '$lib/server/quiz/exam.service';

function parseAnswers(
	value: unknown
): ExamAnswers | null {
	if (
		typeof value !== 'object' ||
		value === null ||
		Array.isArray(value)
	) {
		return null;
	}

	const answers: ExamAnswers = {};

	for (const [questionId, optionId] of Object.entries(value)) {
		if (!questionId) {
			return null;
		}

		if (optionId !== null && typeof optionId !== 'string') {
			return null;
		}

		answers[questionId] = optionId;
	}

	return answers;
}

export const POST: RequestHandler = async ({
	params,
	request,
	locals
}) => {
	const bank = await getQuestionBankBySlug(params.slug);

	if (!bank) {
		error(404, '找不到指定的題庫');
	}

	let body: {
		answers?: unknown;
		startedAt?: unknown;
		attemptId?: unknown;
	};

	try {
		body = await request.json();
	} catch {
		error(400, '作答資料格式錯誤');
	}

	const answers = parseAnswers(body.answers);

	if (!answers) {
		error(400, '作答資料格式錯誤');
	}

	try {
		if (locals.user) {
			if (
				typeof body.attemptId !== 'string' ||
				!body.attemptId
			) {
				error(
					400,
					'考試紀錄識別碼格式錯誤'
				);
			}

			const result = await submitUserExamAttempt({
				attemptId: body.attemptId,
				userId: locals.user.id,
				bankId: bank.id,
				answers
			});

			return json({
				result,
				persisted: true
			});
		}

		if (typeof body.startedAt !== 'number') {
			error(400, '考試開始時間格式錯誤');
		}

		const result = await gradeExam(
			bank.id,
			answers,
			body.startedAt
		);

		return json({
			result,
			persisted: false
		});
	} catch (caught) {
		if (caught instanceof ExamError) {
			error(caught.status, caught.message);
		}

		if (caught instanceof ExamAttemptError) {
			error(caught.status, caught.message);
		}

		throw caught;
	}
};
