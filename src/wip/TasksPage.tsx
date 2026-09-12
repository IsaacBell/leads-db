import { useMemo, useState, type FormEvent } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { GripVertical, Trash2 } from 'lucide-react'
import { useAuth } from "@/src/lib/auth/useAuth"
import { EmptyState } from "@/src/components/wip/app/empty-state"
import { SectionHeader } from "@/src/components/wip/app/section-header"
import { StatusBadge } from "@/src/components/wip/app/status-badge"
import { Button } from "@/src/components/wip/layout/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/wip/layout/ui/card"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/src/components/wip/layout/ui/context-menu"
import { Input } from "@/src/components/wip/layout/ui/input"
import { Textarea } from "@/src/components/wip/layout/ui/textarea"
import { apiRequest } from '../lib/api'
import type { Task } from '../types/entities'

type CreateTaskPayload = {
  title: string
  details?: string | null
}

type UpdateTaskStatusPayload = {
  status: Task['status']
}

const EMPTY_TASKS: Task[] = []
const TASK_BOARD_STATUSES = ['todo', 'in_progress', 'done'] as const
type TaskBoardStatus = (typeof TASK_BOARD_STATUSES)[number]

const TASK_STATUS_LABEL: Record<Task['status'], string> = {
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done',
  canceled: 'Canceled',
}

function isTaskBoardStatus(value: string): value is TaskBoardStatus {
  return TASK_BOARD_STATUSES.includes(value as TaskBoardStatus)
}

function TaskBoardColumn({
  status,
  tasks,
  onUpdateStatus,
}: {
  status: TaskBoardStatus
  tasks: Task[]
  onUpdateStatus: (task: Task, nextStatus: Task['status']) => void
}) {
  const { isOver, setNodeRef } = useDroppable({ id: status })

  return (
    <section
      ref={setNodeRef}
      data-testid={`task-column-${status}`}
      className={`rounded-2xl border bg-white p-3 transition-colors ${
        isOver ? 'border-emerald-300 bg-emerald-50/40' : 'border-neutral-200'
      }`}
    >
      <header className="mb-3 flex items-center justify-between gap-2 px-1">
        <p className="text-sm font-medium text-neutral-900">{TASK_STATUS_LABEL[status]}</p>
        <StatusBadge value={status} />
      </header>

      <div className="space-y-2">
        {tasks.length === 0 ? (
          <p className="rounded-xl border border-dashed border-neutral-200 px-3 py-4 text-xs text-neutral-500">
            Drop task here
          </p>
        ) : (
          tasks.map((task) => <TaskBoardCard key={task.id} task={task} onUpdateStatus={onUpdateStatus} />)
        )}
      </div>
    </section>
  )
}

function TaskDropZone({
  id,
  title,
  description,
}: {
  id: string
  title: string
  description: string
}) {
  const { isOver, setNodeRef } = useDroppable({ id })

  return (
    <section
      ref={setNodeRef}
      data-testid={`task-drop-zone-${id}`}
      className={`flex items-center justify-between rounded-2xl border px-4 py-3 transition-colors ${
        isOver ? 'border-rose-300 bg-rose-50/60' : 'border-neutral-200 bg-white'
      }`}
    >
      <div>
        <p className="text-sm font-medium text-neutral-900">{title}</p>
        <p className="text-xs text-neutral-600">{description}</p>
      </div>
      <Trash2 className={`h-4 w-4 ${isOver ? 'text-rose-600' : 'text-neutral-400'}`} />
    </section>
  )
}

function TaskBoardCard({
  task,
  onUpdateStatus,
}: {
  task: Task
  onUpdateStatus: (task: Task, nextStatus: Task['status']) => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
  })

  const style = {
    transform: CSS.Translate.toString(transform),
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <article
          ref={setNodeRef}
          style={style}
          data-testid={`task-card-${task.id}`}
          className={`rounded-xl border border-neutral-200 bg-white p-3 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-neutral-300 ${
            isDragging ? 'z-10 opacity-70' : ''
          }`}
        >
          <div className="mb-2 flex items-start justify-between gap-2">
            <p className="text-sm font-medium text-neutral-900">{task.title}</p>
            <button
              type="button"
              className="rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
              aria-label={`Drag task ${task.title}`}
              {...listeners}
              {...attributes}
            >
              <GripVertical className="h-4 w-4" />
            </button>
          </div>
          {task.details ? <p className="text-xs text-neutral-600">{task.details}</p> : null}
          <div className="mt-3 flex justify-between gap-2">
            <StatusBadge value={task.status} />
            <p className="text-xs text-neutral-500">Right-click for quick actions</p>
          </div>
        </article>
      </ContextMenuTrigger>

      <ContextMenuContent>
        <ContextMenuLabel>Task actions</ContextMenuLabel>
        <ContextMenuSeparator />
        <ContextMenuItem disabled={task.status === 'todo'} onSelect={() => onUpdateStatus(task, 'todo')}>
          Mark to do
        </ContextMenuItem>
        <ContextMenuItem
          disabled={task.status === 'in_progress'}
          onSelect={() => onUpdateStatus(task, 'in_progress')}
        >
          Mark in progress
        </ContextMenuItem>
        <ContextMenuItem disabled={task.status === 'done'} onSelect={() => onUpdateStatus(task, 'done')}>
          Mark done
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          variant="destructive"
          disabled={task.status === 'canceled'}
          onSelect={() => onUpdateStatus(task, 'canceled')}
        >
          Cancel task
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

export function TasksPage() {
  const { token } = useAuth()
  const queryClient = useQueryClient()

  const [title, setTitle] = useState('')
  const [details, setDetails] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor),
  )

  const tasksQuery = useQuery({
    queryKey: ['tasks', token],
    queryFn: () => apiRequest<Task[]>('/api/tasks', { token }),
    enabled: Boolean(token),
  })

  const createTaskMutation = useMutation({
    mutationFn: (payload: CreateTaskPayload) =>
      apiRequest<Task>('/api/tasks', {
        method: 'POST',
        token,
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['tasks'] })
      setTitle('')
      setDetails('')
      setError(null)
    },
    onError: (mutationError: Error) => {
      setError(mutationError.message)
    },
  })

  const updateTaskStatusMutation = useMutation({
    mutationFn: ({ taskId, payload }: { taskId: string, payload: UpdateTaskStatusPayload }) =>
      apiRequest<Task>(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        token,
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
    onError: (mutationError: Error) => {
      setError(mutationError.message)
    },
  })

  const tasks = tasksQuery.data ?? EMPTY_TASKS
  const tasksByBoardStatus = useMemo(() => {
    const grouped = Object.fromEntries(TASK_BOARD_STATUSES.map((status) => [status, [] as Task[]])) as Record<
      TaskBoardStatus,
      Task[]
    >

    for (const task of tasks) {
      if (task.status === 'canceled') {
        continue
      }
      const normalizedStatus = isTaskBoardStatus(task.status) ? task.status : 'todo'
      grouped[normalizedStatus].push(task)
    }

    return grouped
  }, [tasks])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    const normalizedTitle = title.trim()
    if (!normalizedTitle) {
      setError('Task title is required.')
      return
    }
    if (!token) {
      setError('You are not signed in. Sign in again and retry.')
      return
    }

    await createTaskMutation.mutateAsync({
      title: normalizedTitle,
      details: details.trim() || null,
    })
  }

  function updateTaskStatus(taskId: string, status: Task['status']) {
    updateTaskStatusMutation.mutate({
      taskId,
      payload: { status },
    })
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveTaskId(String(event.active.id))
  }

  function handleDragEnd(event: DragEndEvent) {
    const taskId = String(event.active.id)
    const nextStatus = event.over?.id
    setActiveTaskId(null)

    if (!nextStatus || typeof nextStatus !== 'string') {
      return
    }

    const task = tasks.find((entry) => entry.id === taskId)
    if (!task) {
      return
    }

    if (nextStatus === 'canceled') {
      if (task.status !== 'canceled') {
        updateTaskStatus(task.id, 'canceled')
      }
      return
    }

    if (!isTaskBoardStatus(nextStatus) || task.status === nextStatus) {
      return
    }

    updateTaskStatus(task.id, nextStatus)
  }

  const openTasks = tasks.filter((task) => task.status !== 'done' && task.status !== 'canceled')

  return (
    <section className="space-y-6">
      <SectionHeader
        eyebrow="Tasks"
        title="Task queue"
        description="Track follow-ups, assign owners, and run approved agent tasks."
      />
      <Card>
        <CardHeader>
          <CardTitle>Task board</CardTitle>
          <CardDescription>Drag tasks between lanes, or right-click a card for quick updates.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {tasks.length > 0 ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <div data-testid="task-status-board" className="grid gap-3 md:grid-cols-3">
                {TASK_BOARD_STATUSES.map((status) => (
                  <TaskBoardColumn
                    key={status}
                    status={status}
                    tasks={tasksByBoardStatus[status]}
                    onUpdateStatus={(task, nextStatus) => updateTaskStatus(task.id, nextStatus)}
                  />
                ))}
              </div>
              <TaskDropZone
                id="canceled"
                title="Drop here to cancel"
                description="Use this when a task no longer needs to be done."
              />
            </DndContext>
          ) : (
            <EmptyState title="No tasks yet" description="Create your first task below to start the board." />
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500">
            <p>Canceled tasks stay in the detailed list below.</p>
            {updateTaskStatusMutation.isPending ? <p>Updating task status...</p> : null}
            {activeTaskId ? <p>Dragging {activeTaskId}</p> : null}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Manual tasks</CardTitle>
          <CardDescription>Create and complete everyday follow-ups from one queue.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="space-y-3" onSubmit={handleSubmit}>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Task title"
              required
            />
            <Textarea
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              placeholder="Optional notes"
            />
            {error ? <p className="text-sm text-red-700">{error}</p> : null}
            <Button type="submit" disabled={createTaskMutation.isPending}>
              {createTaskMutation.isPending ? 'Saving task...' : 'Create task'}
            </Button>
          </form>

          {tasks.length > 0 ? (
            <ul className="space-y-3">
              {tasks.map((task) => (
                <li key={task.id} className="rounded-xl border border-[var(--border-default)] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-neutral-900">{task.title}</p>
                    <StatusBadge value={task.status} />
                  </div>
                  {task.details ? <p className="mt-2 text-sm text-neutral-700">{task.details}</p> : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={task.status === 'in_progress' || updateTaskStatusMutation.isPending}
                      onClick={() => updateTaskStatus(task.id, 'in_progress')}
                    >
                      Mark in progress
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={task.status === 'done' || updateTaskStatusMutation.isPending}
                      onClick={() => updateTaskStatus(task.id, 'done')}
                    >
                      Mark done
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              title="No task data yet"
              description="Create your first task above to track follow-ups."
            />
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Agent tasks</CardTitle>
          <CardDescription>
            Agents will be able to execute tasks only when you enable this in Settings and confirm required permissions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {openTasks.length > 0 ? (
            <p className="text-sm text-neutral-700">
              {openTasks.length} manual task{openTasks.length === 1 ? '' : 's'} still open. Agent-run controls remain off
              by default.
            </p>
          ) : (
            <EmptyState
              title="Agent task execution is off by default"
              description="When enabled, this area will show queued agent actions, approval prompts, and run history."
            />
          )}
        </CardContent>
      </Card>
    </section>
  )
}
