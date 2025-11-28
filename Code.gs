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

// 固定列（システム列）の定義
// これらの列は常に先頭に配置され、位置が固定されます
const FIXED_COLUMNS = {
  ID: { index: 0, name: 'ID' },
  CORRECT_COUNT: { index: 1, name: '正解数' },
  INCORRECT_COUNT: { index: 2, name: '不正解数' },
  STREAK: { index: 3, name: '連続正解' },
  NEXT_REVIEW_DATE: { index: 4, name: '次回復習日' },
  FAVORITE: { index: 5, name: 'お気に入り' },
  PASSED: { index: 6, name: '合格' }
};

// 固定列の数（ID + 進捗6列 = 7列）
const FIXED_COLUMN_COUNT = 7;

// カスタムフィールド開始列（0-indexed: 7 = H列）
const CUSTOM_FIELD_START_INDEX = 7;

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
    case SHEET_NAMES.SETTINGS:
      initializeSettingsSheet(sheet);
      break;
  }
}

/**
 * Cardsシートを初期化
 * 列構造: [固定列7列] + [カスタムフィールド（デッキ、英語、日本語など）]
 * 固定列: ID, 正解数, 不正解数, 連続正解, 次回復習日, お気に入り, 合格
 */
function initializeCardsSheet(sheet) {
  // 固定列（7列）+ カスタムフィールド（6列）= 13列
  const headers = [
    // 固定列7列                                                        + カスタムフィールド
    ['ID', '正解数', '不正解数', '連続正解', '次回復習日', 'お気に入り', '合格', 'デッキ', '英語', '日本語', '読み', '例文', '発音記号'],
    // displaySide: 固定列は'-'、カスタムフィールドは表示設定
    ['-', '-', '-', '-', '-', '-', '-', '-', '表', '裏', '裏', '裏', '非表示'],
    // displayOrder
    ['-', '-', '-', '-', '-', '-', '-', '-', '1', '1', '2', '3', '-'],
    // speechOrder
    ['-', '-', '-', '-', '-', '-', '-', '-', '1', '2', '-', '-', '-'],
    // listSide
    ['-', '-', '-', '-', '-', '-', '-', '-', '左', '右', '右', '右', '非表示'],
    // listOrder
    ['-', '-', '-', '-', '-', '-', '-', '-', '1', '1', '2', '3', '-'],
    // listSpeechOrder
    ['-', '-', '-', '-', '-', '-', '-', '-', '1', '-', '-', '-', '-'],
    // サンプルデータ
    [1, 0, 0, 0, '', false, false, 'サンプル', 'apple', 'りんご', 'アップル', 'I eat an apple every day.', 'ˈæp.əl'],
    [2, 0, 0, 0, '', false, false, 'サンプル', 'book', '本', 'ブック', 'This is a book.', 'bʊk'],
    [3, 0, 0, 0, '', false, false, 'サンプル', 'cat', '猫', 'キャット', 'The cat is sleeping.', 'kæt']
  ];
  
  sheet.getRange(1, 1, headers.length, headers[0].length).setValues(headers);
  
  // ヘッダー行のスタイル設定
  sheet.getRange(1, 1, 1, headers[0].length).setBackground('#4285f4').setFontColor('#ffffff').setFontWeight('bold');
  // 固定列のヘッダー背景色を区別
  sheet.getRange(1, 1, 1, FIXED_COLUMN_COUNT).setBackground('#1a73e8');
  // 設定行の背景色
  sheet.getRange(2, 1, 4, headers[0].length).setBackground('#e8f0fe');  // カード表示設定
  sheet.getRange(5, 1, 3, headers[0].length).setBackground('#fff3e0');  // 一覧表示設定
  // 固定列の設定行背景を薄いグレーに
  sheet.getRange(2, 1, 6, FIXED_COLUMN_COUNT).setBackground('#f5f5f5');
}

/**
 * 固定列かどうかを判定
 */
function isFixedColumn(columnIndex) {
  return columnIndex < FIXED_COLUMN_COUNT;
}

/**
 * 固定列名のリストを取得
 */
function getFixedColumnNames() {
  return Object.values(FIXED_COLUMNS).map(col => col.name);
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
    ['listWaitBetweenFields', '0', '一覧読み上げ時のフィールド間の待機時間（秒）'],
    ['listWaitBetweenCards', '0.3', '一覧読み上げ時のカード間の待機時間（秒）'],
    ['waitTimeBetweenCards', '3', '学習中のカード間の待機時間（秒）'],
    ['waitTimeAfterFlip', '2', '学習中のめくり後の待機時間（秒）'],
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
 * 固定列（ID, 進捗データ）とカスタムフィールドを区別して返す
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
  
  const fixedColumnNames = getFixedColumnNames();
  
  const fields = [];
  for (let i = 0; i < lastCol; i++) {
    const isFixed = isFixedColumn(i);
    fields.push({
      index: i,
      name: fieldNames[i],
      displaySide: displaySides[i],
      displayOrder: displayOrders[i],
      speechOrder: speechOrders[i],
      listSide: listSides[i],
      listOrder: listOrders[i],
      listSpeechOrder: listSpeechOrders[i],
      isFixedColumn: isFixed,
      isProgressColumn: isFixed && fieldNames[i] !== 'ID'
    });
  }
  
  return fields;
}

/**
 * 全カードデータを取得
 * 固定列（進捗データ）を除き、ID + カスタムフィールドのみを返す
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
    
    // ID列が空の行はスキップ
    if (!row[FIXED_COLUMNS.ID.index]) continue;
    
    const card = {
      rowNumber: rowNumber,
      fields: {}
    };
    
    for (let j = 0; j < fields.length; j++) {
      // 進捗列（ID以外の固定列）はfieldsに含めない
      if (!fields[j].isProgressColumn) {
        card.fields[fields[j].name] = row[j];
      }
    }
    
    cards.push(card);
  }
  
  return cards;
}

/**
 * 進捗データを取得（固定列から直接読み取り）
 */
function getProgress() {
  const sheet = getOrCreateSheet(SHEET_NAMES.CARDS);
  const lastRow = sheet.getLastRow();
  
  if (lastRow < CARDS_HEADER_ROWS.DATA_START) return {};
  
  // 固定列のみ読み取り（ID + 進捗6列 = 7列）
  const dataRange = sheet.getRange(CARDS_HEADER_ROWS.DATA_START, 1, lastRow - CARDS_HEADER_ROWS.DATA_START + 1, FIXED_COLUMN_COUNT);
  const data = dataRange.getValues();
  
  const progress = {};
  
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowNumber = CARDS_HEADER_ROWS.DATA_START + i;
    
    // ID列が空の行はスキップ
    if (!row[FIXED_COLUMNS.ID.index]) continue;
    
    const nextReviewDateValue = row[FIXED_COLUMNS.NEXT_REVIEW_DATE.index];
    let nextReviewDate = null;
    if (nextReviewDateValue) {
      if (nextReviewDateValue instanceof Date) {
        nextReviewDate = Utilities.formatDate(nextReviewDateValue, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      } else if (typeof nextReviewDateValue === 'string' && nextReviewDateValue.length > 0) {
        nextReviewDate = nextReviewDateValue;
      }
    }
    
    progress[rowNumber] = {
      correctCount: row[FIXED_COLUMNS.CORRECT_COUNT.index] || 0,
      incorrectCount: row[FIXED_COLUMNS.INCORRECT_COUNT.index] || 0,
      streak: row[FIXED_COLUMNS.STREAK.index] || 0,
      nextReviewDate: nextReviewDate,
      favorite: row[FIXED_COLUMNS.FAVORITE.index] === true || row[FIXED_COLUMNS.FAVORITE.index] === 'TRUE',
      passed: row[FIXED_COLUMNS.PASSED.index] === true || row[FIXED_COLUMNS.PASSED.index] === 'TRUE'
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
 * 進捗データを保存（固定列に直接保存）
 * @param {number} rowNumber - カードの行番号
 * @param {Object} progressData - 進捗データ
 */
function saveProgress(rowNumber, progressData) {
  const sheet = getOrCreateSheet(SHEET_NAMES.CARDS);
  
  // 進捗データを配列として準備（固定列のインデックス順）
  const progressRow = [
    progressData.correctCount || 0,
    progressData.incorrectCount || 0,
    progressData.streak || 0,
    progressData.nextReviewDate || '',
    progressData.favorite || false,
    progressData.passed || false
  ];
  
  // 進捗列（B-G列、インデックス1-6）に一括書き込み
  sheet.getRange(rowNumber, FIXED_COLUMNS.CORRECT_COUNT.index + 1, 1, 6).setValues([progressRow]);
  
  return { success: true, rowNumber: rowNumber };
}

/**
 * 複数の進捗データを一括保存
 * @param {Array} progressList - [{rowNumber, progressData}, ...]
 */
function saveProgressBatch(progressList) {
  const sheet = getOrCreateSheet(SHEET_NAMES.CARDS);
  
  for (const item of progressList) {
    const rowNumber = item.rowNumber;
    const prog = item.progressData;
    
    const progressRow = [
      prog.correctCount || 0,
      prog.incorrectCount || 0,
      prog.streak || 0,
      prog.nextReviewDate || '',
      prog.favorite || false,
      prog.passed || false
    ];
    
    sheet.getRange(rowNumber, FIXED_COLUMNS.CORRECT_COUNT.index + 1, 1, 6).setValues([progressRow]);
  }
  
  return { success: true, updated: progressList.length };
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
 * @param {Object} fieldData - フィールドデータ（カスタムフィールドのみ）
 * @param {Object} progressData - 進捗データ
 */
function saveCardData(rowNumber, fieldData, progressData) {
  const sheet = getOrCreateSheet(SHEET_NAMES.CARDS);
  const fields = getFields();
  
  // 各フィールドを更新（固定列以外のカスタムフィールドのみ）
  for (const field of fields) {
    if (fieldData.hasOwnProperty(field.name) && !field.isFixedColumn) {
      const colIndex = field.index + 1; // 1-indexed
      sheet.getRange(rowNumber, colIndex).setValue(fieldData[field.name]);
    }
  }
  
  // 進捗データも保存
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
 * 設定を保存
 * @param {string} key - 設定キー
 * @param {any} value - 設定値
 */
function saveSetting(key, value) {
  const sheet = getOrCreateSheet(SHEET_NAMES.SETTINGS);
  const lastRow = sheet.getLastRow();
  
  // 既存の設定を検索
  if (lastRow > 1) {
    const keys = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < keys.length; i++) {
      if (keys[i][0] === key) {
        // 既存の設定を更新
        sheet.getRange(i + 2, 2).setValue(value);
        return { success: true, key: key, value: value };
      }
    }
  }
  
  // 新規設定を追加
  sheet.getRange(lastRow + 1, 1, 1, 2).setValues([[key, value]]);
  return { success: true, key: key, value: value };
}

/**
 * シート初期化（手動実行用）
 */
function initializeAllSheets() {
  getOrCreateSheet(SHEET_NAMES.CARDS);
  getOrCreateSheet(SHEET_NAMES.SETTINGS);
  return '全シートを初期化しました';
}
