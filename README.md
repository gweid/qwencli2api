# Qwen API Server

FastAPI 服务器，提供 Qwen 模型的 API 接口，兼容 OpenAI API 格式。

[English Version](README_en.md) | [中文版本](README.md)

## 功能特性

- 🔐 密码保护访问
- 📁 支持上传 oauth_creds.json 文件
- 🔑 OAuth 设备码授权登录
- 💬 OpenAI 兼容的 API 接口
- 🔄 自动 token 刷新
- 📊 Token 状态管理
- 💾 SQLite 持久化存储
- 🌐 Web 管理界面
- 🏗️ 模块化架构设计

## 系统要求

- Python 3.8+
- Docker (可选)
- Docker Compose (可选)

## 快速开始

### 环境变量配置

首先复制环境变量示例文件：

```bash
cp .env.example .env
```

编辑 `.env` 文件，配置必要参数：

```bash
# 服务器配置
PORT=3008
HOST=0.0.0.0

# API 密码配置（建议修改为强密码）
API_PASSWORD=sk-123456

# 数据库配置
DATABASE_URL=data/tokens.db

# OAuth2 配置
QWEN_OAUTH_BASE_URL=https://chat.qwen.ai
QWEN_OAUTH_CLIENT_ID=f0304373b74a44d2b584a3fb70ca9e56

# 调试配置
DEBUG=false
LOG_LEVEL=info
```

## 启动方式

### 方式一：Docker Compose 启动（推荐）

这是最简单的启动方式，适合生产环境使用：

```bash
# 确保已配置 .env 文件
cp .env.example .env

# 启动服务
docker compose up -d

# 查看日志
docker compose logs -f

# 停止服务
docker compose down
```

**特点：**
- 自动构建镜像
- 数据持久化（./data 目录映射到容器）
- 健康检查
- 自动重启

### 方式二：Docker 启动

适合需要自定义配置的场景：

```bash
# 1. 构建镜像
docker build -t qwen-api-server .

# 2. 运行容器
docker run -d \
  --name qwen-api-server \
  -p 3008:3008 \
  -v $(pwd)/data:/app/data \
  --env-file .env \
  qwen-api-server

# 查看容器状态
docker ps

# 查看日志
docker logs qwen-api-server

# 停止容器
docker stop qwen-api-server
docker rm qwen-api-server
```

### 方式三：本地启动

#### 使用启动脚本（推荐）

**Linux/macOS:**
```bash
# 赋予执行权限
chmod +x run.sh

# 运行启动脚本
./run.sh
```

**Windows:**
```cmd
# 直接运行批处理文件
run.bat
```

启动脚本会自动执行以下操作：
- 检查 Python 环境
- 创建和激活虚拟环境
- 安装依赖包
- 设置默认环境变量
- 启动 FastAPI 服务器

#### 手动安装

如果需要更多控制或启动脚本无法正常工作：

```bash
# 1. 创建虚拟环境
python3 -m venv venv

# 2. 激活虚拟环境
# Linux/macOS
source venv/bin/activate
# Windows
venv\Scripts\activate

# 3. 安装依赖
pip install -r requirements.txt

# 4. 启动服务器
uvicorn src.main:app --host 0.0.0.0 --port 3008 --reload
```

#### Python 包安装

```bash
# 安装为 Python 包
pip install -e .

# 直接运行命令
qwen-api-server
```

## 验证安装

服务启动后，访问以下地址验证：

- **Web 界面**: http://localhost:3008
- **API 文档**: http://localhost:3008/docs
- **健康检查**: http://localhost:3008/health

## 使用方法

### 1. 访问 Web 界面

打开浏览器访问 http://localhost:3008，输入密码（默认：`sk-123456`）

### 2. 获取 Token

选择以下任一方式获取 token：

- **OAuth 登录**: 点击"OAuth 登录获取 Token"按钮进行授权
- **文件上传**: 上传本地的 `oauth_creds.json` 文件

### 3. 测试 API

在 Web 界面的 API 测试区域测试功能，或使用命令行：

```bash
# 测试聊天接口
curl -X POST http://localhost:3008/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-123456" \
  -d '{
    "model": "qwen3-coder-plus",
    "messages": [{"role": "user", "content": "你好"}]
  }'
```

## API 接口

### OpenAI 兼容接口

完全兼容 OpenAI API 格式，可以直接用于各种 OpenAI 客户端：

#### 聊天完成
```bash
# 标准格式
POST /v1/chat/completions
Authorization: Bearer your_password

# 流式输出
POST /v1/chat/completions
{
  "stream": true,
  "model": "qwen3-coder-plus",
  "messages": [{"role": "user", "content": "你好"}]
}
```

#### 模型列表
```bash
GET /v1/models
Authorization: Bearer your_password
```

#### Python 客户端示例
```python
import openai

client = openai.OpenAI(
    api_key="sk-123456",
    base_url="http://localhost:3008/v1"
)

response = client.chat.completions.create(
    model="qwen3-coder-plus",
    messages=[
        {"role": "user", "content": "写一个Python函数计算斐波那契数列"}
    ]
)

print(response.choices[0].message.content)
```

### 原生 API 接口

```bash
# 登录
POST /api/login
{"password": "your_password"}

# 上传 token
POST /api/upload-token
Authorization: Bearer your_password

# 获取 token 状态
GET /api/token-status
Authorization: Bearer your_password

# 聊天
POST /api/chat
Authorization: Bearer your_password
```

## 配置说明

### 环境变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `PORT` | 3008 | 服务器端口 |
| `HOST` | 0.0.0.0 | 监听地址 |
| `API_PASSWORD` | sk-123456 | API 访问密码 |
| `DATABASE_URL` | data/tokens.db | SQLite 数据库路径 |
| `TOKEN_REFRESH_INTERVAL` | 30 | Token 刷新间隔（分钟） |
| `SCHEDULER_ENABLED` | true | 启用调度器 |
| `DEBUG` | false | 调试模式 |
| `LOG_LEVEL` | info | 日志级别 |

### 数据库

项目使用 SQLite 数据库存储 token 信息，默认路径为 `data/tokens.db`：

```sql
CREATE TABLE tokens (
    id TEXT PRIMARY KEY,           -- refresh_token 的前8位
    access_token TEXT NOT NULL,    -- 访问令牌
    refresh_token TEXT NOT NULL,   -- 刷新令牌
    expires_at INTEGER,            -- 过期时间戳
    uploaded_at INTEGER            -- 上传时间戳
);
```

## 故障排查

### 常见问题

1. **端口被占用**
   ```bash
   # 查看端口占用
   lsof -i :3008
   # 或修改 .env 文件中的 PORT 配置
   ```

2. **权限问题**
   ```bash
   # 确保 data 目录可写
   mkdir -p data
   chmod 755 data
   ```

3. **依赖安装失败**
   ```bash
   # 更新 pip
   pip install --upgrade pip
   # 清理缓存重新安装
   pip cache purge
   pip install -r requirements.txt
   ```

4. **Docker 构建失败**
   ```bash
   # 重新构建镜像
   docker compose build --no-cache
   ```

### 日志查看

```bash
# Docker Compose
docker compose logs -f

# Docker
docker logs qwen-api-server

# 本地运行
# 日志直接输出到终端
```

## 项目结构

```
qwencli2api/
├── src/                        # 源代码
│   ├── main.py                 # 应用入口
│   ├── api/                    # API 路由
│   │   ├── routes.py           # 原生 API
│   │   └── openai_routes.py    # OpenAI 兼容 API
│   ├── auth/                   # 认证模块
│   ├── config/                 # 配置管理
│   ├── database/               # 数据库操作
│   ├── models/                 # 数据模型
│   ├── oauth/                  # OAuth 认证
│   ├── utils/                  # 工具函数
│   └── web/                    # Web 界面
├── templates/                  # HTML 模板
├── static/                     # 静态文件
├── data/                       # 数据目录
│   └── tokens.db              # SQLite 数据库
├── docker-compose.yml          # Docker Compose 配置
├── Dockerfile                  # Docker 镜像构建
├── requirements.txt            # Python 依赖
├── .env.example               # 环境变量示例
├── run.sh                     # Linux/macOS 启动脚本
├── run.bat                    # Windows 启动脚本
└── setup.py                   # 包安装配置
```

## 注意事项

- 🔒 请妥善保管 API 密码，建议使用强密码
- 💾 Token 数据存储在本地数据库中，请确保数据库文件安全
- 🌐 生产环境建议使用 HTTPS 和反向代理
- 📁 确保 `data` 目录存在且可写
- 🔄 建议定期备份数据库文件

## 许可证

本项目采用 MIT 许可证。
