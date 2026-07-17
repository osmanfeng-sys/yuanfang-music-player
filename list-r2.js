const { S3Client, ListObjectsV2Command } = require("@aws-sdk/client-s3");
const fs = require('fs');

const s3 = new S3Client({
  region: "auto",
  endpoint: "https://d3aaa017897b99e5387bffd8208e3967.r2.cloudflarestorage.com",
  credentials: {
    // 使用 S3 客户端专用的 32 位访问密钥 ID
    accessKeyId: "0b1bf533372317c4432ae06ecb5cc4ba", 
    // 使用 64 位长机密访问密钥
    secretAccessKey: "c597197408ed745f1f5c8aaf1f4a5a77f464937e6a6a8a38724721293544b8d6",
  },
});

async function generatePlaylist() {
  try {
    const command = new ListObjectsV2Command({ Bucket: "music-bucket" });
    const response = await s3.send(command);
    
    if (!response.Contents) {
      console.log("存储桶为空或无内容。");
      return;
    }

    const tracks = response.Contents
      .filter(item => item.Key.endsWith('playlist.m3u8'))
      .map(item => ({
        name: item.Key.split('/').slice(-2, -1)[0],
        url: `https://music-proxy.osmanfeng.workers.dev/${encodeURIComponent(item.Key)}`,
        type: 'hls'
      }));

    fs.writeFileSync('playlist.json', JSON.stringify(tracks, null, 2));
    console.log(`成功生成 playlist.json，共计 ${tracks.length} 首曲目。`);
  } catch (err) {
    console.error("执行失败，错误详情:", err.message);
  }
}

generatePlaylist();