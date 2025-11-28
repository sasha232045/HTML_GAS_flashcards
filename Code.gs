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

// 進捗データ列（Cardsシート内、右端に配置）
const PROGRESS_COLUMNS = {
  CORRECT_COUNT: '正解数',
  INCORRECT_COUNT: '不正解数',
  STREAK: '連続正解',
  NEXT_REVIEW_DATE: '次回復習日',
  FAVORITE: 'お気に入り',
  PASSED: '合格'
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
    case SHEET_NAMES.SETTINGS:
      initializeSettingsSheet(sheet);
      break;
  }
}

/**
 * Cardsシートを初期化（進捗列を含む）
 */
function initializeCardsSheet(sheet) {
  // カードフィールド + 進捗列
  const headers = [
    ['ID', 'デッキ', '英語', '日本語', '読み', '例文', '発音記号', '正解数', '不正解数', '連続正解', '次回復習日', 'お気に入り', '合格'],
    ['-', '-', '表', '裏', '裏', '裏', '非表示', '-', '-', '-', '-', '-', '-'],
    ['-', '-', '1', '1', '2', '3', '-', '-', '-', '-', '-', '-', '-'],
    ['-', '-', '1', '2', '-', '-', '-', '-', '-', '-', '-', '-', '-'],
    ['-', '-', '左', '右', '右', '右', '非表示', '-', '-', '-', '-', '-', '-'],
    ['-', '-', '1', '1', '2', '3', '-', '-', '-', '-', '-', '-', '-'],
    ['-', '-', '1', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-'],
    ['8', 'サンプル', 'apple', 'りんご', 'アップル', 'I eat an apple every day.', 'ˈæp.əl', 0, 0, 0, '', false, false],
    ['9', 'サンプル', 'book', '本', 'ブック', 'This is a book.', 'bʊk', 0, 0, 0, '', false, false],
    ['10', 'サンプル', 'cat', '猫', 'キャット', 'The cat is sleeping.', 'kæt', 0, 0, 0, '', false, false]
  ];
  
  sheet.getRange(1, 1, headers.length, headers[0].length).setValues(headers);
  
  // ヘッダー行のスタイル設定
  sheet.getRange(1, 1, 1, headers[0].length).setBackground('#4285f4').setFontColor('#ffffff').setFontWeight('bold');
  sheet.getRange(2, 1, 4, headers[0].length).setBackground('#e8f0fe');  // カード表示設定
  sheet.getRange(5, 1, 3, headers[0].length).setBackground('#fff3e0');  // 一覧表示設定
}

/**
 * 進捗列のインデックスを取得
 */
function getProgressColumnIndices(fields) {
  const indices = {};
  for (let i = 0; i < fields.length; i++) {
    const name = fields[i].name;
    if (name === PROGRESS_COLUMNS.CORRECT_COUNT) indices.correctCount = i;
    else if (name === PROGRESS_COLUMNS.INCORRECT_COUNT) indices.incorrectCount = i;
    else if (name === PROGRESS_COLUMNS.STREAK) indices.streak = i;
    else if (name === PROGRESS_COLUMNS.NEXT_REVIEW_DATE) indices.nextReviewDate = i;
    else if (name === PROGRESS_COLUMNS.FAVORITE) indices.favorite = i;
    else if (name === PROGRESS_COLUMNS.PASSED) indices.passed = i;
  }
  return indices;
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
 * フィールド定義を取得（進捗列は表示対象から除外）
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
  
  const progressColumnNames = Object.values(PROGRESS_COLUMNS);
  
  const fields = [];
  for (let i = 0; i < lastCol; i++) {
    // 進捗列もfieldsに含める（ただしdisplaySideは'-'）
    fields.push({
      index: i,
      name: fieldNames[i],
      displaySide: displaySides[i],
      displayOrder: displayOrders[i],
      speechOrder: speechOrders[i],
      listSide: listSides[i],
      listOrder: listOrders[i],
      listSpeechOrder: listSpeechOrders[i],
      isProgressColumn: progressColumnNames.includes(fieldNames[i])
    });
  }
  
  return fields;
}

/**
 * 全カードデータを取得（進捗データを含む）
 */
function getCards() {
  const sheet = getOrCreateSheet(SHEET_NAMES.CARDS);
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  
  if (lastRow < CARDS_HEADER_ROWS.DATA_START) return [];
  
  const fields = getFields();
  const progressIndices = getProgressColumnIndices(fields);
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
      // 進捗列はfieldsに含めない
      const fieldName = fields[j].name;
      if (fieldName !== PROGRESS_COLUMNS.CORRECT_COUNT &&
          fieldName !== PROGRESS_COLUMNS.INCORRECT_COUNT &&
          fieldName !== PROGRESS_COLUMNS.STREAK &&
          fieldName !== PROGRESS_COLUMNS.NEXT_REVIEW_DATE &&
          fieldName !== PROGRESS_COLUMNS.FAVORITE &&
          fieldName !== PROGRESS_COLUMNS.PASSED) {
        card.fields[fieldName] = row[j];
      }
    }
    
    cards.push(card);
  }
  
  return cards;
}

/**
 * 進捗データを取得（Cardsシートから）
 */
function getProgress() {
  const sheet = getOrCreateSheet(SHEET_NAMES.CARDS);
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  
  if (lastRow < CARDS_HEADER_ROWS.DATA_START) return {};
  
  const fields = getFields();
  const progressIndices = getProgressColumnIndices(fields);
  
  // 進捗列が存在しない場合は空を返す
  if (Object.keys(progressIndices).length < 6) return {};
  
  const dataRange = sheet.getRange(CARDS_HEADER_ROWS.DATA_START, 1, lastRow - CARDS_HEADER_ROWS.DATA_START + 1, lastCol);
  const data = dataRange.getValues();
  
  const progress = {};
  
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowNumber = CARDS_HEADER_ROWS.DATA_START + i;
    
    // 空行はスキップ
    if (!row[0] && !row[1] && !row[2]) continue;
    
    const nextReviewDateValue = row[progressIndices.nextReviewDate];
    let nextReviewDate = null;
    if (nextReviewDateValue) {
      if (nextReviewDateValue instanceof Date) {
        nextReviewDate = Utilities.formatDate(nextReviewDateValue, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      } else if (typeof nextReviewDateValue === 'string' && nextReviewDateValue.length > 0) {
        nextReviewDate = nextReviewDateValue;
      }
    }
    
    progress[rowNumber] = {
      correctCount: row[progressIndices.correctCount] || 0,
      incorrectCount: row[progressIndices.incorrectCount] || 0,
      streak: row[progressIndices.streak] || 0,
      nextReviewDate: nextReviewDate,
      favorite: row[progressIndices.favorite] === true || row[progressIndices.favorite] === 'TRUE',
      passed: row[progressIndices.passed] === true || row[progressIndices.passed] === 'TRUE'
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
 * 進捗データを保存（Cardsシートに直接保存）
 * @param {number} rowNumber - カードの行番号
 * @param {Object} progressData - 進捗データ
 */
function saveProgress(rowNumber, progressData) {
  const sheet = getOrCreateSheet(SHEET_NAMES.CARDS);
  const fields = getFields();
  const progressIndices = getProgressColumnIndices(fields);
  
  // 進捗列が存在しない場合はエラー
  if (Object.keys(progressIndices).length < 6) {
    throw new Error('進捗列がCardsシートに存在しません。');
  }
  
  // 各進捗データを書き込み
  sheet.getRange(rowNumber, progressIndices.correctCount + 1).setValue(progressData.correctCount || 0);
  sheet.getRange(rowNumber, progressIndices.incorrectCount + 1).setValue(progressData.incorrectCount || 0);
  sheet.getRange(rowNumber, progressIndices.streak + 1).setValue(progressData.streak || 0);
  sheet.getRange(rowNumber, progressIndices.nextReviewDate + 1).setValue(progressData.nextReviewDate || '');
  sheet.getRange(rowNumber, progressIndices.favorite + 1).setValue(progressData.favorite || false);
  sheet.getRange(rowNumber, progressIndices.passed + 1).setValue(progressData.passed || false);
  
  return { success: true, rowNumber: rowNumber };
}

/**
 * 複数の進捗データを一括保存
 * @param {Array} progressList - [{rowNumber, progressData}, ...]
 */
function saveProgressBatch(progressList) {
  const sheet = getOrCreateSheet(SHEET_NAMES.CARDS);
  const fields = getFields();
  const progressIndices = getProgressColumnIndices(fields);
  
  // 進捗列が存在しない場合はエラー
  if (Object.keys(progressIndices).length < 6) {
    throw new Error('進捗列がCardsシートに存在しません。');
  }
  
  for (const item of progressList) {
    const rowNumber = item.rowNumber;
    const prog = item.progressData;
    
    sheet.getRange(rowNumber, progressIndices.correctCount + 1).setValue(prog.correctCount || 0);
    sheet.getRange(rowNumber, progressIndices.incorrectCount + 1).setValue(prog.incorrectCount || 0);
    sheet.getRange(rowNumber, progressIndices.streak + 1).setValue(prog.streak || 0);
    sheet.getRange(rowNumber, progressIndices.nextReviewDate + 1).setValue(prog.nextReviewDate || '');
    sheet.getRange(rowNumber, progressIndices.favorite + 1).setValue(prog.favorite || false);
    sheet.getRange(rowNumber, progressIndices.passed + 1).setValue(prog.passed || false);
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
 * @param {Object} fieldData - フィールドデータ
 * @param {Object} progressData - 進捗データ
 */
function saveCardData(rowNumber, fieldData, progressData) {
  const sheet = getOrCreateSheet(SHEET_NAMES.CARDS);
  const fields = getFields();
  const progressIndices = getProgressColumnIndices(fields);
  
  // 各フィールドを更新（進捗列以外）
  for (const field of fields) {
    if (fieldData.hasOwnProperty(field.name)) {
      // 進捗列でないフィールドのみ更新
      if (field.name !== PROGRESS_COLUMNS.CORRECT_COUNT &&
          field.name !== PROGRESS_COLUMNS.INCORRECT_COUNT &&
          field.name !== PROGRESS_COLUMNS.STREAK &&
          field.name !== PROGRESS_COLUMNS.NEXT_REVIEW_DATE &&
          field.name !== PROGRESS_COLUMNS.FAVORITE &&
          field.name !== PROGRESS_COLUMNS.PASSED) {
        const colIndex = field.index + 1; // 1-indexed
        sheet.getRange(rowNumber, colIndex).setValue(fieldData[field.name]);
      }
    }
  }
  
  // 進捗データも保存（Cardsシートに直接）
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
  getOrCreateSheet(SHEET_NAMES.SETTINGS);
  return '全シートを初期化しました';
}
