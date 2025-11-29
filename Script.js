/**
 * GAS フラッシュカード - クライアントサイドJavaScript
 * リファクタリング版 + ステップ8: 統計表示
 */

// ============================================
// グローバル状態
// ============================================
const AppState = {
  // データ
  fields: [],
  cards: [],
  progress: {},
  settings: {},
  decks: { tree: {}, list: [] },
  
  // アプリ状態
  isLoading: true,
  error: null,
  selectedDeck: null,
  todayStudyCount: 0,
  editingCard: null,
  
  // 学習状態
  study: {
    mode: null,
    cards: [],
    currentIndex: 0,
    isFlipped: false,
    sessionAnswers: {},
    isSpeaking: false,
    isAutoPlay: false,
    isRepeat: false,
    // セッション統計
    sessionStartTime: null,
    sessionCorrect: 0,
    sessionIncorrect: 0
  },
  
  // 一覧読み上げ状態
  listAutoPlay: false,
  listAutoPlayStopped: false,
  listRepeat: false,
  listSpeechLangFilter: 'all', // 'all', 'en', 'ja'
  
  // カード一覧のカスタムフィルター
  cardListFilterType: null,
  
  // スワイプ用
  touchStartX: 0,
  touchStartY: 0,
  touchEndX: 0,
  touchEndY: 0
};

// スプレッドシートURL
const SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/1i5YCfwU_IJYC-4EWZQsBxIOVczdrJShvInJZGPxmZ0U/';

// ============================================
// 定数
// ============================================
const ANIMATION_DURATION = {
  SLIDE: 400,
  FLIP: 600,
  FEEDBACK: 500
};

const COLORS = {
  PRIMARY: '#4285f4',
  SECONDARY: '#34a853',
  WARNING: '#ea4335',
  FAVORITE: '#fbbc04',
  BACKGROUND: '#f5f5f5',
  TEXT: '#333'
};

const DEFAULT_SETTINGS = {
  speechRateEn: 1.0,
  speechRateJa: 1.0,
  speechVolumeEn: 1.0,
  speechVolumeJa: 1.0,
  listSpeechRateEn: 1.0,
  listSpeechRateJa: 1.0,
  listSpeechVolumeEn: 1.0,
  listSpeechVolumeJa: 1.0,
  listWaitBetweenFields: 0,
  listWaitBetweenCards: 0.3,
  waitTimeAfterFlip: 0,
  waitTimeBetweenCards: 0,
  newCardsPerDay: 20,
  // 表・裏読み上げ設定（true=読み上げる）
  speakFront: true,
  speakBack: true,
  // SM-2アルゴリズム用デフォルト
  interval_1: 1,
  interval_2: 3,
  interval_3: 7,
  interval_4: 14,
  interval_5: 30,
  // 難易度別復習間隔の乗数
  easyMultiplier: 1.5,
  normalMultiplier: 1.0,
  hardMultiplier: 0.5
};

// ============================================
// ユーティリティ関数
// ============================================
const Utils = {
  escapeHtml: function(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  shuffleArray: function(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  },

  getTodayString: function() {
    return new Date().toISOString().split('T')[0];
  },

  getDateAfterDays: function(days) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
  },

  getSettingNumber: function(key, defaultValue) {
    const value = parseFloat(AppState.settings[key]);
    return isNaN(value) ? defaultValue : value;
  },

  setElementText: function(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }
};

// ============================================
// 統計計算モジュール
// ============================================
const Stats = {
  calculate: function() {
    const cards = AppState.cards;
    const progress = AppState.progress;
    const today = Utils.getTodayString();
    
    let studied = 0, passed = 0, review = 0, newCards = 0;
    let totalCorrect = 0, totalIncorrect = 0;
    
    for (const card of cards) {
      const prog = progress[card.rowNumber];
      if (!prog || (prog.correctCount === 0 && prog.incorrectCount === 0)) {
        newCards++;
      }
      if (!prog) continue;
      
      if (prog.correctCount > 0 || prog.incorrectCount > 0) studied++;
      if (prog.passed) passed++;
      if (prog.nextReviewDate && prog.nextReviewDate <= today && !prog.passed) review++;
      totalCorrect += prog.correctCount || 0;
      totalIncorrect += prog.incorrectCount || 0;
    }
    
    const totalAnswers = totalCorrect + totalIncorrect;
    const accuracy = totalAnswers > 0 ? Math.round((totalCorrect / totalAnswers) * 100) : 0;
    
    return { total: cards.length, studied, passed, review, newCards, totalCorrect, totalIncorrect, accuracy };
  },

  updateHomeStats: function() {
    const stats = this.calculate();
    const newCardsPerDay = Utils.getSettingNumber('newCardsPerDay', 20);
    const todayNewCount = Math.min(stats.newCards, newCardsPerDay);
    
    Utils.setElementText('stat-today', AppState.todayStudyCount);
    Utils.setElementText('stat-total', stats.studied + ' / ' + stats.total);
    Utils.setElementText('stat-passed', stats.passed);
    Utils.setElementText('stat-review', stats.review);
    // 今日の復習ボタンに残り枚数を表示
    const reviewBadge = document.getElementById('review-count-badge');
    if (reviewBadge) reviewBadge.textContent = stats.review;
    // 新規学習ボタンに枚数を表示
    const newBadge = document.getElementById('new-count-badge');
    if (newBadge) newBadge.textContent = todayNewCount;
  }
};

// ============================================
// 読み上げモジュール
// ============================================
const Speech = {
  // 現在読み上げ中のカードRowNumber（一覧用）
  currentListRowNumber: null,

  detectLanguage: function(fieldName, text) {
    const lowerName = fieldName.toLowerCase();
    if (lowerName.includes('英語') || lowerName.includes('english') || lowerName === 'en') return 'en-US';
    if (lowerName.includes('日本語') || lowerName.includes('japanese') || lowerName === 'ja' || 
        lowerName.includes('読み') || lowerName.includes('例文')) return 'ja-JP';
    if (text && /[぀-ゟ゠-ヿ一-龯]/.test(text)) return 'ja-JP';
    return 'en-US';
  },

  speak: function(text, lang, onEnd, useListRate) {
    if (!('speechSynthesis' in window)) { if (onEnd) onEnd(); return; }
    
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    
    // 一覧表示用の読み上げ速度・音量を使用するかどうか
    let rateKey, volumeKey;
    if (useListRate) {
      rateKey = lang === 'en-US' ? 'listSpeechRateEn' : 'listSpeechRateJa';
      volumeKey = lang === 'en-US' ? 'listSpeechVolumeEn' : 'listSpeechVolumeJa';
    } else {
      rateKey = lang === 'en-US' ? 'speechRateEn' : 'speechRateJa';
      volumeKey = lang === 'en-US' ? 'speechVolumeEn' : 'speechVolumeJa';
    }
    utterance.rate = Math.max(0.1, Math.min(10, Utils.getSettingNumber(rateKey, DEFAULT_SETTINGS[rateKey])));
    utterance.volume = Math.max(0, Math.min(1, Utils.getSettingNumber(volumeKey, DEFAULT_SETTINGS[volumeKey])));
    
    console.log('Speaking:', text, 'lang:', lang, 'rate:', utterance.rate, 'volume:', utterance.volume);
    App.setSpeakingState(true);
    
    utterance.onend = () => { 
      App.setSpeakingState(false);
      this.currentListRowNumber = null;
      App.updateListSpeakingState(null);
      if (onEnd) onEnd(); 
    };
    utterance.onerror = (e) => {
      if (e.error !== 'interrupted') console.error('Speech error:', e);
      App.setSpeakingState(false);
      this.currentListRowNumber = null;
      App.updateListSpeakingState(null);
      if (e.error !== 'interrupted' && onEnd) onEnd();
    };
    
    window.speechSynthesis.speak(utterance);
  },

  speakSequence: function(items, index, onComplete, useListRate) {
    if (index >= items.length) {
      App.setSpeakingState(false);
      this.currentListRowNumber = null;
      App.updateListSpeakingState(null);
      if (onComplete) onComplete();
      return;
    }
    const item = items[index];
    // 一覧表示時はフィールド間の待機時間を設定から取得
    const waitTime = useListRate ? Utils.getSettingNumber('listWaitBetweenFields', DEFAULT_SETTINGS.listWaitBetweenFields) * 1000 : 0;
    this.speak(item.text, item.lang, () => {
      if (waitTime > 0 && index < items.length - 1) {
        setTimeout(() => this.speakSequence(items, index + 1, onComplete, useListRate), waitTime);
      } else {
        this.speakSequence(items, index + 1, onComplete, useListRate);
      }
    }, useListRate);
  },

  stop: function() {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    App.setSpeakingState(false);
    this.currentListRowNumber = null;
    App.updateListSpeakingState(null);
  }
};

// ============================================
// カード描画モジュール
// ============================================
const CardRenderer = {
  getFieldsBySide: function(side) {
    return AppState.fields
      .filter(f => f.displaySide === side)
      .sort((a, b) => (parseInt(a.displayOrder) || 99) - (parseInt(b.displayOrder) || 99));
  },

  // 一覧表示用：listSide/listOrderを使用
  getFieldsByListSide: function(side) {
    return AppState.fields
      .filter(f => f.listSide === side)
      .sort((a, b) => (parseInt(a.listOrder) || 99) - (parseInt(b.listOrder) || 99));
  },

  renderFields: function(card, fields) {
    return fields.map((field, index) => {
      const value = card.fields[field.name] || '';
      const isFirst = index === 0;
      return '<div class="card-field"><div class="card-field-label">' + Utils.escapeHtml(field.name) + 
        '</div><div class="card-field-value' + (isFirst ? ' large' : '') + '">' + Utils.escapeHtml(value) + '</div></div>';
    }).join('');
  },

  render: function(card) {
    if (!card) return;
    document.getElementById('front-content').innerHTML = this.renderFields(card, this.getFieldsBySide('表'));
    document.getElementById('back-content').innerHTML = this.renderFields(card, this.getFieldsBySide('裏'));
  },

  renderNext: function(nextCard) {
    const nextEl = document.getElementById('flashcard-next');
    if (!nextCard) { 
      nextEl.style.display = 'none'; 
      return; 
    }
    // 次のカードは後ろで待機（display:blockで表示するが、z-index:1なので現在のカードの後ろ）
    nextEl.style.display = 'block';
    document.getElementById('next-front-content').innerHTML = this.renderFields(nextCard, this.getFieldsBySide('表'));
  }
};

// ============================================
// アプリケーションメイン
// ============================================
const App = {
  init: function() {
    console.log('App initializing...');
    this.loadInitialData();
  },

  loadInitialData: function() {
    this.showScreen('loading-screen');
    
    // DataAdapterを使用（GAS/ローカル両対応）
    const loadData = async () => {
      try {
        const data = await DataAdapter.getInitialData();
        this.onDataLoaded(data);
      } catch (error) {
        this.onDataError(error);
      }
    };
    loadData();
  },

  onDataLoaded: function(data) {
    try {
      AppState.fields = data.fields || [];
      AppState.cards = data.cards || [];
      AppState.progress = data.progress || {};
      AppState.settings = data.settings || {};
      AppState.decks = data.decks || { tree: {}, list: [] };
      AppState.isLoading = false;
      
      Stats.updateHomeStats();
      this.updateDebugInfo();
      this.showScreen('home-screen');
    } catch (error) {
      console.error('Error in onDataLoaded:', error);
    }
  },

  onDataError: function(error) {
    console.error('Data load error:', error);
    AppState.error = error;
    AppState.isLoading = false;
    document.getElementById('error-message').textContent = error.message || 'データの読み込みに失敗しました';
    this.showScreen('error-screen');
  },

  retry: function() { this.loadInitialData(); },

  showScreen: function(screenId) {
    document.querySelectorAll('.screen').forEach(s => { s.classList.remove('active'); s.style.display = 'none'; });
    const target = document.getElementById(screenId);
    if (target) {
      target.classList.add('active');
      target.style.display = screenId === 'loading-screen' ? 'flex' : 'block';
    }
  },

  updateDebugInfo: function() {
    Utils.setElementText('debug-connection', '✓ 接続成功');
    const conn = document.getElementById('debug-connection');
    if (conn) conn.style.color = 'green';
    Utils.setElementText('debug-card-count', AppState.cards.length);
    Utils.setElementText('debug-field-count', AppState.fields.length);
    Utils.setElementText('debug-deck-count', AppState.decks.list.length);
  },

  showRawData: function() {
    const el = document.getElementById('debug-raw-data');
    if (el.classList.contains('show')) { el.classList.remove('show'); }
    else {
      el.textContent = JSON.stringify({ fields: AppState.fields, cards: AppState.cards, progress: AppState.progress, settings: AppState.settings, decks: AppState.decks }, null, 2);
      el.classList.add('show');
    }
  },

  // 学習開始
  startStudy: function(mode) {
    const today = Utils.getTodayString();
    let cards = [];
    
    if (mode === 'review') {
      cards = AppState.cards.filter(c => {
        const p = AppState.progress[c.rowNumber];
        return p && p.nextReviewDate && p.nextReviewDate <= today && !p.passed;
      });
    } else if (mode === 'new') {
      // 新規カードのみ抽出
      let newCards = AppState.cards.filter(c => {
        const p = AppState.progress[c.rowNumber];
        return !p || (p.correctCount === 0 && p.incorrectCount === 0);
      });
      // 新規学習枚数で制限
      const newCardsPerDay = Utils.getSettingNumber('newCardsPerDay', 20);
      cards = newCards.slice(0, newCardsPerDay);
    } else {
      cards = [...AppState.cards];
    }
    
    if (cards.length === 0) { alert('学習するカードがありません'); return; }
    if (AppState.settings.shuffleCards !== false) cards = Utils.shuffleArray(cards);
    this.initStudySession(mode, cards);
  },

  startFilteredStudy: function() {
    const shuffle = document.getElementById('setting-shuffle').checked;
    let cards = this.getFilteredCards();
    if (cards.length === 0) { alert('条件に一致するカードがありません'); return; }
    if (shuffle) cards = Utils.shuffleArray(cards);
    this.initStudySession('filtered', cards);
  },

  initStudySession: function(mode, cards) {
    AppState.study = { 
      mode, 
      cards, 
      currentIndex: 0, 
      isFlipped: false, 
      sessionAnswers: {}, 
      isSpeaking: false, 
      isAutoPlay: false, 
      isRepeat: false,
      sessionStartTime: new Date(),
      sessionCorrect: 0,
      sessionIncorrect: 0
    };
    this.showScreen('study-screen');
    this.renderCard();
    this.updateStudyProgress();
    this.setupKeyboardAndSwipe();
  },

  // キーボードとスワイプの設定
  setupKeyboardAndSwipe: function() {
    // キーボードイベント
    document.removeEventListener('keydown', this.handleKeyDown);
    this.handleKeyDown = (e) => {
      // 学習画面でのみ有効
      if (!document.getElementById('study-screen').classList.contains('active')) return;
      
      switch(e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          if (AppState.study.isFlipped) {
            // 裏面なら表面に戻す
            this.flipCard();
          } else {
            // 表面なら前のカードへ
            this.prevCard();
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (!AppState.study.isFlipped) {
            this.flipCard();
          } else {
            this.nextCard();
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          if (AppState.study.isFlipped) {
            this.answerCard('easy');
          }
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (AppState.study.isFlipped) {
            this.answerCard('hard');
          }
          break;
        case ' ':
        case 'Enter':
          e.preventDefault();
          this.flipCard();
          break;
        case '1':
          if (AppState.study.isFlipped) this.answerCard('hard');
          break;
        case '2':
          if (AppState.study.isFlipped) this.answerCard('normal');
          break;
        case '3':
          if (AppState.study.isFlipped) this.answerCard('easy');
          break;
      }
    };
    document.addEventListener('keydown', this.handleKeyDown);
    
    // スワイプイベント
    const container = document.querySelector('.flashcard-container');
    if (container) {
      container.removeEventListener('touchstart', this.handleTouchStart);
      container.removeEventListener('touchend', this.handleTouchEnd);
      
      this.handleTouchStart = (e) => {
        AppState.touchStartX = e.changedTouches[0].screenX;
        AppState.touchStartY = e.changedTouches[0].screenY;
      };
      
      this.handleTouchEnd = (e) => {
        AppState.touchEndX = e.changedTouches[0].screenX;
        AppState.touchEndY = e.changedTouches[0].screenY;
        this.handleSwipe();
      };
      
      container.addEventListener('touchstart', this.handleTouchStart, { passive: true });
      container.addEventListener('touchend', this.handleTouchEnd, { passive: true });
    }
  },

  // スワイプ処理
  handleSwipe: function() {
    const diffX = AppState.touchEndX - AppState.touchStartX;
    const diffY = AppState.touchEndY - AppState.touchStartY;
    const threshold = 50; // スワイプと判定する最小距離
    
    // 水平方向のスワイプが垂直方向より大きい場合
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > threshold) {
      if (diffX > 0) {
        // 右スワイプ -> 前のカード
        this.prevCard();
      } else {
        // 左スワイプ -> 次のカード
        if (!AppState.study.isFlipped) {
          this.flipCard();
        } else {
          this.nextCard();
        }
      }
    } else if (Math.abs(diffY) > threshold && Math.abs(diffY) > Math.abs(diffX)) {
      // 垂直方向のスワイプ
      if (AppState.study.isFlipped) {
        if (diffY < 0) {
          // 上スワイプ -> 正解（簡単）
          this.answerCard('easy');
        } else {
          // 下スワイプ -> 不正解（難しい）
          this.answerCard('hard');
        }
      }
    }
  },

  // カード表示
  renderCard: function() {
    Speech.stop();
    const card = AppState.study.cards[AppState.study.currentIndex];
    if (!card) return;
    
    CardRenderer.render(card);
    const flashcard = document.getElementById('flashcard');
    flashcard.classList.remove('flipped');
    AppState.study.isFlipped = false;
    document.getElementById('answer-buttons').style.display = 'flex';
    this.updateCardButtons(card);
    this.updateNavButtons();
    this.updateAnswerButtonState();
    this.prepareNextCard();
    
    // 継続読み上げモードなら読み上げる
    if (AppState.study.isContinuousSpeech) {
      setTimeout(() => this.speakCurrentSide(), 300);
    }
  },

  updateCardContent: function() {
    const card = AppState.study.cards[AppState.study.currentIndex];
    if (!card) return;
    CardRenderer.render(card);
    document.getElementById('answer-buttons').style.display = 'flex';
    this.updateCardButtons(card);
    this.updateNavButtons();
  },

  prepareNextCard: function() {
    const nextIndex = AppState.study.currentIndex + 1;
    const hasNextCard = nextIndex < AppState.study.cards.length;
    const nextCard = hasNextCard ? AppState.study.cards[nextIndex] : null;
    CardRenderer.renderNext(nextCard);
  },

  flipCard: function() {
    AppState.study.isFlipped = !AppState.study.isFlipped;
    document.getElementById('flashcard').classList.toggle('flipped', AppState.study.isFlipped);
    
    // 継続読み上げモードなら読み上げる
    if (AppState.study.isContinuousSpeech && !AppState.study.isSpeaking) {
      setTimeout(() => this.speakCurrentSide(), 300);
    }
    
    // 回答ボタンの評価状態を更新
    this.updateAnswerButtonState();
  },
  
  // 回答ボタンの評価済み状態を更新
  updateAnswerButtonState: function() {
    const card = AppState.study.cards[AppState.study.currentIndex];
    if (!card) return;
    
    const prog = AppState.progress[card.rowNumber];
    const lastDifficulty = prog ? prog.lastDifficulty : null;
    
    // すべてのボタンからselectedクラスを削除
    document.querySelectorAll('.btn-answer').forEach(btn => btn.classList.remove('selected'));
    
    // 最後に選択した難易度のボタンにselectedクラスを追加
    if (lastDifficulty) {
      const selector = '.btn-' + lastDifficulty;
      const selectedBtn = document.querySelector(selector);
      if (selectedBtn) selectedBtn.classList.add('selected');
    }
  },

  updateStudyProgress: function() {
    Utils.setElementText('study-current', AppState.study.currentIndex + 1);
    Utils.setElementText('study-total', AppState.study.cards.length);
  },

  updateCardButtons: function(card) {
    const prog = AppState.progress[card.rowNumber] || {};
    const fav = document.getElementById('btn-favorite');
    const pass = document.getElementById('btn-passed');
    fav.classList.toggle('active', prog.favorite);
    fav.querySelector('.material-icons').textContent = prog.favorite ? 'star' : 'star_border';
    pass.classList.toggle('passed', prog.passed);
    pass.querySelector('.material-icons').textContent = prog.passed ? 'check_circle' : 'check_circle_outline';
  },

  updateNavButtons: function() {
    document.getElementById('btn-prev').disabled = AppState.study.currentIndex === 0;
    document.getElementById('btn-next').disabled = AppState.study.currentIndex >= AppState.study.cards.length - 1;
  },

  prevCard: function() { if (AppState.study.currentIndex > 0) this.slideToCard(AppState.study.currentIndex - 1, 'prev'); },
  
  nextCard: function() {
    if (AppState.study.currentIndex < AppState.study.cards.length - 1) this.slideToCard(AppState.study.currentIndex + 1, 'next');
    else this.finishStudy();
  },

  slideToCard: function(newIndex, direction) {
    const flashcard = document.getElementById('flashcard');
    const inner = flashcard.querySelector('.flashcard-inner');
    const nextCard = AppState.study.cards[newIndex];
    
    // 読み上げ停止
    Speech.stop();
    
    // 次のカードを準備（後ろで待機）
    CardRenderer.renderNext(nextCard);
    
    // スライドアウトアニメーション開始
    const slideClass = direction === 'next' ? 'slide-out-left' : 'slide-out-right';
    flashcard.classList.add(slideClass);
    
    // アニメーション完了後の処理
    setTimeout(() => {
      AppState.study.currentIndex = newIndex;
      
      // トランジションを一時的に無効化
      flashcard.style.transition = 'none';
      inner.style.transition = 'none';
      
      // クラスをリセット
      flashcard.classList.remove('slide-out-left', 'slide-out-right', 'flipped');
      AppState.study.isFlipped = false;
      
      // カードの内容を更新
      this.updateCardContent();
      
      // リフローを強制
      flashcard.offsetHeight;
      
      // トランジションを復元
      flashcard.style.transition = '';
      inner.style.transition = '';
      
      // 次のカードを準備
      this.prepareNextCard();
      this.updateStudyProgress();
    }, ANIMATION_DURATION.SLIDE);
  },

  // 回答処理（難易度別: 'easy', 'normal', 'hard'）
  answerCard: function(difficulty) {
    const card = AppState.study.cards[AppState.study.currentIndex];
    const row = card.rowNumber;
    let prog = AppState.progress[row] || { 
      correctCount: 0, 
      incorrectCount: 0, 
      streak: 0, 
      nextReviewDate: null, 
      favorite: false, 
      passed: false,
      easeFactor: 2.5, // SM-2の初期値
      interval: 1,
      lastStudyDate: null,
      lastDifficulty: null
    };
    
    // 今日の学習日と難易度を記録
    prog.lastStudyDate = Utils.getTodayString();
    prog.lastDifficulty = difficulty;
    
    // 前回の回答を取り消し
    const prev = AppState.study.sessionAnswers[row];
    if (prev) {
      if (prev.isCorrect) { 
        prog.correctCount = Math.max(0, prog.correctCount - 1); 
        prog.streak = Math.max(0, prog.streak - 1);
        AppState.study.sessionCorrect = Math.max(0, AppState.study.sessionCorrect - 1);
      } else { 
        prog.incorrectCount = Math.max(0, prog.incorrectCount - 1);
        AppState.study.sessionIncorrect = Math.max(0, AppState.study.sessionIncorrect - 1);
      }
    }
    
    // 難易度による処理
    const isCorrect = difficulty !== 'hard';
    if (isCorrect) { 
      prog.correctCount++; 
      prog.streak++;
      AppState.study.sessionCorrect++;
    } else { 
      prog.incorrectCount++; 
      prog.streak = 0;
      AppState.study.sessionIncorrect++;
    }
    
    // 新規回答の場合のみ今日の学習数をカウント
    if (!prev) {
      AppState.todayStudyCount++;
    }
    AppState.study.sessionAnswers[row] = { isCorrect, difficulty };
    
    // SM-2アルゴリズムで次回復習日を計算
    prog = this.calculateSM2(prog, difficulty);
    AppState.progress[row] = prog;
    this.saveProgressToServer(row, prog);
    
    const flashcard = document.getElementById('flashcard');
    // 難易度に応じたアニメーション
    let anim;
    switch(difficulty) {
      case 'easy': anim = 'answer-correct'; break;
      case 'normal': anim = 'answer-normal'; break;
      case 'hard': anim = 'answer-incorrect'; break;
      default: anim = 'answer-normal';
    }
    flashcard.classList.add(anim);
    
    // 評価ボタンの選択状態を更新
    this.updateAnswerButtonState();
    
    setTimeout(() => {
      flashcard.classList.remove('answer-correct', 'answer-normal', 'answer-incorrect');
      if (AppState.study.currentIndex < AppState.study.cards.length - 1) this.slideToCard(AppState.study.currentIndex + 1, 'next');
      else this.finishStudy();
    }, ANIMATION_DURATION.FEEDBACK);
  },

  // SM-2アルゴリズムによる復習日計算
  calculateSM2: function(prog, difficulty) {
    // SM-2のパラメータ
    let easeFactor = prog.easeFactor || 2.5;
    let interval = prog.interval || 1;
    
    // 難易度に応じたグレード（0-5）
    let grade;
    switch (difficulty) {
      case 'easy': grade = 5; break;
      case 'normal': grade = 3; break;
      case 'hard': grade = 0; break;
      default: grade = 3;
    }
    
    // EaseFactor の更新
    easeFactor = easeFactor + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02));
    easeFactor = Math.max(1.3, easeFactor); // 最小値1.3
    
    // 次回間隔の計算
    if (grade < 3) {
      // 不正解の場合は最初からやり直し
      interval = 1;
    } else {
      // 正解の場合
      if (interval === 1) {
        interval = 1;
      } else if (interval === 2) {
        interval = 6;
      } else {
        interval = Math.round(interval * easeFactor);
      }
      
      // 難易度による調整
      const multiplier = Utils.getSettingNumber(
        difficulty === 'easy' ? 'easyMultiplier' : (difficulty === 'hard' ? 'hardMultiplier' : 'normalMultiplier'),
        DEFAULT_SETTINGS[difficulty === 'easy' ? 'easyMultiplier' : (difficulty === 'hard' ? 'hardMultiplier' : 'normalMultiplier')]
      );
      interval = Math.round(interval * multiplier);
    }
    
    // 最大90日に制限
    interval = Math.min(90, Math.max(1, interval));
    
    prog.easeFactor = easeFactor;
    prog.interval = interval;
    prog.nextReviewDate = Utils.getDateAfterDays(interval);
    
    return prog;
  },

  saveProgressToServer: async function(row, data) {
    try {
      await DataAdapter.saveProgress(row, data);
      console.log('Progress saved');
    } catch (e) {
      console.error('Failed:', e);
    }
  },

  toggleFavorite: function() {
    const card = AppState.study.cards[AppState.study.currentIndex];
    let prog = AppState.progress[card.rowNumber] || { correctCount: 0, incorrectCount: 0, streak: 0, nextReviewDate: null, favorite: false, passed: false };
    prog.favorite = !prog.favorite;
    AppState.progress[card.rowNumber] = prog;
    this.updateCardButtons(card);
    this.saveProgressToServer(card.rowNumber, prog);
  },

  togglePassed: function() {
    const card = AppState.study.cards[AppState.study.currentIndex];
    let prog = AppState.progress[card.rowNumber] || { correctCount: 0, incorrectCount: 0, streak: 0, nextReviewDate: null, favorite: false, passed: false };
    prog.passed = !prog.passed;
    AppState.progress[card.rowNumber] = prog;
    this.updateCardButtons(card);
    this.saveProgressToServer(card.rowNumber, prog);
  },

  finishStudy: function() { 
    // セッション統計を計算
    const endTime = new Date();
    const startTime = AppState.study.sessionStartTime || endTime;
    const durationMs = endTime - startTime;
    const durationSec = Math.floor(durationMs / 1000);
    const minutes = Math.floor(durationSec / 60);
    const seconds = durationSec % 60;
    
    const correct = AppState.study.sessionCorrect;
    const incorrect = AppState.study.sessionIncorrect;
    const total = correct + incorrect;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
    
    // モーダルで統計を表示
    this.showSessionResultModal(correct, incorrect, accuracy, minutes, seconds);
  },
  
  showSessionResultModal: function(correct, incorrect, accuracy, minutes, seconds) {
    // 既存のモーダルを削除
    const existingModal = document.getElementById('session-result-modal');
    if (existingModal) existingModal.remove();
    
    const total = correct + incorrect;
    const accuracyColor = accuracy >= 80 ? '#34a853' : (accuracy >= 50 ? '#fbbc04' : '#ea4335');
    
    const modalHtml = `
      <div id="session-result-modal" class="modal-overlay">
        <div class="modal-content session-result">
          <div class="result-header">
            <span class="result-emoji">🎉</span>
            <h2>学習完了！</h2>
          </div>
          <div class="result-chart">
            <svg viewBox="0 0 100 100" class="accuracy-ring">
              <circle cx="50" cy="50" r="40" fill="none" stroke="#e0e0e0" stroke-width="10"/>
              <circle cx="50" cy="50" r="40" fill="none" stroke="${accuracyColor}" stroke-width="10" 
                stroke-dasharray="${accuracy * 2.51} 251" stroke-linecap="round" 
                transform="rotate(-90 50 50)" class="progress-ring"/>
            </svg>
            <div class="accuracy-value">${accuracy}%</div>
          </div>
          <div class="result-stats">
            <div class="result-stat correct">
              <span class="material-icons">check_circle</span>
              <span class="stat-number">${correct}</span>
              <span class="stat-label">正解</span>
            </div>
            <div class="result-stat incorrect">
              <span class="material-icons">cancel</span>
              <span class="stat-number">${incorrect}</span>
              <span class="stat-label">不正解</span>
            </div>
            <div class="result-stat time">
              <span class="material-icons">timer</span>
              <span class="stat-number">${minutes}:${seconds.toString().padStart(2, '0')}</span>
              <span class="stat-label">所要時間</span>
            </div>
          </div>
          <button class="btn btn-primary btn-large" onclick="App.closeResultAndExit()">
            <span class="material-icons">home</span>
            ホームに戻る
          </button>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    // アニメーションのために少し遅延
    setTimeout(() => {
      document.getElementById('session-result-modal').classList.add('show');
    }, 50);
  },
  
  closeResultAndExit: function() {
    const modal = document.getElementById('session-result-modal');
    if (modal) {
      modal.classList.remove('show');
      setTimeout(() => modal.remove(), 300);
    }
    this.exitStudy();
  },

  exitStudy: function() {
    Speech.stop();
    // キーボードイベントを削除
    if (this.handleKeyDown) {
      document.removeEventListener('keydown', this.handleKeyDown);
    }
    AppState.study = { 
      mode: null, 
      cards: [], 
      currentIndex: 0, 
      isFlipped: false, 
      sessionAnswers: {}, 
      isSpeaking: false, 
      isAutoPlay: false, 
      isRepeat: false,
      isContinuousSpeech: false,
      sessionStartTime: null,
      sessionCorrect: 0,
      sessionIncorrect: 0
    };
    Stats.updateHomeStats();
    this.showScreen('home-screen');
  },

  // デッキ選択（学習設定画面内）
  renderDeckTreeInline: function() {
    const container = document.getElementById('deck-tree-inline');
    if (!container) return;
    const allSel = AppState.selectedDeck === null;
    let html = '<div class="deck-item deck-all-item' + (allSel ? ' selected' : '') + '" onclick="App.selectDeckInline(null)">' +
      '<span class="material-icons">folder_special</span><span class="deck-item-name">すべてのデッキ</span>' +
      '<span class="deck-item-count">' + AppState.cards.length + '枚</span></div>';
    html += this.renderDeckTreeNode(AppState.decks.tree, '');
    container.innerHTML = html;
  },

  selectDeckInline: function(path) {
    AppState.selectedDeck = path;
    this.renderDeckTreeInline();
    this.updateFilteredCardCount();
  },

  toggleSection: function(header) {
    const content = header.nextElementSibling;
    const icon = header.querySelector('.collapse-icon');
    if (content.style.maxHeight) {
      content.style.maxHeight = null;
      icon.textContent = 'expand_more';
    } else {
      content.style.maxHeight = content.scrollHeight + 'px';
      icon.textContent = 'expand_less';
    }
  },

  // デッキ選択（旧画面 - 互換性のため残す）
  showDeckSelect: function() { this.showStudySettings(); },
  closeDeckSelect: function() { this.showScreen('home-screen'); },

  renderDeckTree: function() {
    const container = document.getElementById('deck-tree');
    const allSel = AppState.selectedDeck === null;
    let html = '<div class="deck-item deck-all-item' + (allSel ? ' selected' : '') + '" onclick="App.selectDeck(null)">' +
      '<span class="material-icons">folder_special</span><span class="deck-item-name">すべてのデッキ</span>' +
      '<span class="deck-item-count">' + AppState.cards.length + '枚</span></div>';
    html += this.renderDeckTreeNode(AppState.decks.tree, '');
    container.innerHTML = html;
  },

  renderDeckTreeNode: function(node, parentPath) {
    let html = '';
    for (const key in node) {
      if (key === '_path' || key === '_children') continue;
      const path = parentPath ? parentPath + '/' + key : key;
      const children = node[key]._children || {};
      const childKeys = Object.keys(children).filter(k => k !== '_path' && k !== '_children');
      const hasChildren = childKeys.length > 0;
      const count = this.getCardCountForDeck(path);
      const sel = AppState.selectedDeck === path;
      
      html += '<div class="deck-node"><div class="deck-item' + (sel ? ' selected' : '') + '" onclick="App.selectDeckInline(\'' + Utils.escapeHtml(path) + '\')">';
      if (hasChildren) html += '<button class="deck-toggle" onclick="event.stopPropagation(); App.toggleDeckNode(this)"><span class="material-icons">chevron_right</span></button>';
      else html += '<span style="width: 28px; display: inline-block;"></span>';
      html += '<span class="material-icons">folder</span><span class="deck-item-name">' + Utils.escapeHtml(key) + '</span><span class="deck-item-count">' + count + '枚</span></div>';
      if (hasChildren) html += '<div class="deck-children" style="display: none;">' + this.renderDeckTreeNode(children, path) + '</div>';
      html += '</div>';
    }
    return html;
  },

  getCardCountForDeck: function(path) {
    return AppState.cards.filter(c => { const d = c.fields['デッキ'] || ''; return d === path || d.startsWith(path + '/'); }).length;
  },

  toggleDeckNode: function(btn) {
    const node = btn.closest('.deck-node');
    const children = node.querySelector('.deck-children');
    if (children) { const hidden = children.style.display === 'none'; children.style.display = hidden ? 'block' : 'none'; btn.classList.toggle('expanded', hidden); }
  },

  selectDeck: function(path) { AppState.selectedDeck = path; this.renderDeckTreeInline(); this.updateFilteredCardCount(); },

  updateSelectedDeckInfo: function() {
    // 互換性のため残す（学習設定画面に統合されたため不要）
  },

  // 学習設定
  showStudySettings: function() {
    document.getElementById('word-start').value = '';
    document.getElementById('word-count').value = '';
    document.getElementById('filter-favorite').checked = false;
    document.getElementById('filter-not-passed').checked = false;
    document.getElementById('setting-shuffle').checked = true;
    document.querySelector('input[name="studyMode"][value="all"]').checked = true;
    this.renderDeckTreeInline();
    this.setupStudySettingsListeners();
    this.updateFilteredCardCount();
    this.showScreen('study-settings-screen');
  },

  setupStudySettingsListeners: function() {
    const handler = this.updateFilteredCardCount.bind(this);
    ['word-start', 'word-count', 'filter-favorite', 'filter-not-passed', 'setting-shuffle'].forEach(id => {
      const el = document.getElementById(id);
      el.removeEventListener('change', handler); el.addEventListener('change', handler);
      if (el.type === 'number') { el.removeEventListener('input', handler); el.addEventListener('input', handler); }
    });
    document.querySelectorAll('input[name="studyMode"]').forEach(r => { r.removeEventListener('change', handler); r.addEventListener('change', handler); });
  },

  updateFilteredCardCount: function() { document.getElementById('filtered-card-count').textContent = this.getFilteredCards().length; },

  getFilteredCards: function() {
    const mode = document.querySelector('input[name="studyMode"]:checked').value;
    const start = parseInt(document.getElementById('word-start').value) || null;
    const count = parseInt(document.getElementById('word-count').value) || null;
    const fav = document.getElementById('filter-favorite').checked;
    const notPass = document.getElementById('filter-not-passed').checked;
    const today = Utils.getTodayString();
    
    let cards = [...AppState.cards];
    if (AppState.selectedDeck !== null) cards = cards.filter(c => { const d = c.fields['デッキ'] || ''; return d === AppState.selectedDeck || d.startsWith(AppState.selectedDeck + '/'); });
    cards.sort((a, b) => a.rowNumber - b.rowNumber);
    
    if (start !== null && start >= 1) { const idx = start - 1; cards = count !== null && count >= 1 ? cards.slice(idx, idx + count) : cards.slice(idx); }
    else if (count !== null && count >= 1) cards = cards.slice(0, count);
    
    if (mode === 'review') cards = cards.filter(c => { const p = AppState.progress[c.rowNumber]; return p && p.nextReviewDate && p.nextReviewDate <= today && !p.passed; });
    else if (mode === 'new') cards = cards.filter(c => { const p = AppState.progress[c.rowNumber]; return !p || (p.correctCount === 0 && p.incorrectCount === 0); });
    
    if (fav) cards = cards.filter(c => { const p = AppState.progress[c.rowNumber]; return p && p.favorite; });
    if (notPass) cards = cards.filter(c => { const p = AppState.progress[c.rowNumber]; return !p || !p.passed; });
    
    return cards;
  },

  closeStudySettings: function() { this.showScreen('home-screen'); },

  // カード一覧
  showCardList: function() {
    this.populateDeckFilter();
    this.renderCardList();
    this.showScreen('card-list-screen');
  },

  // 今日学習したカードを表示
  showTodayStudiedCards: function() {
    this.populateDeckFilter();
    this.showScreen('card-list-screen');
    
    // フィルターをリセット
    document.getElementById('card-search').value = '';
    document.getElementById('card-list-deck-filter').value = '';
    document.getElementById('card-list-side-filter').value = 'both';
    document.getElementById('card-list-fav-filter').value = '';
    document.getElementById('card-list-pass-filter').value = '';
    
    // 今日学習したカード（セッション回答があるカード）
    AppState.cardListFilterType = 'today';
    
    this.renderCardList();
  },

  // 弱点カード（間違いが多いカード）を学習
  startWeakPointStudy: function() {
    // 不正解率が高いカードを抽出
    let weakCards = AppState.cards.filter(c => {
      const p = AppState.progress[c.rowNumber];
      if (!p) return false;
      const total = (p.correctCount || 0) + (p.incorrectCount || 0);
      if (total < 2) return false; // 最低2回以上回答したカード
      const incorrectRate = (p.incorrectCount || 0) / total;
      return incorrectRate >= 0.3; // 不正解率30%以上
    });
    
    // 不正解率でソート（高い順）
    weakCards.sort((a, b) => {
      const pA = AppState.progress[a.rowNumber];
      const pB = AppState.progress[b.rowNumber];
      const rateA = (pA.incorrectCount || 0) / ((pA.correctCount || 0) + (pA.incorrectCount || 0));
      const rateB = (pB.incorrectCount || 0) / ((pB.correctCount || 0) + (pB.incorrectCount || 0));
      return rateB - rateA;
    });
    
    // 最大20枚に制限
    weakCards = weakCards.slice(0, 20);
    
    if (weakCards.length === 0) {
      alert('弱点カードが見つかりません。\nもう少し学習を進めてからお試しください。');
      return;
    }
    
    this.initStudySession('weak', weakCards);
  },

  // フィルター付きカード一覧表示（設定画面の統計からの遷移用）
  showCardListWithFilter: function(filterType) {
    // まず一覧画面に遷移
    this.populateDeckFilter();
    this.showScreen('card-list-screen');
    
    // フィルターをリセット
    document.getElementById('card-search').value = '';
    document.getElementById('card-list-deck-filter').value = '';
    document.getElementById('card-list-side-filter').value = 'both';
    document.getElementById('card-list-fav-filter').value = '';
    document.getElementById('card-list-pass-filter').value = '';
    
    // AppStateにフィルタータイプを保存
    AppState.cardListFilterType = filterType;
    
    this.renderCardList();
  },

  closeCardList: function() { 
    AppState.cardListFilterType = null;
    this.showScreen('home-screen'); 
  },

  populateDeckFilter: function() {
    const select = document.getElementById('card-list-deck-filter');
    let html = '<option value="">すべてのデッキ</option>';
    AppState.decks.list.forEach(deck => {
      html += '<option value="' + Utils.escapeHtml(deck) + '">' + Utils.escapeHtml(deck) + '</option>';
    });
    select.innerHTML = html;
  },

  filterCardList: function() { 
    AppState.cardListFilterType = null; // 手動フィルター時はカスタムフィルターをリセット
    this.renderCardList(); 
  },

  renderCardList: function() {
    const container = document.getElementById('card-list-container');
    const searchTerm = (document.getElementById('card-search').value || '').toLowerCase();
    const deckFilter = document.getElementById('card-list-deck-filter').value;
    const sideFilter = document.getElementById('card-list-side-filter').value;
    const favFilter = document.getElementById('card-list-fav-filter').value;
    const passFilter = document.getElementById('card-list-pass-filter').value;
    const today = Utils.getTodayString();
    
    let cards = [...AppState.cards];
    
    // 統計画面からのカスタムフィルター
    const customFilter = AppState.cardListFilterType;
    if (customFilter) {
      if (customFilter === 'today') {
        // 今日学習したカード（lastStudyDateが今日のカード）
        cards = cards.filter(c => {
          const p = AppState.progress[c.rowNumber];
          return p && p.lastStudyDate === today;
        });
      } else if (customFilter === 'studied') {
        // 学習済み：正解または不正解が1回以上
        cards = cards.filter(c => {
          const p = AppState.progress[c.rowNumber];
          return p && (p.correctCount > 0 || p.incorrectCount > 0);
        });
      } else if (customFilter === 'passed') {
        // 合格
        cards = cards.filter(c => {
          const p = AppState.progress[c.rowNumber];
          return p && p.passed;
        });
      } else if (customFilter === 'review') {
        // 復習待ち
        cards = cards.filter(c => {
          const p = AppState.progress[c.rowNumber];
          return p && p.nextReviewDate && p.nextReviewDate <= today && !p.passed;
        });
      }
      // 'all'の場合はフィルターなし
    }
    
    // デッキフィルター
    if (deckFilter) {
      cards = cards.filter(c => {
        const d = c.fields['デッキ'] || '';
        return d === deckFilter || d.startsWith(deckFilter + '/');
      });
    }
    
    // お気に入りフィルター
    if (favFilter === 'fav') {
      cards = cards.filter(c => {
        const p = AppState.progress[c.rowNumber];
        return p && p.favorite;
      });
    } else if (favFilter === 'not-fav') {
      cards = cards.filter(c => {
        const p = AppState.progress[c.rowNumber];
        return !p || !p.favorite;
      });
    }
    
    // 合格フィルター
    if (passFilter === 'passed') {
      cards = cards.filter(c => {
        const p = AppState.progress[c.rowNumber];
        return p && p.passed;
      });
    } else if (passFilter === 'not-passed') {
      cards = cards.filter(c => {
        const p = AppState.progress[c.rowNumber];
        return !p || !p.passed;
      });
    }
    
    // 検索フィルター
    if (searchTerm) {
      cards = cards.filter(c => {
        for (const key in c.fields) {
          if ((c.fields[key] || '').toLowerCase().includes(searchTerm)) return true;
        }
        return false;
      });
    }
    
    // 一覧表示用のフィールドを取得（listSide/listOrderを使用）
    const leftFields = CardRenderer.getFieldsByListSide('左');
    const rightFields = CardRenderer.getFieldsByListSide('右');
    
    // 表示モードに応じたクラスを決定
    let itemClass = 'card-list-item';
    if (sideFilter === 'front') itemClass += ' left-only';
    else if (sideFilter === 'back') itemClass += ' right-only';
    
    let html = '';
    cards.forEach(card => {
      const prog = AppState.progress[card.rowNumber] || {};
      const deck = card.fields['デッキ'] || '';
      const rowNum = card.rowNumber;
      
      // 左側フィールド（クリックで読み上げ）
      let leftHtml = '<div class="card-list-left" data-row="' + rowNum + '" onclick="App.speakCardInList(' + rowNum + ', event)">';
      leftFields.forEach((field, i) => {
        const val = card.fields[field.name] || '';
        const cls = i === 0 ? 'field-main' : 'field-sub';
        leftHtml += '<div class="' + cls + '">' + Utils.escapeHtml(val) + '</div>';
      });
      leftHtml += '</div>';
      
      // 右側フィールド
      let rightHtml = '<div class="card-list-right">';
      rightFields.forEach((field, i) => {
        const val = card.fields[field.name] || '';
        const cls = i === 0 ? 'field-main' : 'field-sub';
        rightHtml += '<div class="' + cls + '">' + Utils.escapeHtml(val) + '</div>';
      });
      // デッキ名
      if (deck) rightHtml += '<div class="deck-name">' + Utils.escapeHtml(deck) + '</div>';
      rightHtml += '</div>';
      
      // アクションボタン
      let actionsHtml = '<div class="card-list-actions">';
      actionsHtml += '<button class="action-btn' + (prog.favorite ? ' favorite-active' : '') + '" onclick="App.toggleListFavorite(' + rowNum + ', event)" title="お気に入り"><span class="material-icons">' + (prog.favorite ? 'star' : 'star_border') + '</span></button>';
      actionsHtml += '<button class="action-btn' + (prog.passed ? ' passed-active' : '') + '" onclick="App.toggleListPassed(' + rowNum + ', event)" title="合格"><span class="material-icons">' + (prog.passed ? 'check_circle' : 'check_circle_outline') + '</span></button>';
      actionsHtml += '<button class="action-btn edit-btn" onclick="App.showCardEdit(' + rowNum + ', event)" title="編集"><span class="material-icons">edit</span></button>';
      actionsHtml += '</div>';
      
      html += '<div class="' + itemClass + '" data-row="' + rowNum + '">';
      html += leftHtml + rightHtml + actionsHtml;
      html += '</div>';
    });
    
    if (cards.length === 0) {
      html = '<div class="card-list-empty"><span class="material-icons">search_off</span><p>カードが見つかりません</p></div>';
    }
    
    container.innerHTML = html;
  },

  // 一覧からカードを読み上げ（タップで常に最初から再生）
  speakCardInList: function(rowNumber, event) {
    if (event) event.stopPropagation();
    
    // 読み上げ中なら即座に停止して新たに再生
    Speech.stop();
    
    const card = AppState.cards.find(c => c.rowNumber === rowNumber);
    if (!card) return;
    
    // 読み上げ対象フィールドを取得（listSpeechOrder使用、数字のみ有効）
    let fields = AppState.fields
      .filter(f => this.isValidSpeechOrder(f.listSpeechOrder))
      .sort((a, b) => (parseInt(a.listSpeechOrder) || 99) - (parseInt(b.listSpeechOrder) || 99));
    
    // 一覧読み上げフィルター（英語のみ/日本語のみ）
    const langFilter = AppState.listSpeechLangFilter || 'all';
    if (langFilter === 'en') {
      fields = fields.filter(f => {
        const lang = Speech.detectLanguage(f.name, card.fields[f.name]);
        return lang === 'en-US';
      });
    } else if (langFilter === 'ja') {
      fields = fields.filter(f => {
        const lang = Speech.detectLanguage(f.name, card.fields[f.name]);
        return lang === 'ja-JP';
      });
    }
    
    if (fields.length === 0) return;
    
    const items = fields.map(f => ({
      text: card.fields[f.name] || '',
      lang: Speech.detectLanguage(f.name, card.fields[f.name])
    })).filter(i => i.text);
    
    if (items.length === 0) return;
    
    Speech.currentListRowNumber = rowNumber;
    this.updateListSpeakingState(rowNumber);
    Speech.speakSequence(items, 0, () => {
      // 連続再生モードの場合、次のカードを読み上げ
      if (AppState.listAutoPlay && !AppState.listAutoPlayStopped) {
        this.playNextCardInList(rowNumber);
      }
    }, true); // useListRate = true
  },

  // 一覧での連続再生：次のカードを読み上げ
  playNextCardInList: function(currentRowNumber) {
    const container = document.getElementById('card-list-container');
    const items = container.querySelectorAll('.card-list-item');
    let foundCurrent = false;
    let nextRowNumber = null;
    
    for (const item of items) {
      const row = parseInt(item.getAttribute('data-row'));
      if (foundCurrent) {
        nextRowNumber = row;
        break;
      }
      if (row === currentRowNumber) {
        foundCurrent = true;
      }
    }
    
    // カード間の待機時間を設定から取得（ミリ秒に変換）
    const waitTime = Utils.getSettingNumber('listWaitBetweenCards', DEFAULT_SETTINGS.listWaitBetweenCards) * 1000;
    
    if (nextRowNumber) {
      // 設定された時間だけ間を空けて次を再生
      setTimeout(() => {
        if (AppState.listAutoPlay && !AppState.listAutoPlayStopped) {
          this.speakCardInList(nextRowNumber, null);
        }
      }, waitTime);
    } else if (AppState.listRepeat) {
      // リピートモードの場合、最初に戻る
      const firstItem = items[0];
      if (firstItem) {
        const firstRow = parseInt(firstItem.getAttribute('data-row'));
        setTimeout(() => {
          if (AppState.listAutoPlay && !AppState.listAutoPlayStopped) {
            this.speakCardInList(firstRow, null);
          }
        }, waitTime);
      }
    } else {
      // 連続再生終了
      AppState.listAutoPlay = false;
      this.updateListSpeechButtons();
    }
  },

  // 一覧の連続再生をトグル
  toggleListAutoPlay: function() {
    AppState.listAutoPlay = !AppState.listAutoPlay;
    AppState.listAutoPlayStopped = false;
    this.updateListSpeechButtons();
    
    if (AppState.listAutoPlay) {
      // 最初のカードから再生開始
      const container = document.getElementById('card-list-container');
      const firstItem = container.querySelector('.card-list-item');
      if (firstItem) {
        const rowNumber = parseInt(firstItem.getAttribute('data-row'));
        this.speakCardInList(rowNumber, null);
      }
    } else {
      AppState.listAutoPlayStopped = true;
      Speech.stop();
    }
  },

  // 一覧のリピートをトグル
  toggleListRepeat: function() {
    AppState.listRepeat = !AppState.listRepeat;
    this.updateListSpeechButtons();
  },

  // 一覧の言語フィルターを設定
  setListSpeechLangFilter: function(filter) {
    AppState.listSpeechLangFilter = filter;
    this.updateListSpeechButtons();
  },

  // 一覧の読み上げボタンを更新
  updateListSpeechButtons: function() {
    const autoPlayBtn = document.getElementById('list-autoplay-btn');
    const repeatBtn = document.getElementById('list-repeat-btn');
    const langSelect = document.getElementById('list-speech-lang');
    const speedSlider = document.getElementById('list-speed-slider');
    const speedValue = document.getElementById('list-speed-value');
    
    if (autoPlayBtn) {
      autoPlayBtn.classList.toggle('active', AppState.listAutoPlay);
      autoPlayBtn.querySelector('.material-icons').textContent = AppState.listAutoPlay ? 'pause_circle' : 'play_circle';
    }
    if (repeatBtn) {
      repeatBtn.classList.toggle('active', AppState.listRepeat);
    }
    if (langSelect) {
      langSelect.value = AppState.listSpeechLangFilter || 'all';
    }
    // 速度スライダーの初期化
    if (speedSlider && speedValue) {
      const currentSpeed = Utils.getSettingNumber('listSpeechRateEn', 1.0);
      speedSlider.value = currentSpeed;
      speedValue.textContent = currentSpeed + 'x';
    }
  },

  // 一覧の再生速度を更新
  updateListSpeed: function(value) {
    const speed = parseFloat(value);
    const speedValue = document.getElementById('list-speed-value');
    if (speedValue) speedValue.textContent = speed + 'x';
    // 英語と日本語の両方に適用
    AppState.settings.listSpeechRateEn = speed;
    AppState.settings.listSpeechRateJa = speed;
  },

  // 一覧の読み上げ状態を更新
  updateListSpeakingState: function(rowNumber) {
    // 全ての左側要素からspeakingクラスを削除
    document.querySelectorAll('.card-list-left').forEach(el => {
      el.classList.remove('speaking');
    });
    // 読み上げ中のカードにspeakingクラスを追加
    if (rowNumber) {
      const el = document.querySelector('.card-list-left[data-row="' + rowNumber + '"]');
      if (el) el.classList.add('speaking');
    }
  },

  // 一覧からお気に入りをトグル
  toggleListFavorite: function(rowNumber, event) {
    if (event) event.stopPropagation();
    
    let prog = AppState.progress[rowNumber] || { correctCount: 0, incorrectCount: 0, streak: 0, nextReviewDate: null, favorite: false, passed: false };
    prog.favorite = !prog.favorite;
    AppState.progress[rowNumber] = prog;
    
    // UIを更新
    const item = document.querySelector('.card-list-item[data-row="' + rowNumber + '"]');
    if (item) {
      const btn = item.querySelector('.action-btn:first-child');
      if (btn) {
        btn.classList.toggle('favorite-active', prog.favorite);
        btn.querySelector('.material-icons').textContent = prog.favorite ? 'star' : 'star_border';
      }
    }
    
    this.saveProgressToServer(rowNumber, prog);
  },

  // 一覧から合格をトグル
  toggleListPassed: function(rowNumber, event) {
    if (event) event.stopPropagation();
    
    let prog = AppState.progress[rowNumber] || { correctCount: 0, incorrectCount: 0, streak: 0, nextReviewDate: null, favorite: false, passed: false };
    prog.passed = !prog.passed;
    AppState.progress[rowNumber] = prog;
    
    // UIを更新
    const item = document.querySelector('.card-list-item[data-row="' + rowNumber + '"]');
    if (item) {
      const btn = item.querySelectorAll('.action-btn')[1];
      if (btn) {
        btn.classList.toggle('passed-active', prog.passed);
        btn.querySelector('.material-icons').textContent = prog.passed ? 'check_circle' : 'check_circle_outline';
      }
    }
    
    this.saveProgressToServer(rowNumber, prog);
    Stats.updateHomeStats();
  },

  // カード編集
  showCardEdit: function(rowNumber, event) {
    if (event) event.stopPropagation();
    
    const card = AppState.cards.find(c => c.rowNumber === rowNumber);
    if (!card) return;
    
    AppState.editingCard = card;
    
    // IDの取得（フィールドにあればそれを使用、なければrowNumberから計算）
    let cardId = card.fields['ID'];
    if (cardId === undefined || cardId === null || cardId === '') {
      // データ開始行が8なので、rowNumber - 7 がカード番号
      cardId = rowNumber - 7;
    }
    document.getElementById('card-edit-title').textContent = 'カード #' + cardId;
    
    const container = document.getElementById('card-edit-content');
    let html = '';
    
    // 固定列（ID、進捗データ）は除外して表示
    const editableFields = AppState.fields.filter(f => !f.isFixedColumn);
    
    editableFields.forEach(field => {
      const value = card.fields[field.name] || '';
      const side = field.displaySide === '表' ? '表面' : (field.displaySide === '裏' ? '裏面' : '');
      
      html += '<div class="card-edit-field">';
      html += '<label>' + Utils.escapeHtml(field.name);
      if (side) html += ' <span class="field-side">(' + side + ')</span>';
      html += '</label>';
      html += '<textarea id="edit-field-' + Utils.escapeHtml(field.name) + '" data-field="' + Utils.escapeHtml(field.name) + '">' + Utils.escapeHtml(value) + '</textarea>';
      html += '</div>';
    });
    
    // 進捗情報表示
    const prog = AppState.progress[rowNumber] || {};
    html += '<div class="card-edit-progress">';
    html += '<h3>学習進捗</h3>';
    html += '<div class="progress-stats">';
    html += '<span>正解: ' + (prog.correctCount || 0) + '</span>';
    html += '<span>不正解: ' + (prog.incorrectCount || 0) + '</span>';
    html += '<span>連続正解: ' + (prog.streak || 0) + '</span>';
    html += '</div>';
    html += '<div class="progress-toggles">';
    html += '<label class="checkbox-item"><input type="checkbox" id="edit-favorite" ' + (prog.favorite ? 'checked' : '') + '><span class="checkbox-label"><span class="material-icons">star</span>お気に入り</span></label>';
    html += '<label class="checkbox-item"><input type="checkbox" id="edit-passed" ' + (prog.passed ? 'checked' : '') + '><span class="checkbox-label"><span class="material-icons">check_circle</span>合格</span></label>';
    html += '</div></div>';
    
    container.innerHTML = html;
    this.showScreen('card-edit-screen');
  },

  closeCardEdit: function() {
    AppState.editingCard = null;
    this.showScreen('card-list-screen');
  },

  saveCard: function() {
    if (!AppState.editingCard) return;
    
    const card = AppState.editingCard;
    const rowNumber = card.rowNumber;
    
    // フィールド値を収集（固定列以外）
    const updatedFields = {};
    const editableFields = AppState.fields.filter(f => !f.isFixedColumn);
    editableFields.forEach(field => {
      const textarea = document.getElementById('edit-field-' + field.name);
      if (textarea) {
        updatedFields[field.name] = textarea.value;
      }
    });
    
    // 進捗情報を更新
    let prog = AppState.progress[rowNumber] || { correctCount: 0, incorrectCount: 0, streak: 0, nextReviewDate: null, favorite: false, passed: false };
    prog.favorite = document.getElementById('edit-favorite').checked;
    prog.passed = document.getElementById('edit-passed').checked;
    
    // ローカル状態を更新
    card.fields = { ...card.fields, ...updatedFields };
    AppState.progress[rowNumber] = prog;
    
    // サーバーに保存（DataAdapter経由）
    const saveToServer = async () => {
      try {
        await DataAdapter.saveCardData(rowNumber, updatedFields, prog);
        console.log('Card saved');
        alert('保存しました');
        this.closeCardEdit();
        this.renderCardList();
      } catch (e) {
        console.error('Failed to save card:', e);
        alert('保存に失敗しました: ' + e.message);
      }
    };
    saveToServer();
  },

  // 連続再生
  toggleAutoPlay: function() {
    AppState.study.isAutoPlay = !AppState.study.isAutoPlay;
    this.updateAutoPlayButton();
    if (AppState.study.isAutoPlay) this.startAutoPlay(); else Speech.stop();
  },

  toggleRepeat: function() { AppState.study.isRepeat = !AppState.study.isRepeat; this.updateRepeatButton(); },

  updateAutoPlayButton: function() {
    const btn = document.getElementById('btn-autoplay');
    if (btn) { btn.classList.toggle('autoplay-active', AppState.study.isAutoPlay); btn.querySelector('.material-icons').textContent = AppState.study.isAutoPlay ? 'pause_circle' : 'play_circle'; }
  },

  updateRepeatButton: function() {
    const btn = document.getElementById('btn-repeat');
    if (btn) btn.classList.toggle('repeat-active', AppState.study.isRepeat);
  },

  startAutoPlay: function() {
    if (!AppState.study.isAutoPlay) return;
    this.speakCurrentSide(() => {
      if (!AppState.study.isAutoPlay) return;
      const wait = Utils.getSettingNumber('waitTimeAfterFlip', 0) * 1000;
      setTimeout(() => {
        if (!AppState.study.isAutoPlay) return;
        if (!AppState.study.isFlipped) {
          this.flipCard();
          setTimeout(() => { if (AppState.study.isAutoPlay) this.startAutoPlay(); }, Math.max(0, wait));
        } else { this.autoPlayNextCard(); }
      }, Math.max(0, wait));
    });
  },

  autoPlayNextCard: function() {
    const wait = Utils.getSettingNumber('waitTimeBetweenCards', 0) * 1000;
    if (AppState.study.currentIndex < AppState.study.cards.length - 1) {
      this.slideToCardForAutoPlay(AppState.study.currentIndex + 1, 'next', () => { setTimeout(() => { if (AppState.study.isAutoPlay) this.startAutoPlay(); }, Math.max(0, wait)); });
    } else if (AppState.study.isRepeat) {
      this.slideToCardForAutoPlay(0, 'next', () => { setTimeout(() => { if (AppState.study.isAutoPlay) this.startAutoPlay(); }, Math.max(0, wait)); });
    } else { AppState.study.isAutoPlay = false; this.updateAutoPlayButton(); this.finishStudy(); }
  },

  slideToCardForAutoPlay: function(newIndex, direction, onComplete) {
    const flashcard = document.getElementById('flashcard');
    const inner = flashcard.querySelector('.flashcard-inner');
    CardRenderer.renderNext(AppState.study.cards[newIndex]);
    flashcard.classList.add(direction === 'next' ? 'slide-out-left' : 'slide-out-right');
    setTimeout(() => {
      AppState.study.currentIndex = newIndex;
      flashcard.style.transition = 'none'; inner.style.transition = 'none';
      flashcard.classList.remove('slide-out-left', 'slide-out-right', 'flipped');
      AppState.study.isFlipped = false;
      this.updateCardContent();
      flashcard.offsetHeight;
      flashcard.style.transition = ''; inner.style.transition = '';
      this.prepareNextCard();
      this.updateStudyProgress();
      if (onComplete) onComplete();
    }, ANIMATION_DURATION.SLIDE);
  },

  // 読み上げ（継続モード切り替え）
  speakCurrentCard: function() { 
    if (AppState.study.isSpeaking) { 
      Speech.stop(); 
      return; 
    }
    // 継続読み上げモードをトグル
    AppState.study.isContinuousSpeech = !AppState.study.isContinuousSpeech;
    this.updateSpeechButton();
    if (AppState.study.isContinuousSpeech) {
      this.speakCurrentSide();
    }
  },
  
  updateSpeechButton: function() {
    const btn = document.getElementById('btn-speech');
    if (btn) {
      btn.classList.toggle('autoplay-active', AppState.study.isContinuousSpeech);
    }
  },

  // 読み上げ順序が有効な数値かどうかを判定
  isValidSpeechOrder: function(value) {
    if (value === null || value === undefined || value === '') return false;
    const strValue = String(value).trim();
    return /^\d+$/.test(strValue);
  },

  speakCurrentSide: function(onComplete) {
    const card = AppState.study.cards[AppState.study.currentIndex];
    if (!card) { if (onComplete) onComplete(); return; }
    
    const side = AppState.study.isFlipped ? '裏' : '表';
    
    // 表・裏の読み上げ設定を確認
    const speakFront = AppState.settings.speakFront !== false; // デフォルトtrue
    const speakBack = AppState.settings.speakBack !== false;   // デフォルトtrue
    
    // 現在の面の読み上げが無効な場合はスキップ
    if ((side === '表' && !speakFront) || (side === '裏' && !speakBack)) {
      console.log('Speech disabled for side:', side);
      if (onComplete) onComplete();
      return;
    }
    
    const fields = AppState.fields.filter(f => f.displaySide === side && this.isValidSpeechOrder(f.speechOrder))
      .sort((a, b) => (parseInt(a.speechOrder) || 99) - (parseInt(b.speechOrder) || 99));
    if (fields.length === 0) { if (onComplete) onComplete(); return; }
    const items = fields.map(f => ({ text: card.fields[f.name] || '', lang: Speech.detectLanguage(f.name, card.fields[f.name]) })).filter(i => i.text);
    if (items.length === 0) { if (onComplete) onComplete(); return; }
    Speech.speakSequence(items, 0, onComplete);
  },

  setSpeakingState: function(isSpeaking) {
    AppState.study.isSpeaking = isSpeaking;
    const btn = document.getElementById('btn-speech');
    if (btn) { btn.classList.toggle('speaking', isSpeaking); btn.querySelector('.material-icons').textContent = isSpeaking ? 'stop' : 'volume_up'; }
  },

  stopSpeech: function() { Speech.stop(); },

  // 設定画面
  showSettings: function() { this.showScreen('settings-screen'); this.renderSettingsScreen(); },

  renderSettingsScreen: function() {
    const stats = Stats.calculate();
    const container = document.getElementById('settings-content');
    if (!container) return;
    
    const speechRateEn = Utils.getSettingNumber('speechRateEn', 1.0);
    const speechRateJa = Utils.getSettingNumber('speechRateJa', 1.0);
    const speechVolumeEn = Utils.getSettingNumber('speechVolumeEn', 1.0);
    const speechVolumeJa = Utils.getSettingNumber('speechVolumeJa', 1.0);
    const listSpeechRateEn = Utils.getSettingNumber('listSpeechRateEn', 1.0);
    const listSpeechRateJa = Utils.getSettingNumber('listSpeechRateJa', 1.0);
    const listSpeechVolumeEn = Utils.getSettingNumber('listSpeechVolumeEn', 1.0);
    const listSpeechVolumeJa = Utils.getSettingNumber('listSpeechVolumeJa', 1.0);
    const listWaitBetweenFields = Utils.getSettingNumber('listWaitBetweenFields', 0);
    const listWaitBetweenCards = Utils.getSettingNumber('listWaitBetweenCards', 0.3);
    const waitTimeAfterFlip = Utils.getSettingNumber('waitTimeAfterFlip', 0);
    const waitTimeBetweenCards = Utils.getSettingNumber('waitTimeBetweenCards', 0);
    const newCardsPerDay = Utils.getSettingNumber('newCardsPerDay', 20);
    const speakFront = AppState.settings.speakFront !== false;
    const speakBack = AppState.settings.speakBack !== false;
    
    container.innerHTML = '<div class="setting-section"><h3><span class="material-icons" style="vertical-align:middle;margin-right:4px;">bar_chart</span>学習統計</h3><div class="stats-detail">' +
      '<div class="stat-row stat-clickable" onclick="App.showCardListWithFilter(\'all\')"><span>総カード数</span><span>' + stats.total + '枚</span></div>' +
      '<div class="stat-row stat-clickable" onclick="App.showCardListWithFilter(\'studied\')"><span>学習済み</span><span>' + stats.studied + '枚</span></div>' +
      '<div class="stat-row stat-clickable" onclick="App.showCardListWithFilter(\'passed\')"><span>合格</span><span>' + stats.passed + '枚</span></div>' +
      '<div class="stat-row stat-clickable" onclick="App.showCardListWithFilter(\'review\')"><span>復習待ち</span><span>' + stats.review + '枚</span></div>' +
      '<div class="stat-row"><span>総正解数</span><span>' + stats.totalCorrect + '回</span></div>' +
      '<div class="stat-row"><span>総不正解数</span><span>' + stats.totalIncorrect + '回</span></div>' +
      '<div class="stat-row"><span>今日の学習</span><span>' + AppState.todayStudyCount + '枚</span></div>' +
      '<div class="stat-row highlight"><span>正解率</span><span>' + stats.accuracy + '%</span></div></div></div>' +
      '<div class="setting-section"><h3><span class="material-icons" style="vertical-align:middle;margin-right:4px;">add_circle</span>新規学習</h3>' +
      '<div class="setting-slider-row"><label>1日の枚数</label><input type="range" id="setting-new-cards" min="5" max="100" step="5" value="' + newCardsPerDay + '"><span id="setting-new-cards-val">' + newCardsPerDay + '枚</span></div></div>' +
      '<div class="setting-section"><h3><span class="material-icons" style="vertical-align:middle;margin-right:4px;">record_voice_over</span>学習モードの設定</h3>' +
      '<div class="setting-checkbox-row"><label><input type="checkbox" id="setting-speak-front" ' + (speakFront ? 'checked' : '') + '> 表を読み上げる</label></div>' +
      '<div class="setting-checkbox-row"><label><input type="checkbox" id="setting-speak-back" ' + (speakBack ? 'checked' : '') + '> 裏を読み上げる</label></div>' +
      '<div class="setting-slider-row"><label>英語速度</label><input type="range" id="setting-speech-en" min="0.5" max="2" step="0.1" value="' + speechRateEn + '"><span id="setting-speech-en-val">' + speechRateEn + 'x</span></div>' +
      '<div class="setting-slider-row"><label>英語音量</label><input type="range" id="setting-volume-en" min="0" max="1" step="0.1" value="' + speechVolumeEn + '"><span id="setting-volume-en-val">' + Math.round(speechVolumeEn * 100) + '%</span></div>' +
      '<div class="setting-slider-row"><label>日本語速度</label><input type="range" id="setting-speech-ja" min="0.5" max="2" step="0.1" value="' + speechRateJa + '"><span id="setting-speech-ja-val">' + speechRateJa + 'x</span></div>' +
      '<div class="setting-slider-row"><label>日本語音量</label><input type="range" id="setting-volume-ja" min="0" max="1" step="0.1" value="' + speechVolumeJa + '"><span id="setting-volume-ja-val">' + Math.round(speechVolumeJa * 100) + '%</span></div>' +
      '<div class="setting-slider-row"><label>めくり後</label><input type="range" id="setting-wait-flip" min="0" max="3" step="0.1" value="' + waitTimeAfterFlip + '"><span id="setting-wait-flip-val">' + waitTimeAfterFlip + '秒</span></div>' +
      '<div class="setting-slider-row"><label>カード間</label><input type="range" id="setting-wait-card" min="0" max="3" step="0.1" value="' + waitTimeBetweenCards + '"><span id="setting-wait-card-val">' + waitTimeBetweenCards + '秒</span></div></div>' +
      '<div class="setting-section"><h3><span class="material-icons" style="vertical-align:middle;margin-right:4px;">list_alt</span>一覧読み上げの設定</h3>' +
      '<div class="setting-slider-row"><label>英語速度</label><input type="range" id="setting-list-speech-en" min="0.5" max="2" step="0.1" value="' + listSpeechRateEn + '"><span id="setting-list-speech-en-val">' + listSpeechRateEn + 'x</span></div>' +
      '<div class="setting-slider-row"><label>英語音量</label><input type="range" id="setting-list-volume-en" min="0" max="1" step="0.1" value="' + listSpeechVolumeEn + '"><span id="setting-list-volume-en-val">' + Math.round(listSpeechVolumeEn * 100) + '%</span></div>' +
      '<div class="setting-slider-row"><label>日本語速度</label><input type="range" id="setting-list-speech-ja" min="0.5" max="2" step="0.1" value="' + listSpeechRateJa + '"><span id="setting-list-speech-ja-val">' + listSpeechRateJa + 'x</span></div>' +
      '<div class="setting-slider-row"><label>日本語音量</label><input type="range" id="setting-list-volume-ja" min="0" max="1" step="0.1" value="' + listSpeechVolumeJa + '"><span id="setting-list-volume-ja-val">' + Math.round(listSpeechVolumeJa * 100) + '%</span></div>' +
      '<div class="setting-slider-row"><label>フィールド間</label><input type="range" id="setting-list-wait-fields" min="0" max="3" step="0.1" value="' + listWaitBetweenFields + '"><span id="setting-list-wait-fields-val">' + listWaitBetweenFields + '秒</span></div>' +
      '<div class="setting-slider-row"><label>カード間</label><input type="range" id="setting-list-wait-cards" min="0" max="3" step="0.1" value="' + listWaitBetweenCards + '"><span id="setting-list-wait-cards-val">' + listWaitBetweenCards + '秒</span></div></div>' +
      '<div class="setting-section"><h3><span class="material-icons" style="vertical-align:middle;margin-right:4px;">link</span>データ管理</h3>' +
      '<a href="' + SPREADSHEET_URL + '" target="_blank" class="spreadsheet-link"><span class="material-icons">open_in_new</span>スプレッドシートを開く</a>' +
      '<p class="setting-hint">カードデータや詳細設定はスプレッドシートで編集できます。</p></div>';
    
    this.setupSettingsListeners();
  },

  setupSettingsListeners: function() {
    const self = this;
    
    // 設定を保存するヘルパー関数
    async function saveSettingToServer(key, value) {
      try {
        await DataAdapter.saveSetting(key, value);
        console.log('Setting saved:', key, value);
      } catch (e) {
        console.error('Failed to save setting:', e);
      }
    }
    
    // 表を読み上げる
    document.getElementById('setting-speak-front').addEventListener('change', function() {
      AppState.settings.speakFront = this.checked;
      saveSettingToServer('speakFront', this.checked);
    });
    
    // 裏を読み上げる
    document.getElementById('setting-speak-back').addEventListener('change', function() {
      AppState.settings.speakBack = this.checked;
      saveSettingToServer('speakBack', this.checked);
    });
    
    // 新規学習枚数
    document.getElementById('setting-new-cards').addEventListener('input', function() {
      const val = parseInt(this.value);
      document.getElementById('setting-new-cards-val').textContent = val + '枚';
      AppState.settings.newCardsPerDay = val;
    });
    document.getElementById('setting-new-cards').addEventListener('change', function() {
      saveSettingToServer('newCardsPerDay', parseInt(this.value));
      Stats.updateHomeStats();
    });
    
    // 読み上げ速度（英語）
    document.getElementById('setting-speech-en').addEventListener('input', function() {
      const val = parseFloat(this.value);
      document.getElementById('setting-speech-en-val').textContent = val + 'x';
      AppState.settings.speechRateEn = val;
    });
    document.getElementById('setting-speech-en').addEventListener('change', function() {
      saveSettingToServer('speechRateEn', parseFloat(this.value));
    });
    
    // 読み上げ音量（英語）
    document.getElementById('setting-volume-en').addEventListener('input', function() {
      const val = parseFloat(this.value);
      document.getElementById('setting-volume-en-val').textContent = Math.round(val * 100) + '%';
      AppState.settings.speechVolumeEn = val;
    });
    document.getElementById('setting-volume-en').addEventListener('change', function() {
      saveSettingToServer('speechVolumeEn', parseFloat(this.value));
    });
    
    // 読み上げ速度（日本語）
    document.getElementById('setting-speech-ja').addEventListener('input', function() {
      const val = parseFloat(this.value);
      document.getElementById('setting-speech-ja-val').textContent = val + 'x';
      AppState.settings.speechRateJa = val;
    });
    document.getElementById('setting-speech-ja').addEventListener('change', function() {
      saveSettingToServer('speechRateJa', parseFloat(this.value));
    });
    
    // 読み上げ音量（日本語）
    document.getElementById('setting-volume-ja').addEventListener('input', function() {
      const val = parseFloat(this.value);
      document.getElementById('setting-volume-ja-val').textContent = Math.round(val * 100) + '%';
      AppState.settings.speechVolumeJa = val;
    });
    document.getElementById('setting-volume-ja').addEventListener('change', function() {
      saveSettingToServer('speechVolumeJa', parseFloat(this.value));
    });
    
    // 一覧表示の読み上げ速度（英語）
    document.getElementById('setting-list-speech-en').addEventListener('input', function() {
      const val = parseFloat(this.value);
      document.getElementById('setting-list-speech-en-val').textContent = val + 'x';
      AppState.settings.listSpeechRateEn = val;
    });
    document.getElementById('setting-list-speech-en').addEventListener('change', function() {
      saveSettingToServer('listSpeechRateEn', parseFloat(this.value));
    });
    
    // 一覧表示の読み上げ音量（英語）
    document.getElementById('setting-list-volume-en').addEventListener('input', function() {
      const val = parseFloat(this.value);
      document.getElementById('setting-list-volume-en-val').textContent = Math.round(val * 100) + '%';
      AppState.settings.listSpeechVolumeEn = val;
    });
    document.getElementById('setting-list-volume-en').addEventListener('change', function() {
      saveSettingToServer('listSpeechVolumeEn', parseFloat(this.value));
    });
    
    // 一覧表示の読み上げ速度（日本語）
    document.getElementById('setting-list-speech-ja').addEventListener('input', function() {
      const val = parseFloat(this.value);
      document.getElementById('setting-list-speech-ja-val').textContent = val + 'x';
      AppState.settings.listSpeechRateJa = val;
    });
    document.getElementById('setting-list-speech-ja').addEventListener('change', function() {
      saveSettingToServer('listSpeechRateJa', parseFloat(this.value));
    });
    
    // 一覧表示の読み上げ音量（日本語）
    document.getElementById('setting-list-volume-ja').addEventListener('input', function() {
      const val = parseFloat(this.value);
      document.getElementById('setting-list-volume-ja-val').textContent = Math.round(val * 100) + '%';
      AppState.settings.listSpeechVolumeJa = val;
    });
    document.getElementById('setting-list-volume-ja').addEventListener('change', function() {
      saveSettingToServer('listSpeechVolumeJa', parseFloat(this.value));
    });
    
    // 待機時間（めくり後）
    document.getElementById('setting-wait-flip').addEventListener('input', function() {
      const val = parseFloat(this.value);
      document.getElementById('setting-wait-flip-val').textContent = val + '秒';
      AppState.settings.waitTimeAfterFlip = val;
    });
    document.getElementById('setting-wait-flip').addEventListener('change', function() {
      saveSettingToServer('waitTimeAfterFlip', parseFloat(this.value));
    });
    
    // 待機時間（カード間）
    document.getElementById('setting-wait-card').addEventListener('input', function() {
      const val = parseFloat(this.value);
      document.getElementById('setting-wait-card-val').textContent = val + '秒';
      AppState.settings.waitTimeBetweenCards = val;
    });
    document.getElementById('setting-wait-card').addEventListener('change', function() {
      saveSettingToServer('waitTimeBetweenCards', parseFloat(this.value));
    });
    
    // 一覧読み上げ：フィールド間の待機時間
    document.getElementById('setting-list-wait-fields').addEventListener('input', function() {
      const val = parseFloat(this.value);
      document.getElementById('setting-list-wait-fields-val').textContent = val + '秒';
      AppState.settings.listWaitBetweenFields = val;
    });
    document.getElementById('setting-list-wait-fields').addEventListener('change', function() {
      saveSettingToServer('listWaitBetweenFields', parseFloat(this.value));
    });
    
    // 一覧読み上げ：カード間の待機時間
    document.getElementById('setting-list-wait-cards').addEventListener('input', function() {
      const val = parseFloat(this.value);
      document.getElementById('setting-list-wait-cards-val').textContent = val + '秒';
      AppState.settings.listWaitBetweenCards = val;
    });
    document.getElementById('setting-list-wait-cards').addEventListener('change', function() {
      saveSettingToServer('listWaitBetweenCards', parseFloat(this.value));
    });
  },

  closeSettings: function() { this.showScreen('home-screen'); }
};

document.addEventListener('DOMContentLoaded', function() { App.init(); });
