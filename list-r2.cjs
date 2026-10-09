const { S3Client, ListObjectsV2Command, PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
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

  // 时长表（由 upload-music.mjs 维护）：读一次就有全部 mp3 的时长，不必逐对象 HEAD
  let durations = {};
  try {
    const d = await s3.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: "durations.json" }));
    durations = JSON.parse(await d.Body.transformToString());
    console.log(`时长表：${Object.keys(durations).length} 条`);
  } catch {
    console.log("时长表：无（mp3 的时长要跑过 npm run music:upload 才会有）");
  }

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
          // 老 HLS 分片清单 + 新直传的 mp3 原文件，两种共存
          .filter(item => item.Key.endsWith('playlist.m3u8') || /\.mp3$/i.test(item.Key))
          .map(item => {
            const isHls = item.Key.endsWith('.m3u8');
            // 老 HLS：曲目名在倒数第二段（目录名）；新 mp3：曲目名就是文件名
            const name = isHls
              ? item.Key.split('/').slice(-2, -1)[0]
              : item.Key.split('/').pop().replace(/\.mp3$/i, '');
            const track = {
              name,
              // 分段编码，保留真实 / 路径分隔符（否则 hls.js 无法解析相对路径）
              // 使用自定义域名（workers.dev 域名在中国大陆被屏蔽）
              url: `https://api.yuanfangorganics.ccwu.cc/${item.Key.split('/').map(encodeURIComponent).join('/')}`,
              type: isHls ? 'hls' : 'mp3'
            };
            if (durations[item.Key]) track.duration = durations[item.Key];
            return track;
          });
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