# パチンコマーブル Enhanced Fixed版 - 技術仕様書

## プロジェクト概要

**プロジェクト名**: パチンコマーブル Enhanced Fixed版  
**バージョン**: 1.2.0  
**開発言語**: HTML5 + CSS3 + JavaScript (ES6+) + WebAudio API  
**対象環境**: モダンブラウザ (Chrome 80+, Firefox 75+, Safari 13+)  
**レスポンシブ対応**: 完全対応 (320px～1920px)  
**特徴**: 高度な物理演算・音響システム・Enhanced版完全改良  

---

## 1. システム構成

### 1.1 ファイル構造
```
pachinko-enhanced-fixed/
├── index.html          # メインHTML (統合UI + Enhanced機能)
├── game.js             # Enhanced版ゲームロジック (WebAudio統合)
├── SPECIFICATION.md    # この技術仕様書
└── README.md           # プロジェクト概要・修正内容
```

### 1.2 技術スタック
- **フロントエンド**: Vanilla JavaScript ES6+ (フレームワーク非依存)
- **描画エンジン**: HTML5 Canvas 2D API (高DPI対応)
- **物理演算**: カスタム高度物理エンジン (重力・摩擦・空気抵抗)
- **音響システム**: WebAudio API (プログラム生成音響)
- **UI フレームワーク**: CSS Grid + Flexbox (完全レスポンシブ)
- **アニメーション**: CSS3 Transitions + Transforms + Keyframes
- **状態管理**: クラスベース状態管理 (永続化対応)

---

## 2. ゲーム仕様

### 2.1 基本ゲームフロー

#### 通常時
1. **マーブル選択**: ドラッグ操作でマーブル(1-15個)選択
2. **高度物理演算**: 重力・摩擦・空気抵抗による自然な挙動
3. **当たり判定**: 選択マーブル数に応じた確率抽選
4. **抽選結果**: 1/319確率で大当たり→ST突入

#### ST(Special Time)モード
1. **高確率抽選**: 1/144確率で当たり (通常の2.2倍)
2. **継続抽選**: ST中毎回転1/99確率でST継続判定
3. **回転数管理**: ST中は144回転でモード終了
4. **継続カウント**: ST継続回数をリアルタイム表示・即座更新

#### 先バレシステム
1. **先バレ抽選**: 通常時1/128確率で先バレ演出
2. **先バレ当選**: 先バレ時40%確率で当たり確定
3. **演出強化**: 特別エフェクト・音響・UI変更

### 2.2 確率・数値設定

| 項目 | 通常時 | ST中 | 先バレ時 |
|------|--------|------|----------|
| 大当たり確率 | 1/319 | 1/144 | 40% |
| ST継続率 | - | 1/99 (毎回転) | - |
| ST規定回転数 | - | 144回転 | - |
| 先バレ発生率 | 1/128 | - | - |
| 獲得玉数/回 | 15玉 | 15玉 | 15玉 |

### 2.3 物理演算仕様 (Enhanced版)

#### 高度物理パラメータ
```javascript
this.physics = {
    gravity: 120,              // 自然な重力加速度
    friction: 0.92,            // 高摩擦で安定化
    airResistance: 0.97,       // 強い空気抵抗で速度制御
    restitution: 0.15,         // 小反発で自然な挙動
    collisionDamping: 0.6,     // 衝突減衰
    separationStrength: 0.8    // マーブル分離力
};
```

#### 衝突検出・反応
- **マーブル間衝突**: 弾性衝突・運動量保存則適用
- **壁面反発**: 摩擦・反発係数考慮
- **重複解決**: 分離力による重複排除
- **安定性判定**: 速度閾値による静止判定

---

## 3. アーキテクチャ設計

### 3.1 EnhancedPachinkoGame クラス

#### 主要プロパティ
```javascript
class EnhancedPachinkoGame {
    constructor() {
        this.canvas = null;              // Canvas要素
        this.ctx = null;                 // 描画コンテキスト
        this.gameState = {};             // ゲーム状態管理
        this.marbles = [];               // マーブル配列
        this.selectedMarbles = new Set(); // 選択マーブル
        this.physics = {};               // 物理パラメータ
        this.audioContext = null;        // WebAudio Context
        this.soundBuffers = new Map();   // 音響バッファ
    }
}
```

### 3.2 状態管理 (Enhanced版)

#### ゲーム状態
```javascript
this.gameState = {
    // 基本状態
    mode: 'normal',                  // 'normal' | 'st' | 'preReveal'
    spinCount: 0,                    // 総回転数
    ballCount: 0,                    // 獲得玉数
    stCount: 0,                      // ST回転数
    stRemaining: 144,                // ST残り回転数
    stContinueCount: 0,              // ST継続回数 ★重要
    
    // 制御フラグ
    isAutoPlay: false,               // オートプレイフラグ
    autoPlaySpeed: 'normal',         // オート速度
    soundEnabled: true,              // 音響有効
    autoStopped: false,              // オート停止
    
    // 履歴・統計
    hitHistory: [],                  // 当たり履歴
    normalSpinsSinceHit: 0,          // 通常時はまり回転数
    stSpinsSinceHit: 0,              // ST中はまり回転数
    
    // 先バレ機能
    isPreRevealing: false,           // 先バレ演出中
    preRevealAutoStopped: false,     // 先バレオート停止
    
    // ST詳細管理
    ballsAtSTStart: 0,               // ST開始時玉数
    currentSTBalls: 0,               // ST獲得玉数
    stContinueConfirmed: false,      // ST継続確定
    
    // システム
    gameStarted: false               // ゲーム開始フラグ
};
```

### 3.3 WebAudio API統合

#### 音響システム
```javascript
// 音響初期化
async initAudio() {
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    this.createSoundEffects();
}

// プログラム生成音響
createSoundEffects() {
    this.createCrackSound();      // クラック音
    this.createPreRevealSound();  // 先バレ音
    this.createWinSound();        // 当たり音
    this.createFreezeSound();     // フリーズ音
}
```

---

## 4. 重要修正項目 (Enhanced-Fixed版)

### 4.1 ST継続カウンター完全修正 ★最重要

#### 問題の解決方法
Enhanced版では継続カウンターの表示が遅延・非表示になる問題を完全解決。

```javascript
// ST継続処理の修正版
continueST() {
    // ST継続抽選 (毎回転1/99)
    const shouldContinue = Math.random() < (1 / this.probabilities.stContinue);
    
    if (shouldContinue) {
        // ★重要: 即座にカウンターを更新
        this.gameState.stContinueCount++;
        
        // ST継続回数表示の即座更新
        const stChainElement = document.getElementById('st-chain');
        if (stChainElement) {
            stChainElement.textContent = this.gameState.stContinueCount;
            console.log('✅ ST継続回数表示を更新:', this.gameState.stContinueCount);
        }
        
        // ST継続演出
        this.showEffect('celebrate');
        
        // ST回転数リセット
        this.gameState.stRemaining = 144;
        this.gameState.stCount = 0;
        
        console.log(`🎊 ST継続！ 継続回数: ${this.gameState.stContinueCount}`);
    } else {
        // ST終了処理
        this.endST();
    }
}
```

#### 更新保証メカニズム
1. **直接DOM更新**: getElementById直接操作
2. **即座実行**: 状態変更と同時にUI更新
3. **冗長ログ**: コンソールログで更新確認
4. **要素検証**: DOM要素存在確認

### 4.2 文字表示崩れ・切れ対策

#### STパネル改善
```css
.st-display {
    max-width: 480px;           /* パネル幅制限 */
    padding: 20px;              /* コンパクト化 */
    white-space: nowrap;        /* 改行防止 */
    overflow: hidden;           /* はみ出し防止 */
    text-overflow: ellipsis;    /* 省略記号対応 */
}

.st-title {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.mode-text {
    max-width: 200px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
```

#### レスポンシブ強化
```css
@media (max-width: 480px) {
    .header { 
        height: 80px; 
        padding: 10px; 
    }
    
    .mode-text { 
        font-size: 18px; 
        max-width: 140px; 
    }
    
    .st-display { 
        padding: 15px; 
        left: 10px; 
        right: 10px; 
    }
    
    .st-info { 
        font-size: 12px; 
        gap: 8px; 
    }
}
```

---

## 5. Enhanced版固有機能

### 5.1 先バレシステム

#### 先バレ抽選・演出
```javascript
// 先バレ判定
checkPreReveal() {
    if (this.gameState.mode === 'normal') {
        const preRevealChance = Math.random() < (1 / this.probabilities.preReveal);
        
        if (preRevealChance) {
            this.gameState.isPreRevealing = true;
            this.showEffect('chance');
            this.playSound('preReveal');
            
            // 40%確率で当たり確定
            return Math.random() < this.probabilities.preRevealHit;
        }
    }
    return false;
}
```

### 5.2 履歴システム

#### 当たり履歴管理
```javascript
// 履歴記録
recordHit(mode) {
    const hitRecord = {
        spin: this.gameState.spinCount,
        mode: mode,
        timestamp: Date.now(),
        balls: this.gameState.ballCount
    };
    
    this.gameState.hitHistory.push(hitRecord);
    this.updateHistoryDisplay();
}

// 統計計算
calculateStats() {
    const stats = {
        normalHits: this.gameState.hitHistory.filter(h => h.mode === 'normal').length,
        stHits: this.gameState.hitHistory.filter(h => h.mode === 'st').length,
        preRevealHits: this.gameState.hitHistory.filter(h => h.mode === 'preReveal').length
    };
    
    return stats;
}
```

### 5.3 高度エフェクトシステム

#### 視覚エフェクト
```css
/* 先バレ演出 */
.effect-text.chance {
    color: #ffd700;
    text-shadow: 
        0 0 20px rgba(255, 215, 0, 1),
        0 0 40px rgba(255, 215, 0, 0.9), 
        0 0 80px rgba(255, 215, 0, 0.6),
        2px 2px 0px rgba(255, 0, 0, 0.8),
        -2px -2px 0px rgba(0, 255, 255, 0.8);
    animation: chanceGlow 0.4s infinite alternate;
    font-weight: 900;
    letter-spacing: clamp(1px, 0.3vw, 3px);
}

/* ST継続お祝い */
.effect-text.celebrate {
    animation: celebratePulse 1.5s ease-in-out;
    background: linear-gradient(135deg, rgba(255,215,0,0.2), rgba(255,69,0,0.1));
    padding: 25px 50px;
    border-radius: 20px;
    border: 3px solid #ffd700;
}
```

---

## 6. パフォーマンス最適化

### 6.1 物理演算最適化

#### 効率的な衝突検出
```javascript
// 空間分割による衝突最適化
updatePhysics(deltaTime) {
    // 空間ハッシュで衝突候補を絞り込み
    const spatialHash = this.buildSpatialHash();
    
    for (const marble of this.marbles) {
        if (marble.isStatic) continue;
        
        // 重力適用
        marble.vy += this.physics.gravity * deltaTime;
        
        // 空気抵抗
        marble.vx *= this.physics.airResistance;
        marble.vy *= this.physics.airResistance;
        
        // 位置更新
        marble.x += marble.vx * deltaTime;
        marble.y += marble.vy * deltaTime;
        
        // 近隣マーブルとの衝突のみチェック
        this.checkCollisionsInCell(marble, spatialHash);
    }
}
```

### 6.2 描画最適化

#### 差分描画・オフスクリーンキャンバス
```javascript
// 効率的な描画
render() {
    // 変更があった場合のみ再描画
    if (!this.needsRedraw) return;
    
    // バックグラウンド一回描画
    if (this.backgroundChanged) {
        this.renderBackground();
        this.backgroundChanged = false;
    }
    
    // マーブルのみ更新
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawBackground();
    this.drawMarbles();
    this.drawEffects();
    
    this.needsRedraw = false;
}
```

---

## 7. 音響システム (WebAudio API)

### 7.1 プログラム生成音響

#### リアルな音響合成
```javascript
// クラック音生成
createCrackSound() {
    const buffer = this.audioContext.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        const envelope = Math.exp(-t * 15); // 急激減衰
        
        // 複数周波数合成
        let sample = 0;
        sample += Math.sin(2 * Math.PI * 2500 * t) * 0.3; // 基本
        sample += Math.sin(2 * Math.PI * 4200 * t) * 0.2; // 高音
        sample += Math.sin(2 * Math.PI * 1800 * t) * 0.15; // 低音
        
        // ノイズ追加でリアリティ
        sample += (Math.random() * 2 - 1) * 0.1;
        
        data[i] = sample * envelope;
    }
    
    this.soundBuffers.set('crack', buffer);
}
```

### 7.2 空間音響・3Dオーディオ

#### 立体音響効果
```javascript
// 位置に基づく音響再生
playPositionalSound(soundName, x, y) {
    if (!this.gameState.soundEnabled) return;
    
    const source = this.audioContext.createBufferSource();
    const panner = this.audioContext.createPanner();
    const gainNode = this.audioContext.createGain();
    
    source.buffer = this.soundBuffers.get(soundName);
    
    // 3D位置設定
    panner.setPosition(x / 100, y / 100, 0);
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    
    // 音量調整
    gainNode.gain.value = 0.3;
    
    // 接続・再生
    source.connect(panner);
    panner.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    source.start();
}
```

---

## 8. UI/UX設計

### 8.1 レスポンシブデザイン

#### 多段階ブレークポイント
```css
/* デスクトップ (768px+) */
@media (min-width: 768px) {
    #app {
        max-width: 480px;
        margin: 0 auto;
        box-shadow: 0 0 60px rgba(0, 0, 0, 0.8);
        border-radius: 10px;
    }
}

/* タブレット (480px-768px) */
@media (max-width: 768px) {
    .effect-text.chance {
        font-size: clamp(24px, 6vw, 42px);
    }
}

/* スマートフォン (320px-480px) */
@media (max-width: 480px) {
    .header {
        height: 80px;
        padding: 10px;
    }
    
    .st-display {
        padding: 15px;
        left: 10px;
        right: 10px;
    }
}
```

### 8.2 アクセシビリティ

#### タッチ操作最適化
```css
/* タッチターゲット最小44px */
.control-btn {
    min-width: 44px;
    min-height: 44px;
    -webkit-tap-highlight-color: transparent;
}

/* 視覚的フィードバック */
.control-btn:active {
    transform: scale(0.95) translateY(-1px);
    transition: transform 0.1s ease-out;
}
```

---

## 9. テスト・品質保証

### 9.1 機能テスト項目

| テスト項目 | 期待結果 | 確認方法 |
|-----------|----------|----------|
| ST継続カウンター | 継続時に即座に数値増加表示 | 視覚・コンソール確認 |
| 先バレシステム | 1/128で発生・40%で当たり | 確率統計・ログ確認 |
| 物理演算 | 自然なマーブル挙動・衝突 | 視覚確認・fps測定 |
| 音響システム | 適切なタイミングで音再生 | 聴覚確認・デバッグ |
| レスポンシブ | 全画面サイズで崩れなし | 各デバイス・ブラウザ |
| 履歴機能 | 正確な記録・統計表示 | データ確認・計算検証 |

### 9.2 パフォーマンステスト

#### フレームレート測定
```javascript
// FPS監視
measurePerformance() {
    const now = performance.now();
    this.frameCount++;
    
    if (now - this.lastFPSUpdate > 1000) {
        this.currentFPS = this.frameCount;
        this.frameCount = 0;
        this.lastFPSUpdate = now;
        
        console.log(`FPS: ${this.currentFPS}`);
    }
}
```

---

## 10. デプロイメント・運用

### 10.1 環境要件

#### 最小動作環境
- **Chrome**: 80+ (WebAudio API完全対応)
- **Firefox**: 75+ (ES6+・Canvas 2D対応)
- **Safari**: 13+ (iOS 13+・WebAudio対応)
- **Edge**: 80+ (Chromium版)

#### 推奨環境
- **解像度**: 1280x720以上
- **RAM**: 4GB以上 (WebAudio バッファ用)
- **CPU**: デュアルコア 2.0GHz以上
- **ストレージ**: 10MB以上 (履歴・設定用)

### 10.2 最適化設定

#### 本番環境設定
```javascript
const PRODUCTION_CONFIG = {
    // 物理演算精度
    physicsSteps: 60,         // 本番: 60fps
    maxMarbles: 200,          // マーブル上限
    
    // 音響設定
    audioQuality: 'high',     // 高品質音響
    spatialAudio: true,       // 3Dオーディオ
    
    // UI設定
    animationQuality: 'high', // 高品質アニメーション
    particleEffects: true,    // パーティクル有効
    
    // デバッグ
    debugMode: false,         // デバッグ無効
    consoleLog: false         // ログ無効
};
```

---

## 11. 拡張性・将来展望

### 11.1 機能拡張候補

#### 新機能アイデア
- **マルチプレイヤー**: WebSocket通信での対戦
- **クラウドセーブ**: Firebase連携
- **AIアシスタント**: 最適戦略提案
- **VRモード**: WebXR対応3D空間
- **カスタムテーマ**: ユーザー定義スキン

### 11.2 技術的改良

#### 次世代技術対応
- **WebAssembly**: 物理演算高速化
- **Service Worker**: オフライン対応
- **WebGL**: 3D描画・シェーダー
- **PWA**: アプリ化・プッシュ通知
- **TypeScript**: 型安全性向上

---

## 12. 既知の問題・制限事項

### 12.1 現在の制限

- **ブラウザ依存**: WebAudio API対応要
- **メモリ使用**: 長時間プレイで履歴蓄積
- **音響遅延**: 一部デバイスで音響遅延
- **タッチ精度**: 小画面での選択精度

### 12.2 今後の修正予定

- 履歴データ自動クリア機能
- 音響遅延補償アルゴリズム  
- タッチ操作精度向上
- バッテリー消費最適化

---

## 13. 変更履歴

| バージョン | 日付 | 変更内容 |
|-----------|------|----------|
| 1.2.0 | 2025-08-23 | Enhanced-Fixed版・ST継続カウンター完全修正・文字表示問題解決 |
| 1.1.0 | 2025-08-22 | Enhanced版ベース・WebAudio統合・先バレシステム |
| 1.0.0 | 2025-08-21 | 初期Enhanced版リリース |

---

**文書作成日**: 2025年8月23日  
**最終更新**: 2025年8月23日  
**作成者**: Claude Code AI Assistant  
**バージョン**: 1.2.0  

---

## 付録A. Enhanced版と Ultimate版の比較

| 項目 | Enhanced Fixed版 | Ultimate版 |
|------|------------------|------------|
| 物理演算 | 高度 (重力・摩擦・空気抵抗) | 標準 (重力・反発) |
| 音響システム | WebAudio API統合 | なし |
| 先バレ機能 | あり (1/128・40%) | なし |
| 履歴システム | 詳細履歴・統計 | なし |
| UI複雑度 | 高 (多機能UI) | 中 (シンプル) |
| レスポンシブ | 完全対応 | 完全対応 |
| ST継続修正 | ✅ 完全修正 | ✅ 完全修正 |
| 文字表示修正 | ✅ 完全修正 | ✅ 完全修正 |
| 学習コスト | 高 | 低 |
| 拡張性 | 極高 | 中 |

**選択指針**: 
- **Enhanced Fixed版**: 高機能・本格派向け
- **Ultimate版**: シンプル・初心者向け