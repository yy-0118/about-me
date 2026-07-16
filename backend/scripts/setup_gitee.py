"""
一次性配置脚本：把 Gitee 模力方舟 的 Key 写入 settings 表。

用法（Key 通过环境变量传入，绝不入库/不提交）：
    cd backend
    $env:GITEE_API_KEY="sk-xxx"
    venv/Scripts/python scripts/setup_gitee.py

也可以用 --llm-model / --embedding-model 覆盖默认值。
"""
import os
import sys
import asyncio
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

from app.database import init_db, async_session
from app.services.setting_service import set_value, DEFAULT_SETTINGS


DEFAULT_BASE_URL = "https://ai.gitee.com/v1"
DEFAULT_LLM_MODEL = "DeepSeek-V4-Flash"
DEFAULT_EMBEDDING_MODEL = "Qwen3-Embedding-8B"


def parse_args():
    args = {}
    for a in sys.argv[1:]:
        if a.startswith("--llm-model="):
            args["llm_model"] = a.split("=", 1)[1]
        elif a.startswith("--embedding-model="):
            args["embedding_model"] = a.split("=", 1)[1]
        elif a.startswith("--base-url="):
            args["base_url"] = a.split("=", 1)[1]
    return args


async def main():
    api_key = os.environ.get("GITEE_API_KEY", "").strip()
    if not api_key:
        print("✗ 缺少 GITEE_API_KEY 环境变量")
        print("  用法：$env:GITEE_API_KEY='你的key'; venv\\Scripts\\python scripts/setup_gitee.py")
        return

    args = parse_args()
    base_url = args.get("base_url", DEFAULT_BASE_URL)
    llm_model = args.get("llm_model", DEFAULT_LLM_MODEL)
    embedding_model = args.get("embedding_model", DEFAULT_EMBEDDING_MODEL)

    print("准备写入以下配置：")
    print(f"  base_url            = {base_url}")
    print(f"  llm_model           = {llm_model}")
    print(f"  embedding_model     = {embedding_model}")
    print(f"  api_key 长度         = {len(api_key)} 字符（不打印内容）")
    print()

    await init_db()
    async with async_session() as db:
        # 1) 凭据
        await set_value(db, "deepseek_api_key", api_key)
        await set_value(db, "deepseek_base_url", base_url)
        await set_value(db, "llm_model", llm_model)

        # 2) Embedding 复用同一 Key / 同一 base_url
        await set_value(db, "embedding_base_url", base_url)
        # 显式不写 embedding_api_key，让其回落 LLM key（已在 setting_service 实现）
        await set_value(db, "embedding_model", embedding_model)

        # 3) 其他参数保留默认值（如果 DB 没有的话）
        for k, v in DEFAULT_SETTINGS.items():
            if k in {"deepseek_base_url", "llm_model", "embedding_base_url", "embedding_model"}:
                continue
            await set_value(db, k, v)

    print("✓ 配置已写入数据库 settings 表")
    print()
    print("下一步：")
    print("  1) 浏览器进管理后台 → LLM API → 测试连接（应显示 LLM ✓ Embedding ✓）")
    print("  2) 在 backend 目录跑：")
    print("       venv\\Scripts\\python scripts/ingest_samples.py --re-embed")
    print("     对已入库的 6 个示例文档重新生成向量")


if __name__ == "__main__":
    asyncio.run(main())
