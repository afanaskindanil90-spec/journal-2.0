// Мок-данные для статического режима (без БД)
// Используются когда USE_DATABASE=false или БД недоступна

import { JournalLesson, SchoolClass, Service } from "./models";
import { seedClasses } from "./seed-data";
import {
  ATTENDANCE_MARKS,
  WORK_TYPE_KEYS,
  getRecentSchoolDates,
} from "./journal";

export const mockClasses: SchoolClass[] = seedClasses.map((seed, index) => ({
  id: seed.id,
  name: seed.name,
  isMyClass: seed.isMyClass,
  sortOrder: index + 1,
  students: seed.students.map((student, studentIndex) => ({
    id: `${seed.id}-${studentIndex + 1}`,
    lastName: student.lastName,
    firstName: student.firstName,
  })),
  createdAt: new Date("2024-01-15").toISOString(),
  updatedAt: new Date("2024-01-15").toISOString(),
}));

export const mockJournal: JournalLesson[] = seedClasses.flatMap(
  (seed, classIndex) => {
    const dates = getRecentSchoolDates(10);
    return dates.map((date, dateIndex) => {
      const entries: Record<string, string> = {};
      seed.students.forEach((student, studentIndex) => {
        if ((studentIndex + dateIndex) % 5 === 0) {
          entries[`${seed.id}-${studentIndex + 1}`] =
            ATTENDANCE_MARKS[
              (studentIndex + dateIndex * 2) % ATTENDANCE_MARKS.length
            ];
        } else if ((studentIndex + dateIndex) % 7 !== 1) {
          entries[`${seed.id}-${studentIndex + 1}`] = String(
            ((studentIndex + dateIndex) % 4) + 2
          );
        }
      });
      return {
        classId: seed.id,
        date,
        workType:
          WORK_TYPE_KEYS[(classIndex + dateIndex) % WORK_TYPE_KEYS.length],
        entries,
        ...(dateIndex % 3 === 0 && {
          homework:
            "Повторить параграфы и выполнить задания в рабочей тетради к следующему уроку.",
        }),
        ...(dateIndex % 4 === 1 && {
          homeworkFiles: [
            {
              id: `${seed.id}-${date}-hw-file`,
              name: "задание-к-уроку.txt",
              type: "text/plain",
              size: 90,
              data: Buffer.from(
                "Пример прикреплённого файла к домашнему заданию."
              ).toString("base64"),
            },
          ],
        }),
      };
    });
  }
);

export const mockServices: Service[] = [
  {
    id: "mock-service-1",
    name: "API Gateway",
    description: "Шлюз для микросервисной архитектуры",
    status: "active",
    url: "https://api.example.com",
    createdAt: new Date("2024-01-15").toISOString(),
    updatedAt: new Date("2024-01-15").toISOString(),
  },
  {
    id: "mock-service-2",
    name: "Auth Service",
    description: "Сервис аутентификации и авторизации",
    status: "active",
    url: "https://auth.example.com",
    createdAt: new Date("2024-02-01").toISOString(),
    updatedAt: new Date("2024-02-01").toISOString(),
  },
  {
    id: "mock-service-3",
    name: "ML Pipeline",
    description: "Пайплайн для обработки данных с AI",
    status: "deploying",
    url: undefined,
    createdAt: new Date("2024-03-10").toISOString(),
    updatedAt: new Date("2024-03-10").toISOString(),
  },
];
