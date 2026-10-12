"""Custom exceptions and global exception handlers."""
from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError


class BizError(Exception):
    """Business error that maps to a {code, msg} response with a chosen HTTP status."""

    def __init__(self, msg: str, code: int = -1, status_code: int = 400):
        self.msg = msg
        self.code = code
        self.status_code = status_code
        super().__init__(msg)


class NotFoundError(BizError):
    def __init__(self, msg: str = "资源不存在"):
        super().__init__(msg, code=404, status_code=404)


class AuthError(BizError):
    def __init__(self, msg: str = "未认证"):
        super().__init__(msg, code=401, status_code=401)


class ForbiddenError(BizError):
    def __init__(self, msg: str = "无权限"):
        super().__init__(msg, code=403, status_code=403)


def _envelope(code: int, msg: str, data=None):
    return {"code": code, "msg": msg, "data": data}


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(BizError)
    async def _biz_handler(_: Request, exc: BizError):
        return JSONResponse(status_code=exc.status_code, content=_envelope(exc.code, exc.msg))

    @app.exception_handler(RequestValidationError)
    async def _validation_handler(_: Request, exc: RequestValidationError):
        # exc.errors() may carry raw bytes in `input` (e.g. a JSON body sent
        # with the wrong content-type); jsonable_encoder makes it JSON-safe.
        return JSONResponse(
            status_code=422,
            content=_envelope(422, "参数校验失败", data=jsonable_encoder(exc.errors())),
        )

    @app.exception_handler(Exception)
    async def _fallback(_: Request, exc: Exception):
        return JSONResponse(status_code=500, content=_envelope(500, f"服务器错误: {exc}"))
