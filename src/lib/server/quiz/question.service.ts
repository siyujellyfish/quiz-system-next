import type {
	PublicQuestionOption,
	PublicQuizQuestion
} from '$lib/types/quiz';


import {
	getQuestionWithOptionsByIdAndBank,
	getQuestionWithOptionsByIdAndBankSlug
} from './question.repository';


type PracticeQuestionRow = {
	questionId: string;
	prompt: string;
	optionId: string;
	optionContent: string;
	optionPosition: number;
};


export async function getPublicPracticeQuestion(
	bankId: string,
	questionId: string,
	optionIds: string[]
): Promise<PublicQuizQuestion | null> {
	const rows =
		await getQuestionWithOptionsByIdAndBank(
			questionId,
			bankId
		);

	return buildPublicPracticeQuestion(
		rows,
		optionIds
	);
}


export async function getPublicPracticeQuestionByBankSlug(
	bankSlug: string,
	questionId: string,
	optionIds: string[]
): Promise<PublicQuizQuestion | null> {
	const rows =
		await getQuestionWithOptionsByIdAndBankSlug(
			questionId,
			bankSlug
		);

	return buildPublicPracticeQuestion(
		rows,
		optionIds
	);
}


function buildPublicPracticeQuestion(
	rows: PracticeQuestionRow[],
	optionIds: string[]
): PublicQuizQuestion | null {
	const firstRow = rows[0];

	if (!firstRow) {
		return null;
	}

	const options = rows.map(
		(row) => ({
			id: row.optionId,
			content: row.optionContent,
			position: row.optionPosition
		})
	);

	const optionMap =
		new Map(
			options.map(
				(option) => [
					option.id,
					option
				]
			)
		);

	const orderedOptions:
		PublicQuestionOption[] = [];

	const usedOptionIds =
		new Set<string>();

	for (const optionId of optionIds) {
		const option =
			optionMap.get(
				optionId
			);

		if (!option) {
			continue;
		}

		orderedOptions.push({
			id: option.id,
			content: option.content
		});

		usedOptionIds.add(
			option.id
		);
	}

	/*
	 * 題庫更新後若新增 option，
	 * 將新的 option 依 DB position
	 * 補到舊 state 的最後面。
	 */
	for (const option of options) {
		if (
			usedOptionIds.has(
				option.id
			)
		) {
			continue;
		}

		orderedOptions.push({
			id: option.id,
			content: option.content
		});
	}

	if (orderedOptions.length === 0) {
		return null;
	}

	return {
		id: firstRow.questionId,
		prompt: firstRow.prompt,
		options: orderedOptions
	};
}
