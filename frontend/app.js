// 【部署配置】将此处改为你的 Railway 后端地址
// 本地开发: 'http://localhost:3000'
// 生产环境: 'https://your-app.up.railway.app'
const API_BASE_URL = 'http://localhost:3000';

// 核心状态
let currentStream = null;
let selectedImageFileName = null; // 对应 Java 中的 selectedImage 文件名

// DOM 元素获取
const videoPreview = document.getElementById('videoPreview');
const sourceImage = document.getElementById('sourceImage');
const captureCanvas = document.getElementById('captureCanvas');
const generatedImage = document.getElementById('generatedImage');
const fileInput = document.getElementById('fileInput');
const promptInput = document.getElementById('promptInput');
const leftPlaceholder = document.getElementById('leftPlaceholder');
const rightPlaceholder = document.getElementById('rightPlaceholder');
const loadingOverlay = document.getElementById('loadingOverlay');

const btnOpenCam = document.getElementById('btnOpenCam');
const btnCloseCam = document.getElementById('btnCloseCam');
const btnTakePhoto = document.getElementById('btnTakePhoto');
const btnGenerate = document.getElementById('btnGenerate');

// 显示左侧内容辅助函数
function showLeftContent(type) {
    // 隐藏占位符
        if (leftPlaceholder) {
            leftPlaceholder.style.display = 'none';
        }
    if (type === 'video') {
        videoPreview.style.display = 'block';
        sourceImage.style.display = 'none';
    } else if (type === 'image') {
        videoPreview.style.display = 'none';
        sourceImage.style.display = 'block';
    }
}

// 1. 打开相机
btnOpenCam.addEventListener('click', async () => {
    if (currentStream) return;
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        currentStream = stream;
        videoPreview.srcObject = stream;
        showLeftContent('video');
    } catch (err) {
        alert("无法访问相机，请检查权限：" + err.message);
    }
});

// 2. 关闭相机
btnCloseCam.addEventListener('click', () => {
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
        currentStream = null;
        videoPreview.srcObject = null;
        console.log("关闭相机");
    }
});

// 3. 拍照
btnTakePhoto.addEventListener('click', () => {
    if (!currentStream) {
        alert("请先打开相机");
        return;
    }
    const ctx = captureCanvas.getContext('2d');
    // 将视频帧画到 canvas 上
    ctx.drawImage(videoPreview, 0, 0, captureCanvas.width, captureCanvas.height);

    // 转为 Blob 并上传服务器
    captureCanvas.toBlob(async (blob) => {
        const formData = new FormData();
        formData.append('image', blob, 'camera_capture.png');

        try {
            const res = await fetch(`${API_BASE_URL}/api/upload`, {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (data.success) {
                // 设置为选中的图片文件
                selectedImageFileName = data.fileName;
                sourceImage.src = `${API_BASE_URL}${data.url}`;
                showLeftContent('image');

                //添加日志输出，方便调试
                console.log(`%c[上传成功] 拍照已保存至服务器: ${data.fileName}`, "color: #4CAF50; font-weight: bold;");

                // 原逻辑：拍照后关闭相机
                btnCloseCam.click();
            } else {
                alert("保存拍照失败：" + data.error);
            }
        } catch (err) {
            alert("上传请求失败：" + err.message);
        }
    }, 'image/png');
});

// 4. 打开图片 (文件上传)
fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // 前端直接预览上传的图片并提交后端保存
    const formData = new FormData();
    formData.append('image', file);

    try {
        const res = await fetch(`${API_BASE_URL}/api/upload`, {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        if (data.success) {
            selectedImageFileName = data.fileName;
            sourceImage.src = `${API_BASE_URL}${data.url}`;
            showLeftContent('image');

            //添加日志输出，方便调试
            console.log(`%c[上传成功] 本地图片已同步至后端: ${data.fileName}`, "color: #2196F3; font-weight: bold;");
        } else {
            alert("图片上传失败：" + data.error);
        }
    } catch (err) {
        alert("请求失败：" + err.message);
    }
    // 清空 input value，允许重复选择同一图片
    e.target.value = '';
});

// 5. 生成图片
btnGenerate.addEventListener('click', async () => {
    const prompt = promptInput.value.trim();
    if (!prompt || !selectedImageFileName) {
        alert("请输入提示词并选择图片文件(拍照或打开)");
        return;
    }

    // UI 处理：展示 Loading，禁用按钮
    btnGenerate.disabled = true;
    loadingOverlay.style.display = 'flex';
    generatedImage.style.display = 'none';

    console.log(`%c🚀 正在向后端发送生成请求... 提示词: "${prompt}"`, "color: #FF9800;");

    try {
        const res = await fetch(`${API_BASE_URL}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt: prompt,
                fileName: selectedImageFileName
            })
        });

        const data = await res.json();
        if (!res.ok || data.error) {
            throw new Error(data.error || "网络请求异常");
        }

       if (res.ok && !data.error) {
                   console.log("------------------------------------------");
                   console.log("%c✅ 豆包图像创作大模型 5.0 生成成功！", "color: #4CAF50; font-size: 14px; font-weight: bold;");
                   console.log(`图片 URL: ${data.url}`);
                   console.log("------------------------------------------");

                   generatedImage.src = `${API_BASE_URL}${data.url}`;
                   generatedImage.style.display = 'block';
                   rightPlaceholder.style.display = 'none';
               } else {
                   throw new Error(data.error || "网络请求异常");
               }

           } catch (err) {
               console.error("❌ 生成失败:", err.message);
               alert("生成图片失败：" + err.message);
           } finally {
               btnGenerate.disabled = false;
               loadingOverlay.style.display = 'none';
           }
       });