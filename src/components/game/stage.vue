<template>
    <svg id="stage" class="_fullscreen" ></svg>
    <Resettip ref="resettip" />
    <Readytips ref="readytips" />
    <Summary ref="summary" />
    <Databox />
</template>

<script setup>
import { global } from "@/stores/global";
import Resettip from "@/components/game/resettip.vue";
import Readytips from "@/components/game/readytips.vue";
import Summary from "@/components/game/summary.vue";
import Databox from "@/components/game/databox.vue";
import { onMounted, ref } from "vue";
import gsap from "gsap";
import forge from "node-forge";
const store = global();
const player = store.player;
const audio_controller = store.audio_controller;
// 组件
const readytips = ref(null);
const summary = ref(null);
const resettip = ref(null);
//游戏舞台SVG
let stage;
let scale_stander; //缩放标准系数：用于让舞台在不同尺寸的屏幕上保持一致的大小
function resize() {
    // 缩放系数以最短边来计算
    scale_stander = innerWidth <= innerHeight ? innerWidth / 1000 : innerHeight / 1000;
    stage.setAttribute("viewBox", `0 0 ${innerWidth} ${innerHeight}`);
    snakeball.resize();
}
// 闪烁：目标元素改变颜色，短时间后回复
function flicker(ball, color) {
    gsap.timeline()
        .set(ball, {
            fill: color,
        })
        .set(
            ball,
            {
                fill: "",
            },
            "<0.5"
        );
}
// snakeball控制对象
const snakeball = {
    balls: [], //所有的头部/身体svg元素
    // 头部的参考半径/实际半径：用参考半径是为了让snakeball适应不同的屏幕尺寸
    head_radius: {
        ref: 12,
        act: 0,
    },
    // 身体部分的参考半径/实际半径
    body_radius: {
        ref: 6,
        act: 0,
    },
    // 起始xy位置:设置为屏幕左上方外部
    start_x: -20,
    start_y: -20,
    // 水平方向移动距离：用于控制snakeball在水平方向的身体朝向
    distance_x: 0,
    // 移动时间
    duration: {
        smooth: [0, 0.3], //顺滑的移动值区间
        unsmooth: [0.7, 1], //不顺滑的移动值区间
        default: 0.1, //默认值
        act: 0, //实际值
    },
    // 身体的延迟移动间隔时间
    delay: {
        smooth: [0.05, 0.25],
        // delay的不顺滑值有两段，过快或者过慢都会影响玩家的操纵
        unsmooth: [
            [0, 0.01],
            [0.3, 0.5],
        ],
        default: 0.05,
        act: 0,
    },
    // 每一次reset能够顺滑操控snakeball的概率值：获得顺滑duration和delay的概率
    smooth_prob: 0.85,
    // 重置器
    reseter: {
        timer: null, //定时器
        max: 7000, //最长重置间隔时间
        min: 3000, //最短重置间隔时间
        // 启动重置器
        run() {
            this.stop();
            // 设置随机时间触发reset
            this.timer = setTimeout(
                snakeball.reset.bind(snakeball),
                Math.random() * (this.max - this.min) + this.min
            );
        },
        // 停止重置器
        stop() {
            clearTimeout(this.timer);
        },
    },
    resize() {
        // 重新计算头部和身体的实际半径
        this.head_radius.act = this.head_radius.ref * scale_stander;
        this.body_radius.act = this.body_radius.ref * scale_stander;
        // 如果snakeball已经创建，则更改全部半径
        if (!this.balls.length) return;
        this.balls.forEach((ball, index) => {
            if (index === 0) ball.setAttribute("r", this.head_radius.act);
            else ball.setAttribute("r", this.body_radius.act);
        });
    },
    // 创建snakeball
    create(lives) {
        this.balls = []; //清空所有ball
        // 根据当前生命值创建snakeball
        for (let i = 0; i < lives + 1; i++) {
            this.create_ball(i === 0 ? "head" : "body");
        }
        // 设置默认duration和delay
        this.duration.act = this.duration.default;
        this.delay.act = this.delay.default;
        this.bind_events(); // 绑定事件
        // 将snakeball移动到屏幕中间，即使玩家未移动鼠标
        this.move(innerWidth / 2, innerHeight / 2);
    },
    // 绑定事件:鼠标/手指移动、可以操控snakeball移动
    bind_events() {
        stage.onmousemove = (e) => {
            this.move(e.x, e.y);
        };
        stage.ontouchmove = (e) => {
            this.move(e.touches[0].clientX, e.touches[0].clientY);
        };
    },
    // 创建小球元素：snakeball的头/身体部分
    create_ball(type) {
        let ball = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        // 计算xy坐标：用pos_x，pos_y储存位置信息，方便后续不使用DOM方式查找
        ball.pos_x = this.start_x + this.balls.length * this.body_radius.act;
        ball.pos_y = this.start_y;
        // 设置对应DOM属性
        ball.setAttribute("fill", "var(--color_front)");
        ball.setAttribute("cx", ball.pos_x);
        ball.setAttribute("cy", ball.pos_y);
        ball.setAttribute("r", type === "head" ? this.head_radius.act : this.body_radius.act);
        // 将ball添加到stage和balls数组
        stage.appendChild(ball);
        this.balls.push(ball);
        return ball;
    },
    // 移动snakeball
    move(x, y) {
        let direction_x = x - this.start_x - this.distance_x; //snakeball的水平x轴移动方向
        this.distance_x = x - this.start_x; //更新distance_x
        this.balls.forEach((ball, index) => {
            //计算snakeball的x方向移动距离
            x = this.start_x + index * this.body_radius.act + this.distance_x;
            // 根据移动方向调整身体位置：无论蛇头朝向哪个水平方向，身体总是在蛇头的后面
            if (direction_x > 0 && index !== 0) x -= 2 * index * this.body_radius.act;
            // 移动
            this.set_location(ball, x, y, index);
        });
    },
    // 设置ball的xy坐标位置
    set_location(ball, x, y, index) {
        gsap.to(ball, {
            pos_x: x,
            pos_y: y,
            cx: x,
            cy: y,
            duration: this.duration.act,
            ease: "linear",
            delay: index * this.delay.act,
        });
    },
    // 重置snakeball的移动速度、身体延迟移动间隔、以及重置周期
    reset() {
        //播放reset动画和声音
        resettip.value.reset();
        audio_controller.reset.play();
        // 重置duration
        let if_duration_smooth = Math.random() < this.smooth_prob ? "smooth" : "unsmooth";
        this.duration.act =
            Math.random() *
                (this.duration[if_duration_smooth][1] - this.duration[if_duration_smooth][0]) +
            this.duration[if_duration_smooth][0];
        // 重置delay
        if (Math.random() < this.smooth_prob) {
            // 设置delay为顺滑
            this.delay.act =
                Math.random() * (this.delay.smooth[1] - this.delay.smooth[0]) +
                this.delay.smooth[0];
        } else {
            // 设置delay为不顺滑
            let index = Math.random() >= 0.5 ? 0 : 1; //随机取过快或过慢区间
            this.delay.act =
                Math.random() * (this.delay.unsmooth[index][1] - this.delay.unsmooth[index][0]) +
                this.delay.unsmooth[index][0];
        }
        // 重置reseter
        this.reseter.run();
    },
    // 获得生命值
    get_lives() {
        flicker(this.balls, "#0ee515"); // 闪烁颜色
        this.create_ball("body"); // 添加新的身体元素
        player.lives++; //生命值增加
    },
    // 失去生命值
    lost_lives() {
        flicker(this.balls, "#e3d80f"); // 闪烁颜色
        // 移除stage以及数组中的ball元素
        stage.removeChild(this.balls[this.balls.length - 1]);
        this.balls.pop();
        player.lives--; //生命值减少
        // 如果生命值小于等于0，则触发游戏失败事件
        if (player.lives <= 0) game_controler.over(false);
    },
    // 摧毁，清除snakeball
    remove() {
        // 移除鼠标事件
        stage.onmousemove = stage.ontouchmove = null;
        // 播放snakeball爆炸动画：这里不清除是因为再开始游戏的时候、会直接清空stage
        gsap.to(this.balls, {
            fill: "#e3d80f",
            stroke: "#dc1130",
            strokeWidth: this.body_radius.act / 5, //这里用半径计算线条宽度、是为了不让其受屏幕尺寸影响
            r: 2 * this.body_radius.act,
            opacity: 0,
            duration: 0.6,
            ease: "power3.out",
            stagger: 0.01,
        });
    },
    // 改变snakeball的颜色，恢复颜色后、执行后续功能
    change_color(color, duration, next) {
        gsap.timeline()
            .set(this.balls, {
                fill: color,
            })
            .set(
                this.balls,
                {
                    fill: "",
                    onComplete: () => {
                        if (next) next(); //存在后续功能，则执行
                    },
                },
                `<${duration}` //duration时间后、恢复颜色
            );
    },
};
// 子弹球
class bulletball {
    constructor(r, pos_x, pos_y, speed_x, speed_y, type, color) {
        this.r = r; //子弹球半径
        this.pos_x = pos_x; // x位置
        this.pos_y = pos_y; // y位置
        this.speed_x = speed_x; //x方向移动速度
        this.speed_y = speed_y; //y方向移动速度
        this.type = type; //子弹球类型
        this.color = color; //子弹球颜色
        this.move_timer = null; //移动定时器
        this.ball = null; ///DOM元素、SVG
        this.if_removed = false; //是否被移除：用于防止子弹球被多次移除导致BUG
    }
    // 创建子弹球
    create() {
        this.ball = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        // 设置对应DOM属性
        this.ball.setAttribute("cx", this.pos_x);
        this.ball.setAttribute("cy", this.pos_y);
        this.ball.setAttribute("r", this.r);
        this.ball.setAttribute("fill", this.color);
        // 添加到stage
        stage.appendChild(this.ball);
        // 启动移动定时器：移动子弹球
        this.move_timer = setInterval(this.move.bind(this), 30);
    }
    // 移动子弹球
    move() {
        // 更新xy位置
        this.pos_x += this.speed_x;
        this.pos_y += this.speed_y;
        // 移动子弹球
        gsap.set(this.ball, {
            cx: this.pos_x,
            cy: this.pos_y,
        });
        // 每次移动后，检测是否发生撞击
        this.check_crash();
    }
    // 检测是否与snakeball发生了撞击
    check_crash() {
        for (let i = 0; i < snakeball.balls.length; i++) {
            // 计算到snakeball的头/身体的xy距离
            let distance_x = this.pos_x - snakeball.balls[i].pos_x;
            let distance_y = this.pos_y - snakeball.balls[i].pos_y;
            // 如果撞到了头部:
            if (
                i === 0 &&
                Math.abs(distance_x) <= snakeball.head_radius.act + this.r &&
                Math.abs(distance_y) <= snakeball.head_radius.act + this.r
            )
                // 触发撞击头的事件函数
                return this.crash_head(this);
            // 如果撞到了身体部分:
            else if (
                i !== 0 &&
                Math.abs(distance_x) <= snakeball.body_radius.act + this.r &&
                Math.abs(distance_y) <= snakeball.body_radius.act + this.r
            )
                // 触发撞击身体部分的事件函数;
                return this.crash_body(this);
        }
        // 如果子弹球移出界面范围，则直接被移除
        if (
            this.pos_x > innerWidth + this.r ||
            this.pos_x < -this.r ||
            this.pos_y > innerHeight + this.r ||
            this.pos_y < -this.r
        )
            return this.remove();
    }
    // 碰撞到snakeball头部
    crash_head(ball) {
        player.score += launcher.types[this.type].score; //获得对应的分数
        this.remove(); // 子弹球直接被移除
        let trigger_head = launcher.types[this.type].trigger_head.bind(this); //触发撞击头部的事件函数
        return trigger_head();
    }
    // 碰撞到snakeball身体部分
    crash_body(ball) {
        player.score += launcher.types[this.type].score; //获得对应的分数
        this.destroy(); // 子弹球爆炸摧毁并被移除
        let trigger_body = launcher.types[this.type].trigger_body.bind(this); //触发撞击身体的事件功能
        return trigger_body();
    }
    // 摧毁子弹球
    destroy() {
        this.if_removed = true; //标记被移除
        clearInterval(this.move_timer); //清除移动定时器
        // 随机播放爆炸音效
        audio_controller.blasts[parseInt(Math.random() * audio_controller.blasts.length)].play();
        // 播放爆炸动画
        gsap.to(this.ball, {
            fill: "#e3d80f",
            stroke: "#dc1130",
            strokeWidth: this.r / 5,
            r: 2 * this.r,
            opacity: 1, //恢复透明度：小球爆炸时可能在隐身状态，但是需要其爆炸可以被看到
            duration: 0.3,
            ease: "power3.out",
            onComplete: () => {
                this.remove(); // 动画完成之后,再移除子弹球
            },
        });
    }
    // 移除子弹球
    remove() {
        this.if_removed = true; //标记被移除
        clearInterval(this.move_timer); //清除移动定时器
        // 从stage和launcher中移除子弹球
        stage.removeChild(this.ball);
        delete launcher.balls[this.index];
    }
}
// 炮台：子弹球发射器
const launcher = {
    // 所有种类的子弹球
    types: {
        // 火球：碰撞到头部失去一条生命值
        fireball: {
            type: "fireball",
            r: 6, //参考半径
            color: " #dc1130", //颜色
            score: 1, //碰撞所获得的得分
            prob: 0, //发射该子弹球的概率
            // 碰到头部触发的事件
            trigger_head() {
                audio_controller.warn.play(); //播放警示音效
                snakeball.lost_lives(); //snakeball失去一条生命
            },
            // 碰到身体部分触发的事件
            trigger_body() {},
        },
        // 医药球：碰撞到头部增加一条生命值
        medicineball: {
            type: "medicineball",
            r: 12,
            color: " #0ee515",
            score: 3,
            prob: 0.85,
            trigger_head() {
                audio_controller.buff.play(); //播放增益效果音效
                snakeball.get_lives(); //snakeball获得一条生命
            },
            trigger_body() {},
        },
        // 冷冻球
        frozenball: {
            type: "frozenball",
            r: 10,
            color: " #16b7df",
            score: 5,
            prob: 0.95,
            // 短时间内，减速屏幕内所有子弹球
            trigger_head() {
                audio_controller.buff.play(); //播放增益效果音效
                Object.values(launcher.balls).forEach((ball) => {
                    flicker(ball.ball, "#16b7df"); // 闪烁子弹球颜色
                    // 减慢子弹球速度
                    ball.speed_x /= 20;
                    ball.speed_y /= 20;
                    // 一段时间后减速失效
                    setTimeout(() => {
                        ball.speed_x *= 20;
                        ball.speed_y *= 20;
                    }, 1000);
                });
            },
            // 冰冻减速snakeball
            trigger_body() {
                // 判断是否在冰冻生效时间中：临时储存snakeball的duration和delay
                if (!launcher.types["frozenball"].if_effected) {
                    launcher.types["frozenball"].if_effected = true;
                    launcher.types["frozenball"].tem_duration = snakeball.duration.act;
                    launcher.types["frozenball"].tem_delay = snakeball.delay.act;
                } else {
                    // 储存并清除定时器：防止多次触发、定时器堆叠导致效果时长不够
                    if (launcher.types["frozenball"].timer)
                        clearTimeout(launcher.types["frozenball"].timer);
                }
                // 设置最大延迟的duration和delay: 使snakeball移动变慢;
                snakeball.duration.act = snakeball.duration.unsmooth[1];
                snakeball.delay.act = snakeball.delay.unsmooth[1][1];
                // 标识颜色
                gsap.set(snakeball.balls, {
                    fill: "#16b7df",
                });
                // 短时间后，恢复原始发射频率
                launcher.types["frozenball"].timer = setTimeout(() => {
                    launcher.types["frozenball"].if_effected = false;
                    // 恢复duration和delay
                    snakeball.duration.act = launcher.types["frozenball"].tem_duration;
                    snakeball.delay.act = launcher.types["frozenball"].tem_delay;
                    // 恢复颜色
                    gsap.set(snakeball.balls, {
                        fill: "",
                    });
                }, 800);
            },
        },
        // 伸缩球
        scaleball: {
            type: "scaleball",
            r: 15,
            color: " #a37e22",
            score: 5,
            prob: 0.96,
            // 短时间内，snakeball半径变小，不容易撞到子弹球
            trigger_head() {
                audio_controller.buff.play(); //播放增益效果音效
                // 缩小snakeball半径
                snakeball.head_radius.act = (snakeball.head_radius.ref * scale_stander) / 2;
                snakeball.body_radius.act = (snakeball.body_radius.ref * scale_stander) / 2;
                // 设置snakeball颜色和半径
                gsap.set(snakeball.balls, {
                    fill: "#a37e22",
                    r: (i) => {
                        return i === 0 ? snakeball.head_radius.act : snakeball.body_radius.act;
                    },
                });
                // 储存并清除定时器：防止多次触发、定时器堆叠导致效果时长不够
                if (launcher.types["scaleball"].timer)
                    clearTimeout(launcher.types["scaleball"].timer);
                // 一段时间后，恢复颜色和正常大小
                launcher.types["scaleball"].timer = setTimeout(() => {
                    snakeball.head_radius.act = snakeball.head_radius.ref * scale_stander;
                    snakeball.body_radius.act = snakeball.body_radius.ref * scale_stander;
                    gsap.set(snakeball.balls, {
                        fill: "",
                        r: "",
                    });
                }, 3000);
            },
            // 界面范围内的所有子弹球变成原来的三倍大
            trigger_body() {
                Object.values(launcher.balls).forEach((ball) => {
                    // 限制子弹球最大为原来半径的9倍，防止该函数多次被触发，子弹球变得过大
                    if (ball.r / launcher.types[ball.type].r / scale_stander >= 9) return;
                    ball.r *= 3;
                    // 更改子弹球半径
                    gsap.set(ball.ball, {
                        r: ball.r,
                    });
                    flicker(ball.ball, "#a37e22"); // 闪烁子弹球颜色
                });
            },
        },
        // 分裂球
        splitball: {
            type: "splitball",
            r: 12,
            color: " #ef7706",
            score: 5,
            prob: 0.96,
            // 分裂一条相同长度的snakeball，与玩家同步运动
            trigger_head() {
                audio_controller.buff.play(); //播放增益效果音效
                let tem_lives = player.lives; //暂存生命，方便后续移除对应生命值
                // 创建新增身体，并设置新增部分颜色
                for (let i = 0; i < tem_lives; i++) {
                    let ball = snakeball.create_ball("body");
                    gsap.set(ball, {
                        fill: "#ef7706",
                    });
                }
                // 修改移动方法：使新增身体分裂位移
                snakeball.set_location = (ball, x, y, index) => {
                    // 设置新增身体与原位置偏移
                    let add_x = (parseInt(index / (player.lives + 1)) * innerWidth) / 8;
                    let add_y = (parseInt(index / (player.lives + 1)) * innerHeight) / 8;
                    gsap.to(ball, {
                        pos_x: x + add_x,
                        pos_y: y + add_y,
                        cx: x + add_x,
                        cy: y + add_y,
                        duration: snakeball.duration.act,
                        ease: "linear",
                        delay: (index % (player.lives + 1)) * snakeball.delay.act,
                    });
                };
                // 一段时间后恢复
                setTimeout(() => {
                    // 移除新增的身体
                    for (let i = 0; i < tem_lives; i++) {
                        stage.removeChild(snakeball.balls[snakeball.balls.length - 1]);
                        snakeball.balls.pop();
                    }
                    // 恢复移动方法：这里不能临时储存方法然后替换回去，如果多次触发的话，会出BUG
                    snakeball.set_location = (ball, x, y, index) => {
                        gsap.to(ball, {
                            pos_x: x,
                            pos_y: y,
                            cx: x,
                            cy: y,
                            duration: snakeball.duration.act,
                            ease: "linear",
                            delay: index * snakeball.delay.act,
                        });
                    };
                }, 3000);
            },
            // 在爆炸处分裂火球
            trigger_body() {
                // 生成随机数个火球
                for (let i = 0; i < Math.random() * 10 + 10; i++) {
                    // 每一次爆炸，必分裂出一个分裂球
                    let type = i === 0 ? "splitball" : "fireball";
                    // 设置对应属性
                    let r = launcher.types[type].r * scale_stander;
                    let color = launcher.types[type].color;
                    let pos_x = this.pos_x;
                    let pos_y = this.pos_y;
                    let speed_x = (Math.random() - 0.5) * 2 * launcher.max_speed * scale_stander;
                    let speed_y = (Math.random() - 0.5) * 2 * launcher.max_speed * scale_stander;
                    // 生成子弹球对象
                    let ball = new bulletball(r, pos_x, pos_y, speed_x, speed_y, type, color);
                    // 将子弹球用index标记，并储存到balls，方便查找
                    ball.index = launcher.index;
                    launcher.balls[launcher.index] = ball;
                    // 创建子弹球
                    ball.create();
                    launcher.index++;
                }
            },
        },
        // 磁力球
        magneticball: {
            type: "magneticball",
            r: 15,
            color: " #113ede",
            score: 8,
            prob: 0.985,
            // 界面内范围内的所有子弹球、全部移向snakeball的头部位置
            trigger_head() {
                audio_controller.buff.play(); //播放增益效果音效
                Object.values(launcher.balls).forEach((ball) => {
                    // 计算随机更新子弹球的速度，30毫秒是子弹球移动频率
                    ball.speed_x = (this.pos_x - ball.pos_x) / 30 / (Math.random() * 0.5 + 1);
                    ball.speed_y = (this.pos_y - ball.pos_y) / 30 / (Math.random() * 0.5 + 1);
                    flicker(ball.ball, "#113ede"); // 闪烁子弹球颜色
                });
            },
            // snakeball被吸到磁力球爆炸的位置
            trigger_body() {
                // 移除鼠标事件:短时间内无法操控snakeball
                stage.onmousemove = null;
                stage.ontouchmove = null;
                // 移动snakeball到子弹球爆炸位置
                snakeball.move(this.pos_x, this.pos_y);
                // 一段时间后恢复
                snakeball.change_color("#113ede", 1, () => {
                    // 重新绑定事件，可再次操控snakeball
                    snakeball.bind_events();
                });
            },
        },
        // 影子球
        shadowball: {
            type: "shadowball",
            r: 10,
            color: " #9f4df0",
            score: 8,
            prob: 0.985,
            // 短时间内、让与snakeball碰撞的子弹球、瞬移到snakeball头的周围并减速
            trigger_head() {
                audio_controller.buff.play(); //播放增益效果音效
                // 更改子弹球身体碰撞方法
                bulletball.prototype.crash_body = (ball) => {
                    if (ball.type != "fireball") {
                        // 非火球则移动到snakeball头部的位置周围
                        ball.pos_x = snakeball.balls[0].pos_x + Math.random() * 200 - 100;
                        ball.pos_y = snakeball.balls[0].pos_y + Math.random() * 200 - 100;
                        // 减速
                        ball.speed_x /= 5;
                        ball.speed_y /= 5;
                        flicker(ball.ball, "#9f4df0"); // 闪烁子弹球颜色
                    } else {
                        // 是火球则正常加分
                        player.score += launcher.types[ball.type].score;
                        ball.destroy();
                    }
                };
                // 标识snakeball颜色
                gsap.set(snakeball.balls, {
                    fill: "#9f4df0",
                });
                // 储存并清除定时器：防止多次触发、定时器堆叠导致效果时长不够
                if (launcher.types["shadowball"].timer)
                    clearTimeout(launcher.types["shadowball"].timer);
                // 一段时间后恢复
                launcher.types["shadowball"].timer = setTimeout(() => {
                    // 恢复身体碰撞方法:这里不能临时储存方法然后替换回去，如果多次触发的话，会出BUG
                    bulletball.prototype.crash_body = (ball) => {
                        player.score += launcher.types[ball.type].score;
                        ball.destroy();
                        let trigger_body = launcher.types[ball.type].trigger_body.bind(ball);
                        return trigger_body();
                    };
                    gsap.set(snakeball.balls, {
                        fill: "",
                    });
                }, 3000);
            },
            // 短时间后、让所有子弹球随机改变位置
            trigger_body() {
                // 设置颜色预警
                Object.values(launcher.balls).forEach((ball) => {
                    gsap.set(ball.ball, {
                        fill: "#9f4df0",
                    });
                });
                // 一段时间后,随机设置所有子弹球位置
                setTimeout(() => {
                    Object.values(launcher.balls).forEach((ball) => {
                        // 恢复颜色
                        gsap.set(ball.ball, {
                            fill: "",
                        });
                        // 随机子弹球设置xy位置
                        ball.pos_x = Math.random() * innerWidth;
                        ball.pos_y = Math.random() * innerHeight;
                    });
                }, 500);
            },
        },
        // 隐身球
        invisibleball: {
            type: "invisibleball",
            r: 15,
            color: " #808080",
            score: 10,
            prob: 0.985,
            // 短时间内让snakeball隐身，无法碰撞到子弹球
            trigger_head() {
                audio_controller.buff.play(); //播放增益效果音效
                // 临时储存check_crash方法，方便后续替换回去，这里可以用临时储存的方法，因为不存在多次触发的情况
                let tem_check_crash = bulletball.prototype.check_crash;
                // 移除子弹球的撞击检测方法：让子弹球无法撞击snakeball
                bulletball.prototype.check_crash = () => {};
                // 设置snakeball半透明
                gsap.set(snakeball.balls, {
                    opacity: 0.5,
                });
                // 一段时间后恢复
                setTimeout(() => {
                    // 恢复子弹球撞击检测
                    bulletball.prototype.check_crash = tem_check_crash;
                    // 如果游戏还在进行中：则恢复snakeball透明度
                    if (game_controler.if_gaming)
                        gsap.set(snakeball.balls, {
                            opacity: 1,
                        });
                }, 3000);
            },
            // 短时间内让所有子弹球隐身
            trigger_body() {
                // 设置所有子弹球透明度为0
                Object.values(launcher.balls).forEach((ball) => {
                    gsap.to(ball.ball, {
                        opacity: 0,
                        duration: 0.5,
                        ease: "power3.out",
                    });
                });
                // 储存并清除定时器：防止多次触发，造成子弹球闪烁以及隐身时长不够
                if (launcher.types["invisibleball"].timer)
                    clearTimeout(launcher.types["invisibleball"].timer);
                // 一段时间后，撤销隐身效果
                launcher.types["invisibleball"].timer = setTimeout(() => {
                    // 如果游戏还在进行中：恢复所有子弹球透明度
                    if (game_controler.if_gaming)
                        Object.values(launcher.balls).forEach((ball) => {
                            gsap.to(ball.ball, {
                                opacity: 1,
                                duration: 0.5,
                                ease: "power3.out",
                            });
                        });
                }, 3000);
            },
        },
        // 信号球
        signalball: {
            type: "signalball",
            r: 8,
            color: " #ea4fc0",
            score: 20,
            prob: 0.99,
            // 短时间内生成大量身体，但不增加生命，一段时间后恢复
            trigger_head() {
                audio_controller.buff.play(); //播放增益效果音效
                // 使snakeball有一个顺滑的操控
                snakeball.duration.act = snakeball.duration.default;
                snakeball.delay.act = 0.02;
                // 创建身体
                for (let i = 0; i < 50; i++) {
                    snakeball.create_ball("body");
                }
                // 标识snakeball颜色，一段时间后恢复
                snakeball.change_color("#ea4fc0", 3, () => {
                    // 移除新增的身体，恢复颜色
                    for (let i = 0; i < 50; i++) {
                        stage.removeChild(snakeball.balls[snakeball.balls.length - 1]);
                        snakeball.balls.pop();
                    }
                });
            },
            // 短时间内，涌出大量子弹球
            trigger_body() {
                // 重置launcher的定时器，设置发射频率极高
                clearInterval(launcher.timer);
                launcher.timer = setInterval(launcher.launch.bind(launcher), 1);
                // 设置在大量发射子弹球的时间段里面、不再发射信号球，避免造成超多子弹球，极易让玩家死亡
                launcher.types["signalball"].prob = 2;
                // 储存并清除定时器：防止多次触发、定时器堆叠导致效果时长不够
                if (launcher.types["signalball"].timer)
                    clearTimeout(launcher.types["signalball"].timer);
                // 短时间后，恢复原始发射频率
                launcher.types["signalball"].timer = setTimeout(() => {
                    // 恢复信号球发射概率
                    launcher.types["signalball"].prob = 0.99;
                    clearInterval(launcher.timer);
                    // 如果游戏还在进行中：用原频率重新启动炮台，这里一定要确定游戏还在进行，否则会出BUG
                    if (game_controler.if_gaming)
                        launcher.timer = setInterval(
                            launcher.launch.bind(launcher),
                            launcher.frequency
                        );
                }, 800);
            },
        },
        // 核弹球
        hball: {
            type: "hball",
            r: 30,
            color: " #046312",
            score: 50,
            prob: 0.995,
            // 界面范围内所有子弹球爆炸，并获取对应得分
            trigger_head() {
                audio_controller.buff.play(); //播放增益效果音效
                Object.values(launcher.balls).forEach((ball) => {
                    player.score += launcher.types[ball.type].score;
                    if (!ball.if_removed) ball.destroy();
                });
            },
            // 直接丢失5条生命值
            trigger_body() {
                audio_controller.warn.play(); //播放警示音效
                for (let i = 0; i <= 5; i++) {
                    // 如果玩家已经死亡：则不执行，否则会报错
                    if (player.lives > 0) snakeball.lost_lives();
                }
            },
        },
    },
    balls: {}, //所有的子弹球：这里用对象储存以方便查找指定子弹球
    index: 0, //计数：用于查找子弹球
    frequency: 250, //发射频率
    max_speed: 10, //子弹球本局游戏最高可达的移动速度
    timer: null, //发射定时器
    // 运行launcher
    run() {
        // 更新所有子弹球和index
        this.balls = {};
        this.index = 0;
        // 开启定时器，发射子弹球
        this.timer = setInterval(this.launch.bind(this), this.frequency);
    },
    // 发射子弹球
    launch() {
        let r, pos_x, pos_y, speed_x, speed_y, type, color;
        // 设置随机种类的子弹球
        Object.values(this.types).forEach((ball) => {
            if (Math.random() > ball.prob) return (type = ball.type);
        });
        r = this.types[type].r * scale_stander;
        color = this.types[type].color;
        // 设置子弹球从界面外部的进入方向
        let direction = Math.floor(Math.random() * 4);
        switch (direction) {
            case 0: // 从左侧进入
                pos_x = -r; // 球的初始位置在视图左侧外
                speed_x = Math.random() * this.max_speed * scale_stander + 1; // 速度向右
                pos_y = Math.random() * innerHeight; // 随机垂直位置
                speed_y = (Math.random() - 0.5) * 2 * this.max_speed * scale_stander; // 随机垂直速度，可以是向上或向下
                break;
            case 1: // 从右侧进入
                pos_x = innerWidth + r; // 球的初始位置在视图右侧外
                speed_x = Math.random() * -this.max_speed * scale_stander - 1; // 速度向左
                pos_y = Math.random() * innerHeight; // 随机垂直位置
                speed_y = (Math.random() - 0.5) * 2 * this.max_speed * scale_stander; // 随机垂直速度，可以是向上或向下
                break;
            case 2: // 从上方进入
                pos_y = -r; // 球的初始位置在视图上方外
                speed_y = Math.random() * this.max_speed * scale_stander + 1; // 速度向下
                pos_x = Math.random() * innerWidth; // 随机水平位置
                speed_x = (Math.random() - 0.5) * 2 * this.max_speed * scale_stander; // 随机水平速度，可以是向左或向右
                break;
            case 3: // 从下方进入
                pos_y = innerHeight + r; // 球的初始位置在视图下方外
                speed_y = Math.random() * -this.max_speed * scale_stander - 1; // 速度向上
                pos_x = Math.random() * innerWidth; // 随机水平位置
                speed_x = (Math.random() - 0.5) * 2 * this.max_speed * scale_stander; // 随机水平速度，可以是向左或向右
                break;
        }
        // 生成子弹球对象
        let ball = new bulletball(r, pos_x, pos_y, speed_x, speed_y, type, color);
        // 将子弹球用index标记，并储存到balls，方便查找
        ball.index = this.index;
        this.balls[this.index] = ball;
        // 创建子弹球
        ball.create();
        this.index++;
    },
    // 摧毁所有子弹球
    destroy() {
        clearInterval(this.timer); //清除发射定时器
        // 这里只给所有子弹球播放爆炸动画、而不清除，是因为后面再次游戏时，会直接清除整个stage
        Object.values(this.balls).forEach((ball) => {
            clearInterval(ball.move_timer);
            gsap.to(ball.ball, {
                fill: "#e3d80f",
                stroke: "#dc1130",
                strokeWidth: ball.r / 5, //这里用半径计算线条宽度、是为了不让其受屏幕尺寸影响
                r: 2 * ball.r,
                opacity: 0,
                duration: 0.3,
                ease: "power3.out",
            });
        });
    },
};
// 游戏控制器
const game_controler = {
    // wave关卡控制器
    waver: {
        timer: null, //定时器
        default_time: 40, //每一关的默认时长
    },
    initial_lives: 20, //玩家的初始生命值
    if_gaming: false, //是否在进行游戏中
    // 创建关卡：一般关卡会在游戏正式开始之前创建
    create_wave() {
        stage.innerHTML = ""; //清空游戏舞台
        // 如果玩家未激活：已死亡/首次创建
        if (!player.if_active) {
            // 设置默认玩家信息
            player.if_active = true; //激活玩家
            player.wave = player.rank = player.score = 0;
            player.lives = this.initial_lives;
        }
        this.upgrade(); //升级游戏：设置关卡难度参数
        player.time = this.waver.default_time; //重置游戏时间
        snakeball.create(player.lives); //创建snakeball
    },
    // 正式开始游戏
    start() {
        this.if_gaming = true;
        audio_controller.gameing.play(); //播放游戏音乐
        snakeball.reseter.run(); //启动reseter：开始周期重置snakeball
        launcher.run(); //开始发射子弹球
        // 开启waver：进行倒计时，倒计时完成、则结束关卡
        this.waver.timer = setInterval(() => {
            player.time--;
            // 倒计时结束，并且玩家未死亡：游戏关卡胜利
            if (player.time <= 0 && player.if_active) this.over(true);
        }, 1000);
    },
    // 游戏结束
    over(if_win) {
        this.if_gaming = false;
        this.post(); //提交玩家数据
        this.clean(); //清扫游戏舞台
        // 停止游戏音乐、并播放大厅音乐
        audio_controller.gameing.stop();
        audio_controller.hall.play();
        audio_controller.hall.fade(0, 1, 9000);
        //显示总结面板
        summary.value.show();
        // 游戏关卡胜利
        if (if_win) audio_controller.win.play();
        // 游戏关卡失败
        else {
            audio_controller.fail.play();
            // 设置玩家未激活：即死亡，并归零游戏时间
            player.if_active = false;
            player.time = 0;
        }
    },
    // 清扫游戏舞台
    clean() {
        clearInterval(this.waver.timer);
        launcher.destroy();
        snakeball.remove();
        snakeball.reseter.stop();
    },
    // 升级
    upgrade() {
        player.wave++;
        // 升级频率: 频率范围为250-40，增长速度为曲线，先快后慢、最后平稳
        launcher.frequency = 40 + (250 - 40) * Math.exp(-0.08 * player.wave);
        // 升级速度: 速度范围为10-25，增长速度同上
        launcher.max_speed = 10 + (25 - 10) * (1 - Math.exp(-0.08 * player.wave));
        // 加快游戏音乐，音乐速度范围为1-2
        audio_controller.gameing.rate(1 + (2 - 1) * (1 - Math.exp(-0.08 * player.wave)));
    },
    // 提交玩家数据
    post() {
        let data = {
            id: player.id,
            name: player.name,
            wave: player.wave,
            lives: player.lives,
            score: player.score,
        };
        // RAS加密
        const public_key = forge.pki.publicKeyFromPem(process.env.VUE_APP_RSA_PUBLIC_KEY);
        // 生成加密数据
        const encrypted_data = public_key.encrypt(JSON.stringify(data), "RSA-OAEP", {
            md: forge.md.sha256.create(),
        });
        // 将加密数据转换为Base64
        const encrypted_base64 = forge.util.encode64(encrypted_data);
        // 发送数据，改为fetch
        fetch(`${process.env.VUE_APP_API_URL}/score`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ encrypted_data: encrypted_base64 }),
        })
    },
};
// 储存全局功能函数
store.ready_to_game = () => {
    // 在准备提示出现前，就创建关卡、可以看到snakeball。准备提示结束之后，才正式开始游戏
    readytips.value.ready(
        game_controler.create_wave.bind(game_controler),
        game_controler.start.bind(game_controler)
    );
};
onMounted(() => {
    stage = document.querySelector("#stage");
    window.addEventListener("resize", resize);
    resize();
});
</script>
