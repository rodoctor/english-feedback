from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import TrainingSession
from app.schemas import TaskCreate, TaskItem, TaskListResponse, TaskUpdate
from app.services.crud import create_task, delete_task, get_or_create_task_by_title, get_task, list_tasks, update_task

router = APIRouter(prefix="/api", tags=["tasks"])


@router.get("/tasks", response_model=TaskListResponse)
def read_tasks(db: Session = Depends(get_db)) -> TaskListResponse:
    tasks = list_tasks(db)
    return TaskListResponse(
        items=[
            TaskItem(id=task.id, title=task.title, description=task.description, created_at=task.created_at)
            for task in tasks
        ]
    )


@router.post("/tasks", response_model=TaskItem)
def add_task(payload: TaskCreate, db: Session = Depends(get_db)) -> TaskItem:
    if not payload.title.strip():
        raise HTTPException(status_code=400, detail="Task title is required")
    task = create_task(db, payload.title, payload.description)
    db.commit()
    db.refresh(task)
    return TaskItem(id=task.id, title=task.title, description=task.description, created_at=task.created_at)


@router.put("/tasks/{task_id}", response_model=TaskItem)
def edit_task(task_id: int, payload: TaskUpdate, db: Session = Depends(get_db)) -> TaskItem:
    task = get_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if not payload.title.strip():
        raise HTTPException(status_code=400, detail="Task title is required")
    updated = update_task(db, task, payload.title, payload.description)
    db.commit()
    db.refresh(updated)
    return TaskItem(id=updated.id, title=updated.title, description=updated.description, created_at=updated.created_at)


@router.delete("/tasks/{task_id}")
def remove_task(task_id: int, db: Session = Depends(get_db)) -> dict[str, bool]:
    task = get_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    session_count = db.scalar(select(func.count()).select_from(TrainingSession).where(TrainingSession.task_id == task.id)) or 0
    if session_count:
        fallback_title = "General" if task.title != "General" else "Unassigned"
        fallback_task = get_or_create_task_by_title(
            db,
            fallback_title,
            "Fallback task used when a task with linked practice sessions is removed.",
        )
        db.execute(
            update(TrainingSession)
            .where(TrainingSession.task_id == task.id)
            .values(task_id=fallback_task.id)
        )

    delete_task(db, task)
    return {"deleted": True}