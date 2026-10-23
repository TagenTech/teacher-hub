'use client';

import { displayName, type StudentDetailDto } from '@aulinha/contracts';
import { Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Sheet } from '@/components/ui/sheet';
import { ApiError } from '@/lib/api/client';
import { useDeleteStudent } from '@/lib/queries/students';
import { haptic } from '@/lib/utils';

export function DeleteStudentSheet({
  student,
  open,
  onOpenChange,
  onArchive,
}: {
  student: StudentDetailDto;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onArchive: () => void;
}) {
  const router = useRouter();
  const remove = useDeleteStudent(student.id);
  const name = displayName(student);

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={`Excluir ${name} para sempre?`}
      description="Apaga a ficha, os planos e todo o histórico. Não dá para desfazer."
    >
      <div className="space-y-3">
        <div className="rounded-2xl bg-primary-soft p-4 text-sm text-primary-soft-foreground">
          💡 Parou de ter aulas? <strong>Arquivar</strong> esconde o aluno da lista e guarda o histórico.
        </div>
        <Button
          variant="soft"
          size="lg"
          block
          onClick={() => {
            onOpenChange(false);
            onArchive();
          }}
        >
          Arquivar em vez disso
        </Button>
        <Button
          variant="danger"
          size="lg"
          block
          loading={remove.isPending}
          onClick={async () => {
            try {
              await remove.mutateAsync();
              haptic([20, 50, 20]);
              toast.success(`${name} foi excluído`);
              router.replace('/alunos');
            } catch (err) {
              toast.error(err instanceof ApiError ? err.message : 'Não foi possível excluir');
            }
          }}
        >
          <Trash2 /> Excluir definitivamente
        </Button>
      </div>
    </Sheet>
  );
}
