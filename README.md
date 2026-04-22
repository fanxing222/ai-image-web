# AI Image Agent (Web 版本) 运行说明

本项目已成功将原 Java Swing 桌面应用 1:1 迁移为 B/S 架构的前后端分离 Web 应用。前端使用原生 HTML/JS/CSS，后端使用 Node.js + Express。

## 1. 环境依赖
- 运行环境需要安装 **Node.js** (建议版本 v16.0.0 以上)。
- (可选) 全局安装 npm 镜像以加速下载：`npm config set registry https://registry.npmmirror.com`

## 2. 目录配置修改
在正式运行前，请确认图片存储的绝对路径是否正确。
打开 `backend/server.js`，修改第 13 行：
```javascript
const IMAGE_DIR = "D:\\代码库\\AIimgpro\\相册"; // 根据你本机的实际存放路径修改