# Quiz System

一個以 **SvelteKit 5 + PostgreSQL + Drizzle ORM** 建構的題庫練習與模擬測驗系統，支援訪客練習、會員進度保存、錯題複習、模擬測驗、學習統計，以及管理員題庫與使用者管理。

目前正式站：**https://exam.azubot.xyz**

<picture>
	<source media="(prefers-color-scheme: dark)" srcset="./static/quiz-icon-dark.svg">
	<source media="(prefers-color-scheme: light)" srcset="./static/quiz-icon-light.svg">
	<img alt="Quiz System icon" src="./static/quiz-icon-light.svg" width="96" height="96">
</picture>

## 功能

### 練習模式

- 支援訪客直接開始練習，不強制登入。
- 可選擇題庫與練習題目比例。
- 支援固定或隨機選項順序。
- 登入後保存練習進度與作答狀態。
- 可重新開始一輪練習。

### 錯題模式

- 登入使用者可保存個人錯題。
- 答對後自動從錯題集合移除。
- 可依題庫進行錯題複習。
- 支援手動清除指定題庫的錯題。

### 模擬測驗

- 使用完整題庫進行模擬測驗。
- 題目與選項可隨機排列。
- 測驗期間正數計時。
- 交卷後顯示作答結果與答案。
- 測驗紀錄保存於使用者帳號。

### 個人資料與學習統計

- 個人測驗紀錄。
- 題庫練習進度。
- 作答正確率與學習統計。
- 個人錯題資料。

### 管理後台

管理員可進行：

- 題庫新增、編輯與刪除。
- 題目與選項管理。
- 題庫 JSON 匯入。
- 使用者新增與刪除。
- 指派或移除管理員權限。

## 題庫資料

原始題庫資料不包含在此 repository 中；`src/data/*-questions.json` 已加入 `.gitignore`，避免本機題庫資料被誤提交到 Git。

### 新增題目方式

1. 使用管理員帳號登入系統。
2. 進入「管理後台」。
3. 建立或選擇題庫。
4. 使用管理介面逐題新增題目與選項，或使用題庫 JSON 匯入功能批次新增。

題庫 JSON 可使用下列格式：

```json
[
	{
		"id": "question-id",
		"prompt": "Question text",
		"options": [
			{
				"id": "option-id",
				"text": "Option text",
				"isCorrect": true
			}
		]
	}
]
```

> 題庫內容可能涉及原作者、出版商、考試機構或其他第三方權利。除非另有明確授權，題庫、題目與選項內容不屬於本專案 MIT License 的授權範圍。

## 技術棧

- [SvelteKit](https://svelte.dev/docs/kit)
- [Svelte 5](https://svelte.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS 4](https://tailwindcss.com/)
- [Skeleton](https://www.skeleton.dev/)
- [Drizzle ORM](https://orm.drizzle.team/)
- [PostgreSQL](https://www.postgresql.org/)
- [Neon](https://neon.com/)
- [Vercel](https://vercel.com/)
- [Vitest](https://vitest.dev/)
- [Playwright](https://playwright.dev/)
- [Argon2](https://github.com/P-H-C/phc-winner-argon2)

## 系統需求

- Node.js `24.x`
- pnpm
- PostgreSQL，相容 Neon PostgreSQL

## 本機開發

### 1. Clone repository

```sh
git clone https://github.com/siyujellyfish/quiz-system-next.git
cd quiz-system-next
```

### 2. 安裝依賴

```sh
pnpm install
```

### 3. 建立環境變數

在專案根目錄建立 `.env.local`：

```dotenv
DATABASE_URL="postgresql://..."

# 建議 migration / seed 使用未經 pool 的連線。
DATABASE_URL_UNPOOLED="postgresql://..."

# 選填。使用 postgres.js driver 時設定。
# DATABASE_DRIVER="postgres-js"

# 選填。未設定時 seed script 目前預設為 admin / admin。
DEFAULT_ADMIN_USERNAME="admin"
DEFAULT_ADMIN_PASSWORD="請改成安全密碼"
```

> Production 請勿使用預設 `admin / admin`。建議在部署平台設定高強度的 `DEFAULT_ADMIN_PASSWORD`，並避免將任何憑證提交至 Git。

### 4. 建立資料庫結構

若已存在 migration：

```sh
pnpm db:migrate
```

開發階段也可直接同步 schema：

```sh
pnpm db:push
```

### 5. 啟動開發伺服器

```sh
pnpm dev
```

或自動開啟瀏覽器：

```sh
pnpm dev -- --open
```

啟動後可使用管理後台建立題庫，並逐題新增或使用 JSON 匯入功能批次加入題目。

## 常用指令

| 指令 | 用途 |
| --- | --- |
| `pnpm dev` | 啟動開發伺服器 |
| `pnpm build` | 建立 production build |
| `pnpm preview` | 預覽 production build |
| `pnpm check` | 執行 Svelte / TypeScript 檢查 |
| `pnpm test` | 執行 unit tests |
| `pnpm test:integration` | 執行 integration tests |
| `pnpm lint` | 執行 Oxlint |
| `pnpm lint:fix` | 自動修正可修正的 lint 問題 |
| `pnpm fmt` | 執行 Oxfmt |
| `pnpm fmt:check` | 檢查格式 |
| `pnpm db:generate` | 由 schema 產生 Drizzle migration |
| `pnpm db:migrate` | 執行 migration |
| `pnpm db:push` | 將 schema 直接同步至資料庫 |
| `pnpm db:studio` | 開啟 Drizzle Studio |
| `pnpm db:seed` | 執行本機 seed script（需自行準備合法可用的資料） |

## Production 部署

專案已設定 `@sveltejs/adapter-vercel`，可直接部署至 Vercel。

Production 至少需要設定：

```text
DATABASE_URL
```

建議另外設定：

```text
DATABASE_URL_UNPOOLED
DEFAULT_ADMIN_USERNAME
DEFAULT_ADMIN_PASSWORD
```

部署前建議執行：

```sh
pnpm check
pnpm test
pnpm build
```

資料庫 migration 與 seed 建議由部署流程之外明確執行，避免每次 build 重複修改 production database。Production build 本身不依賴原始題庫 JSON。

## 專案結構

```text
src/
├── data/                  # 本機私有題庫資料；*-questions.json 不納入 Git
├── lib/
│   ├── components/        # UI components
│   ├── server/            # DB、auth、repository、service
│   └── types/             # 共用型別
└── routes/
    ├── admin/             # 管理後台
    ├── analytics/         # 學習統計
    ├── exam/              # 模擬測驗
    ├── history/           # 測驗紀錄
    ├── practice/          # 練習模式
    ├── profile/           # 個人資料
    └── wrong/             # 錯題模式

drizzle/                   # Drizzle migrations
scripts/                    # Seed / 維護腳本
static/                     # favicon 與靜態資源
```

## 安全性與資料管理

- 密碼以 Argon2 hash 儲存，不應保存明文密碼。
- `.env.local` 與 Production secrets 不應提交至 repository。
- `src/data/*-questions.json` 為本機／私有題庫資料，不應提交至 repository。
- 正式環境務必更換預設管理員密碼。
- 管理後台操作應僅允許 `isAdmin` 使用者。
- 題庫匯入資料應視為不可信輸入並進行驗證。
- 若敏感或受限制的資料曾被提交到 Git，應進行 history rewrite，並同步更新所有本機 clone。

## License

本專案的**軟體原始碼**採用 [MIT License](./LICENSE) 授權。

MIT 適合本專案目前的定位：條款簡潔、允許個人與商業使用、修改及再散布，同時保留原作者著作權與免責聲明。

**題庫、考題、題目文字、選項與其他第三方內容不在此 repository 中，亦不屬於本專案 MIT License 的授權範圍。使用或散布相關內容前，請自行確認其授權與權利狀態。**