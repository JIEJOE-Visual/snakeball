<template>
    <div class="rank _fullscreen" :class="{'_hidden':!rank.if_visible.value}">
        <div class="rank_middle _middle_ball">
            <div class="rank_middle_data">
                <p class="_font_2">RANK</p>
                <p class="_font_2">{{players_data.length?players_data[rank.current_index.value].rank:'loading'}}</p>
            </div>
            <div class="rank_middle_data">
                <p class="_font_2">SCORE</p>
                <p class="_font_2">{{players_data.length?players_data[rank.current_index.value].score:'loading'}}</p>
            </div>
            <div class="rank_middle_data">
                <p class="_font_2">LIVES</p>
                <p class="_font_2">{{players_data.length?players_data[rank.current_index.value].lives:'loading'}}</p>
            </div>
            <div class="rank_middle_data">
                <p class="_font_2">WAVE</p>
                <p class="_font_2">{{players_data.length?players_data[rank.current_index.value].wave:'loading'}}</p>
            </div>
            <div class="rank_middle_closebtn" @click="rank.hidden">
                <Closebtn />
            </div>
        </div>
        <div
            class="rank_playerball"
            v-for="index in 15"
            :key="index"
            :class="{'rank_playerball_selected':index==rank.current_index.value+1}"
            :style="{'--r': (15 - 1-index) * 0.8 / 20+1}"
            @click="players_data[index-1] && (rank.current_index.value = index-1);"
        >   
            <p class="rank_playerball_rank _font_5">{{players_data[index-1]?(players_data[index-1].rank > 99?'99+':players_data[index-1].rank):'?'}}</p>
            <p class="rank_playerball_name _font_1">{{players_data[index-1]?players_data[index-1].name:'loading'}}</p>
        </div>
    </div>
</template>

<script setup>
import { global } from "@/stores/global";
import Closebtn from "@/components/ui/closebtn.vue";
import { onMounted, ref } from "vue";
import gsap from "gsap";
import { Engine, Bodies, Composite, Events, Body, Mouse, MouseConstraint } from "matter-js";
const store = global();
const player = store.player;
// 进行排名展示的玩家数据
const players_data = ref([]);
// rank控制对象
const rank = {
    // DOM元素
    container: null,
    balls: null,
    middle: null,
    // matter配置项
    engine: null, //引擎
    world: null, //物理世界
    edges: null, //物理世界里面的所有边界墙
    if_run_engine: false, //是否运行引擎
    //当前被选中展示的玩家index
    current_index: ref(0),
    animater: null, //动画播放器
    if_visible: ref(false), //rank是否可见
    init() {
        this.create_engine();
        this.container = document.querySelector(".rank");
        this.balls = [...document.querySelectorAll(".rank_playerball")];
        this.middle = document.querySelector(".rank_middle");
        window.addEventListener("resize", this.resize.bind(this));
        // 创建中间球体的物理模型
        this.create_bady(this.middle, true);
    },
    // 创建物理引擎
    create_engine() {
        this.engine = Engine.create({
            constraintIterations: 1,
        });
        this.world = this.engine.world;
    },
    // 尺寸改变，重新生成所有物理模型以适配新的尺寸
    resize() {
        // 移除，并重新生成中间球体
        Composite.remove(this.world, this.middle.body, false);
        this.create_bady(this.middle, true);
        //如果没有运行引擎的话，边界和小球是空的，不执行后续内容
        if (!this.if_run_engine) return;
        // 移除，并重新生成边界
        Composite.remove(this.world, this.edges, false);
        this.create_edges();
        // 重新为所有小球绑定物理模型模拟
        this.balls.forEach((ball) => {
            Composite.remove(this.world, ball.body, false); //移除小球的物理模型
            this.create_bady(ball); // 重新生成
        });
    },
    // 创建边界墙
    create_edges() {
        this.edges = [];
        // 获取视口宽高
        const view_width = innerWidth;
        const view_height = innerHeight;
        // 创建视口边界 (下左右)：这里不设置顶部，因为小球会从顶部掉落进来
        this.edges = [
            Bodies.rectangle(view_width / 2, view_height + 5, view_width, 10, {
                isStatic: true,
            }), // 底部
            Bodies.rectangle(-5, view_height / 2, 10, view_height, { isStatic: true }), // 左侧
            Bodies.rectangle(view_width + 5, view_height / 2, 10, view_height, {
                isStatic: true,
            }), // 右侧
        ];
        // 将边界加入到物理世界
        Composite.add(this.world, this.edges);
    },
    // 初始化所有小球
    init_balls() {
        this.balls.forEach((ball, index) => {
            // 所有小球按序号从下往上，从左往右依次排列
            let row = parseInt(index % 4);
            let line = parseInt(index / 4);
            ball.style.left = `${25 * row}%`;
            ball.style.top = `${25 * line}%`;
            // 生成小球的物理模型
            this.create_bady(ball);
        });
    },
    // 生成DOM元素的物理模型body
    create_bady(ele, if_static = false) {
        const rect = ele.getBoundingClientRect();
        const body = Bodies.circle(
            rect.left + rect.width / 2, //x位置
            rect.top + rect.width / 2, //y位置
            rect.width / 2, //半径
            { isStatic: if_static } //球体是否静止:是否可以与其他模型发生碰撞
        );
        //将body和元素绑定，方便直接通过元素控制body
        ele.body = body;
        Composite.add(this.world, body); // 将body加入到物理世界
    },
    // 运行引擎
    run_engine() {
        // 引擎不能自动开关：所以用if_run_engine手动控制引擎开关
        if (!this.if_run_engine) return;
        Engine.update(this.engine); //更新引擎
        // 将body物理模型的物理状态设置到DOM元素上
        this.balls.forEach((ball) => {
            // 小球小于一定速度则停止移动：停止设置transform，释放性能
            if (ball.body.speed <= 0.2) return;
            gsap.set(ball, {
                left: `${ball.body.position.x - ball.offsetWidth / 2}px`,
                top: `${ball.body.position.y - ball.offsetHeight / 2}px`,
                rotate: `${ball.body.angle}deg`,
            });
        });
        requestAnimationFrame(() => {
            this.run_engine();
        });
    },
    // 重置物理引擎和动画样式
    reset() {
        this.world.gravity.y = 1.5; //恢复物理世界重力
        // 重新创建边界墙和所有小球的物理模型
        this.create_edges();
        this.init_balls();
        // 运行引擎
        this.if_run_engine = true;
        this.run_engine();
        gsap.set(this.container, {
            clipPath: "polygon(0% 0%, 100% 0%, 100% 0%, 0% 0%)",
        });
    },
    // 显示rank
    show(immediate) {
        // 动画播放器存在且正在播放动画：不执行函数，否则会因为动画冲突导致BUG
        if (this.animater && this.animater.isActive()) return;
        if (immediate) immediate(); //存在立即执行代码，则立即执行
        this.get_rank_list();
        this.reset(); //重置
        this.if_visible.value = true; //显示rank
        // 播放动画
        this.animater = gsap.to(this.container, {
            clipPath: "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)",
            duration: 1,
            ease: "power3.inOut",
        });
    },
    // 隐藏rank
    hidden() {
        // 动画播放器存在且正在播放动画：不执行函数，否则会因为动画冲突导致BUG
        if (this.animater && this.animater.isActive()) return;
        //  移除底部边界，并加大重力，让所有小球掉下
        Composite.remove(this.engine.world, this.edges, false);
        this.world.gravity.y = innerHeight / 250; //根据屏幕高度设置重力，避免小球掉落太快或者太慢
        // 播放动画
        this.animater = gsap.to(this.container, {
            clipPath: "polygon(0% 100%, 100% 100%, 100% 100%, 0% 100%)",
            duration: 1,
            ease: "power3.inOut",
            onComplete: () => {
                this.if_visible.value = false; //隐藏rank
                this.if_run_engine = false; //停止引擎
                // 移除所有小球的物理模型
                this.balls.forEach((ball) => {
                    Composite.remove(this.engine.world, ball.body, false);
                });
            },
        });
    },
    // 获取所有玩家的排名名单
    get_rank_list() {
        // 更新默认显示的玩家index，默认选中第一名
        this.current_index.value = 0;
        (async () => {
            const response = await (await fetch(`${process.env.VUE_APP_API_URL}/rank`)).json();
            players_data.value = response.data;
            
            // 为所有玩家添加排名参数
            players_data.value.forEach((data, index) => {
                data.rank = index + 1;
            });
            // 如果当前玩家的分数存在的话：查找其分数所对应的排名
            if (player.score !== null) this.get_rank();
        })();
    },
    // 获取玩家分数对应的排名
    get_rank() {
        // 也改为 fetch，因为你上面用的就是 fetch，这里用 xhr 没理由啊
        (async () => {
            const response = await (await fetch(`${process.env.VUE_APP_API_URL}/rank/${player.id}/latest-game`)).json();

            player.rank = response.data.rank;
                // 如果玩家在15名内：则默认选中玩家所对应的小球，优先显示玩家信息
                console.log("🚀 ~ file: rank.vue:233 ~ player.rank:", player.rank)
                if (player.rank <= 15) {
                    this.current_index.value = player.rank - 1;
                } else {
                    // 如果玩家在15名外：则让最后一个小球显示玩家的对应信息
                    console.log("🚀 ~ file: rank.vue:238 ~ players_data.value.length - 1:", players_data.value.length - 1)
                    players_data.value[players_data.value.length - 1] = {
                        name: player.name,
                        rank: player.rank,
                        wave: player.wave,
                        lives: player.lives,
                        score: player.score,
                    };
                    // 同上，优先显示玩家信息
                    this.current_index.value = players_data.value.length - 1;
                }
        })();
    },
};
// 储存全局功能函数
store.show_rank = () => {
    // 这里将按钮音效播放放在show函数内部，是为了避免多次点击而多次播放音效的BUG
    rank.show(() => {
        store.audio_controller.button.play();
    });
};
onMounted(() => {
    rank.init();
});
</script>

<style scoped>
.rank {
    --scale: 1;
    justify-content: center;
    align-items: center;
    background-color: var(--color_back);
    z-index: 1000;
}
.rank_middle {
    flex-direction: column;
    position: absolute;
    align-items: center;
}
.rank_middle_data {
    flex-direction: column;
    align-items: center;
    margin-top: calc(var(--scale) * 3rem);
}
.rank_middle .rank_middle_data:first-child {
    margin-top: var(--margin_ball_y);
}
.rank_middle_data P:nth-child(1) {
    color: var(--color_gray);
}
.rank_middle_data P:nth-child(2) {
    color: var(--color_back);
}
.rank_middle_closebtn {
    position: absolute;
    bottom: var(--margin_ball_y);
}
.rank_playerball {
    flex-direction: column;
    position: absolute;
    justify-content: center;
    align-items: center;
    width: calc(var(--scale) * 25rem * var(--r));
    height: calc(var(--scale) * 25rem * var(--r));
    border-radius: 50%;
    background-color: var(--color_gray);
    overflow: hidden;
    transition: background-color 0.5s var(--ease_out);
    cursor: pointer;
}
.rank_playerball p {
    color: var(--color_back);
    transition: color 0.5s var(--ease_out);
}
.rank_playerball_rank {
    font-family: title;
    line-height: calc(var(--scale) * 13rem);
}

@media (hover: hover) {
    .rank_playerball:hover p {
        color: var(--color_front);
    }
}
.rank_playerball_selected {
    background-color: var(--color_front);
}
@media (hover: hover) {
    .rank_playerball_selected:hover p {
        color: var(--color_back);
    }
}
</style>