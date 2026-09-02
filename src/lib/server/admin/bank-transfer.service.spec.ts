import {
	describe,
	expect,
	it
} from 'vitest';

import {
	parseAdminBankImportJson
} from './bank-transfer.service';

const validQuestion = {
	id: 'source-question-1',
	prompt: 'Which option is correct?',
	explanation: 'The second option is correct.',
	options: [
		{
			id: 'source-option-1',
			text: 'Wrong',
			isCorrect: false
		},
		{
			id: 'source-option-2',
			text: 'Correct',
			isCorrect: true
		}
	]
};

describe('parseAdminBankImportJson', () => {
	it('accepts the seed JSON shape, keeps explanation, and strips source ids', () => {
		const result = parseAdminBankImportJson(
			JSON.stringify([validQuestion])
		);

		expect(result.ok).toBe(true);

		if (!result.ok) {
			return;
		}

		expect(result.questions).toEqual([
			{
				prompt: 'Which option is correct?',
				explanation: 'The second option is correct.',
				options: [
					{
						text: 'Wrong',
						isCorrect: false
					},
					{
						text: 'Correct',
						isCorrect: true
					}
				]
			}
		]);
		expect(result.preview).toMatchObject({
			questionCount: 1,
			optionCount: 2,
			explanationCount: 1
		});
	});

	it('normalizes omitted or blank explanation to null', () => {
		const result = parseAdminBankImportJson(
			JSON.stringify([
				{
					...validQuestion,
				explanation: '   '
				}
			])
		);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.questions[0]?.explanation).toBeNull();
		}
	});

	it('rejects an invalid explanation type', () => {
		const result = parseAdminBankImportJson(
			JSON.stringify([
				{
					...validQuestion,
				explanation: 123
				}
			])
		);

		expect(result).toEqual({
			ok: false,
			message: '第 1 題：explanation 必須是字串或 null'
		});
	});

	it('rejects a non-array root value', () => {
		const result = parseAdminBankImportJson(
			JSON.stringify(validQuestion)
		);

		expect(result).toEqual({
			ok: false,
			message: '題庫 JSON 最外層必須是題目陣列'
		});
	});

	it('rejects an empty bank', () => {
		const result = parseAdminBankImportJson('[]');

		expect(result).toEqual({
			ok: false,
			message: '題庫至少需要 1 道題目'
		});
	});

	it('rejects questions with fewer than two options', () => {
		const result = parseAdminBankImportJson(
			JSON.stringify([
				{
					prompt: 'Question',
					options: [
						{
							text: 'Only option',
							isCorrect: true
						}
					]
				}
			])
		);

		expect(result).toEqual({
			ok: false,
			message: '第 1 題：每題至少需要 2 個選項'
		});
	});

	it.each([
		[false, false],
		[true, true]
	])(
		'rejects a question unless exactly one option is correct',
		(firstCorrect, secondCorrect) => {
			const result = parseAdminBankImportJson(
				JSON.stringify([
					{
						prompt: 'Question',
						options: [
							{
								text: 'A',
								isCorrect: firstCorrect
							},
							{
								text: 'B',
								isCorrect: secondCorrect
							}
						]
					}
				])
			);

			expect(result).toEqual({
				ok: false,
				message:
					'第 1 題：每題必須且只能設定 1 個正確答案'
			});
		}
	);
});
