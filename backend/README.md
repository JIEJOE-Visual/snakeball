# SNAKEBALL 后端说明

使用 koa 框架，使用 redis 数据库, 不使用传统数据库，体量太小，没必要

## 开始

启动一个 Redis 服务
```
docker run --name redis -d redis redis-server --requirepass "authpassword"
```

在根目录添加 .env 文件，.env 文件内容参考 .example.env


安装依赖
```
npm install
```
启动后端服务
```
npm run dev
```
访问 http://localhost:8090/api

## API 接口说明

1. 提交玩家数据

POST api/score

Body: {
    encrypted_data: string,
}


2. 获取排行榜数据

GET api/rank

3. 获取玩家分数对应的排名

GET api/rank/:userId/latest-game


## 数据库

使用 redis 数据库

数据库设计：
1. 玩家数据 (Hash)
   - key: `user:{id}`
   - fields: id, name, createTime

2. 排行榜数据 (Sorted Set)
   - key: `score`
   - member: 比赛ID
   - score: 游戏分数

3. 比赛数据 (Hash)
   - key: `game:{id}`
   - fields: 
     - id: 比赛ID
     - userId: 玩家ID
     - score: 分数
     - wave: 波数
     - lives: 剩余生命
     - createTime: 创建时间

4. 玩家比赛记录 (List)
   - key: `user:{id}:games`
   - values: 比赛ID


## 使用 vercel 部署


## 变更日志

1. 增加后端三个接口
   - 提交玩家数据
   - 获取排行榜数据
   - 获取玩家分数对应的排名
2. 增加 redis 数据库
3. 增加前端调用
4. env 环境变量设置
5. 前端接口请求改为 fetch
7. 增加浏览器指纹作为玩家 ID
8. svg 标签改为闭合标签（我这里svg单标签，编辑器会提示错误）
