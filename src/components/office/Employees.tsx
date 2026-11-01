"use client";

import { useEmployeeStore } from "@/store/employees";
import { Avatar } from "./Avatar";

export function Employees() {
  const employees = useEmployeeStore((s) => s.employees);
  return (
    <group>
      {employees.map((e) => (
        <Avatar key={e.id} employee={e} />
      ))}
    </group>
  );
}
