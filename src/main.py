"""
Main application entry point for Qwen Code API Server
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn
import os
import asyncio
import logging

from src.config.settings import PORT, HOST, DEBUG, TOKEN_REFRESH_INTERVAL, SCHEDULER_ENABLED
from src.api import api_router, openai_router
from src.web import web_router
from src.database.token_db import TokenDatabase
from src.oauth.token_manager import TokenManager
from src.scheduler import init_scheduler, start_scheduler, stop_scheduler

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 创建FastAPI应用
app = FastAPI(title="Qwen Code API Server", description="Qwen Code API Server with FastAPI")

# 全局变量
db = None
token_manager = None
scheduler = None

# 添加CORS中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 挂载静态文件
static_path = os.path.join(os.path.dirname(__file__), '..', 'static')
if os.path.exists(static_path):
    app.mount("/static", StaticFiles(directory=static_path), name="static")

# 注册路由
app.include_router(web_router, tags=["Web Interface"])
app.include_router(api_router, prefix="/api", tags=["API"])
app.include_router(openai_router, tags=["OpenAI API"])


@app.on_event("startup")
async def startup_event():
    """应用启动时的初始化"""
    global db, token_manager, scheduler
    
    try:
        # 初始化数据库和token管理器
        db = TokenDatabase()
        token_manager = TokenManager(db)
        token_manager.load_tokens()
        
        logger.info(f"已加载 {len(token_manager.token_store)} 个token")
        
        # 初始化并启动调度器
        if SCHEDULER_ENABLED:
            scheduler = init_scheduler(token_manager, TOKEN_REFRESH_INTERVAL)
            await start_scheduler()
            logger.info(f"Token自动刷新调度器已启动，间隔: {TOKEN_REFRESH_INTERVAL}分钟")
        else:
            logger.info("Token自动刷新调度器已禁用")
            
    except Exception as e:
        logger.error(f"应用启动失败: {str(e)}")
        raise


@app.on_event("shutdown")
async def shutdown_event():
    """应用关闭时的清理"""
    global scheduler
    
    try:
        # 停止调度器
        if scheduler:
            await stop_scheduler()
            logger.info("Token自动刷新调度器已停止")
            
    except Exception as e:
        logger.error(f"应用关闭时出错: {str(e)}")

if __name__ == "__main__":
    uvicorn.run(
        "src.main:app",
        host=HOST,
        port=PORT,
        reload=DEBUG,
        log_level="debug" if DEBUG else "info"
    )