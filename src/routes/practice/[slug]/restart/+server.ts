import {
	error,
	json
} from '@sveltejs/kit';

import type {
	RequestHandler
} from './$types';

import type {
	PracticeConfig,
	PracticeCoverage
} from '$lib/types/quiz';

import {
	getQuestionBankBySlug
} from '$lib/server/quiz/bank.repository';

import {
	generatePracticeState,
	PracticeStateError,
	startPractice
} from '$lib/server/quiz/practice.service';


type RestartPayload = {
	coverage?: unknown;
	shuffleOptions?: unknown;
};


function parseCoverage(
	value: unknown
): PracticeCoverage | null {
	switch (value) {
		case 30:
		case 50:
		case 100:
			return value;

		default:
			return null;
	}
}


export const POST: RequestHandler =
	async ({
		request,
		locals,
		params
	}) => {
		let payload: RestartPayload;

		try {
			payload =
				await request.json() as RestartPayload;
		} catch {
			error(
				400,
				'重新開始設定無效'
			);
		}

		const coverage =
			parseCoverage(
				payload.coverage
			);

		if (
			!coverage ||
			typeof payload.shuffleOptions !==
				'boolean'
		) {
			error(
				400,
				'重新開始設定無效'
			);
		}

		const bank =
			await getQuestionBankBySlug(
				params.slug
			);

		if (!bank) {
			error(
				404,
				'找不到指定的題庫'
			);
		}

		const config: PracticeConfig = {
			coverage,
			shuffleOptions:
				payload.shuffleOptions
		};

		try {
			const questionsState =
				locals.user
					? await startPractice(
						locals.user.id,
						bank.id,
						config
					)
					: await generatePracticeState(
						bank.id,
						config
					);

			return json({
				questionsState
			});
		} catch (caught) {
			if (
				caught instanceof
				PracticeStateError
			) {
				error(
					400,
					caught.message
				);
			}

			throw caught;
		}
	};
