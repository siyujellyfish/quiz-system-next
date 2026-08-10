export const EXAM_NAVIGATOR_PAGE_SIZE = 50;

export function getExamNavigatorPage(
	questionIndex: number
): number {
	if (!Number.isInteger(questionIndex) || questionIndex < 0) {
		return 0;
	}

	return Math.floor(
		questionIndex /
			EXAM_NAVIGATOR_PAGE_SIZE
	);
}

export function getExamNavigatorPageCount(
	totalQuestions: number
): number {
	if (!Number.isFinite(totalQuestions) || totalQuestions <= 0) {
		return 1;
	}

	return Math.max(
		1,
		Math.ceil(
			totalQuestions /
				EXAM_NAVIGATOR_PAGE_SIZE
		)
	);
}

export function getExamNavigatorRange(
	totalQuestions: number,
	page: number
): {
	start: number;
	end: number;
} {
	const pageCount =
		getExamNavigatorPageCount(
			totalQuestions
		);
	const safePage = Math.min(
		Math.max(0, Math.floor(page)),
		pageCount - 1
	);
	const start =
		safePage *
		EXAM_NAVIGATOR_PAGE_SIZE;
	const end = Math.min(
		Math.max(0, totalQuestions),
		start + EXAM_NAVIGATOR_PAGE_SIZE
	);

	return {
		start,
		end
	};
}

export function getExamNavigatorRangeLabel(
	totalQuestions: number,
	page: number
): string {
	const range = getExamNavigatorRange(
		totalQuestions,
		page
	);

	if (range.end <= range.start) {
		return '';
	}

	return `${range.start + 1}-${range.end}`;
}
