#!/usr/bin/env sh

# 确保脚本抛出遇到的错误
set -e

# 生成静态文件

# 进入生成的文件夹
git pull
git add .
git commit -m'上传图片lfs拉取提交'
git push
