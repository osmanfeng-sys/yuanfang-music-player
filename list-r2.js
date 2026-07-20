const { S3Client, ListObjectsV2Command } = require("@aws-sdk/client-s3");
const fs = require('fs');

// ===== 从环境变量读取凭证（从 .env 加载） =====
const requiredEnvVars = ['R2_ENDPOINT', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'];
for (const v of requiredEnvVars) {
  if (!process.env[v]) {
    console.error(`[Error] 缺少环境变量 ${v}。请复制 .env.example 为 .env 并填入凭证。`);
    process.exit(1);
  }
}

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
        Bucket: "music-bucket",
        ContinuationToken: continuationToken,
      });
      
      const response = await s3.send(command);
      
      if (response.Contents) {
        const filtered = response.Contents
          .filter(item => item.Key.endsWith('playlist.m3u8'))
          .map(item => ({
            name: item.Key.split('/').slice(-2, -1)[0],
            url: `https://music-proxy.osmanfeng.workers.dev/${encodeURIComponent(item.Key)}`,
            type: 'hls'
          }));
        allTracks.push(...filtered);
      }

      isTruncated = response.IsTruncated;
      continuationToken = response.NextContinuationToken;
    }

    fs.writeFileSync('playlist.json', JSON.stringify(allTracks, null, 2));
    console.log(`[Success] 扫描完成，共索引 ${allTracks.length} 首曲目。`);
  } catch (err) {
    console.error("[Error] 索引生成失败:", err.message);
    process.exit(1);
  }
}

generatePlaylist();