const { S3Client, ListObjectsV2Command, PutObjectCommand } = require("@aws-sdk/client-s3");
const fs = require('fs');

// ===== 从环境变量读取凭证（从 .env 加载） =====
const requiredEnvVars = ['R2_ENDPOINT', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'];
for (const v of requiredEnvVars) {
  if (!process.env[v]) {
    console.error(`[Error] 缺少环境变量 ${v}。请复制 .env.example 为 .env 并填入凭证。`);
    process.exit(1);
  }
}

const R2_BUCKET = process.env.R2_BUCKET || 'music-bucket';

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

async function generatePlaylist() {
  let isTruncated = true;
  let continuationToken;
  let allTracks = [];

  console.log("正在全量扫描 R2 存储桶...");

  try {
    while (isTruncated) {
      const command = new ListObjectsV2Command({
        Bucket: R2_BUCKET,
        ContinuationToken: continuationToken,
      });

      const response = await s3.send(command);

      if (response.Contents) {
        const filtered = response.Contents
          .filter(item => item.Key.endsWith('playlist.m3u8'))
          .map(item => ({
            name: item.Key.split('/').slice(-2, -1)[0],
            // 分段编码，保留真实 / 路径分隔符（否则 hls.js 无法解析相对路径）
            // 使用自定义域名（workers.dev 域名在中国大陆被屏蔽）
            url: `https://api.yuanfangorganics.ccwu.cc/${item.Key.split('/').map(encodeURIComponent).join('/')}`,
            type: 'hls'
          }));
        allTracks.push(...filtered);
      }

      isTruncated = response.IsTruncated;
      continuationToken = response.NextContinuationToken;
    }

    // 写入本地文件
    fs.writeFileSync('playlist.json', JSON.stringify(allTracks, null, 2));
    console.log(`[Success] 扫描完成，共索引 ${allTracks.length} 首曲目。`);

    // 自动上传到 R2
    console.log("正在上传 playlist.json 到 R2...");
    await s3.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: 'playlist.json',
      Body: JSON.stringify(allTracks, null, 2),
      ContentType: 'application/json'
    }));
    console.log(`[Upload] ✓ playlist.json 已同步到 R2 (${R2_BUCKET}/playlist.json)`);

  } catch (err) {
    console.error("[Error] 操作失败:", err.message);
    process.exit(1);
  }
}

generatePlaylist();