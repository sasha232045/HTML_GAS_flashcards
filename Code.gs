/**
 * GAS フラッシュカード - メインコード
 * Version: 1.0.0
 */

// ============================================
// 設定
// ============================================

// スプレッドシートID（ここを自分のスプレッドシートIDに変更してください）
const SPREADSHEET_ID = '1i5YCfwU_IJYC-4EWZQsBxIOVczdrJShvInJZGPxmZ0U';

// シート名
const SHEET_NAMES = {
  CARDS: 'Cards',
  PROGRESS: 'Progress',
  SETTINGS: 'Settings'
};

// Cardsシートの設定行
const CARDS_HEADER_ROWS = {
  FIELD_NAME: 1,       // フィールド名
  DISPLAY_SIDE: 2,     // 表示面（表/裏/非表示）
  DISPLAY_ORDER: 3,    // 表示順
  SPEECH_ORDER: 4,     // 読上順
  LIST_SIDE: 5,        // 一覧表示位置（左/右/非表示）
  LIST_ORDER: 6,       // 一覧表示順
  LIST_SPEECH_ORDER: 7,// 一覧読上順
  DATA_START: 8        // データ開始行
};

// ============================================
// Webアプリケーション
// ============================================

/**
 * Webアプリケーションのエントリーポイント
 */
function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('GAS フラッシュカード')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * HTMLファイルをインクルードするためのヘルパー関数
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ============================================
// スプレッドシート操作
// ============================================

/**
 * スプレッドシートを取得
 */
function getSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

/**
 * シートを取得（存在しない場合は作成）
 */
function getOrCreateSheet(sheetName) {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    initializeSheet(sheet, sheetName);
  }
  
  return sheet;
}

/**
 * シートを初期化
 */
function initializeSheet(sheet, sheetName) {
  switch (sheetName) {
    case SHEET_NAMES.CARDS:
      initializeCardsSheet(sheet);
      break;
    case SHEET_NAMES.PROGRESS:
      initializeProgressSheet(sheet);
      break;
    case SHEET_NAMES.SETTINGS:
      initializeSettingsSheet(sheet);
      break;
  }
}

/**
 * Cardsシートを初期化
 */
function initializeCardsSheet(sheet) {
  const headers = [
    ['ID', 'デッキ', '英語', '日本語', '読み', '例文', '発音記号'],
    ['-', '-', '表', '裏', '裏', '裏', '非表示'],
    ['-', '-', '1', '1', '2', '3', '-'],
    ['-', '-', '1', '2', '-', '-', '-'],
    ['-', '-', '左', '右', '右', '右', '非表示'],
    ['-', '-', '1', '1', '2', '3', '-'],
    ['-', '-', '1', '-', '-', '-', '-'],
    ['8', 'サンプル', 'apple', 'りんご', 'アップル', 'I eat an apple every day.', 'ˈæp.əl'],
    ['9', 'サンプル', 'book', '本', 'ブック', 'This is a book.', 'bʊk'],
    ['10', 'サンプル', 'cat', '猫', 'キャット', 'The cat is sleeping.', 'kæt']
  ];
  
  sheet.getRange(1, 1, headers.length, headers[0].length).setValues(headers);
  
  // ヘッダー行のスタイル設定
  sheet.getRange(1, 1, 1, headers[0].length).setBackground('#4285f4').setFontColor('#ffffff').setFontWeight('bold');
  sheet.getRange(2, 1, 4, headers[0].length).setBackground('#e8f0fe');  // カード表示設定
  sheet.getRange(5, 1, 3, headers[0].length).setBackground('#fff3e0');  // 一覧表示設定
}

/**
 * Progressシートを初期化
 */
function initializeProgressSheet(sheet) {
  const headers = [['行番号', '正解数', '不正解数', '連続正解', '次回復習日', 'お気に入り', '合格']];
  sheet.getRange(1, 1, 1, headers[0].length).setValues(headers);
  sheet.getRange(1, 1, 1, headers[0].length).setBackground('#4285f4').setFontColor('#ffffff').setFontWeight('bold');
}

/**
 * Settingsシートを初期化
 */
function initializeSettingsSheet(sheet) {
  const settings = [
    ['設定キー', '設定値', '説明'],
    ['speechRateEn', '1.0', '英語読み上げ速度 (0.5〜2.0)'],
    ['speechRateJa', '1.0', '日本語読み上げ速度 (0.5〜2.0)'],
    ['listSpeechRateEn', '1.0', '一覧表示時の英語読み上げ速度 (0.5〜2.0)'],
    ['listSpeechRateJa', '1.0', '一覧表示時の日本語読み上げ速度 (0.5〜2.0)'],
    ['waitTimeBetweenCards', '3', 'カード間の待機時間（秒）'],
    ['waitTimeAfterFlip', '2', 'めくり後の待機時間（秒）'],
    ['autoFlip', 'true', '読み上げ後に自動でめくるか'],
    ['repeatMode', 'false', 'リピート再生モード'],
    ['shuffleCards', 'true', 'カードシャッフル'],
    ['interval_1', '1', '1回目正解後の復習間隔（日）'],
    ['interval_2', '3', '2回連続正解後の復習間隔（日）'],
    ['interval_3', '7', '3回連続正解後の復習間隔（日）'],
    ['interval_4', '14', '4回連続正解後の復習間隔（日）'],
    ['interval_5', '30', '5回以上連続正解後の復習間隔（日）']
  ];
  
  sheet.getRange(1, 1, settings.length, settings[0].length).setValues(settings);
  sheet.getRange(1, 1, 1, settings[0].length).setBackground('#4285f4').setFontColor('#ffffff').setFontWeight('bold');
}

// ============================================
// データ取得 API
// ============================================

/**
 * フィールド定義を取得
 */
function getFields() {
  const sheet = getOrCreateSheet(SHEET_NAMES.CARDS);
  const lastCol = sheet.getLastColumn();
  
  if (lastCol === 0) return [];
  
  const fieldNames = sheet.getRange(CARDS_HEADER_ROWS.FIELD_NAME, 1, 1, lastCol).getValues()[0];
  const displaySides = sheet.getRange(CARDS_HEADER_ROWS.DISPLAY_SIDE, 1, 1, lastCol).getValues()[0];
  const displayOrders = sheet.getRange(CARDS_HEADER_ROWS.DISPLAY_ORDER, 1, 1, lastCol).getValues()[0];
  const speechOrders = sheet.getRange(CARDS_HEADER_ROWS.SPEECH_ORDER, 1, 1, lastCol).getValues()[0];
  const listSides = sheet.getRange(CARDS_HEADER_ROWS.LIST_SIDE, 1, 1, lastCol).getValues()[0];
  const listOrders = sheet.getRange(CARDS_HEADER_ROWS.LIST_ORDER, 1, 1, lastCol).getValues()[0];
  const listSpeechOrders = sheet.getRange(CARDS_HEADER_ROWS.LIST_SPEECH_ORDER, 1, 1, lastCol).getValues()[0];
  
  const fields = [];
  for (let i = 0; i < lastCol; i++) {
    fields.push({
      index: i,
      name: fieldNames[i],
      displaySide: displaySides[i],
      displayOrder: displayOrders[i],
      speechOrder: speechOrders[i],
      listSide: listSides[i],
      listOrder: listOrders[i],
      listSpeechOrder: listSpeechOrders[i]
    });
  }
  
  return fields;
}

/**
 * 全カードデータを取得
 */
function getCards() {
  const sheet = getOrCreateSheet(SHEET_NAMES.CARDS);
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  
  if (lastRow < CARDS_HEADER_ROWS.DATA_START) return [];
  
  const fields = getFields();
  const dataRange = sheet.getRange(CARDS_HEADER_ROWS.DATA_START, 1, lastRow - CARDS_HEADER_ROWS.DATA_START + 1, lastCol);
  const data = dataRange.getValues();
  
  const cards = [];
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowNumber = CARDS_HEADER_ROWS.DATA_START + i;
    
    // 空行はスキップ
    if (!row[0] && !row[1] && !row[2]) continue;
    
    const card = {
      rowNumber: rowNumber,
      fields: {}
    };
    
    for (let j = 0; j < fields.length; j++) {
      card.fields[fields[j].name] = row[j];
    }
    
    cards.push(card);
  }
  
  return cards;
}

/**
 * 進捗データを取得
 */
function getProgress() {
  const sheet = getOrCreateSheet(SHEET_NAMES.PROGRESS);
  const lastRow = sheet.getLastRow();
  
  if (lastRow <= 1) return {};
  
  const data = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
  const progress = {};
  
  for (const row of data) {
    const rowNumber = row[0];
    if (!rowNumber) continue;
    
    progress[rowNumber] = {
      correctCount: row[1] || 0,
      incorrectCount: row[2] || 0,
      streak: row[3] || 0,
      nextReviewDate: row[4] ? Utilities.formatDate(new Date(row[4]), Session.getScriptTimeZone(), 'yyyy-MM-dd') : null,
      favorite: row[5] === true || row[5] === 'TRUE',
      passed: row[6] === true || row[6] === 'TRUE'
    };
  }
  
  return progress;
}

/**
 * 設定を取得
 */
function getSettings() {
  const sheet = getOrCreateSheet(SHEET_NAMES.SETTINGS);
  const lastRow = sheet.getLastRow();
  
  if (lastRow <= 1) return {};
  
  const data = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
  const settings = {};
  
  for (const row of data) {
    const key = row[0];
    let value = row[1];
    
    // 型変換
    if (value === 'true') value = true;
    else if (value === 'false') value = false;
    else if (!isNaN(value) && value !== '') value = Number(value);
    
    settings[key] = value;
  }
  
  return settings;
}

/**
 * デッキ一覧を取得（ツリー構造）
 */
function getDecks() {
  const cards = getCards();
  const deckSet = new Set();
  
  // 全デッキパスを収集
  for (const card of cards) {
    const deckPath = card.fields['デッキ'];
    if (deckPath) {
      deckSet.add(deckPath);
      // 親デッキも追加
      const parts = deckPath.split('/');
      for (let i = 1; i < parts.length; i++) {
        deckSet.add(parts.slice(0, i).join('/'));
      }
    }
  }
  
  // ツリー構造に変換
  const tree = {};
  const sortedDecks = Array.from(deckSet).sort();
  
  for (const deckPath of sortedDecks) {
    const parts = deckPath.split('/');
    let current = tree;
    
    for (const part of parts) {
      if (!current[part]) {
        current[part] = { _path: '', _children: {} };
      }
      current = current[part]._children;
    }
  }
  
  // パスを設定
  function setPath(node, parentPath) {
    for (const key in node) {
      if (key !== '_path' && key !== '_children') {
        const currentPath = parentPath ? `${parentPath}/${key}` : key;
        node[key]._path = currentPath;
        setPath(node[key]._children, currentPath);
      }
    }
  }
  
  setPath(tree, '');
  
  return { tree: tree, list: sortedDecks };
}

/**
 * 初期データをまとめて取得（アプリ起動時用）
 */
function getInitialData() {
  return {
    fields: getFields(),
    cards: getCards(),
    progress: getProgress(),
    settings: getSettings(),
    decks: getDecks()
  };
}

// ============================================
// データ保存 API
// ============================================

/**
 * 進捗データを保存
 * @param {number} rowNumber - カードの行番号
 * @param {Object} progressData - 進捗データ
 */
function saveProgress(rowNumber, progressData) {
  const sheet = getOrCreateSheet(SHEET_NAMES.PROGRESS);
  const lastRow = sheet.getLastRow();
  
  // 既存の行を検索
  let targetRow = -1;
  if (lastRow > 1) {
    const rowNumbers = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < rowNumbers.length; i++) {
      if (rowNumbers[i][0] === rowNumber) {
        targetRow = i + 2; // 1-indexed、ヘッダー行分を加算
        break;
      }
    }
  }
  
  // 保存するデータを準備
  const data = [
    rowNumber,
    progressData.correctCount || 0,
    progressData.incorrectCount || 0,
    progressData.streak || 0,
    progressData.nextReviewDate || '',
    progressData.favorite || false,
    progressData.passed || false
  ];
  
  if (targetRow > 0) {
    // 既存行を更新
    sheet.getRange(targetRow, 1, 1, 7).setValues([data]);
  } else {
    // 新規行を追加
    sheet.appendRow(data);
  }
  
  return { success: true, rowNumber: rowNumber };
}

/**
 * 複数の進捗データを一括保存
 * @param {Array} progressList - [{rowNumber, progressData}, ...]
 */
function saveProgressBatch(progressList) {
  const sheet = getOrCreateSheet(SHEET_NAMES.PROGRESS);
  const lastRow = sheet.getLastRow();
  
  // 既存の行番号をマップ化
  const existingRows = {};
  if (lastRow > 1) {
    const rowNumbers = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < rowNumbers.length; i++) {
      if (rowNumbers[i][0]) {
        existingRows[rowNumbers[i][0]] = i + 2;
      }
    }
  }
  
  const updates = [];
  const inserts = [];
  
  for (const item of progressList) {
    const rowNumber = item.rowNumber;
    const prog = item.progressData;
    
    const data = [
      rowNumber,
      prog.correctCount || 0,
      prog.incorrectCount || 0,
      prog.streak || 0,
      prog.nextReviewDate || '',
      prog.favorite || false,
      prog.passed || false
    ];
    
    if (existingRows[rowNumber]) {
      updates.push({ row: existingRows[rowNumber], data: data });
    } else {
      inserts.push(data);
    }
  }
  
  // 既存行を更新
  for (const update of updates) {
    sheet.getRange(update.row, 1, 1, 7).setValues([update.data]);
  }
  
  // 新規行を追加
  if (inserts.length > 0) {
    const startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, inserts.length, 7).setValues(inserts);
  }
  
  return { success: true, updated: updates.length, inserted: inserts.length };
}

/**
 * 次回復習日を計算
 * @param {number} streak - 連続正解数
 * @returns {string} - 次回復習日（yyyy-MM-dd）
 */
function calculateNextReviewDate(streak) {
  const settings = getSettings();
  let interval = 1;
  
  if (streak >= 5) {
    interval = settings.interval_5 || 30;
  } else if (streak >= 4) {
    interval = settings.interval_4 || 14;
  } else if (streak >= 3) {
    interval = settings.interval_3 || 7;
  } else if (streak >= 2) {
    interval = settings.interval_2 || 3;
  } else if (streak >= 1) {
    interval = settings.interval_1 || 1;
  }
  
  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + interval);
  
  return Utilities.formatDate(nextDate, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

// ============================================
// テスト用関数
// ============================================

/**
 * カードデータと進捗を保存
 * @param {number} rowNumber - カードの行番号
 * @param {Object} fieldData - フィールドデータ
 * @param {Object} progressData - 進捗データ
 */
function saveCardData(rowNumber, fieldData, progressData) {
  const sheet = getOrCreateSheet(SHEET_NAMES.CARDS);
  const fields = getFields();
  
  // 各フィールドを更新
  for (const field of fields) {
    if (fieldData.hasOwnProperty(field.name)) {
      const colIndex = field.index + 1; // 1-indexed
      sheet.getRange(rowNumber, colIndex).setValue(fieldData[field.name]);
    }
  }
  
  // 進捗も保存
  if (progressData) {
    saveProgress(rowNumber, progressData);
  }
  
  return { success: true, rowNumber: rowNumber };
}

/**
 * 接続テスト
 */
function testConnection() {
  try {
    const ss = getSpreadsheet();
    return {
      success: true,
      message: 'スプレッドシートに接続しました: ' + ss.getName()
    };
  } catch (e) {
    return {
      success: false,
      message: 'エラー: ' + e.message
    };
  }
}

/**
 * シート初期化（手動実行用）
 */
function initializeAllSheets() {
  getOrCreateSheet(SHEET_NAMES.CARDS);
  getOrCreateSheet(SHEET_NAMES.PROGRESS);
  getOrCreateSheet(SHEET_NAMES.SETTINGS);
  return '全シートを初期化しました';
}
