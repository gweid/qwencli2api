"""
Token refresh scheduler for Qwen Code API Server
"""
import asyncio
import logging
import time
from typing import Optional
from datetime import datetime, timedelta
from ..oauth.token_manager import TokenManager
from ..database.token_db import TokenDatabase

logger = logging.getLogger(__name__)


class TokenScheduler:
    """Token自动刷新调度器"""
    
    def __init__(self, token_manager: TokenManager, refresh_interval: int = 30):
        """
        初始化调度器
        
        Args:
            token_manager: Token管理器实例
            refresh_interval: 刷新间隔（分钟），默认30分钟
        """
        self.token_manager = token_manager
        self.refresh_interval = refresh_interval  # 分钟
        self.is_running = False
        self.scheduler_task: Optional[asyncio.Task] = None
        self.last_refresh_time: Optional[float] = None
        self.refresh_count = 0
        self.failed_refresh_count = 0
    
    async def start(self):
        """启动调度器"""
        if self.is_running:
            logger.warning("调度器已经在运行中")
            return
        
        self.is_running = True
        self.scheduler_task = asyncio.create_task(self._scheduler_loop())
        logger.info(f"Token刷新调度器已启动，刷新间隔: {self.refresh_interval}分钟")
        
        # 启动后立即执行一次token刷新
        logger.info("调度器启动后执行初始token刷新")
        try:
            await self._refresh_tokens()
        except Exception as e:
            logger.error(f"初始token刷新失败: {str(e)}")
    
    async def stop(self):
        """停止调度器"""
        if not self.is_running:
            return
        
        self.is_running = False
        if self.scheduler_task:
            self.scheduler_task.cancel()
            try:
                await self.scheduler_task
            except asyncio.CancelledError:
                pass
        
        logger.info("Token刷新调度器已停止")
    
    async def _scheduler_loop(self):
        """调度器主循环"""
        logger.info("Token刷新调度器开始运行")
        
        while self.is_running:
            try:
                # 等待刷新间隔
                await asyncio.sleep(self.refresh_interval * 60)  # 转换为秒
                
                if not self.is_running:
                    break
                
                # 执行定时token刷新
                logger.info("执行定时token刷新")
                await self._refresh_tokens()
                
            except asyncio.CancelledError:
                logger.info("调度器任务被取消")
                break
            except Exception as e:
                logger.error(f"调度器运行出错: {str(e)}")
                # 出错后等待5分钟再重试
                try:
                    await asyncio.sleep(300)  # 5分钟
                except asyncio.CancelledError:
                    break
    
    async def _refresh_tokens(self):
        """执行token刷新"""
        start_time = time.time()
        self.last_refresh_time = start_time
        
        try:
            logger.info("开始自动刷新所有token")
            
            # 重新从数据库加载token，确保获取最新数据
            self.token_manager.load_tokens()
            
            # 检查是否有token需要刷新
            if not self.token_manager.token_store or len(self.token_manager.token_store) == 0:
                logger.info("没有可用的token需要刷新")
                return
            
            logger.info(f"当前有 {len(self.token_manager.token_store)} 个token需要检查刷新")
            
            # 执行刷新
            result = await self.token_manager.refresh_all_tokens()
            
            # 更新统计信息
            self.refresh_count += 1
            
            # 记录刷新结果
            if result.get('success'):
                refresh_results = result.get('refreshResults', [])
                success_count = sum(1 for r in refresh_results if r.get('success'))
                failed_count = len(refresh_results) - success_count
                
                logger.info(
                    f"Token刷新完成 - 成功: {success_count}, 失败: {failed_count}, "
                    f"剩余token数: {result.get('remainingTokens', 0)}, "
                    f"耗时: {time.time() - start_time:.2f}秒"
                )
                
                if failed_count > 0:
                    self.failed_refresh_count += failed_count
                    logger.warning(f"有 {failed_count} 个token刷新失败")
            else:
                logger.error(f"Token刷新失败: {result}")
                self.failed_refresh_count += 1
                
        except Exception as e:
            logger.error(f"Token刷新过程中出错: {str(e)}")
            self.failed_refresh_count += 1
    
    async def force_refresh_now(self):
        """立即强制刷新所有token"""
        if not self.is_running:
            logger.warning("调度器未运行，无法执行强制刷新")
            return False
        
        logger.info("执行立即强制刷新")
        # 确保重新加载最新的token数据
        self.token_manager.load_tokens()
        await self._refresh_tokens()
        return True
    
    def get_status(self) -> dict:
        """获取调度器状态"""
        next_refresh_time = None
        if self.last_refresh_time and self.is_running:
            next_refresh_time = self.last_refresh_time + (self.refresh_interval * 60)
        
        return {
            'isRunning': self.is_running,
            'refreshInterval': self.refresh_interval,
            'lastRefreshTime': self.last_refresh_time,
            'nextRefreshTime': next_refresh_time,
            'refreshCount': self.refresh_count,
            'failedRefreshCount': self.failed_refresh_count,
            'tokenCount': len(self.token_manager.token_store) if self.token_manager else 0
        }
    
    def set_refresh_interval(self, minutes: int):
        """设置刷新间隔"""
        if minutes < 1:
            raise ValueError("刷新间隔必须至少为1分钟")
        
        old_interval = self.refresh_interval
        self.refresh_interval = minutes
        logger.info(f"刷新间隔已更新: {old_interval}分钟 -> {minutes}分钟")


# 全局调度器实例
_scheduler_instance: Optional[TokenScheduler] = None


def get_scheduler() -> Optional[TokenScheduler]:
    """获取全局调度器实例"""
    return _scheduler_instance


def init_scheduler(token_manager: TokenManager, refresh_interval: int = 30) -> TokenScheduler:
    """初始化全局调度器实例"""
    global _scheduler_instance
    _scheduler_instance = TokenScheduler(token_manager, refresh_interval)
    return _scheduler_instance


async def start_scheduler():
    """启动全局调度器"""
    if _scheduler_instance:
        await _scheduler_instance.start()


async def stop_scheduler():
    """停止全局调度器"""
    if _scheduler_instance:
        await _scheduler_instance.stop()