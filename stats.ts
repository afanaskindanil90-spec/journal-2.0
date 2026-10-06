import {
  ATTENDANCE_MARKS,
  isAttendanceMark,
  isGrade,
  type AttendanceMark,
} from "./journal";
import type { JournalLesson, Student } from "./models";

export type AbsenceCounts = Record<AttendanceMark, number>;

export function emptyAbsenceCounts(): AbsenceCounts {
  return Object.fromEntries(
    ATTENDANCE_MARKS.map((mark) => [mark, 0])
  ) as AbsenceCounts;
}

export interface StudentStats {
  student: Student;
  averageGrade: number | null;
  gradesCount: number;
  absences: AbsenceCounts;
}

export interface ClassStats {
  classAverageGrade: number | null;
  gradesCount: number;
  absences: AbsenceCounts;
}

export function computeStudentStats(
  student: Student,
  lessons: JournalLesson[]
): StudentStats {
  const absences = emptyAbsenceCounts();
  let sum = 0;
  let count = 0;

  for (const lesson of lessons) {
    const value = lesson.entries?.[student.id];
    if (!value) continue;
    if (isGrade(value)) {
      sum += Number(value);
      count += 1;
    } else if (isAttendanceMark(value)) {
      absences[value] += 1;
    }
  }

  return {
    student,
    averageGrade: count > 0 ? sum / count : null,
    gradesCount: count,
    absences,
  };
}

export function computeClassStats(lessons: JournalLesson[]): ClassStats {
  const absences = emptyAbsenceCounts();
  let sum = 0;
  let count = 0;

  for (const lesson of lessons) {
    for (const value of Object.values(lesson.entries ?? {})) {
      if (!value) continue;
      if (isGrade(value)) {
        sum += Number(value);
        count += 1;
      } else if (isAttendanceMark(value)) {
        absences[value] += 1;
      }
    }
  }

  return {
    classAverageGrade: count > 0 ? sum / count : null,
    gradesCount: count,
    absences,
  };
}

export function formatAverage(value: number | null): string {
  if (value === null) return "—";
  return value.toLocaleString("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}
