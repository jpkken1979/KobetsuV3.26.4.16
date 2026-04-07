import PDFDocument from "pdfkit";
import fs from "node:fs";
import path from "node:path";
import { generateKeiyakushoPDF } from "./server/pdf/keiyakusho-pdf.js";

const fontPath = path.join("server", "pdf", "fonts", "NotoSansJP-Regular.ttf");
const minchoPath = path.join("server", "pdf", "fonts", "BIZUDMincho-0.ttf");
const outDir = "output";
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 0 });
if (fs.existsSync(fontPath)) { doc.registerFont("JP", fontPath); doc.font("JP"); }
if (fs.existsSync(minchoPath)) { doc.registerFont("JP-Mincho", minchoPath); }

const outPath = path.join(outDir, "QUICK_契約書2.pdf");
const stream = fs.createWriteStream(outPath);
doc.pipe(stream);

generateKeiyakushoPDF(doc, {
  companyName: "ティーケーエンジニアリング株式会社",
  companyAddress: "愛知県弥富市六條町大崎11番地1",
  companyPhone: "0567-56-6711",
  factoryName: "海南第二工場",
  factoryAddress: "愛知県弥富市六條町大崎11番地1",
  factoryPhone: "0567-56-6711",
  department: "IH技術開発部",
  lineName: "CAD",
  conflictDate: "2027年3月31日",
  startDate: "2026-04-01",
  endDate: "2026-06-30",
  contractDate: "2026-03-27",
  jobDescription: "コイル製作・加工業務",
  workHours: "8:00～17:00",
  workHoursDay: "8:00～17:00",
  workHoursNight: "",
  breakTime: "12:00～13:00（60分）",
  breakTimeDay: "12:00～13:00（60分）",
  breakTimeNight: "",
  overtimeHours: "3時間/日, 42時間/月, 320時間/年とする。",
  hourlyRate: 1550,
  shiftPattern: "日勤",
  closingDay: "末日",
  paymentDay: "翌月末日",
  calendar: "月～金（シフトに準ずる）休日は、土曜日・日曜日・年末年始・GW・夏季休暇",
  supervisorDept: "III本部",
  supervisorName: "伊藤英昭",
  supervisorPhone: "0567-56-6711",
  hakensakiManagerDept: "III本部 弥富第二事業所",
  hakensakiManagerName: "伊藤英昭",
  hakensakiManagerPhone: "0567-56-6711",
  complaintClientDept: "III本部",
  complaintClientName: "伊藤英昭",
  complaintClientPhone: "0567-56-6711",
  complaintUnsDept: "営業部",
  complaintUnsName: "中山　欣英",
  complaintUnsPhone: "052-938-8840",
  employee: {
    employeeNumber: "E001",
    fullName: "グエン　ヴァン　アン",
    katakanaName: "グエン ヴァン アン",
    romajiName: "NGUYEN VAN ANH",
    gender: "male",
    birthDate: "1995-03-15",
    nationality: "ベトナム",
    address: "愛知県弥富市六條町大崎22番地5 パレスハウス201",
    postalCode: "498-0011",
    actualHireDate: "2020-04-01",
    hireDate: "2020-04-01",
    hourlyRate: 1500,
    billingRate: 1550,
    visaExpiry: "2027-03-31",
    visaType: "技能",
  },
});

doc.end();
stream.on("finish", () => {
  const stat = fs.statSync(outPath);
  console.log(`Generated: ${outPath} (${(stat.size / 1024).toFixed(1)} KB)`);
});
