import redis from './_redis'

export async function GET(request) {
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

  return Response.json({
    code: 200,
    msg: "success",
    data: formattedRank,
  });
}
