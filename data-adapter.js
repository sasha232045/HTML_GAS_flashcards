/**
 * データアダプター - GASモードとローカルモードの切り替え
 * 
 * 使い方:
 *   GASモード:   APP_MODE = 'GAS'   (Google Apps Scriptで動作)
 *   ローカルモード: APP_MODE = 'LOCAL' (ブラウザでローカルファイルから動作)
 * 
 * ローカルモードでは、EMBEDDED_DATA にデータを埋め込んで使用します。
 * （file:// プロトコルでは fetch() が使えないため）
 */

// ============================================
// ★★★ モード設定 - この1行を切り替えるだけ！ ★★★
// ============================================
const APP_MODE = 'LOCAL';  // 'GAS' または 'LOCAL'

// ============================================
// ローカルモード用: 埋め込みデータ
// ※ CSVデータをここに直接記述（file://でfetchが使えないため）
// ============================================
const EMBEDDED_DATA = {
  cards: `"ID","正解数","不正解数","連続正解","次回復習日","お気に入り","合格","デッキ","英語","日本語","読み","例文","発音記号"
"-","-","-","-","-","-","-","-","表","裏","裏","裏","非表示"
"-","-","-","-","-","-","-","-","1","1","2","3","-"
"-","-","-","-","-","-","-","-","1","2","-","-","-"
"-","-","-","-","-","-","-","-","左","右","右","右","非表示"
"-","-","-","-","-","-","-","-","1","1","2","3","-"
"-","-","-","-","-","-","-","-","1","-","-","-","-"
1,0,0,0,"",FALSE,FALSE,"サンプル","apple","りんご","アップル","I eat an apple every day.","ˈæp.əl"
2,0,0,0,"",FALSE,FALSE,"サンプル","book","本","ブック","This is a book.","bʊk"
3,0,0,0,"",FALSE,FALSE,"サンプル","cat","猫","キャット","The cat is sleeping.","kæt"
4,0,0,0,"",FALSE,FALSE,"サンプル/動物","dog","犬","ドッグ","The dog is running.","dɔːɡ"
5,0,0,0,"",FALSE,FALSE,"サンプル/動物","elephant","象","エレファント","An elephant is very big.","ˈel.ə.fənt"
6,0,0,0,"",FALSE,FALSE,"サンプル/食べ物","banana","バナナ","バナナ","I like bananas.","bəˈnæn.ə"
7,0,0,0,"",FALSE,FALSE,"サンプル/食べ物","orange","オレンジ","オレンジ","This orange is sweet.","ˈɔːr.ɪndʒ"
8,0,0,0,"",FALSE,FALSE,"基本単語","hello","こんにちは","ハロー","Hello, how are you?","həˈləʊ"
9,0,0,0,"",FALSE,FALSE,"基本単語","goodbye","さようなら","グッドバイ","Goodbye, see you later!","ɡʊdˈbaɪ"
10,0,0,0,"",FALSE,FALSE,"基本単語","thank you","ありがとう","サンキュー","Thank you very much!","θæŋk juː"`,

  settings: `"設定キー","設定値","説明"
"speechRateEn","1.0","英語読み上げ速度 (0.5〜2.0)"
"speechRateJa","1.0","日本語読み上げ速度 (0.5〜2.0)"
"listSpeechRateEn","1.0","一覧表示時の英語読み上げ速度 (0.5〜2.0)"
"listSpeechRateJa","1.0","一覧表示時の日本語読み上げ速度 (0.5〜2.0)"
"listWaitBetweenFields","0","一覧読み上げ時のフィールド間の待機時間（秒）"
"listWaitBetweenCards","0.3","一覧読み上げ時のカード間の待機時間（秒）"
"waitTimeBetweenCards","3","学習中のカード間の待機時間（秒）"
"waitTimeAfterFlip","2","学習中のめくり後の待機時間（秒）"
"autoFlip","true","読み上げ後に自動でめくるか"
"repeatMode","false","リピート再生モード"
"shuffleCards","true","カードシャッフル"
"newCardsPerDay","20","一日の新規学習枚数"
"interval_1","1","1回目正解後の復習間隔（日）"
"interval_2","3","2回連続正解後の復習間隔（日）"
"interval_3","7","3回連続正解後の復習間隔（日）"
"interval_4","14","4回連続正解後の復習間隔（日）"
"interval_5","30","5回以上連続正解後の復習間隔（日）"`
};

// ============================================
// ローカルアダプター（CSVファイルを使用）
// ============================================
const LocalAdapter = {
  /**
   * CSVテキストを解析して2次元配列に変換
   */
  parseCSV: function(text, delimiter = ',') {
    const lines = text.split(/\r?\n/);
    const result = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim() === '') continue;
      
      // 簡易CSVパーサー（ダブルクォート対応）
      const row = [];
      let cell = '';
      let inQuotes = false;
      
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        const nextChar = line[j + 1];
        
        if (inQuotes) {
          if (char === '"' && nextChar === '"') {
            cell += '"';
            j++; // Skip next quote
          } else if (char === '"') {
            inQuotes = false;
          } else {
            cell += char;
          }
        } else {
          if (char === '"') {
            inQuotes = true;
          } else if (char === delimiter || char === '\t') {
            row.push(cell);
            cell = '';
          } else {
            cell += char;
          }
        }
      }
      row.push(cell);
      result.push(row);
    }
    
    return result;
  },

  /**
   * 2次元配列をCSVテキストに変換
   */
  arrayToCSV: function(data, delimiter = ',') {
    return data.map(row => {
      return row.map(cell => {
        const str = String(cell === null || cell === undefined ? '' : cell);
        // カンマ、改行、ダブルクォートを含む場合はクォート
        if (str.includes(delimiter) || str.includes('\n') || str.includes('"')) {
          return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
      }).join(delimiter);
    }).join('\n');
  },

  /**
   * CSVテキストを読み込み（埋め込みデータまたはfetch）
   */
  loadCSV: function(dataKey) {
    // 埋め込みデータを使用（file://プロトコル対応）
    const text = EMBEDDED_DATA[dataKey];
    if (!text) {
      throw new Error(`Embedded data not found: ${dataKey}`);
    }
    // タブ区切りかカンマ区切りかを自動判定
    const firstLine = text.split(/\r?\n/)[0];
    const delimiter = firstLine.includes('\t') ? '\t' : ',';
    return this.parseCSV(text, delimiter);
  },

  /**
   * CSVファイルをダウンロード形式で保存
   */
  saveCSV: function(filename, data) {
    const csv = this.arrayToCSV(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    console.log(`Saved: ${filename}`);
  },

  /**
   * 初期データを取得（Promise形式で返す）
   */
  getInitialData: function() {
    return new Promise((resolve, reject) => {
      try {
        const cardsData = this.loadCSV('cards');
        let settingsData = [];
        
        try {
          settingsData = this.loadCSV('settings');
        } catch (e) {
          console.warn('Settings data not found, using defaults');
        }
        
        // Cardsデータを解析
        const fields = this.parseFields(cardsData);
        const cards = this.parseCards(cardsData, fields);
        const progress = this.loadProgressFromStorage(cardsData); // LocalStorageから復元
        const settings = this.parseSettings(settingsData);
        const decks = this.buildDeckTree(cards);
        
        resolve({ fields, cards, progress, settings, decks });
      } catch (error) {
        console.error('getInitialData error:', error);
        reject(error);
      }
    });
  },

  /**
   * LocalStorageから進捗を復元（なければCSVの初期値を使用）
   */
  loadProgressFromStorage: function(cardsData) {
    // まずCSVから初期進捗を読み込み
    const csvProgress = this.parseProgress(cardsData);
    
    // LocalStorageに保存された進捗があれば上書き
    const storedProgress = JSON.parse(localStorage.getItem('flashcard_progress') || '{}');
    
    // マージ（LocalStorage優先）
    Object.keys(storedProgress).forEach(rowNumber => {
      csvProgress[rowNumber] = storedProgress[rowNumber];
    });
    
    return csvProgress;
  },

  /**
   * フィールド定義を解析（1-7行目）
   */
  parseFields: function(data) {
    if (data.length < 7) {
      throw new Error('CSV must have at least 7 header rows');
    }
    
    const headers = data[0];        // フィールド名
    const displaySide = data[1];    // 表示面
    const displayOrder = data[2];   // 表示順
    const speechOrder = data[3];    // 読上順
    const listSide = data[4];       // 一覧表示位置
    const listOrder = data[5];      // 一覧表示順
    const listSpeechOrder = data[6]; // 一覧読上順
    
    const fixedColumns = ['ID', '正解数', '不正解数', '連続正解', '次回復習日', 'お気に入り', '合格'];
    
    return headers.map((name, index) => ({
      index,
      name,
      displaySide: displaySide[index] || '-',
      displayOrder: displayOrder[index] || '-',
      speechOrder: speechOrder[index] || '-',
      listSide: listSide[index] || '-',
      listOrder: listOrder[index] || '-',
      listSpeechOrder: listSpeechOrder[index] || '-',
      isFixedColumn: fixedColumns.includes(name),
      isProgressColumn: ['正解数', '不正解数', '連続正解', '次回復習日', 'お気に入り', '合格'].includes(name)
    }));
  },

  /**
   * カードデータを解析（8行目以降）
   */
  parseCards: function(data, fields) {
    const cards = [];
    const fixedColumns = ['ID', '正解数', '不正解数', '連続正解', '次回復習日', 'お気に入り', '合格'];
    
    for (let i = 7; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length === 0 || (row.length === 1 && row[0] === '')) continue;
      
      const card = {
        rowNumber: i + 1, // 1-indexed
        fields: {}
      };
      
      fields.forEach((field, index) => {
        if (!fixedColumns.includes(field.name)) {
          card.fields[field.name] = row[index] || '';
        }
      });
      
      cards.push(card);
    }
    
    return cards;
  },

  /**
   * 進捗データを解析
   */
  parseProgress: function(data) {
    const progress = {};
    const headers = data[0];
    
    // 固定列のインデックスを取得
    const colIndex = {
      correctCount: headers.indexOf('正解数'),
      incorrectCount: headers.indexOf('不正解数'),
      streak: headers.indexOf('連続正解'),
      nextReviewDate: headers.indexOf('次回復習日'),
      favorite: headers.indexOf('お気に入り'),
      passed: headers.indexOf('合格')
    };
    
    for (let i = 7; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length === 0 || (row.length === 1 && row[0] === '')) continue;
      
      const rowNumber = i + 1;
      progress[rowNumber] = {
        correctCount: parseInt(row[colIndex.correctCount]) || 0,
        incorrectCount: parseInt(row[colIndex.incorrectCount]) || 0,
        streak: parseInt(row[colIndex.streak]) || 0,
        nextReviewDate: row[colIndex.nextReviewDate] || '',
        favorite: row[colIndex.favorite] === 'TRUE',
        passed: row[colIndex.passed] === 'TRUE'
      };
    }
    
    return progress;
  },

  /**
   * 設定データを解析
   */
  parseSettings: function(data) {
    const settings = {};
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row && row.length >= 2) {
        settings[row[0]] = row[1];
      }
    }
    
    return settings;
  },

  /**
   * デッキツリーを構築
   */
  buildDeckTree: function(cards) {
    const tree = {};
    const list = [];
    
    cards.forEach(card => {
      const deckPath = card.fields['デッキ'] || '';
      if (!deckPath) return;
      
      const parts = deckPath.split('/');
      let current = tree;
      let path = '';
      
      parts.forEach(part => {
        path = path ? path + '/' + part : part;
        
        if (!list.includes(path)) {
          list.push(path);
        }
        
        if (!current[part]) {
          current[part] = { _children: {} };
        }
        current = current[part]._children;
      });
    });
    
    return { tree, list: list.sort() };
  },

  /**
   * 進捗を保存（Promise形式）
   */
  saveProgress: function(rowNumber, progressData) {
    return new Promise((resolve) => {
      // ローカルストレージに一時保存
      const allProgress = JSON.parse(localStorage.getItem('flashcard_progress') || '{}');
      allProgress[rowNumber] = progressData;
      localStorage.setItem('flashcard_progress', JSON.stringify(allProgress));
      
      console.log('Progress saved to localStorage:', rowNumber, progressData);
      resolve({ success: true });
    });
  },

  /**
   * 設定を保存（Promise形式）
   */
  saveSetting: function(key, value) {
    return new Promise((resolve) => {
      const allSettings = JSON.parse(localStorage.getItem('flashcard_settings') || '{}');
      allSettings[key] = value;
      localStorage.setItem('flashcard_settings', JSON.stringify(allSettings));
      
      console.log('Setting saved to localStorage:', key, value);
      resolve({ success: true, key, value });
    });
  },

  /**
   * カードデータを保存（Promise形式）
   */
  saveCardData: function(rowNumber, updatedFields, progressData) {
    return this.saveProgress(rowNumber, progressData).then(() => {
      console.log('Card data saved:', rowNumber, updatedFields);
      return { success: true };
    });
  },

  /**
   * 全データをCSVとしてエクスポート
   */
  exportToCSV: function(fields, cards, progress) {
    // ヘッダー行（7行）を構築
    const headers = fields.map(f => f.name);
    const displaySide = fields.map(f => f.displaySide);
    const displayOrder = fields.map(f => f.displayOrder);
    const speechOrder = fields.map(f => f.speechOrder);
    const listSide = fields.map(f => f.listSide);
    const listOrder = fields.map(f => f.listOrder);
    const listSpeechOrder = fields.map(f => f.listSpeechOrder);
    
    const data = [
      headers,
      displaySide,
      displayOrder,
      speechOrder,
      listSide,
      listOrder,
      listSpeechOrder
    ];
    
    // カードデータを追加
    cards.forEach(card => {
      const row = fields.map(field => {
        if (field.name === 'ID') return card.fields['ID'] || '';
        if (field.name === '正解数') return progress[card.rowNumber]?.correctCount || 0;
        if (field.name === '不正解数') return progress[card.rowNumber]?.incorrectCount || 0;
        if (field.name === '連続正解') return progress[card.rowNumber]?.streak || 0;
        if (field.name === '次回復習日') return progress[card.rowNumber]?.nextReviewDate || '';
        if (field.name === 'お気に入り') return progress[card.rowNumber]?.favorite ? 'TRUE' : 'FALSE';
        if (field.name === '合格') return progress[card.rowNumber]?.passed ? 'TRUE' : 'FALSE';
        return card.fields[field.name] || '';
      });
      data.push(row);
    });
    
    this.saveCSV('cards_export.csv', data);
  }
};

// ============================================
// GASアダプター（Google Apps Scriptを使用）
// ============================================
const GASAdapter = {
  getInitialData: function() {
    return new Promise((resolve, reject) => {
      google.script.run
        .withSuccessHandler(resolve)
        .withFailureHandler(reject)
        .getInitialData();
    });
  },

  saveProgress: function(rowNumber, progressData) {
    return new Promise((resolve, reject) => {
      google.script.run
        .withSuccessHandler(resolve)
        .withFailureHandler(reject)
        .saveProgress(rowNumber, progressData);
    });
  },

  saveSetting: function(key, value) {
    return new Promise((resolve, reject) => {
      google.script.run
        .withSuccessHandler(resolve)
        .withFailureHandler(reject)
        .saveSetting(key, value);
    });
  },

  saveCardData: function(rowNumber, updatedFields, progressData) {
    return new Promise((resolve, reject) => {
      google.script.run
        .withSuccessHandler(resolve)
        .withFailureHandler(reject)
        .saveCardData(rowNumber, updatedFields, progressData);
    });
  },

  exportToCSV: function() {
    console.log('Export not available in GAS mode - use spreadsheet directly');
  }
};

// ============================================
// 統一アダプター（モードに応じて切り替え）
// ============================================
const DataAdapter = APP_MODE === 'GAS' ? GASAdapter : LocalAdapter;

// ============================================
// エクスポーター（ローカルモード用）
// ============================================
const DataExporter = {
  /**
   * 進捗データをCSVとしてエクスポート
   */
  exportProgress: function() {
    if (APP_MODE === 'GAS') {
      alert('GASモードではスプレッドシートを直接確認してください。');
      return;
    }
    
    // AppStateからデータを取得
    if (typeof AppState === 'undefined') {
      alert('データがロードされていません。');
      return;
    }
    
    LocalAdapter.exportToCSV(AppState.fields, AppState.cards, AppState.progress);
    alert('進捗データをエクスポートしました。\nダウンロードされた cards_export.csv を cards.csv にリネームして使用してください。');
  }
};

// モード表示
console.log(`🚀 Flashcard App running in ${APP_MODE} mode`);
