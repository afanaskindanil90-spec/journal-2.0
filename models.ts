import { docClient } from "./db";
import {
  GetCommand,
  PutCommand,
  DeleteCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { TableName, IndexName } from "./schema";
import { seedClasses } from "./seed-data";
import { getRecentSchoolDates } from "./journal";

export interface Student {
  id: string;
  lastName: string;
  firstName: string;
}

export interface SchoolClass {
  id: string;
  name: string;
  isMyClass: boolean;
  sortOrder: number;
  students: Student[];
  createdAt: string;
  updatedAt: string;
}

export interface ClassInput {
  name: string;
  isMyClass: boolean;
}

let seedingPromise: Promise<boolean> | null = null;

export async function getAllClasses(): Promise<SchoolClass[]> {
  const result = await docClient.send(
    new ScanCommand({
      TableName: TableName.CLASSES,
    })
  );
  const items = (result.Items as SchoolClass[]) ?? [];
  return items.sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "ru")
  );
}

export async function getClassById(id: string): Promise<SchoolClass | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TableName.CLASSES,
      Key: { id },
    })
  );
  return (result.Item as SchoolClass) ?? null;
}

async function countClasses(): Promise<number> {
  const result = await docClient.send(
    new ScanCommand({
      TableName: TableName.CLASSES,
      Select: "COUNT",
    })
  );
  return result.Count ?? 0;
}

export async function seedClassesIfEmpty(): Promise<boolean> {
  if (seedingPromise) {
    return seedingPromise;
  }

  seedingPromise = (async () => {
    const count = await countClasses();
    if (count > 0) return false;

    const now = new Date().toISOString();
    for (const [index, seed] of seedClasses.entries()) {
      const schoolClass: SchoolClass = {
        id: seed.id,
        name: seed.name,
        isMyClass: seed.isMyClass,
        sortOrder: index + 1,
        students: seed.students.map((student, studentIndex) => ({
          id: `${seed.id}-${studentIndex + 1}`,
          lastName: student.lastName,
          firstName: student.firstName,
        })),
        createdAt: now,
        updatedAt: now,
      };
      await docClient.send(
        new PutCommand({
          TableName: TableName.CLASSES,
          Item: schoolClass,
        })
      );
    }
    return true;
  })();

  try {
    return await seedingPromise;
  } catch (error) {
    seedingPromise = null;
    throw error;
  }
}

async function clearMyClassFlags(classes: SchoolClass[]): Promise<void> {
  const now = new Date().toISOString();
  for (const schoolClass of classes) {
    if (!schoolClass.isMyClass) continue;
    await docClient.send(
      new UpdateCommand({
        TableName: TableName.CLASSES,
        Key: { id: schoolClass.id },
        UpdateExpression: "set isMyClass = :value, updatedAt = :now",
        ExpressionAttributeValues: { ":value": false, ":now": now },
      })
    );
  }
}

export async function createClass(data: ClassInput): Promise<SchoolClass> {
  const all = await getAllClasses();
  const nextSortOrder =
    all.length > 0 ? Math.max(...all.map((item) => item.sortOrder)) + 1 : 1;
  const now = new Date().toISOString();
  const schoolClass: SchoolClass = {
    id: crypto.randomUUID(),
    name: data.name,
    isMyClass: data.isMyClass,
    sortOrder: nextSortOrder,
    students: [],
    createdAt: now,
    updatedAt: now,
  };

  if (data.isMyClass) {
    await clearMyClassFlags(all);
  }

  await docClient.send(
    new PutCommand({
      TableName: TableName.CLASSES,
      Item: schoolClass,
    })
  );

  return schoolClass;
}

export async function deleteClass(id: string): Promise<void> {
  await docClient.send(
    new DeleteCommand({
      TableName: TableName.CLASSES,
      Key: { id },
    })
  );
}

export async function addStudent(
  classId: string,
  data: Omit<Student, "id">
): Promise<SchoolClass | null> {
  const schoolClass = await getClassById(classId);
  if (!schoolClass) return null;

  const student: Student = {
    id: crypto.randomUUID(),
    lastName: data.lastName,
    firstName: data.firstName,
  };

  const updated: SchoolClass = {
    ...schoolClass,
    students: [...schoolClass.students, student],
    updatedAt: new Date().toISOString(),
  };

  await docClient.send(
    new PutCommand({
      TableName: TableName.CLASSES,
      Item: updated,
    })
  );

  return updated;
}

export async function updateStudent(
  classId: string,
  studentId: string,
  data: Partial<Omit<Student, "id">>
): Promise<SchoolClass | null> {
  const schoolClass = await getClassById(classId);
  if (!schoolClass) return null;

  const students = schoolClass.students.map((student) =>
    student.id === studentId ? { ...student, ...data } : student
  );

  const updated: SchoolClass = {
    ...schoolClass,
    students,
    updatedAt: new Date().toISOString(),
  };

  await docClient.send(
    new PutCommand({
      TableName: TableName.CLASSES,
      Item: updated,
    })
  );

  return updated;
}

export async function removeStudent(
  classId: string,
  studentId: string
): Promise<SchoolClass | null> {
  const schoolClass = await getClassById(classId);
  if (!schoolClass) return null;

  const updated: SchoolClass = {
    ...schoolClass,
    students: schoolClass.students.filter(
      (student) => student.id !== studentId
    ),
    updatedAt: new Date().toISOString(),
  };

  await docClient.send(
    new PutCommand({
      TableName: TableName.CLASSES,
      Item: updated,
    })
  );

  return updated;
}

export interface HomeworkFile {
  id: string;
  name: string;
  type: string;
  size: number;
  data: string;
}

export interface JournalLesson {
  classId: string;
  date: string;
  workType?: string;
  entries: Record<string, string>;
  homework?: string;
  homeworkFiles?: HomeworkFile[];
}

function normalizeHomeworkFiles(value: unknown): HomeworkFile[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const files = value.filter(
    (file): file is HomeworkFile =>
      typeof file === "object" &&
      file !== null &&
      typeof (file as HomeworkFile).id === "string" &&
      typeof (file as HomeworkFile).name === "string" &&
      typeof (file as HomeworkFile).data === "string"
  );
  return files.length > 0 ? files : undefined;
}

function normalizeJournalLesson(
  item: Record<string, unknown> | undefined
): JournalLesson {
  return {
    classId: typeof item?.classId === "string" ? item.classId : "",
    date: typeof item?.date === "string" ? item.date : "",
    workType: typeof item?.workType === "string" ? item.workType : undefined,
    entries:
      item?.entries && typeof item.entries === "object"
        ? (item.entries as Record<string, string>)
        : {},
    homework: typeof item?.homework === "string" ? item.homework : undefined,
    homeworkFiles: normalizeHomeworkFiles(item?.homeworkFiles),
  };
}

export async function getJournalLesson(
  classId: string,
  date: string
): Promise<JournalLesson | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TableName.JOURNAL,
      Key: { classId, date },
    })
  );
  return result.Item ? normalizeJournalLesson(result.Item) : null;
}

export async function getJournalLessons(
  classId: string
): Promise<JournalLesson[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TableName.JOURNAL,
      KeyConditionExpression: "classId = :classId",
      ExpressionAttributeValues: { ":classId": classId },
    })
  );
  const items = (result.Items ?? []) as Record<string, unknown>[];
  return items
    .map((item) => normalizeJournalLesson(item))
    .sort((a, b) => a.date.localeCompare(b.date));
}

const DEFAULT_LESSON_COUNT = 10;

export async function ensureJournalSeeded(
  classId: string
): Promise<JournalLesson[]> {
  const existing = await getJournalLessons(classId);
  if (existing.length > 0) return existing;

  const lessons: JournalLesson[] = getRecentSchoolDates(
    DEFAULT_LESSON_COUNT
  ).map((date) => ({ classId, date, entries: {} }));

  for (const lesson of lessons) {
    await docClient.send(
      new PutCommand({
        TableName: TableName.JOURNAL,
        Item: lesson,
      })
    );
  }
  return lessons;
}

export async function upsertJournalLesson(input: {
  classId: string;
  date: string;
  workType?: string;
}): Promise<JournalLesson> {
  const result = await docClient.send(
    new UpdateCommand({
      TableName: TableName.JOURNAL,
      Key: { classId: input.classId, date: input.date },
      UpdateExpression: "set workType = :workType",
      ExpressionAttributeValues: { ":workType": input.workType ?? null },
      ReturnValues: "ALL_NEW",
    })
  );
  return normalizeJournalLesson(result.Attributes);
}

export async function setJournalCell(input: {
  classId: string;
  date: string;
  studentId: string;
  value: string;
}): Promise<JournalLesson> {
  const result = await docClient.send(
    new UpdateCommand({
      TableName: TableName.JOURNAL,
      Key: { classId: input.classId, date: input.date },
      UpdateExpression:
        input.value === ""
          ? "remove entries.#studentId"
          : "set entries.#studentId = :value",
      ExpressionAttributeNames: { "#studentId": input.studentId },
      ExpressionAttributeValues:
        input.value === "" ? undefined : { ":value": input.value },
      ReturnValues: "ALL_NEW",
    })
  );
  return normalizeJournalLesson(result.Attributes);
}

export async function saveHomeworkText(input: {
  classId: string;
  date: string;
  homework: string;
}): Promise<JournalLesson> {
  const result = await docClient.send(
    new UpdateCommand({
      TableName: TableName.JOURNAL,
      Key: { classId: input.classId, date: input.date },
      UpdateExpression:
        input.homework === "" ? "remove homework" : "set homework = :homework",
      ExpressionAttributeValues:
        input.homework === "" ? undefined : { ":homework": input.homework },
      ReturnValues: "ALL_NEW",
    })
  );
  return normalizeJournalLesson(result.Attributes);
}

export async function appendHomeworkFiles(input: {
  classId: string;
  date: string;
  files: HomeworkFile[];
}): Promise<JournalLesson | null> {
  const lesson = await getJournalLesson(input.classId, input.date);
  if (!lesson) return null;

  const homeworkFiles = [...(lesson.homeworkFiles ?? []), ...input.files];
  const result = await docClient.send(
    new UpdateCommand({
      TableName: TableName.JOURNAL,
      Key: { classId: input.classId, date: input.date },
      UpdateExpression: "set homeworkFiles = :files",
      ExpressionAttributeValues: { ":files": homeworkFiles },
      ReturnValues: "ALL_NEW",
    })
  );
  return normalizeJournalLesson(result.Attributes);
}

export async function removeHomeworkFile(input: {
  classId: string;
  date: string;
  fileId: string;
}): Promise<JournalLesson | null> {
  const lesson = await getJournalLesson(input.classId, input.date);
  if (!lesson) return null;

  const homeworkFiles = (lesson.homeworkFiles ?? []).filter(
    (file) => file.id !== input.fileId
  );
  const result = await docClient.send(
    new UpdateCommand({
      TableName: TableName.JOURNAL,
      Key: { classId: input.classId, date: input.date },
      UpdateExpression:
        homeworkFiles.length > 0
          ? "set homeworkFiles = :files"
          : "remove homeworkFiles",
      ExpressionAttributeValues:
        homeworkFiles.length > 0 ? { ":files": homeworkFiles } : undefined,
      ReturnValues: "ALL_NEW",
    })
  );
  return normalizeJournalLesson(result.Attributes);
}

export interface Service {
  id: string;
  name: string;
  description?: string;
  status: "active" | "inactive" | "deploying";
  url?: string;
  createdAt: string;
  updatedAt: string;
}

export async function getServiceById(id: string): Promise<Service | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TableName.SERVICES,
      Key: { id },
    })
  );
  return (result.Item as Service) ?? null;
}

export async function getServicesByStatus(status: string): Promise<Service[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TableName.SERVICES,
      IndexName: IndexName.SERVICES_STATUS,
      KeyConditionExpression: "#status = :status",
      ExpressionAttributeNames: {
        "#status": "status",
      },
      ExpressionAttributeValues: {
        ":status": status,
      },
    })
  );
  return (result.Items as Service[]) ?? [];
}

export async function getAllServices(): Promise<Service[]> {
  const result = await docClient.send(
    new ScanCommand({
      TableName: TableName.SERVICES,
    })
  );
  return (result.Items as Service[]) ?? [];
}

export async function createService(
  data: Omit<Service, "createdAt" | "updatedAt">
): Promise<Service> {
  const now = new Date().toISOString();
  const service: Service = {
    ...data,
    createdAt: now,
    updatedAt: now,
  };

  await docClient.send(
    new PutCommand({
      TableName: TableName.SERVICES,
      Item: service,
    })
  );

  return service;
}

export async function updateService(
  id: string,
  data: Partial<Pick<Service, "name" | "description" | "status" | "url">>
): Promise<Service> {
  const updateExpr = [];
  const exprValues: Record<string, unknown> = {};
  const exprNames: Record<string, string> = {};

  if (data.name !== undefined) {
    updateExpr.push("#name = :name");
    exprValues[":name"] = data.name;
    exprNames["#name"] = "name";
  }

  if (data.description !== undefined) {
    updateExpr.push("#description = :description");
    exprValues[":description"] = data.description;
    exprNames["#description"] = "description";
  }

  if (data.status !== undefined) {
    updateExpr.push("#status = :status");
    exprValues[":status"] = data.status;
    exprNames["#status"] = "status";
  }

  if (data.url !== undefined) {
    updateExpr.push("#url = :url");
    exprValues[":url"] = data.url;
    exprNames["#url"] = "url";
  }

  updateExpr.push("updatedAt = :updatedAt");
  exprValues[":updatedAt"] = new Date().toISOString();

  const result = await docClient.send(
    new UpdateCommand({
      TableName: TableName.SERVICES,
      Key: { id },
      UpdateExpression: `set ${updateExpr.join(", ")}`,
      ExpressionAttributeValues: exprValues,
      ExpressionAttributeNames:
        Object.keys(exprNames).length > 0 ? exprNames : undefined,
      ReturnValues: "ALL_NEW",
    })
  );

  return result.Attributes as Service;
}

export async function deleteService(id: string): Promise<void> {
  await docClient.send(
    new DeleteCommand({
      TableName: TableName.SERVICES,
      Key: { id },
    })
  );
}
