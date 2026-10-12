"""Offline data import."""
from fastapi import APIRouter, Depends, Request, UploadFile, File, BackgroundTasks
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.core.deps import require_permission, write_audit
from app.core.exceptions import NotFoundError, BizError
from app.core.response import ok
from app.db.session import get_db
from app.models.auth import User
from app.models.data import DataImport
from app.schemas.data import DataImportOut
from app.services.data_service import save_upload, process_import
from app.utils.parser import parse_bytes, detect_file_type

router = APIRouter()


def _out(imp: DataImport) -> dict:
    return DataImportOut(
        id=imp.id, filename=imp.filename, fileType=imp.file_type, fileSize=imp.file_size,
        status=imp.status, totalRows=imp.total_rows, importedRows=imp.imported_rows,
        errorMsg=imp.error_msg, uploadedBy=imp.uploaded_by, createdAt=imp.created_at,
    ).model_dump()


@router.get("")
def list_imports(
    page: int = 1,
    pageSize: int = 20,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("data:import:read")),
):
    stmt = select(DataImport).order_by(DataImport.id.desc())
    total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0
    rows = db.execute(stmt.offset((page - 1) * pageSize).limit(pageSize)).scalars().all()
    return ok({"list": [_out(r) for r in rows], "meta": {"page": page, "pageSize": pageSize, "total": total}})


@router.post("/upload")
async def upload(
    background_tasks: BackgroundTasks,
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(require_permission("data:import:write")),
):
    content = await file.read()
    if not content:
        raise BizError("文件为空")
    path, size, ext = save_upload(content, file.filename or "upload.csv")
    ftype = detect_file_type(file.filename or "upload.csv")
    imp = DataImport(
        filename=file.filename or "upload.csv",
        file_type=ftype,
        file_size=size,
        storage_path=path,
        status="PARSING",
        uploaded_by=user.id,
    )
    db.add(imp)
    db.commit()
    db.refresh(imp)
    write_audit(db, user, "UPLOAD_IMPORT", resource=f"data_import:{imp.id}",
                detail=imp.filename, ip=request.client.host if request.client else None)

    # Use a dedicated session for background processing
    def _bg():
        from app.db.session import SessionLocal
        bg_db = SessionLocal()
        try:
            target = bg_db.get(DataImport, imp.id)
            if target:
                process_import(bg_db, target, content)
        finally:
            bg_db.close()

    background_tasks.add_task(_bg)
    return ok(_out(imp))


@router.get("/{import_id}")
def get_import(import_id: int, db: Session = Depends(get_db), _: User = Depends(require_permission("data:import:read"))):
    imp = db.get(DataImport, import_id)
    if not imp:
        raise NotFoundError("导入记录不存在")
    return ok(_out(imp))


@router.get("/{import_id}/preview")
def preview_import(import_id: int, db: Session = Depends(get_db), _: User = Depends(require_permission("data:import:read"))):
    imp = db.get(DataImport, import_id)
    if not imp:
        raise NotFoundError("导入记录不存在")
    try:
        with open(imp.storage_path, "rb") as f:
            content = f.read()
        columns, rows, df = parse_bytes(content, imp.filename)
    except Exception as e:  # noqa: BLE001
        raise BizError(f"预览失败: {e}")
    return ok({"columns": columns, "rows": rows[:100], "total": int(df.shape[0])})


@router.delete("/{import_id}")
def delete_import(import_id: int, request: Request, db: Session = Depends(get_db), user: User = Depends(require_permission("data:import:delete"))):
    imp = db.get(DataImport, import_id)
    if not imp:
        raise NotFoundError("导入记录不存在")
    db.delete(imp)
    db.commit()
    write_audit(db, user, "DELETE_IMPORT", resource=f"data_import:{import_id}", ip=request.client.host if request.client else None)
    return ok({"id": import_id})
