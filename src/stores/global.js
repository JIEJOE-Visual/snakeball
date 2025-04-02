import { defineStore } from 'pinia'
import { Howl } from "howler";
const { getFnID } = require('@/utils/index');

export const global = defineStore('global', {
    state: () => ({
        // 是否为safari浏览器
        if_safari: /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
            && !navigator.userAgent.includes('CriOS')
            && typeof InstallTrigger === 'undefined',
        // 玩家数据
        player: {
            id: null,
            name: null,
            rank: 0,
            wave: 1,
            lives: 0,
            score: null,
            time: 0,
            if_active: false,
        },
        // 音频控制器
        audio_controller: {
            // musics
            hall: new Howl({
                src: require("@/assets/audios/musics/hall.mp3"),
                preload: true,
                loop: true,
            }),
            gameing: new Howl({
                src: require("@/assets/audios/musics/gameing.mp3"),
                preload: true,
                loop: true,
            }),
            win: new Howl({
                src: require("@/assets/audios/musics/win.mp3"),
                preload: true,
            }),
            fail: new Howl({
                src: require("@/assets/audios/musics/fail.mp3"),
                preload: true,
            }),
            // effects
            button: new Howl({
                src: require("@/assets/audios/effects/button.mp3"),
                preload: true,
            }),
            ready: new Howl({
                src: require("@/assets/audios/effects/ready.mp3"),
                preload: true,
            }),
            reset: new Howl({
                src: require("@/assets/audios/effects/reset.mp3"),
                preload: true,
            }),
            buff: new Howl({
                src: require("@/assets/audios/effects/buff.mp3"),
                preload: true,
            }),
            warn: new Howl({
                src: require("@/assets/audios/effects/warn.mp3"),
                preload: true,
            }),
            // blasts
            blasts: [
                new Howl({
                    src: require("@/assets/audios/blasts/blast1.mp3"),
                    preload: true,
                }),
                new Howl({
                    src: require("@/assets/audios/blasts/blast2.mp3"),
                    preload: true,
                }),
                new Howl({
                    src: require("@/assets/audios/blasts/blast3.mp3"),
                    preload: true,
                }),
                new Howl({
                    src: require("@/assets/audios/blasts/blast4.mp3"),
                    preload: true,
                }),
                new Howl({
                    src: require("@/assets/audios/blasts/blast5.mp3"),
                    preload: true,
                }),
            ],
        },
        // loading
        hidden_loading: null,
        // welcome
        show_welcome: null,
        hidden_welcome: null,
        // start
        show_start: null,
        hidden_start: null,
        // instrution
        show_instrution: null,
        // rank
        show_rank: null,
        // stage
        ready_to_game: null,
        hidden_summary: null,
        // databox
        show_databox: null,
        hidden_databox: null,
        // menu
        show_menu: null,
        hidden_menu: null,
    }),
    actions: {
        // 初始化玩家信息
        init_player_data(name) {
            // 使用浏览器指纹作为玩家ID，这样玩家使用相同的设备时，ID也会相同
            this.player.id = getFnID();
            // this.player.id = Date.now() + Math.random().toString(36).substring(2, 10);
            this.player.name = name;
            this.player.if_active = false;
        },
        // 初次加载：从loading进入界面
        first_show() {
            this.hidden_loading(() => {
                this.show_welcome();
                this.audio_controller.button.play();
                this.audio_controller.hall.play()
            });
        },
        // 从welcome进入到start
        welcome_to_start() {
            this.hidden_welcome(() => {
                this.show_start();
                this.audio_controller.button.play();
            });
        },
        // 从start返回到welcome
        start_to_welcome() {
            this.hidden_start(() => {
                this.show_welcome();
            });
        },
        // 从start开始新的游戏
        start_new_game() {
            this.hidden_start(() => {
                this.hidden_menu();
                this.audio_controller.hall.stop();
                this.audio_controller.button.play();
            }, () => {
                this.show_databox();
                this.ready_to_game();
                this.audio_controller.ready.play();
            });
        },
        // 从welcome继续游戏
        welcome_continue_game() {
            this.hidden_welcome(() => {
                this.hidden_menu();
                this.audio_controller.hall.stop();
                this.audio_controller.button.play();
            }, () => {
                this.show_databox();
                this.ready_to_game();
                this.audio_controller.ready.play();
            });
        },
        // 从summary返回到welcome
        summary_to_welcome() {
            this.hidden_summary(() => {
                this.show_welcome();
                this.hidden_databox();
                this.show_menu();
            });
        },
        // 从summary继续游戏
        summary_continue_game() {
            this.hidden_summary(() => {
                this.audio_controller.hall.stop();
                this.audio_controller.button.play();
            }, () => {
                this.ready_to_game();
                this.audio_controller.ready.play();
            });
        },
    }
})
