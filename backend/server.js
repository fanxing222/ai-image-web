require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

const app = express();

// CORS 配置：允许 Vercel 前端域名访问
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
app.use(cors({ origin: ALLOWED_ORIGIN }));
app.use(express.json());

// 【配置项】使用环境变量，Railway 部署时通过 Dashboard 设置
const IMAGE_DIR = process.env.IMAGE_DIR || '/tmp/images';
const API_URL = "https://ark.cn-beijing.volces.com/api/v3/images/generations";
const MODEL = "doubao-seedream-5-0-260128";
const API_KEY = process.env.API_KEY; // 必须通过环境变量设置

// 启动前检查 API_KEY
if (!API_KEY) {
    console.error('错误：未设置 API_KEY 环境变量');
    process.exit(1);
}

// 确保目录存在
if (!fs.existsSync(IMAGE_DIR)) {
    fs.mkdirSync(IMAGE_DIR, { recursive: true });
}

// 静态文件服务，允许前端访问生成的图片
app.use('/images', express.static(IMAGE_DIR));

// 1:1 还原时间戳命名规则
function getFormattedTime() {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}-${d.getHours()}-${d.getMinutes()}-${d.getSeconds()}`;
}

// 配置 Multer 存储
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, IMAGE_DIR);
    },
    filename: function (req, file, cb) {
        // 原生 Java 程序总是存为 png
        const ext = file.mimetype.split('/')[1] || 'png';
        cb(null, `${getFormattedTime()}.${ext}`);
    }
});
const upload = multer({ storage: storage });

// 接口：上传本地图片或保存拍照图片
app.post('/api/upload', upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: '未上传图片' });
    }
    // 返回图片在服务器上的访问路径和物理文件名
    res.json({
        success: true,
        fileName: req.file.filename,
        url: `/images/${req.file.filename}`
    });
});

// 判断 MimeType 的辅助方法
function detectMimeType(filename) {
    const ext = path.extname(filename).toLowerCase();
    if (ext === '.png') return 'image/png';
    if (ext === '.gif') return 'image/gif';
    if (ext === '.bmp') return 'image/bmp';
    if (ext === '.webp') return 'image/webp';
    return 'image/jpeg';
}

// 接口：调用 AI 生成图片
app.post('/api/generate', async (req, res) => {
    const { prompt, fileName } = req.body;

    if (!prompt || !fileName) {
        return res.status(400).json({ error: '提示词或图片文件缺失' });
    }

    const filePath = path.join(IMAGE_DIR, fileName);
    if (!fs.existsSync(filePath)) {
        return res.status(400).json({ error: '找不到待处理的图片文件' });
    }

    try {
        // 1. 读取文件并转换为 Base64 (还原 java readAllBytes)
        const fileBuffer = fs.readFileSync(filePath);
        const base64Image = fileBuffer.toString('base64');
        const mimeType = detectMimeType(fileName);
        const dataUri = `data:${mimeType};base64,${base64Image}`;

        // 2. 构建 JSON 请求体 (还原 buildRequestJson)
        const requestBody = {
            model: MODEL,
            prompt: prompt,
            image: dataUri,
            size: "2K",
            sequential_image_generation: "disabled",
            response_format: "url",
            stream: false,
            watermark: true
        };

        // 3. 发送 HTTP 请求
        const response = await axios.post(API_URL, requestBody, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            timeout: 120000 // 120秒超时
        });

        const body = response.data;
        if (body.error) {
            throw new Error(`API返回错误: ${body.error.message || JSON.stringify(body.error)}`);
        }

        // 4. 解析图片 URL 并下载图片 (还原 extractImageUrl 和下载逻辑)
        const imageUrl = body.data?.[0]?.url;
        if (!imageUrl) {
            throw new Error('未从API响应中获取到图片URL。');
        }

        // 下载结果图片
        const imgResponse = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 60000 });
        const generatedFileName = `${getFormattedTime()}-generated.png`;
        const generatedFilePath = path.join(IMAGE_DIR, generatedFileName);

        fs.writeFileSync(generatedFilePath, imgResponse.data);

        // 返回新图片地址给前端展示
        res.json({
            success: true,
            url: `/images/${generatedFileName}`
        });

    } catch (error) {
        console.error("生成图片失败:", error.message);
        res.status(500).json({ error: `生成图片失败：${error.response?.data?.error?.message || error.message}` });
    }
});

// Railway 会通过环境变量 PORT 分配端口
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});