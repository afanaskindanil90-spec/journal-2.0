import { NextRequest, NextResponse } from "next/server";
import { isDatabaseAvailable } from "@/lib/db";
import { removeStudent, updateStudent } from "@/lib/models";
import { studentUpdateSchema } from "@/lib/validation/classes";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ classId: string; studentId: string }> }
) {
  if (!(await isDatabaseAvailable())) {
    return NextResponse.json(
      { error: "База данных недоступна в статическом режиме" },
      { status: 503 }
    );
  }

  const { classId, studentId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }

  const parsed = studentUpdateSchema.safeParse(body);
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    return NextResponse.json(
      {
        error: "Некорректные данные",
        details: parsed.success ? undefined : parsed.error.flatten(),
      },
      { status: 400 }
    );
  }

  try {
    const schoolClass = await updateStudent(classId, studentId, parsed.data);
    if (!schoolClass) {
      return NextResponse.json({ error: "Класс не найден" }, { status: 404 });
    }
    return NextResponse.json(schoolClass);
  } catch (error) {
    console.error("Failed to update student:", error);
    return NextResponse.json(
      { error: "Не удалось изменить ученика" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ classId: string; studentId: string }> }
) {
  if (!(await isDatabaseAvailable())) {
    return NextResponse.json(
      { error: "База данных недоступна в статическом режиме" },
      { status: 503 }
    );
  }

  const { classId, studentId } = await params;

  try {
    const schoolClass = await removeStudent(classId, studentId);
    if (!schoolClass) {
      return NextResponse.json({ error: "Класс не найден" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to remove student:", error);
    return NextResponse.json(
      { error: "Не удалось удалить ученика" },
      { status: 500 }
    );
  }
}
