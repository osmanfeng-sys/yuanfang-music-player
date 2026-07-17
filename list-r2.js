const { S3Client, ListObjectsV2Command } = require("@aws-sdk/client-s3");
const fs = require('fs');

const s3 = new S3Client({
  region: "auto",
  endpoint: "https://d3aaa017897b99e5387bffd8208e3967.r2.cloudflarestorage.com",
  credentials: {
    accessKeyId: "0b1bf533372317c4432ae06ecb5cc4ba",
    secretAccessKey: "c597197408ed745f1f5c8aaf1f4a5a77f464937e6a6a8a38724721293544b8d6",
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