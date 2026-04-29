const ExcelJS = require('exceljs');

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile('C:\\Users\\kenji\\AppData\\Local\\Temp\\shaindaicho.xlsm');

  const ws = wb.getWorksheet('DBGenzaiX');
  if (!ws) {
    console.log('DBGenzaiX not found. Sheets:', wb.worksheets.map(s => s.name));
    return;
  }

  // Headers are in row 1: 社員№=C, 派遣先ID=D, 派遣先=E, 配属先=F, 配属ライン=G, 氏名=I
  console.log('Headers:', ws.getRow(1).values);

  // Search for Carolina / アワコン
  ws.eachRow((row, ri) => {
    if (ri < 2) return;
    const values = row.values;
    const fullName = values[9]; // Column I: 氏名
    const katakana = values[10]; // Column J: カナ
    if (fullName && (fullName.includes('アワコン') || katakana && katakana.includes('アワコン'))) {
      console.log('\nFound at row', ri + ':');
      console.log('  社員№ (C):', values[3]);
      console.log('  派遣先ID (D):', values[4]);
      console.log('  派遣先 (E):', values[5]);
      console.log('  配属先 (F):', values[6]);
      console.log('  配属ライン (G):', values[7]);
      console.log('  仕事内容 (H):', values[8]);
      console.log('  氏名 (I):', values[9]);
      console.log('  カナ (J):', values[10]);
    }
    if (fullName && (fullName.includes('Carolina') || fullName.includes('カロリーナ') || fullName.includes('サチコ') || katakana && (katakana.includes(' Carolina') || katakana.includes('カロリーナ') || katakana.includes('サチコ')))) {
      console.log('\nFound at row', ri + ':');
      console.log('  社員№ (C):', values[3]);
      console.log('  派遣先ID (D):', values[4]);
      console.log('  派遣先 (E):', values[5]);
      console.log('  配属先 (F):', values[6]);
      console.log('  配属ライン (G):', values[7]);
      console.log('  仕事内容 (H):', values[8]);
      console.log('  氏名 (I):', values[9]);
      console.log('  カナ (J):', values[10]);
    }
  });

  console.log('\nDone. Total rows in DBGenzaiX:', ws.rowCount);
}
main().catch(console.error);
