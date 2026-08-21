import { and, asc, desc, eq, gte, lt, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { getDb } from "../../db";
import { employees, employeeSalaryPayments, invoiceDocuments } from "../../db/schema";
import { recordActivityLog, requireSuperadmin } from "../auth";

function asString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function requiredString(formData: FormData, key: string) {
  const value = asString(formData.get(key));

  if (!value) {
    throw new Error(`${key} wajib diisi.`);
  }

  return value;
}

function parseAmount(formData: FormData, key: string) {
  const raw = asString(formData.get(key)).replace(/[^\d]/g, "");
  const amount = raw ? Number(raw) : 0;

  if (!Number.isInteger(amount) || amount < 0) {
    throw new Error(`${key} harus berupa angka valid.`);
  }

  return amount;
}

function parseId(formData: FormData) {
  return requiredString(formData, "id");
}

function employeeValuesFromForm(formData: FormData) {
  return {
    accountNumber: requiredString(formData, "accountNumber"),
    jobdesk: requiredString(formData, "jobdesk"),
    name: requiredString(formData, "name"),
    salary: parseAmount(formData, "salary"),
    status: asString(formData.get("status")) || "Aktif",
    title: requiredString(formData, "title"),
  };
}

export function getJakartaDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Jakarta",
    year: "numeric",
  }).format(date);
}

export function getCurrentSalaryMonth(date = new Date()) {
  return getJakartaDateKey(date).slice(0, 7);
}

export function getReminderSalaryMonth(date = new Date()) {
  const dateKey = getJakartaDateKey(date);
  const salaryMonth = dateKey.slice(0, 7);
  const dayOfMonth = Number(dateKey.slice(8, 10));

  if (dayOfMonth <= 5) {
    return salaryMonth;
  }

  const [year, month] = salaryMonth.split("-").map(Number);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;

  return `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
}

export function getSalaryDueDate(salaryMonth = getCurrentSalaryMonth()) {
  return `${salaryMonth}-05`;
}

export function isSalaryDue(salaryMonth = getCurrentSalaryMonth(), dateKey = getJakartaDateKey()) {
  return dateKey >= getSalaryDueDate(salaryMonth);
}

function previousMonthRange(salaryMonth: string) {
  const [year, month] = salaryMonth.split("-").map(Number);
  const previousMonth = month === 1 ? 12 : month - 1;
  const previousYear = month === 1 ? year - 1 : year;
  const nextMonth = previousMonth === 12 ? 1 : previousMonth + 1;
  const nextYear = previousMonth === 12 ? previousYear + 1 : previousYear;

  return {
    from: `${previousYear}-${String(previousMonth).padStart(2, "0")}-01`,
    to: `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`,
  };
}

export async function getInvoiceOmsetForSalaryMonth(salaryMonth: string) {
  await requireSuperadmin("/employee/employee-list");
  const db = await getDb();
  const range = previousMonthRange(salaryMonth);
  const rows = await db
    .select({
      totalAmount: invoiceDocuments.totalAmount,
    })
    .from(invoiceDocuments)
    .where(
      and(
        gte(invoiceDocuments.invoiceDate, range.from),
        lt(invoiceDocuments.invoiceDate, range.to),
        ne(invoiceDocuments.status, "cancelled")
      )
    );

  return rows.reduce((sum, row) => sum + row.totalAmount, 0);
}

export async function getBonusOmsetForSalaryMonth(salaryMonth: string) {
  const omset = await getInvoiceOmsetForSalaryMonth(salaryMonth);

  return {
    bonusOmset: Math.round((omset * 0.01) / 4),
    omset,
  };
}

export async function listEmployees() {
  await requireSuperadmin("/employee/employee-list");
  const db = await getDb();

  return db
    .select({
      accountNumber: employees.accountNumber,
      createdAt: employees.createdAt,
      id: employees.id,
      jobdesk: employees.jobdesk,
      name: employees.name,
      salary: employees.salary,
      status: employees.status,
      title: employees.title,
    })
    .from(employees)
    .orderBy(asc(employees.name), asc(employees.createdAt));
}

export async function getEmployee(id: string) {
  await requireSuperadmin(`/employee/edit-employee/${id}`);
  const db = await getDb();
  const [employee] = await db
    .select({
      accountNumber: employees.accountNumber,
      id: employees.id,
      jobdesk: employees.jobdesk,
      name: employees.name,
      salary: employees.salary,
      status: employees.status,
      title: employees.title,
    })
    .from(employees)
    .where(eq(employees.id, id))
    .limit(1);

  if (!employee) {
    notFound();
  }

  return employee;
}

export async function listSalaryPayments(salaryMonth?: string) {
  await requireSuperadmin("/employee/employee-list");
  const db = await getDb();
  const rows = await db
    .select({
      additionalBonus: employeeSalaryPayments.additionalBonus,
      baseSalary: employeeSalaryPayments.baseSalary,
      commissionAmount: employeeSalaryPayments.commissionAmount,
      deduction: employeeSalaryPayments.deduction,
      employeeId: employeeSalaryPayments.employeeId,
      employeeName: employees.name,
      id: employeeSalaryPayments.id,
      notes: employeeSalaryPayments.notes,
      paymentDate: employeeSalaryPayments.paymentDate,
      salaryMonth: employeeSalaryPayments.salaryMonth,
      salesAmount: employeeSalaryPayments.salesAmount,
      totalPaid: employeeSalaryPayments.totalPaid,
    })
    .from(employeeSalaryPayments)
    .leftJoin(employees, eq(employeeSalaryPayments.employeeId, employees.id))
    .orderBy(
      desc(employeeSalaryPayments.salaryMonth),
      desc(employeeSalaryPayments.paymentDate)
    );

  return salaryMonth ? rows.filter((row) => row.salaryMonth === salaryMonth) : rows;
}

export async function listEmployeesWithSalaryStatus(salaryMonth = getCurrentSalaryMonth()) {
  const [employeeRows, paymentRows] = await Promise.all([
    listEmployees(),
    listSalaryPayments(salaryMonth),
  ]);
  const paymentByEmployee = new Map(
    paymentRows.map((payment) => [payment.employeeId, payment])
  );

  return employeeRows.map((employee) => ({
    ...employee,
    salaryPayment: paymentByEmployee.get(employee.id) ?? null,
  }));
}

export async function createEmployeeAction(formData: FormData) {
  "use server";

  const user = await requireSuperadmin("/employee/add-new-employee");
  const db = await getDb();
  const values = employeeValuesFromForm(formData);
  const [inserted] = await db
    .insert(employees)
    .values(values)
    .returning({ id: employees.id });

  await recordActivityLog({
    action: "employee_created",
    actor: user,
    details: { employeeId: inserted.id, name: values.name, title: values.title },
    targetUsername: values.name,
  });

  revalidatePath("/employee");
  revalidatePath("/employee/add-new-employee");
  redirect("/employee/employee-list");
}

export async function updateEmployeeAction(formData: FormData) {
  "use server";

  const user = await requireSuperadmin("/employee/employee-list");
  const db = await getDb();
  const employeeId = parseId(formData);
  const values = employeeValuesFromForm(formData);

  await db
    .update(employees)
    .set({
      ...values,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(employees.id, employeeId));

  await recordActivityLog({
    action: "employee_updated",
    actor: user,
    details: { employeeId, name: values.name, title: values.title },
    targetUsername: values.name,
  });

  revalidatePath("/employee");
  revalidatePath("/employee/employee-list");
  redirect("/employee/employee-list");
}

export async function deleteEmployeeAction(formData: FormData) {
  "use server";

  const user = await requireSuperadmin("/employee/employee-list");
  const db = await getDb();
  const employeeId = parseId(formData);
  const [existing] = await db
    .select({ name: employees.name })
    .from(employees)
    .where(eq(employees.id, employeeId))
    .limit(1);

  await db.delete(employees).where(eq(employees.id, employeeId));

  await recordActivityLog({
    action: "employee_deleted",
    actor: user,
    details: { employeeId, name: existing?.name ?? "" },
    targetUsername: existing?.name ?? "",
  });

  revalidatePath("/employee");
}

export async function createSalaryPaymentAction(formData: FormData) {
  "use server";

  const user = await requireSuperadmin("/employee/employee-list");
  const db = await getDb();
  const employeeId = requiredString(formData, "employeeId");
  const salaryMonth = requiredString(formData, "salaryMonth");
  const paymentDate = requiredString(formData, "paymentDate");
  const baseSalary = parseAmount(formData, "baseSalary");
  const salesAmount = await getInvoiceOmsetForSalaryMonth(salaryMonth);
  const commissionAmount = Math.round((salesAmount * 0.01) / 4);
  const additionalBonus = parseAmount(formData, "additionalBonus");
  const deduction = parseAmount(formData, "deduction");
  const totalPaid = Math.max(
    0,
    baseSalary + commissionAmount + additionalBonus - deduction
  );
  const notes = asString(formData.get("notes"));
  const [employee] = await db
    .select({ name: employees.name })
    .from(employees)
    .where(eq(employees.id, employeeId))
    .limit(1);

  if (!employee) {
    throw new Error("Employee tidak ditemukan.");
  }

  const existing = await db
    .select({ id: employeeSalaryPayments.id })
    .from(employeeSalaryPayments)
    .where(
      and(
        eq(employeeSalaryPayments.employeeId, employeeId),
        eq(employeeSalaryPayments.salaryMonth, salaryMonth)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(employeeSalaryPayments)
      .set({
        additionalBonus,
        baseSalary,
        commissionAmount,
        deduction,
        notes,
        paymentDate,
        salesAmount,
        totalPaid,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(employeeSalaryPayments.id, existing[0].id));
  } else {
    await db.insert(employeeSalaryPayments).values({
      additionalBonus,
      baseSalary,
      commissionAmount,
      deduction,
      employeeId,
      notes,
      paymentDate,
      salaryMonth,
      salesAmount,
      totalPaid,
    });
  }

  await recordActivityLog({
    action: "employee_salary_payment_recorded",
    actor: user,
    details: {
      employeeId,
      name: employee.name,
      salaryMonth,
      totalPaid,
    },
    targetUsername: employee.name,
  });

  revalidatePath("/employee");
  revalidatePath("/employee/employee-list");
}
