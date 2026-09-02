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

function makeDocument(
	questions: unknown[] = [validQuestion]
) {
	return {
		version: 1,
		bank: {
			name: 'Example Bank',
			slug: 'example-bank',
			description: 'Example description'
		},
		questions
	};
}

describe('parseAdminBankImportJson', () => {
	it('accepts a complete bank document, keeps explanation, and strips source ids', () => {
		const result = parseAdminBankImportJson(
			JSON.stringify(makeDocument())
		);

		expect(result.ok).toBe(true);

		if (!result.ok) {
			return;
		}

		expect(result.document).toEqual({
			version: 1,
			bank: {
				name: 'Example Bank',
				slug: 'example-bank',
				description: 'Example description'
			},
			questions: [
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
			]
		});
		expect(result.preview).toMatchObject({
			questionCount: 1,
			optionCount: 2,
			explanationCount: 1
		});
	});

	it('normalizes omitted or blank explanation to null', () => {
		const result = parseAdminBankImportJson(
			JSON.stringify(
				makeDocument([
					{
						...validQuestion,
						explanation: '   '
					}
				])
			)
		);

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(
				result.document.questions[0]?.explanation
			).toBeNull();
		}
	});

	it('rejects an invalid explanation type', () => {
		const result = parseAdminBankImportJson(
			JSON.stringify(
				makeDocument([
					{
						...validQuestion,
						explanation: 123
					}
				])
			)
		);

		expect(result).toEqual({
			ok: false,
			message: '第 1 題：explanation 必須是字串或 null'
		});
	});

	it('rejects the legacy array root format', () => {
		const result = parseAdminBankImportJson(
			JSON.stringify([validQuestion])
		);

		expect(result).toEqual({
			ok: false,
			message: '題庫 JSON 最外層必須是物件'
		});
	});

	it('rejects an invalid bank slug', () => {
		const document = makeDocument();
		document.bank.slug = 'Invalid Slug';

		const result = parseAdminBankImportJson(
			JSON.stringify(document)
		);

		expect(result).toEqual({
			ok: false,
			message:
				'bank：slug 僅能使用小寫英文字母、數字與單一連字號'
		});
	});

	it('rejects an empty bank', () => {
		const result = parseAdminBankImportJson(
			JSON.stringify(makeDocument([]))
		);

		expect(result).toEqual({
			ok: false,
			message: '題庫至少需要 1 道題目'
		});
	});

	it('rejects questions with fewer than two options', () => {
		const result = parseAdminBankImportJson(
			JSON.stringify(
				makeDocument([
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
			)
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
				JSON.stringify(
					makeDocument([
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
				)
			);

			expect(result).toEqual({
				ok: false,
				message:
					'第 1 題：每題必須且只能設定 1 個正確答案'
			});
		}
	);

	it('rejects duplicate prompt and option signatures', () => {
		const result = parseAdminBankImportJson(
			JSON.stringify(
				makeDocument([
					validQuestion,
					{
						...validQuestion,
						id: 'source-question-2'
					}
				])
			)
		);

		expect(result).toEqual({
			ok: false,
			message: '第 2 題：題幹與選項內容和前面的題目重複'
		});
	});
});
