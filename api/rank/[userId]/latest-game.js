import redis from "../../_redis";

export async function GET(request, { params }) {
  console.log("🚀 ~ file: latest-game.js:4 ~ params:", params)
  const userId = params.userId;
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

  return Response.json({
    code: 200,
    msg: "success",
    data: gameInfo,
  });
}
