require("dotenv").config();

const koa = require("koa");
const app = new koa();
const Router = require("@koa/router");
const bodyParser = require("koa-bodyparser");
const forge = require("node-forge");
const redis = require("./redis");
const router = new Router({
  prefix: "/api",
});

// 配置跨域 - 移到最前面并修改
app.use(async (ctx, next) => {
  ctx.set("Access-Control-Allow-Origin", "*");
  ctx.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Content-Length, Authorization, Accept, X-Requested-With , yourHeaderFeild"
  );
  ctx.set("Access-Control-Allow-Methods", "PUT, POST, GET, DELETE, OPTIONS");

  // 处理 OPTIONS 请求
  if (ctx.method === "OPTIONS") {
    ctx.body = "";
    ctx.status = 204;
  } else {
    await next();
  }
});

// 配置bodyParser
app.use(bodyParser());

app.use(router.routes()).use(router.allowedMethods());

router.post("/score", async (ctx, next) => {
  // 解密数据
  const private_key = forge.pki.privateKeyFromPem(process.env.RSA_PRIVATE_KEY);
  const encrypted_data = ctx.request.body.encrypted_data;
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
    return (ctx.body = {
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

  const combinedScore = parseFloat(`${data.score}.${9999999999999-Date.now()}`);

  const r = await redis.zadd("ranking_list", "GT", combinedScore, gameId);

  return (ctx.body = {
    code: 200,
    msg: "success",
    data: r,
  });
});

router.get("/rank", async (ctx, next) => {
  // 获取排行榜数据，使用 ZRANGE 获取成员和分数
  const rank = await redis.zrange("ranking_list", 0, 14, "REV");

  // 处理数据
  const formattedRank = [];
  for (let i = 0; i < rank.length; i += 1) {
    await redis.hgetall(`game:${rank[i]}`).then((res) => {
      // 去掉ID
      delete res.id;
      formattedRank.push({
        rank: formattedRank.length + 1,
        gameId: res.id,
        ...res,
      });
    });
  }

  return (ctx.body = {
    code: 200,
    msg: "success",
    data: formattedRank,
  });
});

router.get("/rank/:gameId", async (ctx, next) => {
  // 获取比赛对应的排名
  const gameId = ctx.params.gameId;

  const rank = await redis.zrevrank("ranking_list", gameId);

  if (rank == null) {
    return (ctx.body = {
      code: 404,
      msg: "not found",
    });
  }

  return (ctx.body = {
    code: 200,
    msg: "success",
    data: {
      id: id,
      rank: rank + 1,
    },
  });
});

router.get("/rank/:userId/latest-game", async (ctx, next) => {
  const userId = ctx.params.userId;
  const userGamesKey = `user:${userId}:games`;

  // 获取最新的比赛ID（列表中的第一个元素）
  const latestGameId = await redis.lindex(userGamesKey, 0);

  if (!latestGameId) {
    return (ctx.body = {
      code: 404,
      msg: "no games found",
    });
  }

  // 获取比赛详细信息
  const gameInfo = await redis.hgetall(`game:${latestGameId}`);

  // 获取排名
  const rank = await redis.zrevrank("ranking_list", latestGameId);
  gameInfo.rank = rank + 1;

  return (ctx.body = {
    code: 200,
    msg: "success",
    data: gameInfo,
  });
});

const port = 8090;

app.listen(port, () => {
  console.log(`
snakeball API running at: http://localhost:${8090}/api
`);
});
