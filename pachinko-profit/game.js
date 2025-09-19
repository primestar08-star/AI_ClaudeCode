// 完全改良版パチンコマーブルゲーム - 物理・音響・ST修正版
class EnhancedPachinkoGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // ゲーム状態
        this.gameState = {
            mode: 'normal',
            spinCount: 0,
            ballCount: 0,
            stCount: 0,
            stRemaining: 144,
            stContinueCount: 0,
            chainCount: 0,
            isAutoPlay: false,
            autoPlaySpeed: 'normal',
            soundEnabled: true,
            autoStopped: false,
            
            // 履歴機能
            hitHistory: [],          // 当たり履歴 [{spin: 319, mode: 'normal'}, ...]
            normalSpinsSinceHit: 0,  // 通常時の当たりから経過回転数
            stSpinsSinceHit: 0,      // ST中の当たりから経過回転数
            
            // 先バレ状態管理
            isPreRevealing: false,   // 先バレ演出中フラグ
            preRevealAutoStopped: false, // 先バレでオート停止したフラグ
            
            // ST獲得玉数管理
            ballsAtSTStart: 0,       // ST開始時の玉数
            currentSTBalls: 0,       // 今回のSTで獲得した玉数
            
            // ST継続管理
            stContinueConfirmed: false, // ST継続確定フラグ
            stConsecutiveHits: 0,      // ST中の連続当たり回数 ⭐追加
            
            // ゲーム制御フラグ
            gameStarted: false       // ゲーム開始フラグ
        };
        
        // マーブル管理
        this.marbles = [];
        this.selectedMarbles = new Set();
        this.nextMarbleId = 0;
        
        // 物理演算設定（適度な重力版）
        this.physics = {
            gravity: 120,          // 適度な重力（自然に沈むが強すぎない）
            friction: 0.92,        // 高い摩擦で安定化
            airResistance: 0.97,   // 強い空気抵抗で速度制御
            restitution: 0.15,     // 小さな反発
            collisionDamping: 0.6, // しっかりした衝突減衰
            separationStrength: 0.8 // 適度な分離力
        };
        
        // ドラッグ状態
        this.isDragging = false;
        this.dragPath = [];
        this.lastDragPoint = null;
        
        // アニメーション・タイミング
        this.animationId = null;
        this.lastTime = 0;
        this.stableCheckInterval = 0;
        
        // 音響システム
        this.audioContext = null;
        this.soundBuffers = new Map();
        this.activeSounds = new Map(); // 再生中の音を追跡
        this.soundCooldowns = new Map(); // 音のクールダウン管理
        
        // 物理演算制御
        this.physicsEnabled = false;
        
        // 確率設定
        this.probabilities = {
            normal: 319,
            st: 144,          // STは1/144に修正
            preReveal: 128,
            preRevealHit: 0.4,
            stContinue: 99    // ST継続は毎回転1/99抽選
        };
        
        // マーブル色（Flutter風カラーパレット）
        this.marbleColors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
            '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52C7B8',
            '#FF69B4', '#00CED1', '#FFD700', '#FF1493', '#00FA9A',
            '#FF7F50', '#9370DB', '#32CD32', '#FF4500', '#DA70D6'
        ];
        
        this.initCanvas();
        this.initAudio();
        this.hideAllEffects(); // 全演出を強制非表示
        this.generatePhysicalMarbles();
        this.bindEvents();
        this.startGameLoop();
        
        console.log('完全改良版パチンコゲーム初期化完了');
    }
    
    // 当たりマーブルを激しく光らせる
    triggerWinningMarbleGlow() {
        if (this.lastSelectedMarbles && this.lastSelectedMarbles.length > 0) {
            console.log('✨ 当たり確定！最後に選択されたマーブルを光らせます');
            
            for (const marble of this.lastSelectedMarbles) {
                if (marble && !marble.popping) {
                    marble.isWinningMarble = true;
                    marble.winGlowIntensity = 3.0;
                    marble.winGlowColor = '#FFD700';
                    
                    // 2秒後に光を減衰
                    setTimeout(() => {
                        if (marble.winGlowIntensity) {
                            marble.winGlowIntensity *= 0.9;
                            if (marble.winGlowIntensity < 0.1) {
                                marble.isWinningMarble = false;
                                marble.winGlowIntensity = 0;
                            }
                        }
                    }, 2000);
                }
            }
        }
    }
    
    // 全ての演出エフェクトを強制非表示
    hideAllEffects() {
        const effectIds = ['chance-effect', 'miss-effect', 'celebrate-effect', 'blackout-effect', 'win-effect'];
        for (const id of effectIds) {
            const element = document.getElementById(id);
            if (element) {
                element.classList.remove('show');
                element.style.display = 'none'; // 強制的に非表示
            }
        }
        
        // STパネルも初期時は非表示にする
        const stPanel = document.getElementById('st-display');
        if (stPanel) {
            stPanel.classList.remove('active');
        }
        
        // 通知パネルも非表示にする
        const notification = document.getElementById('auto-stopped-notification');
        if (notification) {
            notification.classList.remove('show');
        }
        
        console.log('🧹 全演出エフェクト・パネルを初期化時に非表示化');
    }
    
    initCanvas() {
        const container = this.canvas.parentElement;
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
        
        // 高DPI対応
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.ctx.scale(dpr, dpr);
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
    }
    
    // Web Audio API初期化
    async initAudio() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // プログラム生成のリアルなクラック音を作成
            this.createSoundEffects();
            
            console.log('音響システム初期化完了');
        } catch (error) {
            console.warn('音響システム初期化失敗:', error);
        }
    }
    
    // プログラム生成音響効果
    createSoundEffects() {
        // クラック音生成
        this.createCrackSound();
        this.createPreRevealSound();
        this.createWinSound();
        this.createFreezeSound();
    }
    
    createCrackSound() {
        const sampleRate = this.audioContext.sampleRate;
        const duration = 0.15;
        const length = sampleRate * duration;
        const buffer = this.audioContext.createBuffer(1, length, sampleRate);
        const data = buffer.getChannelData(0);
        
        // 複雑な波形合成でリアルなクラック音
        for (let i = 0; i < length; i++) {
            const t = i / sampleRate;
            const envelope = Math.exp(-t * 15); // 急激な減衰
            
            // 複数周波数の合成
            let sample = 0;
            sample += Math.sin(2 * Math.PI * 2500 * t) * 0.3; // 基本周波数
            sample += Math.sin(2 * Math.PI * 4200 * t) * 0.2; // 高音成分
            sample += Math.sin(2 * Math.PI * 1800 * t) * 0.15; // 低音成分
            
            // ノイズ成分（クラック音のリアリティ）
            sample += (Math.random() * 2 - 1) * 0.1;
            
            // フィルタリング（高周波強調）
            if (i > 0) {
                sample = sample * 0.7 + data[i - 1] * 0.3;
            }
            
            data[i] = sample * envelope;
        }
        
        this.soundBuffers.set('crack', buffer);
    }
    
    createPreRevealSound() {
        const sampleRate = this.audioContext.sampleRate;
        const duration = 0.8;
        const length = sampleRate * duration;
        const buffer = this.audioContext.createBuffer(1, length, sampleRate);
        const data = buffer.getChannelData(0);
        
        // 上昇するシンセ音
        for (let i = 0; i < length; i++) {
            const t = i / sampleRate;
            const progress = t / duration;
            
            // 周波数が時間とともに上昇
            const freq = 400 + progress * 2000;
            const envelope = Math.sin(progress * Math.PI) * 0.5;
            
            data[i] = Math.sin(2 * Math.PI * freq * t) * envelope;
        }
        
        this.soundBuffers.set('preReveal', buffer);
    }
    
    createWinSound() {
        const sampleRate = this.audioContext.sampleRate;
        const duration = 1.0;
        const length = sampleRate * duration;
        const buffer = this.audioContext.createBuffer(1, length, sampleRate);
        const data = buffer.getChannelData(0);
        
        // ファンファーレ風
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C-E-G-C
        const noteLength = length / notes.length;
        
        for (let noteIndex = 0; noteIndex < notes.length; noteIndex++) {
            const freq = notes[noteIndex];
            const startSample = noteIndex * noteLength;
            
            for (let i = 0; i < noteLength; i++) {
                const globalI = startSample + i;
                if (globalI >= length) break;
                
                const t = i / sampleRate;
                const envelope = Math.exp(-t * 2) * 0.3;
                
                data[globalI] = Math.sin(2 * Math.PI * freq * t) * envelope;
            }
        }
        
        this.soundBuffers.set('win', buffer);
    }
    
    createFreezeSound() {
        const sampleRate = this.audioContext.sampleRate;
        const duration = 0.5;
        const length = sampleRate * duration;
        const buffer = this.audioContext.createBuffer(1, length, sampleRate);
        const data = buffer.getChannelData(0);
        
        // 氷の結晶音
        for (let i = 0; i < length; i++) {
            const t = i / sampleRate;
            const envelope = Math.exp(-t * 3);
            
            // 複数の高周波成分
            let sample = 0;
            sample += Math.sin(2 * Math.PI * 3200 * t) * 0.3;
            sample += Math.sin(2 * Math.PI * 6400 * t) * 0.2;
            sample += Math.sin(2 * Math.PI * 1600 * t) * 0.15;
            
            data[i] = sample * envelope;
        }
        
        this.soundBuffers.set('freeze', buffer);
    }
    
    // 音響再生（同時再生制限・クールダウン付き）
    async playSound(soundName, volume = 0.5, pitch = 1) {
        if (!this.gameState.soundEnabled || !this.audioContext || !this.soundBuffers.has(soundName)) {
            return;
        }
        
        // クールダウンチェック（同じ音の連続再生を防ぐ）
        const now = Date.now();
        const lastPlayed = this.soundCooldowns.get(soundName) || 0;
        const cooldownTime = soundName === 'crack' ? 50 : 100; // crack音は短めのクールダウン
        
        if (now - lastPlayed < cooldownTime) {
            return; // クールダウン中はスキップ
        }
        
        // 同時再生数チェック（最大4音まで）
        const activeCount = this.activeSounds.get(soundName) || 0;
        if (activeCount >= 4) {
            return; // 同じ音が4つ以上再生中ならスキップ
        }
        
        try {
            // AudioContextの再開（ブラウザポリシー対応）
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
            
            const buffer = this.soundBuffers.get(soundName);
            const source = this.audioContext.createBufferSource();
            const gainNode = this.audioContext.createGain();
            
            source.buffer = buffer;
            source.playbackRate.value = pitch;
            
            // 音量を調整（複数再生時は少し下げる）
            const adjustedVolume = volume * (1 - activeCount * 0.1);
            gainNode.gain.value = adjustedVolume;
            
            source.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            // 再生中カウントを増やす
            this.activeSounds.set(soundName, activeCount + 1);
            
            // 再生終了時にカウントを減らす
            source.onended = () => {
                const count = this.activeSounds.get(soundName) || 1;
                this.activeSounds.set(soundName, Math.max(0, count - 1));
            };
            
            source.start();
            
            // クールダウン更新
            this.soundCooldowns.set(soundName, now);
            
        } catch (error) {
            console.warn('音響再生エラー:', error);
        }
    }
    
    // 隙間なく敷き詰めるビー玉配置
    generatePhysicalMarbles() {
        const width = this.canvas.clientWidth || this.canvas.width;
        const height = this.canvas.clientHeight || this.canvas.height;
        
        this.marbles = [];
        this.nextMarbleId = 0;
        
        // 密集配置パラメータ
        const marbleRadius = 14;
        const topMargin = 110;
        const bottomMargin = 125;
        const sideMargin = 10;
        
        // 使用可能領域
        const availableHeight = height - topMargin - bottomMargin;
        const availableWidth = width - (sideMargin * 2);
        
        console.log('隙間なく敷き詰める配置開始...');
        
        // ゆったり配置（重複防止）
        const horizontalSpacing = marbleRadius * 2.8; // 大幅に間隔を拡大
        const verticalSpacing = marbleRadius * 2.5; // 大幅に間隔を拡大
        const rowCount = Math.floor(availableHeight / verticalSpacing);
        
        for (let row = 0; row < rowCount; row++) {
            const y = topMargin + marbleRadius + (row * verticalSpacing);
            const offsetX = (row % 2) * (horizontalSpacing * 0.5); // 交互配置
            const colCount = Math.floor((availableWidth - offsetX) / horizontalSpacing);
            
            for (let col = 0; col < colCount; col++) {
                const x = sideMargin + marbleRadius + offsetX + (col * horizontalSpacing);
                
                // ランダム性を排除して安定配置
                const finalX = x;
                const finalY = y;
                
                // 境界チェック
                if (finalX - marbleRadius < 0 || finalX + marbleRadius > width) {
                    continue;
                }
                
                const colorIndex = Math.floor(Math.random() * this.marbleColors.length);
                
                const marble = {
                    id: this.nextMarbleId++,
                    x: finalX,
                    y: finalY,
                    radius: marbleRadius + Math.random() * 2 - 1,
                    color: this.marbleColors[colorIndex],
                    
                    // 物理プロパティ
                    velocity: { x: 0, y: 0 },
                    mass: 1.0,
                    isStable: false, // 落下させるため不安定に設定
                    restTime: 0, // 初期は不安定
                    
                    // ビジュアルプロパティ
                    selected: false,
                    popping: false,
                    popAnimation: 0,
                    glowIntensity: 0,
                    rotation: Math.random() * Math.PI * 2,
                    rotationSpeed: 0.1 + Math.random() * 0.2,
                    shadowOpacity: 0.4,
                    hasGlow: false
                };
                
                this.marbles.push(marble);
            }
        }
        
        console.log(`箱積み配置マーブル生成完了: ${this.marbles.length}個`);
        
        // 配置が少ない場合の緊急フォールバック
        if (this.marbles.length < 30) {
            console.warn(`マーブル配置数が少ない！(${this.marbles.length}個) 緊急フォールバック実行`);
            this.generateFallbackMarbles(width, height);
        } else {
            console.log(`✅ 十分なマーブル数を確保: ${this.marbles.length}個`);
        }
        
        console.log(`最終マーブル数: ${this.marbles.length}個`);
        
        // 初期化後に物理演算を有効にしてマーブルを落下させる
        this.enablePhysicsAndStabilize();
    }
    
    // 物理演算を有効にしてマーブルを自然に落下・安定させる
    enablePhysicsAndStabilize() {
        console.log('🔄 物理演算を有効にしてマーブルを安定化中...');
        
        // 物理演算を一時的に有効化
        this.physicsEnabled = true;
        
        // 3秒間の安定化処理
        const stabilizeStart = performance.now();
        const stabilizeLoop = () => {
            const elapsed = performance.now() - stabilizeStart;
            
            if (elapsed < 3000) { // 3秒間物理演算を実行
                this.updatePhysics(1/60, false); // 60fps相当で更新
                requestAnimationFrame(stabilizeLoop);
            } else {
                // 安定化完了後に物理演算を無効化
                this.physicsEnabled = false;
                
                // 全マーブルを安定状態に設定
                for (const marble of this.marbles) {
                    marble.velocity.x = 0;
                    marble.velocity.y = 0;
                    marble.isStable = true;
                    marble.restTime = 999999;
                }
                
                console.log('✅ マーブル安定化完了 - 物理演算を無効化');
            }
        };
        
        stabilizeLoop();
    }
    
    // 緊急フォールバック：簡易グリッド配置
    generateFallbackMarbles(width, height) {
        const marbleRadius = 15;
        const topMargin = 120;
        const bottomMargin = 130;
        const spacing = marbleRadius * 2.2;
        
        // 簡単なグリッド配置で最低限のマーブルを確保
        for (let y = topMargin + marbleRadius; y < height - bottomMargin - marbleRadius; y += spacing) {
            for (let x = marbleRadius + 20; x < width - marbleRadius - 20; x += spacing) {
                if (this.marbles.length >= 150) break; // 十分な数があれば終了
                
                const colorIndex = Math.floor(Math.random() * this.marbleColors.length);
                
                const marble = {
                    id: this.nextMarbleId++,
                    x: x + (Math.random() - 0.5) * 10,
                    y: y + (Math.random() - 0.5) * 10,
                    radius: marbleRadius + Math.random() * 2,
                    color: this.marbleColors[colorIndex],
                    velocity: { x: 0, y: 0 },
                    mass: 1.0,
                    isStable: true,
                    restTime: 999999,
                    selected: false,
                    popping: false,
                    popAnimation: 0,
                    glowIntensity: 0,
                    rotation: Math.random() * Math.PI * 2,
                    rotationSpeed: 0.1 + Math.random() * 0.2,
                    shadowOpacity: 0.4,
                    hasGlow: false
                };
                
                this.marbles.push(marble);
            }
            if (this.marbles.length >= 150) break;
        }
        
        console.log(`フォールバック後のマーブル数: ${this.marbles.length}個`);        
    }
    
    // マーブル物理安定化
    stabilizeMarbles() {
        // 複数フレームにわたって物理演算を実行し、安定状態にする
        let stabilizationSteps = 180; // 3秒相当
        
        const stabilize = () => {
            if (stabilizationSteps <= 0) return;
            
            for (let i = 0; i < 3; i++) { // 1フレームで3回物理更新
                this.updatePhysics(1/180, true); // 高速安定化モード
            }
            
            stabilizationSteps--;
            requestAnimationFrame(stabilize);
        };
        
        stabilize();
    }
    
    bindEvents() {
        // 統一イベントハンドラー
        const getEventPos = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const clientX = e.clientX || (e.touches && e.touches[0].clientX);
            const clientY = e.clientY || (e.touches && e.touches[0].clientY);
            return {
                x: clientX - rect.left,
                y: clientY - rect.top
            };
        };
        
        const handleStart = (e) => {
            e.preventDefault();
            
            // 音響コンテキストの初期化（ユーザーインタラクション後）
            if (this.audioContext && this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }
            
            this.isDragging = true;
            this.selectedMarbles.clear();
            this.dragPath = [];
            
            const pos = getEventPos(e);
            this.dragPath.push(pos);
            this.lastDragPoint = pos;
            this.selectMarblesAtPoint(pos);
        };
        
        const handleMove = (e) => {
            if (!this.isDragging) return;
            e.preventDefault();
            
            const pos = getEventPos(e);
            this.dragPath.push(pos);
            
            // パス上のマーブル選択
            if (this.lastDragPoint) {
                this.selectMarblesAlongPath(this.lastDragPoint, pos);
            }
            
            this.selectMarblesAtPoint(pos);
            this.lastDragPoint = pos;
        };
        
        const handleEnd = (e) => {
            if (!this.isDragging) return;
            e.preventDefault();
            
            this.isDragging = false;
            
            if (this.selectedMarbles.size > 0) {
                this.popSelectedMarbles();
            }
            
            this.clearSelection();
        };
        
        // マウスイベント
        this.canvas.addEventListener('mousedown', handleStart);
        this.canvas.addEventListener('mousemove', handleMove);
        this.canvas.addEventListener('mouseup', handleEnd);
        this.canvas.addEventListener('mouseleave', handleEnd);
        
        // タッチイベント
        this.canvas.addEventListener('touchstart', handleStart, { passive: false });
        this.canvas.addEventListener('touchmove', handleMove, { passive: false });
        this.canvas.addEventListener('touchend', handleEnd, { passive: false });
        
        // UIボタンイベント
        document.getElementById('auto-btn').addEventListener('click', () => this.toggleAutoPlay());
        document.getElementById('speed-btn').addEventListener('click', () => this.changeSpeed());
        document.getElementById('sound-btn').addEventListener('click', () => this.toggleSound());
        document.getElementById('stats-btn').addEventListener('click', () => this.showStats());
        document.getElementById('history-btn').addEventListener('click', () => this.showHistoryModal());
        
        // リサイズ対応
        window.addEventListener('resize', () => {
            this.initCanvas();
            this.generatePhysicalMarbles();
        });
        
        console.log('完全改良版イベントバインド完了');
    }
    
    selectMarblesAtPoint(point) {
        const selectionRadius = 32;
        
        for (const marble of this.marbles) {
            if (marble.popping) continue;
            
            const distance = Math.sqrt((marble.x - point.x) ** 2 + (marble.y - point.y) ** 2);
            
            if (distance <= selectionRadius && !this.selectedMarbles.has(marble)) {
                this.selectedMarbles.add(marble);
                marble.selected = true;
                marble.hasGlow = true;
                marble.rotationSpeed = 3.0;
                
                // 選択音（軽いクリック音）
                this.playSound('crack', 0.2, 1.5);
            }
        }
    }
    
    selectMarblesAlongPath(start, end) {
        const steps = 20;
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const point = {
                x: start.x + (end.x - start.x) * t,
                y: start.y + (end.y - start.y) * t
            };
            this.selectMarblesAtPoint(point);
        }
    }
    
    clearSelection() {
        for (const marble of this.selectedMarbles) {
            marble.selected = false;
            marble.hasGlow = false;
            marble.rotationSpeed = 0.1 + Math.random() * 0.2;
        }
        this.selectedMarbles.clear();
        this.dragPath = [];
        this.lastDragPoint = null;
    }
    
    async popSelectedMarbles() {
        if (this.selectedMarbles.size === 0) return;
        
        // ゲーム開始前は処理を実行しない
        if (!this.gameState.gameStarted) {
            console.log('⚠️ ゲーム開始前のため、マーブル消去処理をスキップ');
            this.selectedMarbles.clear();
            return;
        }
        
        const count = this.selectedMarbles.size;
        console.log(`🎯 ${count}個のマーブル消去 → 即座に抽選実行`);
        
        // 全て同時に消す
        for (const marble of this.selectedMarbles) {
            // 即座にポップアニメーション開始
            marble.popping = true;
            marble.popAnimation = 0;
            
            // クラック音（まとめて1回）
            if (this.selectedMarbles.size === 1) {
                this.playSound('crack', 0.6, 1.0);
            }
        }
        
        // 複数個の場合は連続音
        if (count > 1) {
            this.playSound('crack', 0.7, 0.9);
            if (count > 3) {
                setTimeout(() => this.playSound('crack', 0.5, 1.2), 50);
            }
        }
        
        // ★即座に抽選処理を実行（ズレを解消）
        // 選択されたマーブルを記録（当たり時の光る演出用）
        this.lastSelectedMarbles = Array.from(this.selectedMarbles);
        
        for (let i = 0; i < count; i++) {
            this.processSpin();
        }
        
        // 300ms後にマーブルの見た目だけ更新
        setTimeout(() => {
            // マーブル削除
            this.marbles = this.marbles.filter(m => !m.popping);
            
            // 新しいマーブル追加
            this.addNewPhysicalMarbles(count);
            
            console.log(`${count}個のマーブル処理完了`);
        }, 300);
        
        // 選択をクリア
        this.selectedMarbles.clear();
    }
    
    // ポップ時の衝撃波
    applyPopImpulse(poppedMarble) {
        const impulseRadius = 80;
        const impulseForce = 50;
        
        for (const marble of this.marbles) {
            if (marble === poppedMarble || marble.popping) continue;
            
            const distance = Math.sqrt(
                (marble.x - poppedMarble.x) ** 2 + 
                (marble.y - poppedMarble.y) ** 2
            );
            
            if (distance < impulseRadius) {
                const force = impulseForce * (1 - distance / impulseRadius);
                const angle = Math.atan2(marble.y - poppedMarble.y, marble.x - poppedMarble.x);
                
                marble.velocity.x += Math.cos(angle) * force;
                marble.velocity.y += Math.sin(angle) * force;
                marble.isStable = false;
                marble.restTime = 0;
            }
        }
    }
    
    addNewPhysicalMarbles(count) {
        const width = this.canvas.clientWidth || this.canvas.width;
        const marbleRadius = 14;
        
        console.log(`🎯 ${count}個のビー玉を上から降らせます`);
        
        // 上から降ってくるビー玉を生成（より制御された配置）
        for (let i = 0; i < count; i++) {
            const colorIndex = Math.floor(Math.random() * this.marbleColors.length);
            
            // より制御された落下位置（左右の区間を分割）
            const section = i % 3; // 3つの区間に分ける
            const sectionWidth = (width - 120) / 3;
            const dropX = 60 + section * sectionWidth + sectionWidth / 2 + (Math.random() - 0.5) * 20;
            const dropY = 10 + i * -25; // より大きな間隔で落下
            
            const marble = {
                id: this.nextMarbleId++,
                x: dropX,
                y: dropY,
                radius: marbleRadius + Math.random() * 2 - 1,
                color: this.marbleColors[colorIndex],
                
                // 物理プロパティ（適度に降りてくるビー玉）
                velocity: { 
                    x: (Math.random() - 0.5) * 15, // 適度な横方向速度
                    y: Math.random() * 30 + 40 // 適度な下向き初速度
                },
                mass: 1.0,
                isStable: false, // 落下中は不安定
                restTime: 0,
                
                // ビジュアルプロパティ
                selected: false,
                popping: false,
                popAnimation: 0,
                glowIntensity: 0,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: 0.3 + Math.random() * 0.4, // 落下中は早く回転
                shadowOpacity: 0.4,
                hasGlow: false,
                
                // 落下ビー玉専用フラグ
                isFalling: true,
                fallStartTime: Date.now()
            };
            
            this.marbles.push(marble);
        }
        
        // 落下ビー玉用の物理演算を再有効化
        this.enablePhysicsForFallingMarbles();
    }
    
    // 落下ビー玉専用の物理演算制御
    enablePhysicsForFallingMarbles() {
        if (this.physicsEnabled) return; // すでに有効なら何もしない
        
        this.physicsEnabled = true;
        console.log('💫 落下ビー玉の物理演算を有効化');
    }
    
    // 改良されたスピン処理（履歴記録付き）
    processSpin() {
        // ゲーム開始前の実行を防ぐ（起動時先バレバグ対策）
        if (!this.gameState.gameStarted) {
            return;
        }
        
        this.gameState.spinCount++;
        
        // 履歴用のカウント更新
        if (this.gameState.mode === 'normal') {
            this.gameState.normalSpinsSinceHit++;
        } else {
            this.gameState.stSpinsSinceHit++;
        }
        
        this.updateDisplay();
        
        // ST中の特殊処理（通常時の抽選は一切行わない）
        if (this.gameState.mode === 'st') {
            this.gameState.stCount++;
            this.gameState.stRemaining--;
            
            // ST継続抽選（毎回転1/99、144回転目も含む）
            const stContinueRandom = Math.random();
            const stContinueProbability = 1 / this.probabilities.stContinue; // 1/99 = 0.0101...
            
            // デバッグ: 継続抽選の状況をログ出力
            if (this.gameState.stRemaining <= 20) {
                console.log(`🎲 ST継続抽選[残${this.gameState.stRemaining}]: ${stContinueRandom.toFixed(5)} vs ${stContinueProbability.toFixed(5)} (現在継続回数:${this.gameState.stContinueCount})`);
            }
            
            if (stContinueRandom < stContinueProbability) {
                console.log('🎊 ST継続確定！1/99を引きました');
                console.log('📊 継続抽選時の状態 - 残り回転:', this.gameState.stRemaining, '現在継続回数:', this.gameState.stContinueCount);
                
                // 144回転消化時の継続
                if (this.gameState.stRemaining <= 0) {
                    console.log('✅ 144回転目で継続確定！新しいSTセット開始');
                    console.log('🔄 continueST()を呼び出します...');
                    this.continueST();
                    console.log('🔄 continueST()完了後の継続回数:', this.gameState.stContinueCount);
                    this.updateDisplay();
                    return;
                } else {
                    this.gameState.stContinueConfirmed = true;
                    console.log('⏰ 継続確定フラグを設定（144回転消化待ち）');
                }
            } else if (this.gameState.stRemaining <= 0) {
                // 144回転目で1/99を引けなかった場合は終了
                console.log('❌ 144回転目で継続失敗、ST終了');
                this.endSTMode();
                this.updateDisplay();
                return;
            }
            
            // ST中の当たり判定（1/144）- 144回転目では実行しない
            if (this.gameState.stRemaining > 0) {
                const stHitRandom = Math.random();
                const stHitProbability = 1 / this.probabilities.st; // 1/144 = 0.00694...
                
                // デバッグ: 残り10回転以下の時のみログ出力
                if (this.gameState.stRemaining <= 10) {
                    console.log(`ST抽選[残${this.gameState.stRemaining}]: 継続=${stContinueRandom.toFixed(5)} vs ${stContinueProbability.toFixed(5)}, 当たり=${stHitRandom.toFixed(5)} vs ${stHitProbability.toFixed(5)}`);
                }
                
                if (stHitRandom < stHitProbability) {
                    // ST中連続当たりカウント
                    this.gameState.stConsecutiveHits++;
                    console.log(`🎊 ST中当たり！カウンターリセット [連続${this.gameState.stConsecutiveHits}回目]`);
                    
                    // 当たりマーブルを激しく光らせる
                    this.triggerWinningMarbleGlow();
                    
                    // ST中の当たり種類を決定
                    const stHitType = this.determineSTHitType();
                    
                    // 履歴に記録（ST中の回転数で記録）
                    this.gameState.hitHistory.push({
                        spin: this.gameState.stSpinsSinceHit,
                        mode: 'st',
                        hitType: stHitType,
                        timestamp: Date.now()
                    });
                    this.gameState.stSpinsSinceHit = 0;
                    
                    // ST中連続当たりエフェクト
                    if (this.gameState.stConsecutiveHits > 1) {
                        this.showSTConsecutiveHitEffect(this.gameState.stConsecutiveHits);
                    }
                    
                    this.gameState.stCount = 0;
                    this.gameState.stRemaining = 144;
                    this.gameState.stContinueConfirmed = false; // リセット
                    
                    // ボーナス処理
                    this.triggerSTBonus(stHitType);
                    this.updateDisplay();
                    return;
                }
            }
            
            this.updateDisplay();
            return; // ST中は通常時の抽選を一切行わない
        }
        
        // 以下は通常時のみの処理
        
        // 通常時の先バレチェック（ゲーム開始前は実行しない）
        if (this.gameState.gameStarted) {
            const preRevealRandom = Math.random();
            const preRevealProbability = 1 / this.probabilities.preReveal;
            if (preRevealRandom < preRevealProbability) {
                console.log(`🔮 先バレ発生！回転数: ${this.gameState.normalSpinsSinceHit}, 確率: ${preRevealRandom.toFixed(5)} < ${preRevealProbability.toFixed(5)}`);
                this.showPreRevealCountdown();
                return;
            }
        }
        
        // 通常時の当たり判定（ゲーム開始前は実行しない）
        if (this.gameState.gameStarted) {
            const normalHitRandom = Math.random();
            const normalHitProbability = 1 / this.probabilities.normal;
            if (normalHitRandom < normalHitProbability) {
            console.log(`🎯 通常当たり発生！回転数: ${this.gameState.normalSpinsSinceHit}, 確率: ${normalHitRandom.toFixed(5)} < ${normalHitProbability.toFixed(5)}`);
            
            // 当たりの種類を決定
            const hitType = this.determineHitType();
            
            // 履歴に記録（通常時の回転数で記録）
            this.gameState.hitHistory.push({
                spin: this.gameState.normalSpinsSinceHit,
                mode: 'normal',
                hitType: hitType,
                timestamp: Date.now()
            });
            this.gameState.normalSpinsSinceHit = 0;
            
                this.triggerWin(hitType);
            }
        }
    }
    
    // 通常時・先バレの当たり種類決定
    determineHitType() {
        const rand = Math.random();
        
        // 通常時の大当たり振り分け
        if (rand < 0.45) {
            return { rounds: 10, balls: 1500, name: '10R', hasST: false }; // STなし
        } else {
            return { rounds: 20, balls: 3000, name: '20R', hasST: true };  // STあり
        }
    }
    
    // ST中の当たり種類決定
    determineSTHitType() {
        const rand = Math.random();
        
        // ST中の大当たり振り分け
        if (rand < 0.5) {
            return { rounds: 10, balls: 1500, name: '10R' };
        } else if (rand < 0.75) {
            return { rounds: 20, balls: 3000, name: '20R' };
        } else {
            return { rounds: 2, balls: 300, name: '2R' };
        }
    }
    
    // ST中のボーナス（カウンターリセット時）
    async triggerSTBonus(hitType = null) {
        // ST継続ボーナス音
        await this.playSound('win', 0.6);
        
        // hitTypeが指定されている場合はそれを使用、なければランダム決定
        let selectedBonus;
        if (hitType) {
            selectedBonus = { balls: hitType.balls };
        } else {
            const bonusTypes = [
                { balls: 300, probability: 0.5 },
                { balls: 1500, probability: 0.3 },
                { balls: 3000, probability: 0.2 }
            ];
            
            const rand = Math.random();
            let cumulativeProb = 0;
            selectedBonus = bonusTypes[0];
            
            for (const bonus of bonusTypes) {
                cumulativeProb += bonus.probability;
                if (rand < cumulativeProb) {
                    selectedBonus = bonus;
                    break;
                }
            }
        }
        
        this.gameState.ballCount += selectedBonus.balls;
        this.gameState.currentSTBalls += selectedBonus.balls; // ST中の獲得玉数を追跡
        this.showWinEffect(selectedBonus.balls);
    }
    
    // 先バレ3カウントシステム（即座抽選版）
    async showPreRevealCountdown() {
        // ゲーム開始前は演出を実行しない
        if (!this.gameState.gameStarted) {
            console.log('⚠️ ゲーム開始前のため、先バレ演出をスキップ');
            return;
        }
        
        console.log('🔮 先バレ演出開始！即座に抽選実行');
        console.log('🔍 DEBUG: 呼び出しスタック:', new Error().stack);
        
        // ★即座に抽選結果を決定（ズレ解消）
        const isHit = Math.random() < this.probabilities.preRevealHit;
        console.log(`🎯 先バレ抽選結果: ${isHit ? '当たり!' : 'ハズレ...'} (演出後に表示)`);
        
        // 当たりの場合は種類も即座に決定
        let prerevealHitType = null;
        if (isHit) {
            prerevealHitType = this.determineHitType();
            
            // 履歴に即座に記録
            this.gameState.hitHistory.push({
                spin: this.gameState.normalSpinsSinceHit,
                mode: 'normal_prereveal',
                hitType: prerevealHitType,
                timestamp: Date.now()
            });
            this.gameState.normalSpinsSinceHit = 0;
        }
        
        // 先バレ状態開始
        this.gameState.isPreRevealing = true;
        
        // オートプレイ中なら一時停止
        if (this.gameState.isAutoPlay) {
            this.gameState.isAutoPlay = false;
            this.gameState.preRevealAutoStopped = true;
            this.stopAutoPlay();
            this.updateAutoButton();
            console.log('🔮 先バレ演出のためオートプレイ一時停止');
        }
        
        // 40%チャンス!!表示
        const chanceElement = document.getElementById('chance-effect');
        if (chanceElement) {
            // まずテキストを設定
            chanceElement.innerHTML = '🎰💰 激熱40%チャンス 💰🎰';
            // display:noneを解除してから表示
            chanceElement.style.display = '';
            chanceElement.classList.add('show');
        }
        this.playSound('preReveal');
        
        // 3カウントダウン
        for (let count = 3; count >= 1; count--) {
            setTimeout(() => {
                // カウント表示
                const countElement = document.getElementById('chance-effect');
                if (countElement) {
                    const isMobile = window.innerWidth <= 768;
                    const countSize = isMobile ? '72px' : '96px';
                    countElement.innerHTML = `🎰💰 激熱40%チャンス 💰🎰<br><span style="font-size: ${countSize}; color: #FF0000; text-shadow: 0 0 30px #FF0000, 0 0 60px #FFFF00; font-weight: 900;">${count}</span>`;
                    // 念のため再度表示状態を確認
                    countElement.style.display = '';
                    countElement.classList.add('show');
                }
                
                console.log(`40%チャンスカウント: ${count}`);
                
                // カウント音（1の時は特別な音）
                if (count === 1) {
                    this.playSound('preReveal', 0.6, 1.8); // 高めの音でドキドキ感UP
                } else {
                    this.playSound('preReveal', 0.4, 1.2 + count * 0.2);
                }
                
                // 「1」表示の直後に暗転（ノータイムで）
                if (count === 1) {
                    setTimeout(() => {
                        this.showBlackoutEffect();
                    }, 100); // 0.1秒後に即暗転
                }
                
            }, (3 - count) * 1000);
        }
        
        // 3.2秒後に結果表示（暗転終了と同時）
        setTimeout(() => {
            
            if (isHit) {
                // 先バレ当たり！お祝い演出
                this.showPreRevealHitCelebration();
                
                // 3秒後に当たり処理（抽選は既に完了）
                setTimeout(() => {
                    this.triggerWin(prerevealHitType);
                    this.finishPreReveal();
                }, 3000);
            } else {
                // 先バレハズレ！残念演出
                this.showPreRevealMiss();
                
                // 2.5秒後に演出終了
                setTimeout(() => {
                    this.finishPreReveal();
                }, 2500);
            }
        }, 3200); // 「1」から3.2秒後（暗転終了と同時）
    }
    
    // 暗転演出（ドキドキ感UP版）
    showBlackoutEffect() {
        console.log('⚫ 激熱暗転演出開始！ドキドキタイム！');
        const blackoutElement = document.getElementById('blackout-effect');
        const chanceElement = document.getElementById('chance-effect');
        
        // CHANCEエフェクトを即座に消す
        if (chanceElement) {
            chanceElement.classList.remove('show');
            chanceElement.style.display = 'none';
        }
        
        // 暗転を即座に表示
        if (blackoutElement) {
            blackoutElement.style.display = '';
            blackoutElement.classList.add('show');
        }
        
        // 暗転音（低音でドキドキ感演出）
        this.playSound('freeze', 0.5, 0.5); // 低い音でサスペンス感
        
        // 1.2秒後に暗転終了（ドキドキ感を高める長めの暗転）
        setTimeout(() => {
            if (blackoutElement) {
                blackoutElement.classList.remove('show');
            }
            console.log('⚪ 暗転演出終了 - 運命の結果発表!');
        }, 1200);
    }
    
    // 先バレ当たり時のお祝い演出
    showPreRevealHitCelebration() {
        // CHANCEエフェクトを消す
        const chanceElement = document.getElementById('chance-effect');
        if (chanceElement) {
            chanceElement.classList.remove('show');
        }
        
        // お祝い演出を表示
        const celebrateElement = document.getElementById('celebrate-effect');
        if (celebrateElement) {
            celebrateElement.innerHTML = '🎊 CONGRATULATIONS! 🎊<br>激熱40%チャンス的中！';
            celebrateElement.style.display = '';
            celebrateElement.classList.add('show');
        }
        
        // お祝い音を追加で再生
        this.playSound('win', 0.8, 1.2);
        
        // パーティクル風の追加エフェクト（1秒後）
        setTimeout(() => {
            this.playSound('preReveal', 0.4, 1.5);
        }, 1000);
        
        console.log('🎊 先バレ的中！お祝い演出表示');
    }
    
    // 先バレハズレ時の残念演出
    showPreRevealMiss() {
        // CHANCEエフェクトを消す
        const chanceElement = document.getElementById('chance-effect');
        if (chanceElement) {
            chanceElement.classList.remove('show');
        }
        
        // 残念演出を表示
        const missElement = document.getElementById('miss-effect');
        if (missElement) {
            missElement.innerHTML = '残念...<br>MISS';
            missElement.style.display = '';
            missElement.classList.add('show');
        }
        
        // 残念音（低い音程）
        this.playSound('freeze', 0.3, 0.6);
        
        console.log('😢 先バレハズレ...残念演出表示');
    }
    
    // 先バレ演出終了処理
    finishPreReveal() {
        this.gameState.isPreRevealing = false;
        
        // 全てのエフェクトを消す
        document.getElementById('chance-effect').classList.remove('show');
        document.getElementById('celebrate-effect').classList.remove('show');
        document.getElementById('miss-effect').classList.remove('show');
        
        // オートプレイが先バレで停止していた場合は再開
        if (this.gameState.preRevealAutoStopped) {
            this.gameState.preRevealAutoStopped = false;
            this.gameState.isAutoPlay = true;
            this.updateAutoButton();
            this.startAutoPlay();
            console.log('🔮 先バレ演出終了 - オートプレイ再開');
        }
    }
    
    async triggerWin(hitType = null) {
        console.log('初回当たり発生！', hitType ? `(${hitType.name} ${hitType.balls}玉)` : '');
        
        // 当たりマーブルを激しく光らせる
        this.triggerWinningMarbleGlow();
        
        // オート停止
        if (this.gameState.isAutoPlay) {
            this.gameState.isAutoPlay = false;
            this.gameState.autoStopped = true;
            this.showAutoStoppedNotification();
            this.updateAutoButton();
        }
        
        // 当たり演出（FREEZE削除）
        
        // hitTypeが指定されている場合はそれを使用、なければランダム決定
        let selectedBonus;
        if (hitType) {
            selectedBonus = { balls: hitType.balls };
        } else {
            const bonusTypes = [
                { balls: 300, probability: 0.4 },
                { balls: 1500, probability: 0.4 },
                { balls: 3000, probability: 0.2 }
            ];
            
            const rand = Math.random();
            let cumulativeProb = 0;
            selectedBonus = bonusTypes[0];
            
            for (const bonus of bonusTypes) {
                cumulativeProb += bonus.probability;
                if (rand < cumulativeProb) {
                    selectedBonus = bonus;
                    break;
                }
            }
        }
        
        this.gameState.ballCount += selectedBonus.balls;
        
        // STモード突入（hitTypeにhasST情報がある場合のみ）
        if (this.gameState.mode === 'normal' && hitType && hitType.hasST) {
            this.gameState.mode = 'st';
            this.gameState.stCount = 0;
            this.gameState.stRemaining = 144;
            this.gameState.chainCount++;
            this.gameState.stContinueConfirmed = false; // 新STセット開始
            
            // ST突入時はST回転数カウンターをリセット
            this.gameState.stSpinsSinceHit = 0;
            this.gameState.stConsecutiveHits = 0; // ST開始時に連続当たりカウントをリセット
            
            // ST開始時の玉数を記録
            this.gameState.ballsAtSTStart = this.gameState.ballCount;
            this.gameState.currentSTBalls = 0;
            
            this.showSTDisplay();
            console.log('🚀 STモード突入！144回転開始');
        } else if (this.gameState.mode === 'normal') {
            // STなし10Rの場合は通常時のまま
            console.log('💰 STなし当たり（通常時継続）');
        }
        
        setTimeout(() => {
            this.showWinEffect(selectedBonus.balls);
            this.playSound('win');
        }, 1000);
        
        this.updateDisplay();
    }
    
    continueST() {
        console.log('🔄 continueST()開始 - 現在の継続回数:', this.gameState.stContinueCount);
        this.gameState.stContinueCount++;
        console.log('🔄 ST継続回数をカウントアップ！新しい回数:', this.gameState.stContinueCount);
        
        this.gameState.stCount = 0;
        this.gameState.stRemaining = 144;
        this.gameState.stContinueConfirmed = false; // 新セットでリセット
        
        // ST継続時もST回転数カウンターをリセット
        this.gameState.stSpinsSinceHit = 0;
        
        // ST継続時は連続当たりカウントもリセット
        this.gameState.stConsecutiveHits = 0;
        
        console.log('🎊 ST継続完了！継続回数:', this.gameState.stContinueCount);
        
        // UI強制更新（継続回数も含む）
        this.updateDisplay();
        
        // ST継続回数の即座更新
        const stChainElement = document.getElementById('st-chain');
        if (stChainElement) {
            stChainElement.textContent = this.gameState.stContinueCount;
            console.log('✅ ST継続回数表示を更新:', this.gameState.stContinueCount);
        }
        
        // ST継続演出
        this.showEffect('chance');
        
        this.playSound('win', 0.7);
    }
    
    // ST中の連続当たりエフェクト表示
    showSTConsecutiveHitEffect(consecutiveCount) {
        console.log(`🎯 ST連続当たり表示: ${consecutiveCount}回`);
        
        // 連続当たり専用エフェクトテキストを作成
        const effectElement = document.getElementById('celebrate-effect');
        if (effectElement) {
            // 連続回数に応じたメッセージ
            let message = '';
            let color = '';
            
            if (consecutiveCount >= 10) {
                message = `🔥 MEGA連撃×${consecutiveCount} 🔥`;
                color = '#ff0080'; // 鮮やかなピンク
            } else if (consecutiveCount >= 5) {
                message = `⚡ 連撃×${consecutiveCount} FEVER! ⚡`;  
                color = '#00ffff'; // 鮮やかなシアン
            } else if (consecutiveCount >= 3) {
                message = `🌟 ${consecutiveCount}連続HIT! 🌟`;
                color = '#ff4500'; // オレンジレッド
            } else {
                message = `💫 ${consecutiveCount}連続! 💫`;
                color = '#ffd700'; // ゴールド
            }
            
            effectElement.innerHTML = message;
            effectElement.style.color = color;
            effectElement.style.fontSize = `${Math.min(48 + consecutiveCount * 2, 64)}px`;
            effectElement.classList.add('show');
            
            // 表示時間を連続回数に応じて調整
            const displayTime = Math.min(2000 + consecutiveCount * 200, 4000);
            setTimeout(() => {
                effectElement.classList.remove('show');
            }, displayTime);
            
            // 連続当たり専用音を再生
            if (consecutiveCount >= 5) {
                this.playSound('win', 0.9, 1.2); // 高音程
            } else {
                this.playSound('win', 0.7, 1.1);
            }
        }
    }
    
    endSTMode() {
        console.log('ST終了');
        
        // ST終了リザルト表示
        this.showSTResult();
        
        // 状態リセット
        this.gameState.mode = 'normal';
        this.gameState.stCount = 0;
        this.gameState.stRemaining = 144;
        this.gameState.chainCount = 0;
        this.gameState.stContinueCount = 0;
        this.gameState.stConsecutiveHits = 0; // ST終了時に連続当たりもリセット
        
        // 通常時に戻るので通常時回転数カウンターをリセット
        this.gameState.normalSpinsSinceHit = 0;
        
        this.hideSTDisplay();
    }
    
    showSTResult() {
        // 連チャン数 = ST初当たり1回 + ST継続回数
        const totalChains = 1 + this.gameState.stContinueCount;
        const continueCount = this.gameState.stContinueCount;
        const totalBalls = this.gameState.ballCount; // 現在の総獲得玉数
        const stBalls = this.gameState.currentSTBalls; // 今回のSTで獲得した玉数
        const ballsBeforeST = this.gameState.ballsAtSTStart; // ST開始前の玉数
        
        const resultMessage = `🎊 ST終了リザルト 🎊

📊 ST成績
連チャン数: ${totalChains}回
ST継続回数: ${continueCount}回

💰 獲得玉数
今回のST: ${stBalls}個
ST開始前: ${ballsBeforeST}個
現在の総計: ${totalBalls}個

🎮 通常時に戻ります
次回の1/319を目指しましょう！`;

        // アラート表示（3秒後に自動で消える）
        alert(resultMessage);
        
        console.log('ST終了リザルト:', {
            chains: totalChains,
            continues: continueCount,
            stBalls: stBalls,
            ballsBeforeST: ballsBeforeST,
            totalBalls: totalBalls
        });
    }
    
    // 高度な物理演算
    updatePhysics(deltaTime, fastMode = false) {
        const width = this.canvas.clientWidth || this.canvas.width;
        const height = this.canvas.clientHeight || this.canvas.height;
        const groundY = height - 130;
        
        // マーブル個別更新
        for (const marble of this.marbles) {
            if (marble.popping) {
                marble.popAnimation = Math.min(marble.popAnimation + deltaTime * 4, 1);
                continue;
            }
            
            // 重力適用
            if (!marble.isStable) {
                marble.velocity.y += this.physics.gravity * deltaTime;
            }
            
            // 空気抵抗
            marble.velocity.x *= this.physics.airResistance;
            marble.velocity.y *= this.physics.airResistance;
            
            // 位置更新
            marble.x += marble.velocity.x * deltaTime;
            marble.y += marble.velocity.y * deltaTime;
            
            // 境界衝突
            this.handleBoundaryCollision(marble, width, height, groundY);
            
            // 安定性チェック
            const speed = Math.sqrt(marble.velocity.x ** 2 + marble.velocity.y ** 2);
            if (speed < 5 && marble.y + marble.radius >= groundY - 5) {
                marble.restTime += deltaTime;
                if (marble.restTime > 0.2) {
                    marble.isStable = true;
                    marble.velocity.x = 0;
                    marble.velocity.y = 0;
                }
            } else {
                marble.restTime = 0;
                marble.isStable = false;
            }
            
            // ビジュアル更新
            marble.rotation += marble.rotationSpeed * deltaTime;
            
            // グロー効果
            if (marble.selected || marble.hasGlow) {
                marble.glowIntensity = Math.min(marble.glowIntensity + deltaTime * 4, 1);
            } else {
                marble.glowIntensity = Math.max(marble.glowIntensity - deltaTime * 3, 0);
            }
        }
        
        // マーブル間衝突処理（強化版）
        if (!fastMode) {
            // 3回繰り返しで確実な分離を保証
            for (let iteration = 0; iteration < 3; iteration++) {
                this.updateCollisions();
                this.applySeparationForces();
                this.resolveOverlaps(); // 重複解決処理を追加
            }
        }
    }
    
    handleBoundaryCollision(marble, width, height, groundY) {
        // 左右の壁
        if (marble.x - marble.radius < 0) {
            marble.x = marble.radius;
            marble.velocity.x = -marble.velocity.x * this.physics.restitution;
        } else if (marble.x + marble.radius > width) {
            marble.x = width - marble.radius;
            marble.velocity.x = -marble.velocity.x * this.physics.restitution;
        }
        
        // 地面
        if (marble.y + marble.radius > groundY) {
            marble.y = groundY - marble.radius;
            marble.velocity.y = -marble.velocity.y * this.physics.restitution;
            marble.velocity.x *= this.physics.friction;
            
            // 地面反発時の安定化処理
            if (Math.abs(marble.velocity.y) < 20) {
                marble.velocity.y = 0;
            }
        }
        
        // 天井（新しいマーブルが上から来る場合）
        if (marble.y - marble.radius < 0) {
            marble.y = marble.radius;
            marble.velocity.y = Math.abs(marble.velocity.y) * 0.5;
        }
    }
    
    updateCollisions() {
        // 改良された衝突検出（重複防止を強化）
        const processedPairs = new Set();
        
        for (let i = 0; i < this.marbles.length; i++) {
            for (let j = i + 1; j < this.marbles.length; j++) {
                const marbleA = this.marbles[i];
                const marbleB = this.marbles[j];
                
                if (marbleA.popping || marbleB.popping) continue;
                
                const pairKey = `${i}-${j}`;
                if (processedPairs.has(pairKey)) continue;
                processedPairs.add(pairKey);
                
                const dx = marbleA.x - marbleB.x;
                const dy = marbleA.y - marbleB.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const minDistance = (marbleA.radius + marbleB.radius) * 1.15; // 15%のバッファで絶対重複防止
                
                if (distance < minDistance) {
                    // 強化された衝突解決
                    this.resolveCollisionImproved(marbleA, marbleB, dx, dy, distance, minDistance);
                }
            }
        }
    }
    
    resolveCollisionImproved(marbleA, marbleB, dx, dy, distance, minDistance) {
        // 重なりが極端な場合の緊急処理
        if (distance < 0.1) {
            // 完全に重なっている場合、強制的に離す
            const angle = Math.random() * Math.PI * 2;
            dx = Math.cos(angle) * minDistance;
            dy = Math.sin(angle) * minDistance;
            distance = minDistance;
        }
        
        // 超強化された位置補正
        const overlap = minDistance - distance;
        const separationForce = overlap * 1.0; // 完全な分離力
        
        // 正規化されたベクトル
        const normalX = dx / distance;
        const normalY = dy / distance;
        
        // 質量を考慮した位置補正（重いものは動きにくい）
        const totalMass = marbleA.mass + marbleB.mass;
        const ratioA = marbleB.mass / totalMass;
        const ratioB = marbleA.mass / totalMass;
        
        // 位置を強制的に分離
        marbleA.x += normalX * separationForce * ratioA;
        marbleA.y += normalY * separationForce * ratioA;
        marbleB.x -= normalX * separationForce * ratioB;
        marbleB.y -= normalY * separationForce * ratioB;
        
        // 境界チェック（押し出された結果が境界を超えていないか）
        const width = this.canvas.clientWidth || this.canvas.width;
        const height = this.canvas.clientHeight || this.canvas.height;
        const groundY = height - 130;
        
        marbleA.x = Math.max(marbleA.radius, Math.min(width - marbleA.radius, marbleA.x));
        marbleB.x = Math.max(marbleB.radius, Math.min(width - marbleB.radius, marbleB.x));
        marbleA.y = Math.max(marbleA.radius, Math.min(groundY - marbleA.radius, marbleA.y));
        marbleB.y = Math.max(marbleB.radius, Math.min(groundY - marbleB.radius, marbleB.y));
        
        // 改良された速度計算
        const relativeVelX = marbleA.velocity.x - marbleB.velocity.x;
        const relativeVelY = marbleA.velocity.y - marbleB.velocity.y;
        
        // 法線方向の相対速度
        const relativeSpeed = relativeVelX * normalX + relativeVelY * normalY;
        
        // 分離中なら衝突しない
        if (relativeSpeed > 0) return;
        
        // 反発係数を適用した衝突計算
        const restitution = this.physics.restitution;
        const impulse = -(1 + restitution) * relativeSpeed / totalMass;
        
        // 速度更新（より現実的な衝突）
        const damping = this.physics.collisionDamping;
        marbleA.velocity.x += impulse * marbleB.mass * normalX * damping;
        marbleA.velocity.y += impulse * marbleB.mass * normalY * damping;
        marbleB.velocity.x -= impulse * marbleA.mass * normalX * damping;
        marbleB.velocity.y -= impulse * marbleA.mass * normalY * damping;
        
        // 接触摩擦
        const frictionCoeff = 0.1;
        const tangentX = -normalY;
        const tangentY = normalX;
        const tangentSpeed = relativeVelX * tangentX + relativeVelY * tangentY;
        const frictionImpulse = tangentSpeed * frictionCoeff;
        
        marbleA.velocity.x -= frictionImpulse * tangentX;
        marbleA.velocity.y -= frictionImpulse * tangentY;
        marbleB.velocity.x += frictionImpulse * tangentX;
        marbleB.velocity.y += frictionImpulse * tangentY;
        
        // 安定性リセット
        marbleA.isStable = false;
        marbleB.isStable = false;
        marbleA.restTime = 0;
        marbleB.restTime = 0;
    }
    
    // 重複解決処理（強制的位置補正）
    resolveOverlaps() {
        for (let i = 0; i < this.marbles.length; i++) {
            const marbleA = this.marbles[i];
            if (marbleA.popping) continue;
            
            for (let j = i + 1; j < this.marbles.length; j++) {
                const marbleB = this.marbles[j];
                if (marbleB.popping) continue;
                
                const dx = marbleB.x - marbleA.x;
                const dy = marbleB.y - marbleA.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const minDistance = marbleA.radius + marbleB.radius;
                
                // 重複している場合は強制的に分離
                if (distance < minDistance && distance > 0) {
                    const overlap = minDistance - distance;
                    const correctionRatio = overlap / distance * 0.5; // 半分ずつ移動
                    
                    const correctionX = dx * correctionRatio;
                    const correctionY = dy * correctionRatio;
                    
                    // 位置を強制補正
                    marbleA.x -= correctionX;
                    marbleA.y -= correctionY;
                    marbleB.x += correctionX;
                    marbleB.y += correctionY;
                    
                    // 両方とも不安定状態に
                    marbleA.isStable = false;
                    marbleB.isStable = false;
                    marbleA.restTime = 0;
                    marbleB.restTime = 0;
                }
            }
        }
    }
    
    // 追加の分離力適用（絶対重複防止）
    applySeparationForces() {
        const separationRadius = 35; // 厳格な分離半径
        const separationStrength = this.physics.separationStrength * 1.5; // 分離力を1.5倍
        
        for (let i = 0; i < this.marbles.length; i++) {
            const marble = this.marbles[i];
            if (marble.popping) continue;
            
            let totalForceX = 0;
            let totalForceY = 0;
            let neighborCount = 0;
            
            // 近隣マーブルからの分離力を計算
            for (let j = 0; j < this.marbles.length; j++) {
                if (i === j) continue;
                
                const other = this.marbles[j];
                if (other.popping) continue;
                
                const dx = marble.x - other.x;
                const dy = marble.y - other.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                // 近すぎる場合は分離力を適用
                if (distance < separationRadius && distance > 0) {
                    const force = separationStrength * (separationRadius - distance) / separationRadius;
                    const normalizedDx = dx / distance;
                    const normalizedDy = dy / distance;
                    
                    totalForceX += normalizedDx * force;
                    totalForceY += normalizedDy * force;
                    neighborCount++;
                }
            }
            
            // 分離力が強い場合は位置を直接調整
            if (neighborCount > 0) {
                const avgForceX = totalForceX / neighborCount;
                const avgForceY = totalForceY / neighborCount;
                
                // 位置調整（最大限）
                marble.x += avgForceX * 3;
                marble.y += avgForceY * 3;
                
                // 速度にも強力な分離力を適用
                marble.velocity.x += avgForceX * 20;
                marble.velocity.y += avgForceY * 20;
                
                // 境界内に制限
                const width = this.canvas.clientWidth || this.canvas.width;
                const height = this.canvas.clientHeight || this.canvas.height;
                const groundY = height - 130;
                
                marble.x = Math.max(marble.radius, Math.min(width - marble.radius, marble.x));
                marble.y = Math.max(marble.radius, Math.min(groundY - marble.radius, marble.y));
                
                // 強制的に不安定状態に
                marble.isStable = false;
                marble.restTime = 0;
            }
        }
    }
    
    // UI制御メソッド群は前版と同じため省略...
    // （続きは次のレスポンスで）
    
    // ゲームループ
    startGameLoop() {
        const gameLoop = (currentTime) => {
            const deltaTime = Math.min((currentTime - this.lastTime) / 1000, 1/30); // 最大33ms
            this.lastTime = currentTime;
            
            this.update(deltaTime);
            this.render();
            
            this.animationId = requestAnimationFrame(gameLoop);
        };
        
        this.animationId = requestAnimationFrame(gameLoop);
        
        // ゲームループ開始後にゲーム開始フラグを設定（初期化完了）
        setTimeout(() => {
            this.gameState.gameStarted = true;
            console.log('🎮 ゲーム開始フラグ設定完了');
        }, 100);
    }
    
    update(deltaTime) {
        // 落下中のビー玉がある場合のみ物理演算を実行
        const hasFallingMarbles = this.marbles.some(m => m.isFalling || !m.isStable);
        
        if (hasFallingMarbles) {
            this.updatePhysics(deltaTime); // 物理演算実行
            
            // 全ビー玉が安定したかチェック
            this.stableCheckInterval += deltaTime;
            if (this.stableCheckInterval > 1.0) {
                this.checkFallStability();
                this.stableCheckInterval = 0;
            }
        }
        
        // 常時更新するアニメーション
        for (const marble of this.marbles) {
            // ポップアニメーション
            if (marble.popping) {
                marble.popAnimation = Math.min(marble.popAnimation + deltaTime * 4, 1);
            }
            
            // 選択エフェクト
            if (marble.selected) {
                marble.rotation += marble.rotationSpeed * deltaTime;
                marble.glowIntensity = 0.8 + Math.sin(Date.now() * 0.008) * 0.2;
            } else if (!marble.isStable) {
                // 落下中のマーブルは回転
                marble.rotation += marble.rotationSpeed * deltaTime;
            }
        }
    }
    
    // 落下安定性チェック
    checkFallStability() {
        let unstableCount = 0;
        const now = Date.now();
        
        for (const marble of this.marbles) {
            if (marble.isFalling || !marble.isStable) {
                const speed = Math.sqrt(marble.velocity.x ** 2 + marble.velocity.y ** 2);
                
                // 速度が十分小さく、一定時間経過したら安定とみなす
                if (speed < 10 && (now - marble.fallStartTime) > 2000) {
                    marble.isStable = true;
                    marble.isFalling = false;
                    marble.rotationSpeed = 0.1 + Math.random() * 0.2; // 通常の回転速度に戻す
                    console.log(`ビー玉${marble.id}が安定しました`);
                } else {
                    unstableCount++;
                }
            }
        }
        
        // 全て安定したら物理演算を停止
        if (unstableCount === 0) {
            this.physicsEnabled = false;
            console.log('💤 全ビー玉が安定 - 物理演算を停止');
        }
    }
    
    checkOverallStability() {
        // 全体的な安定性チェック（マーブルが正しく積み重なっているか）
        let unstableCount = 0;
        for (const marble of this.marbles) {
            if (!marble.isStable && !marble.popping) {
                unstableCount++;
            }
        }
        
        // 安定していないマーブルが多い場合は物理演算を強化
        if (unstableCount > this.marbles.length * 0.1) {
            console.log(`不安定なマーブル: ${unstableCount}個 - 物理演算強化中`);
        }
    }
    
    render() {
        const width = this.canvas.clientWidth || this.canvas.width;
        const height = this.canvas.clientHeight || this.canvas.height;
        
        // 画面クリア
        this.ctx.clearRect(0, 0, width, height);
        
        // 背景効果
        this.drawStarField();
        
        // マーブル描画（前版と同じ）
        this.drawMarbles();
        
        // ドラッグパス描画
        this.drawDragPath();
        
        // 物理デバッグ情報（開発用）
        if (window.location.hash === '#debug') {
            this.drawPhysicsDebug();
        }
    }
    
    drawPhysicsDebug() {
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        this.ctx.font = '12px monospace';
        
        let stableCount = 0;
        let movingCount = 0;
        
        for (const marble of this.marbles) {
            if (marble.isStable) stableCount++;
            else movingCount++;
        }
        
        this.ctx.fillText(`安定: ${stableCount} 移動中: ${movingCount}`, 10, 20);
        this.ctx.fillText(`総マーブル: ${this.marbles.length}`, 10, 35);
    }
    
    // UI制御メソッド
    updateDisplay() {
        document.getElementById('spin-count').textContent = this.gameState.spinCount;
        document.getElementById('ball-count').textContent = this.gameState.ballCount;
        document.getElementById('st-count').textContent = this.gameState.stCount;
        document.getElementById('st-chain').textContent = this.gameState.stContinueCount;
        
        // ST連続当たり回数表示更新
        const consecutiveElement = document.getElementById('st-consecutive-hits');
        if (consecutiveElement) {
            consecutiveElement.textContent = this.gameState.stConsecutiveHits;
            
            // 3回以上でフィーバー表示
            if (this.gameState.stConsecutiveHits >= 3) {
                consecutiveElement.classList.add('fever');
            } else {
                consecutiveElement.classList.remove('fever');
            }
        }
        
        const modeText = document.getElementById('mode-text');
        const probabilityText = document.getElementById('probability-text');
        
        if (this.gameState.mode === 'st') {
            modeText.textContent = 'SPECIAL TIME';
            modeText.classList.add('st');
            probabilityText.textContent = '1/144';
        } else {
            modeText.textContent = '通常時';
            modeText.classList.remove('st');
            probabilityText.textContent = '1/319';
        }
    }

    showEffect(type) {
        // ゲーム開始前は演出を実行しない
        if (!this.gameState.gameStarted) {
            console.log(`⚠️ ゲーム開始前のため、${type}演出をスキップ`);
            return;
        }
        
        const effectElement = document.getElementById(`${type}-effect`);
        if (effectElement) {
            effectElement.style.display = ''; // display:noneを解除
            effectElement.classList.add('show');
            
            setTimeout(() => {
                effectElement.classList.remove('show');
            }, type === 'chance' ? 2000 : 1500);
        }
    }

    showWinEffect(amount) {
        const winElement = document.getElementById('win-effect');
        if (winElement) {
            winElement.innerHTML = `BIG BONUS!!<br>+<span id="win-amount">${amount}</span>`;
            winElement.style.display = '';
            winElement.classList.add('show');
            
            setTimeout(() => {
                winElement.classList.remove('show');
            }, 1500);
        }
    }

    showSTDisplay() {
        document.getElementById('st-display').classList.add('active');
    }

    hideSTDisplay() {
        document.getElementById('st-display').classList.remove('active');
    }

    showAutoStoppedNotification() {
        const notification = document.getElementById('auto-stopped-notification');
        notification.classList.add('show');
        
        setTimeout(() => {
            notification.classList.remove('show');
            this.gameState.autoStopped = false;
        }, 3000);
    }

    toggleAutoPlay() {
        this.gameState.isAutoPlay = !this.gameState.isAutoPlay;
        this.gameState.autoStopped = false;
        this.updateAutoButton();
        
        if (this.gameState.isAutoPlay) {
            this.startAutoPlay();
        } else {
            this.stopAutoPlay();
        }
    }

    updateAutoButton() {
        const btn = document.getElementById('auto-btn');
        const icon = btn.querySelector('.control-icon');
        const label = btn.querySelector('.control-label');
        
        btn.classList.remove('active', 'auto-stopped');
        
        if (this.gameState.isAutoPlay) {
            btn.classList.add('active');
            icon.textContent = '⏸';
            label.textContent = 'オート中';
        } else if (this.gameState.autoStopped) {
            btn.classList.add('auto-stopped');
            icon.textContent = '▶';
            label.textContent = '停止中';
        } else {
            icon.textContent = '▶';
            label.textContent = 'オート';
        }
    }

    startAutoPlay() {
        // 速度ごとの設定：インターバル時間と消去個数
        const speedConfigs = {
            normal: { interval: 800, marbleCount: 1 },  // 標準：1個ずつ
            fast: { interval: 400, marbleCount: 2 },    // 高速：2個ずつ  
            ultra: { interval: 150, marbleCount: 3 }    // 超速：3個ずつ
        };
        
        const config = speedConfigs[this.gameState.autoPlaySpeed];
        
        this.autoInterval = setInterval(() => {
            if (!this.gameState.isAutoPlay) {
                this.stopAutoPlay();
                return;
            }
            
            this.simulateAutoPlay(config.marbleCount);
        }, config.interval);
    }

    stopAutoPlay() {
        if (this.autoInterval) {
            clearInterval(this.autoInterval);
            this.autoInterval = null;
        }
    }

    simulateAutoPlay(marbleCount = 1) {
        if (this.marbles.length === 0) return;
        
        // 指定された個数のマーブルを選択
        const availableMarbles = this.marbles.filter(m => !m.popping);
        const numToSelect = Math.min(marbleCount, availableMarbles.length); // 指定個数または残り個数の少ない方
        
        if (availableMarbles.length === 0) return;
        
        this.selectedMarbles.clear();
        
        // シャッフルしてからランダム選択
        const shuffledMarbles = [...availableMarbles].sort(() => Math.random() - 0.5);
        
        for (let i = 0; i < numToSelect; i++) {
            const marble = shuffledMarbles[i];
            if (!this.selectedMarbles.has(marble)) {
                this.selectedMarbles.add(marble);
                marble.selected = true;
                marble.hasGlow = true;
            }
        }
        
        console.log(`🤖 オート選択: ${this.selectedMarbles.size}個のマーブルを選択 (速度: ${this.gameState.autoPlaySpeed})`);
        
        if (this.selectedMarbles.size > 0) {
            this.popSelectedMarbles();
        }
    }

    changeSpeed() {
        const speeds = ['normal', 'fast', 'ultra'];
        const speedNames = { normal: '標準', fast: '高速', ultra: '超速' };
        
        const currentIndex = speeds.indexOf(this.gameState.autoPlaySpeed);
        this.gameState.autoPlaySpeed = speeds[(currentIndex + 1) % speeds.length];
        
        const label = document.getElementById('speed-btn').querySelector('.control-label');
        label.textContent = `速度: ${speedNames[this.gameState.autoPlaySpeed]}`;
        
        if (this.gameState.isAutoPlay) {
            this.stopAutoPlay();
            this.startAutoPlay();
        }
    }

    toggleSound() {
        this.gameState.soundEnabled = !this.gameState.soundEnabled;
        const icon = document.getElementById('sound-btn').querySelector('.control-icon');
        icon.textContent = this.gameState.soundEnabled ? '🔊' : '🔇';
        
        console.log('音声:', this.gameState.soundEnabled ? 'ON' : 'OFF');
    }

    // 描画メソッド
    drawStarField() {
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        
        const width = this.canvas.clientWidth || this.canvas.width;
        const height = this.canvas.clientHeight || this.canvas.height;
        
        const stars = [
            { x: width * 0.1, y: height * 0.1 },
            { x: width * 0.3, y: height * 0.15 },
            { x: width * 0.7, y: height * 0.08 },
            { x: width * 0.9, y: height * 0.2 },
            { x: width * 0.15, y: height * 0.4 },
            { x: width * 0.8, y: height * 0.35 },
            { x: width * 0.2, y: height * 0.6 },
            { x: width * 0.6, y: height * 0.7 },
            { x: width * 0.85, y: height * 0.8 },
            { x: width * 0.4, y: height * 0.9 }
        ];
        
        for (const star of stars) {
            this.ctx.beginPath();
            this.ctx.arc(star.x, star.y, 1.5, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }

    drawMarbles() {
        // 深度ソート（奥から手前へ）
        const sortedMarbles = [...this.marbles].sort((a, b) => a.y - b.y);
        
        for (const marble of sortedMarbles) {
            if (marble.popping && marble.popAnimation > 0.8) {
                this.drawShatterEffect(marble);
            } else {
                this.drawRichMarble(marble);
            }
        }
    }

    drawRichMarble(marble) {
        const ctx = this.ctx;
        
        // 影
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
        ctx.shadowBlur = 12;
        ctx.shadowOffsetX = 4;
        ctx.shadowOffsetY = 6;
        
        // グロー効果（選択時）
        if (marble.glowIntensity > 0) {
            ctx.shadowColor = marble.color;
            ctx.shadowBlur = 25 * marble.glowIntensity;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
        }
        
        // 当たり確定時の激しいグロー効果
        if (marble.isWinningMarble && marble.winGlowIntensity > 0) {
            ctx.shadowColor = marble.winGlowColor || '#FFD700';
            ctx.shadowBlur = 50 * marble.winGlowIntensity * (1 + Math.sin(Date.now() * 0.02) * 0.3);
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
        }
        
        // メインマーブル（よりリッチなグラデーション）
        const gradient = ctx.createRadialGradient(
            marble.x - marble.radius * 0.3, marble.y - marble.radius * 0.3, 0,
            marble.x, marble.y, marble.radius
        );
        
        const color = marble.color;
        gradient.addColorStop(0, this.lightenColor(color, 0.4));
        gradient.addColorStop(0.3, this.lightenColor(color, 0.2));
        gradient.addColorStop(0.7, color);
        gradient.addColorStop(1, this.darkenColor(color, 0.3));
        
        ctx.fillStyle = gradient;
        
        // ポップアニメーション
        let scale = 1;
        let alpha = 1;
        
        if (marble.popping) {
            scale = 1 + marble.popAnimation * 0.8;
            alpha = 1 - marble.popAnimation;
        }
        
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(marble.x, marble.y, marble.radius * scale, 0, Math.PI * 2);
        ctx.fill();
        
        // より美しい外枠
        ctx.strokeStyle = this.darkenColor(color, 0.2);
        ctx.lineWidth = 1.5;
        ctx.stroke();
        
        // 強化されたハイライト
        const highlightGradient = ctx.createRadialGradient(
            marble.x - marble.radius * 0.4, marble.y - marble.radius * 0.4, 0,
            marble.x - marble.radius * 0.4, marble.y - marble.radius * 0.4, marble.radius * 0.7
        );
        highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
        highlightGradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.4)');
        highlightGradient.addColorStop(0.8, 'rgba(255, 255, 255, 0.1)');
        highlightGradient.addColorStop(1, 'transparent');
        
        ctx.fillStyle = highlightGradient;
        ctx.beginPath();
        ctx.arc(marble.x - marble.radius * 0.3, marble.y - marble.radius * 0.3, marble.radius * 0.5, 0, Math.PI * 2);
        ctx.fill();
        
        // 選択時の強化されたスパークル
        if (marble.selected) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.lineWidth = 2.5;
            
            ctx.save();
            ctx.translate(marble.x, marble.y);
            ctx.rotate(marble.rotation);
            
            // 十字スパークル
            ctx.beginPath();
            ctx.moveTo(-marble.radius * 0.9, 0);
            ctx.lineTo(marble.radius * 0.9, 0);
            ctx.moveTo(0, -marble.radius * 0.9);
            ctx.lineTo(0, marble.radius * 0.9);
            ctx.stroke();
            
            // 斜めスパークル
            ctx.rotate(Math.PI / 4);
            ctx.beginPath();
            ctx.moveTo(-marble.radius * 0.6, 0);
            ctx.lineTo(marble.radius * 0.6, 0);
            ctx.moveTo(0, -marble.radius * 0.6);
            ctx.lineTo(0, marble.radius * 0.6);
            ctx.stroke();
            
            ctx.restore();
        }
        
        // 当たり確定時の激しい光り輪っかエフェクト
        if (marble.isWinningMarble && marble.winGlowIntensity > 0) {
            const time = Date.now() * 0.01;
            const pulseSize = 1.5 + Math.sin(time) * 0.3;
            
            // 外側の光の輪
            ctx.strokeStyle = marble.winGlowColor || '#FFD700';
            ctx.lineWidth = 6;
            ctx.globalAlpha = 0.8 * (1 + Math.sin(time * 1.5) * 0.4);
            
            ctx.beginPath();
            ctx.arc(marble.x, marble.y, marble.radius * pulseSize, 0, Math.PI * 2);
            ctx.stroke();
            
            // 内側の光の輪
            ctx.lineWidth = 3;
            ctx.globalAlpha = 0.6 * (1 + Math.cos(time * 2) * 0.3);
            
            ctx.beginPath();
            ctx.arc(marble.x, marble.y, marble.radius * (pulseSize - 0.3), 0, Math.PI * 2);
            ctx.stroke();
            
            // 放射状の光線
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.7;
            for (let i = 0; i < 8; i++) {
                const angle = (i / 8) * Math.PI * 2 + time * 0.5;
                const innerRadius = marble.radius * 0.8;
                const outerRadius = marble.radius * (1.8 + Math.sin(time + i) * 0.2);
                
                ctx.beginPath();
                ctx.moveTo(
                    marble.x + Math.cos(angle) * innerRadius,
                    marble.y + Math.sin(angle) * innerRadius
                );
                ctx.lineTo(
                    marble.x + Math.cos(angle) * outerRadius,
                    marble.y + Math.sin(angle) * outerRadius
                );
                ctx.stroke();
            }
        }
        
        ctx.restore();
        ctx.globalAlpha = 1;
    }

    drawShatterEffect(marble) {
        const ctx = this.ctx;
        
        ctx.strokeStyle = marble.color;
        ctx.lineWidth = 4;
        ctx.globalAlpha = 1 - marble.popAnimation;
        
        // より激しい放射状の破砕線
        for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            const startRadius = marble.radius * 0.2;
            const endRadius = marble.radius * (1.5 + marble.popAnimation * 0.8);
            
            ctx.beginPath();
            ctx.moveTo(
                marble.x + Math.cos(angle) * startRadius,
                marble.y + Math.sin(angle) * startRadius
            );
            ctx.lineTo(
                marble.x + Math.cos(angle) * endRadius,
                marble.y + Math.sin(angle) * endRadius
            );
            ctx.stroke();
        }
        
        // 破片風エフェクト
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2 + marble.rotation;
            const distance = marble.radius * (0.5 + marble.popAnimation * 1.2);
            
            ctx.fillStyle = marble.color;
            ctx.beginPath();
            ctx.arc(
                marble.x + Math.cos(angle) * distance,
                marble.y + Math.sin(angle) * distance,
                2 + marble.popAnimation * 3,
                0, Math.PI * 2
            );
            ctx.fill();
        }
        
        ctx.globalAlpha = 1;
    }

    drawDragPath() {
        if (this.dragPath.length < 2) return;
        
        const ctx = this.ctx;
        
        // より美しいパスライン
        const gradient = ctx.createLinearGradient(
            this.dragPath[0].x, this.dragPath[0].y,
            this.dragPath[this.dragPath.length - 1].x, this.dragPath[this.dragPath.length - 1].y
        );
        gradient.addColorStop(0, 'rgba(255, 100, 100, 0.8)');
        gradient.addColorStop(0.5, 'rgba(255, 50, 50, 0.6)');
        gradient.addColorStop(1, 'rgba(255, 0, 0, 0.4)');
        
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        // 滑らかな曲線でパスを描画
        ctx.beginPath();
        ctx.moveTo(this.dragPath[0].x, this.dragPath[0].y);
        
        for (let i = 1; i < this.dragPath.length - 1; i++) {
            const cp1x = (this.dragPath[i].x + this.dragPath[i + 1].x) / 2;
            const cp1y = (this.dragPath[i].y + this.dragPath[i + 1].y) / 2;
            ctx.quadraticCurveTo(this.dragPath[i].x, this.dragPath[i].y, cp1x, cp1y);
        }
        
        if (this.dragPath.length > 1) {
            const lastPoint = this.dragPath[this.dragPath.length - 1];
            ctx.lineTo(lastPoint.x, lastPoint.y);
        }
        
        ctx.stroke();
        
        // パス上の光る点
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        for (let i = 0; i < this.dragPath.length; i += 4) {
            const pulseSize = 2 + Math.sin(Date.now() * 0.01 + i * 0.1) * 1;
            ctx.beginPath();
            ctx.arc(this.dragPath[i].x, this.dragPath[i].y, pulseSize, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // ユーティリティ関数
    lightenColor(color, amount) {
        const hex = color.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        
        return `rgb(${Math.min(255, Math.floor(r + amount * 255))}, ${Math.min(255, Math.floor(g + amount * 255))}, ${Math.min(255, Math.floor(b + amount * 255))})`;
    }

    darkenColor(color, amount) {
        const hex = color.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        
        return `rgb(${Math.max(0, Math.floor(r - amount * 255))}, ${Math.max(0, Math.floor(g - amount * 255))}, ${Math.max(0, Math.floor(b - amount * 255))})`;
    }

    showStats() {
        const stableMarbles = this.marbles.filter(m => m.isStable).length;
        const movingMarbles = this.marbles.filter(m => !m.isStable && !m.popping).length;
        
        // 履歴統計
        const normalHits = this.gameState.hitHistory.filter(h => h.mode === 'normal' || h.mode === 'normal_prereveal');
        const stHits = this.gameState.hitHistory.filter(h => h.mode === 'st');
        const recentHits = this.gameState.hitHistory.slice(-5); // 最新5回
        
        let hitHistoryText = '';
        if (recentHits.length > 0) {
            hitHistoryText = '\n\n📈 最新当たり履歴:';
            recentHits.reverse().forEach((hit, index) => {
                const modeText = hit.mode === 'st' ? 'ST' : hit.mode === 'normal_prereveal' ? '先バレ' : '通常';
                hitHistoryText += `\n${index + 1}. ${hit.spin}回転で当たり (${modeText})`;
            });
        }
        
        alert(`📊 統計データ：
        
🎯 ゲーム統計
回転数: ${this.gameState.spinCount}
獲得玉: ${this.gameState.ballCount}
連チャン: ${this.gameState.chainCount}
ST継続: ${this.gameState.stContinueCount}回

🎪 当たり統計
通常時当たり: ${normalHits.length}回
ST中当たり: ${stHits.length}回
現在: ${this.gameState.mode === 'normal' ? this.gameState.normalSpinsSinceHit : this.gameState.stSpinsSinceHit}回転経過

🎱 マーブル状態  
総マーブル: ${this.marbles.length}個
安定: ${stableMarbles}個
移動中: ${movingMarbles}個

🎮 現在のモード: ${this.gameState.mode === 'st' ? 'SPECIAL TIME' : '通常時'}
${this.gameState.mode === 'st' ? `ST残り: ${this.gameState.stRemaining}回転` : ''}${hitHistoryText}`);
    }

    // 履歴モーダル表示
    showHistoryModal() {
        const modal = document.getElementById('history-modal');
        modal.classList.add('show');
        
        // 履歴データを更新
        this.updateHistoryDisplay();
        
        // モーダルクローズイベント
        if (!modal.hasCloseListener) {
            document.getElementById('close-history').addEventListener('click', () => {
                this.hideHistoryModal();
            });
            
            // 背景クリックでも閉じる
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.hideHistoryModal();
                }
            });
            
            modal.hasCloseListener = true;
        }
    }

    hideHistoryModal() {
        document.getElementById('history-modal').classList.remove('show');
    }

    // 履歴表示更新
    updateHistoryDisplay() {
        const history = this.gameState.hitHistory;
        const normalHits = history.filter(h => h.mode === 'normal' || h.mode === 'normal_prereveal');
        const stHits = history.filter(h => h.mode === 'st');
        const prerevealHits = history.filter(h => h.mode === 'normal_prereveal');
        
        // サマリー更新
        document.getElementById('normal-hit-count').textContent = `${normalHits.filter(h => h.mode === 'normal').length}回`;
        document.getElementById('st-hit-count').textContent = `${stHits.length}回`;
        document.getElementById('prereveal-hit-count').textContent = `${prerevealHits.length}回`;
        document.getElementById('total-hit-count').textContent = `${history.length}回`;
        
        // 履歴リスト更新
        const historyList = document.getElementById('history-list');
        
        if (history.length === 0) {
            historyList.innerHTML = '<div class="history-empty">まだ当たりがありません</div>';
            return;
        }
        
        // 履歴を逆順（新しい順）で表示
        const reversedHistory = [...history].reverse();
        
        historyList.innerHTML = reversedHistory.map((hit, index) => {
            const hitNumber = history.length - index;
            const date = new Date(hit.timestamp);
            const timeString = date.toLocaleTimeString('ja-JP', { 
                hour12: false,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
            
            let modeText = '';
            let modeClass = '';
            
            switch(hit.mode) {
                case 'normal':
                    modeText = '通常';
                    modeClass = 'mode-normal';
                    break;
                case 'st':
                    modeText = 'ST中';
                    modeClass = 'mode-st';
                    break;
                case 'normal_prereveal':
                    modeText = '先バレ';
                    modeClass = 'mode-prereveal';
                    break;
            }
            
            // 当たり種類の情報を表示
            let hitTypeInfo = '';
            if (hit.hitType) {
                hitTypeInfo = `<div class="history-item-type">${hit.hitType.name} (${hit.hitType.balls}玉)</div>`;
            }
            
            return `
                <div class="history-item">
                    <div class="history-item-header">
                        <div class="history-item-number">${hitNumber}</div>
                        <div class="history-item-mode ${modeClass}">${modeText}</div>
                    </div>
                    <div class="history-item-details">
                        <div class="history-item-left">
                            <div class="history-item-spins">${hit.spin}回転</div>
                            ${hitTypeInfo}
                        </div>
                        <div class="history-item-time">${timeString}</div>
                    </div>
                </div>
            `;
        }).join('');
    }
}

// ゲーム初期化
document.addEventListener('DOMContentLoaded', () => {
    const game = new EnhancedPachinkoGame();
    window.game = game;
    console.log('完全改良版パチンコゲーム開始');
});