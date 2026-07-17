yuanfang-music-player/
├── .wrangler/          # Cloudflare 配置文件及日志
├── node_modules/       # 依赖库 (通过 npm install 安装)
├── index.html          # 前端代码
├── list-r2.js          # 扫描 R2 存储桶的脚本
├── package.json        # 项目依赖清单
├── worker.js           # 代理后端代码
└── wrangler.toml       # 项目配置
2026-07-17 08：46
对 deploy.bat 进行技术升级。
优化点包括：自动化生成 playlist.json、增加错误处理逻辑、明确区分 Cloudflare Pages 与 Worker 部署流程，并确保 Git 动作的健壮性。
全量递归扫描版 list-r2.js
原代码使用了 ListObjectsV2Command 且未处理 ContinuationToken，导致只能扫描存储桶的前 1000 个对象且无法深度递归。以下代码已重构为支持分页的全量递归扫描版本。
