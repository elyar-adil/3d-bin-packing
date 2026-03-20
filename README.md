# 3D 装箱优化 · 3D Bin Packing Solver

一个基于浏览器的三维装箱优化工具，实现了多种装箱算法，支持交互式 3D 可视化。

> Partial implementation of *"A Combinational Heuristic Algorithm for the Three-Dimensional Packing Problem."*

![screenshot](3d%20bin%20packing.png)

---

## 功能特性

### 容器设置
- 支持**容器**与**托盘**两种模式
- 内置常用预设：20尺 / 40尺集装箱、40尺高柜、货架格位
- 托盘预设：EUR、美标、国标 T1/T2
- 可自定义尺寸（W × H × D，单位 cm）及最大载重

### 箱子管理
- 内置快递、电商、仓储等多种箱型预设
- 自定义尺寸、重量、顶部载重、数量
- 高级约束：易碎品标记、旋转约束（自由 / 直立 / 固定）、分组与隔离放置
- 名称标签支持

### 装箱算法
| 算法 | 描述 |
|------|------|
| 启发式贪心 | 快速启发式，适合大多数场景 |
| 断切算法（Guillotine） | 基于空间切割，空间利用率较高 |
| 极大空间算法（Maximal Spaces） | 维护最大自由空间集合，装箱率最优 |
| 模拟退火（Simulated Annealing） | 全局优化，装箱率最高；支持多核并行 + WebGPU 加速 |

### 3D 可视化
- 基于 Three.js 的交互式 3D 视图
- 拖拽旋转、滚轮缩放
- 逐步回放：支持逐箱动画播放，可调节速度
- 实时统计：装箱率、已装箱数、总重量

---

## 快速开始

无需安装，直接在浏览器中打开 `index.html` 即可运行，或通过本地 HTTP 服务器访问：

```bash
npx serve .
# 或
python3 -m http.server 8080
```

然后访问 `http://localhost:8080`。

---

## 技术栈

- **前端**：原生 HTML / CSS / JavaScript（ES Modules）
- **3D 渲染**：[Three.js](https://threejs.org/) + OrbitControls
- **并行计算**：Web Workers（模拟退火多核加速）
- **GPU 加速**：WebGPU（实验性支持）

---

## 项目结构

```
├── index.html
├── css/
│   └── main.css
└── js/
    ├── main.js              # 入口
    ├── BinPackingSolver.js  # 求解器调度
    ├── solvers/
    │   ├── HeuristicSolver.js
    │   ├── GuillotineSolver.js
    │   ├── MaximalSpacesSolver.js
    │   └── SimulatedAnnealingSolver.js
    ├── ui/                  # UI 组件
    ├── viewer/              # Three.js 3D 视图
    └── workers/             # Web Workers
```

---

## 参考文献

- Lim, A., & Zhang, X. (2005). *A Combinational Heuristic Algorithm for the Three-Dimensional Packing Problem*. IEEE International Conference on Systems, Man and Cybernetics.
