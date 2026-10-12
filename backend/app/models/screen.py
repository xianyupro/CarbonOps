"""自定义大屏配置模型（驾驶舱中心）。"""
from sqlalchemy import JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ScreenConfig(Base):
    __tablename__ = "screen_configs"

    name: Mapped[str] = mapped_column(String(128), nullable=False)
    # 布局 JSON：{layout: [{i,w,h,x,y,widget}], widgetData: {i: {...}}}（react-grid-layout 格式）
    layout: Mapped[dict | None] = mapped_column(JSON, nullable=True)
