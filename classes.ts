import { z } from "zod";

export const classNameSchema = z.object({
  name: z.string().trim().min(1, "Введите название класса").max(10),
  isMyClass: z.boolean().optional().default(false),
});

export type ClassInput = z.infer<typeof classNameSchema>;

export const studentSchema = z.object({
  lastName: z.string().trim().min(1, "Введите фамилию").max(100),
  firstName: z.string().trim().min(1, "Введите имя").max(100),
});

export type StudentInput = z.infer<typeof studentSchema>;

export const studentUpdateSchema = studentSchema.partial();

export type StudentUpdateInput = z.infer<typeof studentUpdateSchema>;
