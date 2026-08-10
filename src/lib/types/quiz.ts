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


export type PracticeStats = {
	answeredCount: number;
	correctCount: number;
};


export type GuestPracticeSession = {
	questionsState: PracticeQuestionsState;
	currentIndex: number;
	answeredCount: number;
	correctCount: number;
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


export type QuizAnswerResult = {
	selectedOptionId: string | null;
	correct: boolean;
	correctOptionIds: string[];
	completed: boolean;
};


export type WrongAnswerResult =
	QuizAnswerResult & {
		remainingCount: number;
	};


export type ExamAnswers = Record<
	string,
	string | null
>;


export type ExamQuestionResult = {
	questionId: string;
	selectedOptionId: string | null;
	correctOptionIds: string[];
	correct: boolean;
};


export type ExamResult = {
	totalQuestions: number;
	answeredCount: number;
	unansweredCount: number;
	correctCount: number;
	incorrectCount: number;
	accuracy: number;
	elapsedSeconds: number;
	questions: ExamQuestionResult[];
};


export type ExamSession = {
	version: 1;
	attemptId: string | null;
	startedAt: number;
	currentIndex: number;
	questions: PublicQuizQuestion[];
	answers: ExamAnswers;
	result: ExamResult | null;
};
