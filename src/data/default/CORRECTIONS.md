# 題庫資料品質與修正報告

## 已直接修正（高信心）

1. **CEH v13 / ceh-5**
   - 原答案：Angela's public key.
   - 修正：His own private key.
   - 理由：數位簽章由簽署者使用自己的私鑰產生，驗證者使用簽署者公鑰驗證；此流程提供來源驗證與訊息完整性。

2. **EDRP v3 / edrp-4**
   - 原答案：Semi-Qualitative Risk Assessment
   - 修正：Qualitative Risk Assessment
   - 理由：題幹只使用 unlikely / high 等描述性等級，沒有數值尺度或計算，符合 qualitative risk analysis。

3. **EDRP v3 / edrp-38**
   - 原答案：Business Impact Analysis
   - 修正：Mission Essential Functions (MEF)
   - 理由：「組織在中斷期間必須持續、或在中斷後迅速恢復的功能」是 MEF 的標準定義。

## 保留原答案但標記人工複核

- **edrp-15**：題幹提到 parity stored across multiple drives，典型描述與題目提供的 RAID 選項存在疑義；選項沒有更典型的 RAID 5。
- **edrp-16**：emergency fund 與 RAROC/RORAC 等財務績效指標並非直接同義，疑似題幹或選項受損。
- **edrp-47**：來源明示原 PDF 配對表內容缺失，無法由現有文字獨立驗證。
- **edrp-92**：B/C 錯誤選項文字完全重複，雖不影響目前唯一正解，但應對照原教材修整。

## 結構檢查

- CEH v13：332 題
- CTIA v2：88 題
- EDRP v3：153 題
- CSA v2：100 題
- 合計：673 題
- 四個來源檔皆為單選題結構，每題目前恰好一個正確答案。
