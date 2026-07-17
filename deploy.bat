@echo off
echo [14] 正在添加文件到 Git...
git add .

echo [24] 正在提交更改...
git commit -m 自动更新：Worker和前端

echo [34] 正在推送到 GitHub...
git push origin main

echo [44] 正在部署到 Cloudflare Worker...
npx wrangler deploy

echo 更新已完成！
pause