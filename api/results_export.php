<?php
// Выгрузка протокола гонки в Excel (.xlsx).
// Один файл: лист «Абсолют» + по листу на каждую категорию.
// XLSX собирается вручную через ZipArchive — без сторонних библиотек.

if (!isset($_GET['race_id']) || !is_numeric($_GET['race_id'])) {
  http_response_code(400);
  header('Content-Type: application/json');
  echo json_encode(['success' => false, 'error' => 'race_id обязателен']);
  exit;
}

$raceId = (int)$_GET['race_id'];

try {
  $config = require_once __DIR__ . '/../config/db.php';
  $dsn = "mysql:host={$config['host']};port={$config['port']};dbname={$config['dbname']};charset=utf8mb4";
  $pdo = new PDO($dsn, $config['username'], $config['password'], [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
  ]);

  $raceStmt = $pdo->prepare('SELECT name, stage, date, location FROM races WHERE id = ?');
  $raceStmt->execute([$raceId]);
  $race = $raceStmt->fetch(PDO::FETCH_ASSOC);
  if (!$race) {
    http_response_code(404);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'error' => 'Гонка не найдена']);
    exit;
  }

  $stmt = $pdo->prepare("
    SELECT place, bib_number, last_name, first_name, city, birth_year, category, laps
    FROM race_results
    WHERE race_id = ?
    ORDER BY place ASC
  ");
  $stmt->execute([$raceId]);
  $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

  if (!$results) {
    http_response_code(404);
    header('Content-Type: application/json');
    echo json_encode(['success' => false, 'error' => 'Результаты пока не опубликованы']);
    exit;
  }

  foreach ($results as &$r) {
    $r['laps'] = $r['laps'] ? (json_decode($r['laps'], true) ?: []) : [];
  }
  unset($r);

  // Шапка протокола: название гонки и дата/место
  $title = trim($race['name'] . ($race['stage'] ? '. ' . $race['stage'] : ''));
  $subtitleParts = [];
  if ($race['date']) {
    $subtitleParts[] = date('d.m.Y', strtotime($race['date']));
  }
  if ($race['location']) {
    $subtitleParts[] = $race['location'];
  }
  $subtitle = implode(', ', $subtitleParts);

  // Листы: «Абсолют» + категории в порядке появления (как на сайте)
  $sheets = [['name' => 'Абсолют', 'rows' => $results, 'absolute' => true]];
  $categories = [];
  foreach ($results as $r) {
    if ($r['category'] !== null && $r['category'] !== '' && !in_array($r['category'], $categories, true)) {
      $categories[] = $r['category'];
    }
  }
  foreach ($categories as $cat) {
    $rows = array_values(array_filter($results, function ($r) use ($cat) {
      return $r['category'] === $cat;
    }));
    $sheets[] = ['name' => $cat, 'rows' => $rows, 'absolute' => false];
  }

  $usedNames = [];
  foreach ($sheets as &$sheet) {
    $sheet['name'] = uniqueSheetName($sheet['name'], $usedNames);
    $sheet['xml']  = buildSheetXml($sheet['rows'], $sheet['absolute'], $title, $subtitle);
  }
  unset($sheet);

  $tmpFile = tempnam(sys_get_temp_dir(), 'wmx');
  $zip = new ZipArchive();
  if ($zip->open($tmpFile, ZipArchive::OVERWRITE) !== true) {
    throw new RuntimeException('Не удалось создать файл');
  }

  $zip->addFromString('[Content_Types].xml', buildContentTypesXml(count($sheets)));
  $zip->addFromString('_rels/.rels', buildRootRelsXml());
  $zip->addFromString('xl/workbook.xml', buildWorkbookXml($sheets));
  $zip->addFromString('xl/_rels/workbook.xml.rels', buildWorkbookRelsXml(count($sheets)));
  $zip->addFromString('xl/styles.xml', buildStylesXml());
  foreach ($sheets as $i => $sheet) {
    $zip->addFromString('xl/worksheets/sheet' . ($i + 1) . '.xml', $sheet['xml']);
  }
  $zip->close();

  $fileName  = 'Протокол - ' . preg_replace('/[\\\\\/:*?"<>|]+/u', ' ', $title) . '.xlsx';
  $asciiName = 'protocol_race_' . $raceId . '.xlsx';

  header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  header('Content-Disposition: attachment; filename="' . $asciiName . '"; filename*=UTF-8\'\'' . rawurlencode($fileName));
  header('Content-Length: ' . filesize($tmpFile));
  header('Cache-Control: no-cache, no-store');
  readfile($tmpFile);
  unlink($tmpFile);
  exit;
} catch (Exception $e) {
  if (isset($tmpFile) && is_file($tmpFile)) {
    unlink($tmpFile);
  }
  http_response_code(500);
  header('Content-Type: application/json');
  echo json_encode(['success' => false, 'error' => 'Ошибка сервера']);
  exit;
}

// ── Построение XML ───────────────────────────────────────────────────────

function xmlEscape($value) {
  $value = preg_replace('/[^\x{9}\x{A}\x{D}\x{20}-\x{D7FF}\x{E000}-\x{FFFD}]/u', '', (string)$value);
  return htmlspecialchars($value, ENT_QUOTES | ENT_XML1, 'UTF-8');
}

// Имя листа Excel: до 31 символа, без []:*?/\ и уникальное в книге
function uniqueSheetName($name, array &$used) {
  $base = trim(preg_replace('/\s+/u', ' ', preg_replace('/[\[\]:*?\/\\\\]/u', ' ', $name)));
  if ($base === '') {
    $base = 'Лист';
  }
  $base = mb_substr($base, 0, 31);
  $candidate = $base;
  $n = 2;
  while (in_array(mb_strtolower($candidate), $used, true)) {
    $suffix = ' (' . $n++ . ')';
    $candidate = mb_substr($base, 0, 31 - mb_strlen($suffix)) . $suffix;
  }
  $used[] = mb_strtolower($candidate);
  return $candidate;
}

// Номер колонки (0-based) → буквы: 0 → A, 26 → AA
function columnLetter($index) {
  $letters = '';
  $index++;
  while ($index > 0) {
    $mod = ($index - 1) % 26;
    $letters = chr(65 + $mod) . $letters;
    $index = intdiv($index - 1, 26);
  }
  return $letters;
}

// Ячейка: числа пишутся как числа, остальное — inline-строкой
function cellXml($ref, $value, $style = 0) {
  $s = $style ? ' s="' . $style . '"' : '';
  if ($value === null || $value === '') {
    return $style ? '<c r="' . $ref . '"' . $s . '/>' : '';
  }
  if (is_int($value) || (is_string($value) && preg_match('/^-?[1-9]\d{0,14}$|^0$/', $value))) {
    return '<c r="' . $ref . '"' . $s . '><v>' . $value . '</v></c>';
  }
  return '<c r="' . $ref . '"' . $s . ' t="inlineStr"><is><t xml:space="preserve">' . xmlEscape($value) . '</t></is></c>';
}

function rowXml($rowNum, array $values, $style = 0) {
  $cells = '';
  foreach ($values as $i => $value) {
    $cells .= cellXml(columnLetter($i) . $rowNum, $value, $style);
  }
  return '<row r="' . $rowNum . '">' . $cells . '</row>';
}

function buildSheetXml(array $rows, $isAbsolute, $title, $subtitle) {
  $lapCount = 0;
  foreach ($rows as $r) {
    $lapCount = max($lapCount, count($r['laps']));
  }

  $header = ['Место', 'Номер', 'Участник', 'Год', 'Город'];
  if ($isAbsolute) {
    $header[] = 'Категория';
  }
  for ($i = 1; $i <= $lapCount; $i++) {
    $header[] = 'Круг ' . $i;
  }

  $xmlRows = [];
  $rowNum = 1;
  $xmlRows[] = rowXml($rowNum++, [$title], 1);
  if ($subtitle !== '') {
    $xmlRows[] = rowXml($rowNum++, [$subtitle]);
  }
  $rowNum++; // пустая строка
  $headerRow = $rowNum;
  $xmlRows[] = rowXml($rowNum++, $header, 2);

  foreach ($rows as $idx => $r) {
    $place = $isAbsolute ? $r['place'] : $idx + 1;
    $name  = trim($r['last_name'] . ' ' . $r['first_name']);
    $values = [$place, $r['bib_number'], $name, $r['birth_year'], $r['city']];
    if ($isAbsolute) {
      $values[] = $r['category'];
    }
    for ($i = 0; $i < $lapCount; $i++) {
      $values[] = $r['laps'][$i] ?? '';
    }
    $xmlRows[] = rowXml($rowNum++, $values);
  }

  // Ширины колонок
  $widths = [8, 8, 32, 7, 18];
  if ($isAbsolute) {
    $widths[] = 14;
  }
  for ($i = 0; $i < $lapCount; $i++) {
    $widths[] = 12;
  }
  $cols = '';
  foreach ($widths as $i => $w) {
    $cols .= '<col min="' . ($i + 1) . '" max="' . ($i + 1) . '" width="' . $w . '" customWidth="1"/>';
  }

  // Закрепляем шапку таблицы при прокрутке
  $pane = '<sheetViews><sheetView workbookViewId="0">'
        . '<pane ySplit="' . $headerRow . '" topLeftCell="A' . ($headerRow + 1) . '" activePane="bottomLeft" state="frozen"/>'
        . '</sheetView></sheetViews>';

  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    . '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    . $pane
    . '<cols>' . $cols . '</cols>'
    . '<sheetData>' . implode('', $xmlRows) . '</sheetData>'
    . '</worksheet>';
}

function buildContentTypesXml($sheetCount) {
  $overrides = '';
  for ($i = 1; $i <= $sheetCount; $i++) {
    $overrides .= '<Override PartName="/xl/worksheets/sheet' . $i . '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
  }
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    . '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    . '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    . '<Default Extension="xml" ContentType="application/xml"/>'
    . '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
    . '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
    . $overrides
    . '</Types>';
}

function buildRootRelsXml() {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    . '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
    . '</Relationships>';
}

function buildWorkbookXml(array $sheets) {
  $list = '';
  foreach ($sheets as $i => $sheet) {
    $list .= '<sheet name="' . xmlEscape($sheet['name']) . '" sheetId="' . ($i + 1) . '" r:id="rId' . ($i + 1) . '"/>';
  }
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    . '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
    . '<sheets>' . $list . '</sheets>'
    . '</workbook>';
}

function buildWorkbookRelsXml($sheetCount) {
  $rels = '';
  for ($i = 1; $i <= $sheetCount; $i++) {
    $rels .= '<Relationship Id="rId' . $i . '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' . $i . '.xml"/>';
  }
  $rels .= '<Relationship Id="rId' . ($sheetCount + 1) . '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>';
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    . $rels
    . '</Relationships>';
}

// Стили: 0 — обычный, 1 — заголовок протокола (жирный, крупный), 2 — шапка таблицы (жирный, заливка, рамка)
function buildStylesXml() {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    . '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    . '<fonts count="3">'
    . '<font><sz val="11"/><name val="Calibri"/></font>'
    . '<font><b/><sz val="14"/><name val="Calibri"/></font>'
    . '<font><b/><sz val="11"/><name val="Calibri"/></font>'
    . '</fonts>'
    . '<fills count="3">'
    . '<fill><patternFill patternType="none"/></fill>'
    . '<fill><patternFill patternType="gray125"/></fill>'
    . '<fill><patternFill patternType="solid"><fgColor rgb="FFE0E0E0"/><bgColor indexed="64"/></patternFill></fill>'
    . '</fills>'
    . '<borders count="2">'
    . '<border><left/><right/><top/><bottom/><diagonal/></border>'
    . '<border><left/><right/><top/><bottom style="thin"><color auto="1"/></bottom><diagonal/></border>'
    . '</borders>'
    . '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
    . '<cellXfs count="3">'
    . '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
    . '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>'
    . '<xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>'
    . '</cellXfs>'
    . '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
    . '</styleSheet>';
}
