'use client';

import type {
  ChangeStudentStatusRequest,
  CreateBillingPlanRequest,
  CreateStudentRequest,
  StudentDetailDto,
  UpdateStudentRequest,
} from '@turmei/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { studentsApi } from '@/lib/api/students';

export const studentKeys = {
  all: ['students'] as const,
  list: () => [...studentKeys.all, 'list'] as const,
  detail: (id: string) => [...studentKeys.all, 'detail', id] as const,
};

/** Lista completa (um professor tem dezenas de alunos): busca e filtros rodam no aparelho, instantâneos. */
export function useStudents() {
  return useQuery({ queryKey: studentKeys.list(), queryFn: studentsApi.list });
}

export function useStudent(id: string) {
  return useQuery({ queryKey: studentKeys.detail(id), queryFn: () => studentsApi.get(id), enabled: !!id });
}

/** Toda mutação devolve o detalhe atualizado: grava no cache e invalida a lista. */
function useStudentMutation<V>(fn: (vars: V) => Promise<StudentDetailDto>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (student) => {
      qc.setQueryData(studentKeys.detail(student.id), student);
      qc.invalidateQueries({ queryKey: studentKeys.list() });
    },
  });
}

export const useCreateStudent = () =>
  useStudentMutation((body: CreateStudentRequest) => studentsApi.create(body));

export const useUpdateStudent = (id: string) =>
  useStudentMutation((body: UpdateStudentRequest) => studentsApi.update(id, body));

export const useChangeStudentStatus = (id: string) =>
  useStudentMutation((body: ChangeStudentStatusRequest) => studentsApi.changeStatus(id, body));

export const useAddPlan = (id: string) =>
  useStudentMutation((body: CreateBillingPlanRequest) => studentsApi.addPlan(id, body));

export const useRemovePlan = (id: string) =>
  useStudentMutation((planId: string) => studentsApi.removePlan(id, planId));

export function useDeleteStudent(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => studentsApi.remove(id),
    onSuccess: () => {
      qc.removeQueries({ queryKey: studentKeys.detail(id) });
      qc.invalidateQueries({ queryKey: studentKeys.list() });
    },
  });
}
