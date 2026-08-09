export type PracticeCoverage =
	| 30
	| 50
	| 100;


export type PracticeConfig = {
	coverage: PracticeCoverage;
	shuffleOptions: boolean;
};


export type PracticeQuestionState = {
	questionId: string;
	optionIds: string[];
};


export type PracticeQuestionsState = {
	version: 1;

	coverage: PracticeCoverage;
	shuffleOptions: boolean;

	questions: PracticeQuestionState[];
};

export type PublicQuestionOption = {
	id: string;
	content: string;
};


export type PublicQuizQuestion = {
	id: string;
	prompt: string;
	options: PublicQuestionOption[];
};