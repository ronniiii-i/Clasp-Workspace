"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { InventoryItem } from "../types";

// interface InventoryItem {
//   id: string;
//   name: string;
//   type: "hardware" | "software";
//   status: "active" | "maintenance" | "retired";
//   assignedTo?: string;
// }

export function TechnologyInventory({ items }: { items: InventoryItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Technology Inventory</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Assigned</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.name}</TableCell>
                <TableCell>{item.type}</TableCell>
                <TableCell>
                  <span
                    className={`px-2 py-1 rounded-full text-xs ${
                      item.status === "active"
                        ? "bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-300"
                        : item.status === "maintenance"
                        ? "bg-yellow-100 dark:bg-yellow-950 text-yellow-800 dark:text-yellow-300"
                        : "bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300"
                    }`}
                  >
                    {item.status}
                  </span>
                </TableCell>
                <TableCell>{item.assignedTo || "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
