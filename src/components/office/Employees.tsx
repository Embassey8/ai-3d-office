"use client";

import { SEED_EMPLOYEES } from "@/lib/employees/seed";
import { Avatar } from "./Avatar";

export function Employees() {
  return (
    <group>
      {SEED_EMPLOYEES.map((e) => (
        <Avatar key={e.id} employee={e} />
      ))}
    </group>
  );
}
