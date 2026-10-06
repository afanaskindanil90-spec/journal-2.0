export const WORK_TYPE_KEYS = [
  "control",
  "independent",
  "credit",
  "answer",
  "homework",
  "project",
  "dictation",
  "test",
] as const;

export type WorkTypeKey = (typeof WORK_TYPE_KEYS)[number];

export const WORK_TYPE_LABELS: Record<WorkTypeKey, string> = {
  control: "Контрольная",
  independent: "Самостоятельная",
  credit: "Зачёт",
  answer: "Ответ на уроке",
  homework: "Домашняя работа",
  project: "Проект",
  dictation: "Диктант",
  test: "Тест",
};

export const GRADES = ["2", "3", "4", "5"] as const;

export type Grade = (typeof GRADES)[number];

export const ATTENDANCE_MARKS = [
  "Н",
  "Б",
  "У",
  "О",
  "Пр",
  "К",
  "С",
  "Э",
  "Ч",
  "В",
  "Сп",
  "Д",
] as const;

export type AttendanceMark = (typeof ATTENDANCE_MARKS)[number];

export const ATTENDANCE_LABELS: Record<AttendanceMark, string> = {
  Н: "не был",
  Б: "болел",
  У: "уважительная причина",
  О: "опоздал",
  Пр: "прогул",
  К: "карантин",
  С: "соревнования",
  Э: "экскурсия",
  Ч: "чрезвычайные обстоятельства",
  В: "врач",
  Сп: "справка",
  Д: "дежурство",
};

export const CELL_VALUES = [...GRADES, ...ATTENDANCE_MARKS] as const;

export type CellValue = (typeof CELL_VALUES)[number];

export const HOMEWORK_MAX_TEXT_LENGTH = 10_000;
export const HOMEWORK_MAX_FILES = 10;
export const HOMEWORK_MAX_FILE_BYTES = 200 * 1024;
export const HOMEWORK_MAX_TOTAL_BYTES = 250 * 1024;

export const HOMEWORK_ACCEPT =
  "image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt";

export function isGrade(value: string): value is Grade {
  return (GRADES as readonly string[]).includes(value);
}

export function isAttendanceMark(value: string): value is AttendanceMark {
  return (ATTENDANCE_MARKS as readonly string[]).includes(value);
}

export function getRecentSchoolDates(count: number): string[] {
  const dates: string[] = [];
  const now = new Date();
  const cursor = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  while (dates.length < count) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) {
      dates.unshift(cursor.toISOString().split("T")[0]);
    }
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return dates;
}

const WEEKDAYS_SHORT = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];

export function formatDateHeader(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return date;
  const dt = new Date(Date.UTC(year, month - 1, day));
  const dd = String(day).padStart(2, "0");
  const mm = String(month).padStart(2, "0");
  return `${WEEKDAYS_SHORT[dt.getUTCDay()]} ${dd}.${mm}`;
}

export function formatDateLong(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return date;
  const dd = String(day).padStart(2, "0");
  const mm = String(month).padStart(2, "0");
  return `${dd}.${mm}.${year}`;
}
