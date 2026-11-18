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
import { AuditLog } from "../types";

interface AuditLogProps {
  logs: AuditLog[];
}

export function AuditTrails({ logs }: AuditLogProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit Trails</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Action</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell>{log.action}</TableCell>
                <TableCell>{log.initiator}</TableCell>
                <TableCell>{log.timestamp.toLocaleString()}</TableCell>
                <TableCell>
                  <span
                    className={`px-2 py-1 rounded-full text-xs ${
                      log.status === "success"
                        ? "bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-300"
                        : "bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300"
                    }`}
                  >
                    {log.status}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
