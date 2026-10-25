import { prisma } from "@/lib/prisma/client";

export const calendarRepository = {
  async listByWorkspace(workspaceId: string) {
    return prisma.calendar.findMany({ where: { workspaceId,deletedAt:null }, orderBy: { createdAt: "asc" } });
  },
  async create(workspaceId: string, input: { name: string; color: string }) {
    return prisma.calendar.create({ data: { workspaceId, name: input.name, color: input.color } });
  },
  async update(id: string, input: Partial<{ name: string; color: string; isArchived: boolean }>) {
    return prisma.calendar.update({ where: { id }, data: { name: input.name, color: input.color, isArchived: input.isArchived } });
  },
};
