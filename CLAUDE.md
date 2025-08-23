# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

このリポジトリは4つの異なるゲーム アプリケーションを含むマルチプロジェクト構成です：

1. **ハイローご褒美ゲーム** (Root) - Electron製日本向けカジノゲーム  
2. **アーケード ポーカー v2** - アニメテーマのWeb ポーカーゲーム
3. **ゲーム レビューサイト** - Next.js/Supabase製レビュープラットフォーム
4. **ホラー写真ローグライク** - React/TypeScript製ナラティブゲーム

## 開発コマンド

### ハイローご褒美ゲーム (ルートディレクトリ)
```bash
# 開発・テスト
npm start                    # Electronアプリを開発モードで起動
npm install                  # 依存関係インストール (Electron + electron-builder)

# ビルド・配布
npm run build-win           # Windows実行ファイル作成
npm run dist                # 代替ビルドコマンド

# 重要ファイル: main.js (Electron), high-low-game-casino.html (ゲームロジック)
# 画像アセット: images/ フォルダ（厳格な命名規則：character{1-3}_{reward|special}{1-5|1-3}.jpg）
```

### ゲーム レビューサイト (game-review-site/)
```bash
# 開発
npm run dev                 # Next.js開発サーバー起動 (Turbopack使用)
npm run build               # プロダクションビルド (※型エラー有り - 既知の問題参照)
npm start                   # プロダクションサーバー起動
npm run lint                # ESLint実行

# データベース設定
# セットアップ: SUPABASE_SETUP.md の手順に従ってSupabase設定
# 環境変数: .env.local にSupabase認証情報が必要
# テストデータ: lib/mockGames.ts に游戏のサンプルデータあり
```

### ホラー写真ローグライク (horror-photo-roguelike/)
```bash
# 開発
npm run dev                 # Vite開発サーバー起動
npm run build               # TypeScriptコンパイル + Viteビルド
npm run lint                # ESLint実行  
npm run preview             # プロダクションビルド プレビュー

# アーキテクチャ: Zustandストア + Reactコンポーネント + TypeScript
# 状態管理: 4つの独立したZustandストア（game, story, encyclopedia, extended）
```

### アーケード ポーカー v2 (arcade-poker-v2/)
```bash
# 静的ファイル - 任意のHTTPサーバーで配信
# index.html (水平レイアウト・デスクトップ向け)
# index-vertical.html (垂直レイアウト・モバイル向け)
# 直接ブラウザで開いてテスト可能
```

## アーキテクチャ概要

### ハイローご褒美ゲーム
- **単一ファイル設計**: `high-low-game-casino.html` にゲームロジック統合
- **Electronラッパー**: `main.js` でBrowserWindow作成、最小設定
- **アセット システム**: `images/` フォルダの厳格な命名規則
- **ゲーム メカニクス**: カード値2-14 (Aが最強)、引き分け=勝利、累進報酬システム
- **統計システム**: 勝率・連勝数・最高記録の3要素で100人中の順位算出
- **配布形式**: electron-builderによるWindows実行ファイル

### ゲーム レビューサイト
- **Next.js 15 App Router**: サーバー・クライアント コンポーネント + Turbopack
- **Supabase統合**: 認証、データベース、RLSポリシー
- **データベース設計**: users, games, reviews, favorites, roles テーブル
- **認証システム**: Google/Apple OAuth (Supabase Auth経由)
- **型安全性**: `types/database.ts` の生成型定義
- **レビューシステム**: 5次元評価 (プレイ性/バランス/表現力/UX/価値)
- **ユーザー管理**: ランク制度（Bronze→Diamond）、性格タイプ分類

### ホラー写真ローグライク
- **状態管理**: 4つのZustandストア (game, story, encyclopedia, extended)
- **ゲーム進行**: 5日制システム、1日3ラウンド、選択式ナラティブ
- **写真システム**: Seedrandomベースの選択、エフェクトで能力値変動
- **ストーリー分岐**: 写真選択でエンディング決定 (脱出/除霊/契約)
- **性格判定**: プレイヤーの行動追跡でエンディング自動選択
- **永続化**: ローカルストレージでの進行・発見コンテンツ保存
- **百科事典機能**: 発見した写真・エンティティの詳細記録

### アーケード ポーカー v2
- **レスポンシブ設計**: 水平デスクトップ + 垂直モバイルレイアウト
- **アニメテーマ**: CSSアニメーション、ディーラーキャラ統合
- **yamikawa美学**: 「病みかわ」デザインコンセプト
- **ゲーセン風UI**: 緑フェルト背景、アーケードスタイル
- **静的配布**: ビルドプロセス不要、直接配信可能

## 既知の問題

### ゲーム レビューサイト
- **ルートハンドラー型エラー**: Next.js 15でparamsがPromise化、API routesでTypeScriptエラー発生
- **ビルド警告**: 複数のpackage.jsonによるTurbopackワークスペースルート検出問題  
- **ポート競合**: 開発サーバーが自動ポート調整 (通常3001ポートを使用)
- **型定義修正が必要**: APIルートで`{ params }: { params: Promise<{ id: string }> }`に更新要

### ホラー写真ローグライク
- **複雑な状態依存**: 複数ストアの相互作用、変更時は慎重な調整が必要
- **ストーリー進行**: 新コンテンツ追加時は写真→ルートマッピング更新が必要
- **セーブシステム**: ローカルストレージのみ、クラウド同期なし
- **バランス調整**: ゲーム難易度・選択肢の影響度は継続的な調整対象

## 開発ノート・重要事項

### 画像アセット管理
- **ハイローゲーム**: 厳格な命名規則 `character{1-3}_{reward|special}{1-5|1-3}.jpg`
  - 全24枚必須 (各キャラ8枚 × 3キャラ)
  - ファイルサイズ1MB以下推奨、解像度500x500px以上
- **アーケードポーカー**: キャラクター画像はプロジェクトルート
- **ゲームレビュー**: ゲームアイコンは外部URL または `public/images/games/`

### データベース設計 (ゲーム レビューサイト)
- **users**: handle, display_name, rank (Bronze→Diamond), type_label (6種類の性格)
- **reviews**: 5次元スコア、プライバシー制御、helpful投票機能
- **games**: プラットフォーム配列、ジャンルタグ、外部画像URL
- **user_favorites_seed**: レコメンデーション用の重み付けシード
- **RLS ポリシー**: 公開読み取り、認証済み書き込み

### 状態管理アーキテクチャ (ホラー写真ローグライク)
- **gameStore**: コアゲーム状態、写真選択、エフェクト処理、ラウンド進行
- **storyStore**: ナラティブイベント、ルート進行追跡、ストーリー分岐
- **encyclopediaStore**: 発見追跡、メタ進行、写真・エンティティ詳細記録
- **extendedGameStore**: 日次・フェーズ進行、性格分析、エンディング判定
- **相互作用**: 写真選択→ストーリールート進行→性格ポイント蓄積→エンディング決定

## プロジェクト固有パターン・コード規約

### Next.js API ルート修正パターン (ゲーム レビューサイト)
現在のパターン (型エラーあり):
```typescript
export async function GET(request: Request, { params }: { params: { id: string } })
```

修正後パターン:
```typescript  
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> })
```

修正対象ファイル:
- `app/api/games/[id]/route.ts`
- `app/api/games/[id]/reviews/route.ts`
- `app/api/reviews/[id]/route.ts`

### Zustand ストア構造 (ホラー写真ローグライク)
```typescript
export const useStore = create<StoreType>()(
  persist(
    (set, get) => ({
      // 状態とアクション定義
      selectPhoto: (photo: PhotoCard) => {
        // 百科事典に追加、ストーリールート進行
        const encyclopedia = useEncyclopediaStore.getState();
        const storyStore = useStoryStore.getState();
        // ...
      },
      nextRound: () => { /* ラウンド進行処理 */ }
    }),
    {
      name: 'horror-photo-game',  // ローカルストレージキー
      partialize: (state) => ({   // 永続化対象フィールド
        sanity: state.sanity,
        clarity: state.clarity,
        // ...
      })
    }
  )
);
```

**重要**: ストア間の相互参照は`getState()`で行う

### Electron アプリ設定 (ハイローご褒美ゲーム)
```javascript
// main.js の重要設定
const mainWindow = new BrowserWindow({
  width: 1280,
  height: 900,
  resizable: false,          // サイズ変更無効
  autoHideMenuBar: true,     // メニューバー自動非表示
  webPreferences: {
    nodeIntegration: false,
    contextIsolation: true,
    webSecurity: false       // ローカルファイルアクセス用
  }
});
```

**配布用ビルド設定**:
- `npm run build-win` でWindows実行ファイル作成
- `dist/win-unpacked/` にポータブル版
- `dist/*.exe` にインストーラー版
- 画像ファイルも自動的にパッケージに含まれる

## 特記事項・開発時の注意点

### 日本語ゲーム開発の考慮事項
- **ハイローご褒美ゲーム**: DLsite等日本市場向け、キャラクター画像の著作権注意
- **アーケードポーカー**: yamikawa美学、日本のゲーセン文化参考
- **UI/UX**: 日本語テキスト表示、フォントサイズ・行間に注意

### パフォーマンス最適化
- **ホラーゲーム**: seedrandom使用で再現性確保、大量画像の遅延読み込み
- **レビューサイト**: Supabase RLSで適切な権限制御、画像最適化
- **全プロジェクト**: ローカルストレージの容量制限に注意

### セキュリティ・プライバシー
- レビューサイトの個人情報はSupabase RLSで保護
- Electronアプリは署名なしでセキュリティ警告発生可能性
- ローカルゲームデータの暗号化は未実装