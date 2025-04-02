import forge from "node-forge";
import redis from "../_redis";

export async function POST(request) {
  // 解密数据
  const private_key = forge.pki.privateKeyFromPem(process.env.RSA_PRIVATE_KEY);
  const encrypted_data = request.body.encrypted_data;
  const decrypted_data = private_key.decrypt(
    forge.util.decode64(encrypted_data),
    "RSA-OAEP",
    {
      md: forge.md.sha256.create(),
    }
  );
  const data = JSON.parse(decrypted_data);
  console.log("🚀 ~ file: main.js:42 ~ data:", data);

  // 校验数据
  // {
  //   id: '1743588652898lqwl59fq',
  //   name: 'huiwang',
  //   wave: 1,
  //   lives: 0,
  //   score: 1
  // }

  if (!data.id || !data.name || !data.score) {
    return Response.json({
      code: 400,
      msg: "invalid data",
    });
  }

  // 使用 Hash 结构存储用户信息，key 为 user:id
  const userKey = `user:${data.id}`;

  const c = await redis.hexists(userKey, "id");

  if (!c) {
    await redis.hset(userKey, {
      id: data.id,
      name: data.name,
      createTime: Date.now(),
    });
  }

  // 生成比赛ID：使用 MD5 哈希算法,虽然MD5并不安全，但对于比赛ID来说已经足够了
  const gameId = forge.md.md5
    .create()
    .update(`${data.id}_${Date.now()}_${data.score}`)
    .digest()
    .toHex();

  const gaomeKey = `game:${gameId}`;

  // 比赛信息
  await redis.hset(gaomeKey, {
    id: gameId,
    userId: data.id, // 玩家ID
    name: data.name,
    // 比赛信息
    wave: data.wave,
    lives: data.lives,
    score: data.score,
    createTime: Date.now(),
  });

  const userGamesKey = `user:${data.id}:games`;
  await redis.lpush(userGamesKey, gameId);

  const combinedScore = parseFloat(
    `${data.score}.${9999999999999 - Date.now()}`
  );

  const r = await redis.zadd("ranking_list", "GT", combinedScore, gameId);

  return Response.json({
    code: 200,
    msg: "success",
    data: r,
  });
}
