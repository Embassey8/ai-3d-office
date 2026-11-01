import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SEED_EMPLOYEES } from "@/lib/employees/seed";
import { canDo, EmployeeConfigSchema, isEditable, NewTaskSchema } from "./schemas";
import { mapEmployee, mapTask, mergeEmployeeRow, type EmployeeRow, type TaskRow } from "./mappers";

const row: EmployeeRow = {
  id: "11111111-1111-1111-1111-111111111111",
  slug: "seo",
  name: "Noah",
  title: "SEO Specialist",
  personality: "p",
  system_instructions: "i",
  model_provider: "anthropic",
  model_name: "claude-sonnet-5-5",
  workstation_id: "mkt-seo",
  stand_side: 1,
  appearance: { shirt: "#fff" },
  status: "idle",
  current_task_id: null,
  departments: { name: "Marketing" },
};

describe("mappers", () => {
  it("maps an employee row and fills missing appearance fields", () => {
    const e = mapEmployee(row, ["web_search"]);
    expect(e.department).toBe("Marketing");
    expect(e.tools).toEqual(["web_search"]);
    expect(e.appearance.shirt).toBe("#fff");
    expect(e.appearance.skin).toBeTruthy();
  });

  it("merges a partial realtime update without losing joined fields", () => {
    const e = mapEmployee(row, ["web_search"]);
    const next = mergeEmployeeRow(e, { name: "Noah L.", current_task_id: "t1" });
    expect(next.name).toBe("Noah L.");
    expect(next.currentTaskId).toBe("t1");
    expect(next.tools).toEqual(["web_search"]);
    expect(next.department).toBe("Marketing");
  });

  it("maps task rows", () => {
    const t = mapTask({
      id: "t", employee_id: "e", title: "x", description: "", priority: "high", status: "queued",
      deadline: null, result: null, error: null, attempts: 0, created_at: "a", updated_at: "b",
    } satisfies TaskRow);
    expect(t.employeeId).toBe("e");
    expect(t.priority).toBe("high");
  });
});

describe("validation", () => {
  const id = "3f2b8c1e-5a4d-4e8b-9c3a-1d2e3f4a5b6c";
  it("accepts a valid task and normalises an empty deadline", () => {
    const r = NewTaskSchema.parse({ employeeId: id, title: "  Audit  ", deadline: "" });
    expect(r.title).toBe("Audit");
    expect(r.deadline).toBeNull();
    expect(r.priority).toBe("normal");
  });
  it("rejects empty titles, bad ids and bad dates", () => {
    expect(NewTaskSchema.safeParse({ employeeId: id, title: " " }).success).toBe(false);
    expect(NewTaskSchema.safeParse({ employeeId: "nope", title: "x" }).success).toBe(false);
    expect(NewTaskSchema.safeParse({ employeeId: id, title: "x", deadline: "not a date" }).success).toBe(false);
  });
  it("mirrors the database's allowed CEO task actions", () => {
    expect(canDo("pause", "queued")).toBe(true);
    expect(canDo("pause", "completed")).toBe(false);
    expect(canDo("resume", "paused")).toBe(true);
    expect(canDo("resume", "running")).toBe(false);
    expect(canDo("cancel", "waiting_for_approval")).toBe(true);
    expect(canDo("cancel", "failed")).toBe(false);
    expect(isEditable("running")).toBe(false);
  });
  it("validates employee configuration", () => {
    expect(EmployeeConfigSchema.safeParse({ personality: "", systemInstructions: "", modelName: "m" }).success).toBe(false);
  });
});

describe("seed data stays in sync with the SQL seed", () => {
  const sql = readFileSync("supabase/migrations/20261101000007_design_roster.sql", "utf8");
  it("every demo employee appears in the SQL seed with the same slug, name, title and model", () => {
    for (const e of SEED_EMPLOYEES) {
      expect(sql, e.slug).toContain(`('${e.slug}'`);
      expect(sql, e.name).toContain(`'${e.name}'`);
      expect(sql, e.title).toContain(`'${e.title}'`);
      expect(sql, `${e.slug} model`).toContain(`'${e.model.name}'`);
      expect(sql, `${e.slug} avatar`).toContain(e.appearance.avatar ?? "missing");
    }
  });
  it("every demo tool assignment exists in the SQL employee_tools seed", () => {
    for (const e of SEED_EMPLOYEES) {
      for (const t of e.tools) expect(sql, `${e.slug}/${t}`).toContain(`('${e.slug}', '${t}')`);
    }
  });
});
