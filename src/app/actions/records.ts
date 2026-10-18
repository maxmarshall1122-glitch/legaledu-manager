"use server";

import type { AssignmentStatus } from "@/lib/types";
import type { AssignmentInput, GroupInput, StudentInput, SubjectInput } from "@/lib/validation";
import * as assignments from "@/lib/services/assignments";
import * as groups from "@/lib/services/groups";
import * as students from "@/lib/services/students";
import * as subjects from "@/lib/services/subjects";
import { act } from "./_act";

// Students
export async function createStudentAction(input: StudentInput) {
  return act(async (ctx) => (await students.createStudent(ctx, input)).id, { message: "students.created" });
}
export async function updateStudentAction(id: string, input: StudentInput) {
  return act(async (ctx) => (await students.updateStudent(ctx, id, input)).id, { message: "students.updated" });
}
export async function deleteStudentAction(id: string) {
  return act((ctx) => students.deleteStudent(ctx, id), { message: "common.deleted" });
}

// Groups
export async function createGroupAction(input: GroupInput) {
  return act(async (ctx) => (await groups.createGroup(ctx, input)).id, { message: "common.saved" });
}
export async function updateGroupAction(id: string, input: GroupInput) {
  return act(async (ctx) => (await groups.updateGroup(ctx, id, input)).id, { message: "common.saved" });
}
export async function deleteGroupAction(id: string) {
  return act((ctx) => groups.deleteGroup(ctx, id), { message: "common.deleted" });
}
export async function addGroupMemberAction(groupId: string, studentId: string) {
  return act((ctx) => groups.addGroupMember(ctx, groupId, studentId), { message: "common.saved" });
}
export async function removeGroupMemberAction(groupId: string, studentId: string) {
  return act((ctx) => groups.removeGroupMember(ctx, groupId, studentId), { message: "common.saved" });
}

// Subjects
export async function createSubjectAction(input: SubjectInput) {
  return act(async (ctx) => (await subjects.createSubject(ctx, input)).id, { message: "common.saved" });
}
export async function updateSubjectAction(id: string, input: SubjectInput) {
  return act(async (ctx) => (await subjects.updateSubject(ctx, id, input)).id, { message: "common.saved" });
}
export async function deleteSubjectAction(id: string) {
  return act((ctx) => subjects.deleteSubject(ctx, id), { message: "common.deleted" });
}

// Assignments
export async function createAssignmentAction(input: AssignmentInput, status: "draft" | "published") {
  return act(async (ctx) => (await assignments.createAssignment(ctx, input, status)).id, {
    message: status === "published" ? "assignments.published" : "common.saved",
  });
}
export async function updateAssignmentAction(id: string, input: AssignmentInput) {
  return act(async (ctx) => (await assignments.updateAssignment(ctx, id, input)).id, { message: "common.saved" });
}
export async function setAssignmentStatusAction(id: string, status: AssignmentStatus) {
  return act(async (ctx) => (await assignments.setAssignmentStatus(ctx, id, status)).id, {
    message: status === "published" ? "assignments.published" : "common.saved",
  });
}
export async function deleteAssignmentAction(id: string) {
  return act((ctx) => assignments.deleteAssignment(ctx, id), { message: "common.deleted" });
}
