import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getWorkspaceAccess } from "@/lib/workspace-access";
import {
  isTaskStatus,
  normalizeStatus,
  setTaskStatus,
  taskCounts,
  type TaskGroup,
} from "@/lib/task-status";

interface SessionUser {
  id: string;
}

/**
 * PATCH /api/workspace/tasks-status
 *
 * Pindahkan satu task antar kolom board (todo → doing → done | failed).
 * Body: { id: workspaceId, taskId, status }
 *
 * Model: field `status` per task item di dalam `tasksJson`. Task lama tanpa
 * field `status` tetap valid — dibaca sebagai "todo".
 */
export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as SessionUser;
  const { id, taskId, status } = await req.json().catch(() => ({}));

  if (!id) {
    return Response.json({ error: "Missing workspace id" }, { status: 400 });
  }
  if (!taskId) {
    return Response.json({ error: "Missing task id" }, { status: 400 });
  }
  if (!isTaskStatus(status)) {
    return Response.json(
      { error: "Invalid status. Gunakan: todo, doing, done, failed." },
      { status: 400 }
    );
  }

  const access = await getWorkspaceAccess(id, user.id);
  if (!access.canView) {
    return Response.json({ error: "Workspace not found" }, { status: 404 });
  }
  if (!access.canEdit) {
    return Response.json(
      { error: "Anda hanya punya akses lihat pada workspace ini." },
      { status: 403 }
    );
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id },
    select: { tasksJson: true },
  });
  if (!workspace) {
    return Response.json({ error: "Workspace not found" }, { status: 404 });
  }

  const current = (workspace.tasksJson ?? []) as unknown as TaskGroup[];
  const { groups, changed } = setTaskStatus(current, taskId, status);

  if (!changed) {
    // Task tidak ditemukan ATAU status sudah sama — laporkan tanpa menulis DB.
    const sameId = JSON.stringify(current).includes(taskId);
    if (!sameId) {
      return Response.json({ error: "Task not found" }, { status: 404 });
    }
    return Response.json({
      success: true,
      unchanged: true,
      status: normalizeStatus(status),
      counts: taskCounts(current),
    });
  }

  await prisma.workspace.update({
    where: { id },
    data: { tasksJson: groups },
  });

  return Response.json({
    success: true,
    status,
    counts: taskCounts(groups),
  });
}

/**
 * GET /api/workspace/tasks-status?id=<workspaceId>
 *
 * Kembalikan pengelompokan task per status. Dipakai board kanban agar
 * tidak perlu memparsing tasksJson mentah di klien.
 */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as SessionUser;
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return Response.json({ error: "Missing workspace id" }, { status: 400 });
  }

  const access = await getWorkspaceAccess(id, user.id);
  if (!access.canView) {
    return Response.json({ error: "Workspace not found" }, { status: 404 });
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id },
    select: { tasksJson: true },
  });
  if (!workspace) {
    return Response.json({ error: "Workspace not found" }, { status: 404 });
  }

  const groups = (workspace.tasksJson ?? []) as unknown as TaskGroup[];
  const byStatus: Record<string, TaskGroup[]> = {
    todo: [],
    doing: [],
    done: [],
    failed: [],
  };

  for (const group of Array.isArray(groups) ? groups : []) {
    const buckets: Record<string, TaskGroup["tasks"]> = {
      todo: [],
      doing: [],
      done: [],
      failed: [],
    };
    for (const task of Array.isArray(group.tasks) ? group.tasks : []) {
      buckets[normalizeStatus(task.status)].push(task);
    }
    for (const [status, tasks] of Object.entries(buckets)) {
      if (tasks.length > 0) byStatus[status].push({ phase: group.phase, tasks });
    }
  }

  return Response.json({ counts: taskCounts(groups), byStatus });
}
