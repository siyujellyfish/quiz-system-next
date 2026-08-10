import {
	describe,
	expect,
	it
} from 'vitest';

import {
	EXAM_NAVIGATOR_PAGE_SIZE,
	getExamNavigatorPage,
	getExamNavigatorPageCount,
	getExamNavigatorRange,
	getExamNavigatorRangeLabel
} from './exam-navigator';

describe('exam navigator paging', () => {
	it('keeps the page size fixed at 50 questions', () => {
		expect(
			EXAM_NAVIGATOR_PAGE_SIZE
		).toBe(50);
	});

	it('maps question indexes to the expected 50-question page', () => {
		expect(getExamNavigatorPage(0)).toBe(0);
		expect(getExamNavigatorPage(49)).toBe(0);
		expect(getExamNavigatorPage(50)).toBe(1);
		expect(getExamNavigatorPage(99)).toBe(1);
		expect(getExamNavigatorPage(100)).toBe(2);
		expect(getExamNavigatorPage(152)).toBe(3);
	});

	it('splits 153 questions into four fixed pages', () => {
		expect(
			getExamNavigatorPageCount(153)
		).toBe(4);
		expect(
			getExamNavigatorRange(153, 0)
		).toEqual({
			start: 0,
			end: 50
		});
		expect(
			getExamNavigatorRange(153, 1)
		).toEqual({
			start: 50,
			end: 100
		});
		expect(
			getExamNavigatorRange(153, 2)
		).toEqual({
			start: 100,
			end: 150
		});
		expect(
			getExamNavigatorRange(153, 3)
		).toEqual({
			start: 150,
			end: 153
		});
	});

	it('formats actual question ranges for pagination controls', () => {
		expect(
			getExamNavigatorRangeLabel(153, 0)
		).toBe('1-50');
		expect(
			getExamNavigatorRangeLabel(153, 1)
		).toBe('51-100');
		expect(
			getExamNavigatorRangeLabel(153, 2)
		).toBe('101-150');
		expect(
			getExamNavigatorRangeLabel(153, 3)
		).toBe('151-153');
	});
});
