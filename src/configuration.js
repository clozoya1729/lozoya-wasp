import {Lidar} from "./object/sensor.js";
import {PlannerWASP} from "./planners/wasp.js";

let themeDark = {
    colorTrail: '#fff',
    colorPath: '#ffd600',
    colorBodyOutline: '#fff',
    colorBodyFill: '#888',
    colorP1: '#0ff',
    colorP2: '#43a047',
    colorP3: '#1976d2',
    colorLidarNoHit: '#4dd0e1'
};
let themeLight = {
    colorTrail: '#000',
    colorPath: '#888',
    colorBodyOutline: '#000',
    colorBodyFill: '#888',
    colorP1: '#0ff',
    colorP2: '#43a047',
    colorP3: '#1976d2',
    colorLidarNoHit: '#08f'
};
const THEME = {
    div: document.getElementById('theme'),
    dark: themeDark,
    light: themeLight,
}
const AGENTS_CONFIG = [
    {
        name: 'Agent 0',
        positionX: 100,
        positionY: 350,
        speed: 50,
        targetX: 700,
        targetY: 100,
        lidar: new Lidar(),
        planner: new PlannerWASP(),
        svgTemplate: 'agent-template',
    },
    {
        name: 'Agent 1',
        positionX: 750,
        positionY: 300,
        speed: 50,
        targetX: 100,
        targetY: 200,
        lidar: new Lidar(),
        planner: new PlannerWASP(),
        svgTemplate: 'agent-template',
    },
]
const AGENTS_ASSEMBLY_CONFIG = [
    {
        name: 'Agent 0',
        positionX: 100,
        positionY: 200,
        speed: 50,
        targetX: 600,
        targetY: 100,
        targetOrientation: Math.PI,
        lidar: new Lidar(),
        planner: new PlannerWASP(),
    },
    {
        name: 'Agent 1',
        positionX: 600,
        positionY: 300,
        speed: 50,
        targetX: 100,
        targetY: 100,
        targetOrientation: 0,
        lidar: new Lidar(),
        planner: new PlannerWASP(),
    },
];
const OBSTACLES_CONFIG = [
    {
        name: 'Static',
        positionX: 320,
        positionY: 150,
        radius: 60,
        svgTemplate: 'agent-template',
    },
    // {
    //     name: 'Dynamic',
    //     positionX: canvas.width - 300,
    //     positionY: 300,
    //     velocityX: -20,
    // },
    // {
    //     positionX: 800 + 30,
    //     positionY: 300,
    //     velocityX: -50,
    // },
    // {
    //     positionX: 800 + 30,
    //     positionY: 100,
    //     velocityX: -10,
    // },
    // {
    //     positionX: 800 + 100,
    //     positionY: 250,
    //     velocityX: -40,
    // },
    // {
    //     positionX: 800 / 1.75,
    //     positionY: 0,
    //     velocityY: 25,
    // },
    // {
    //     positionX: 800 / 1.5,
    //     positionY: -200,
    //     velocityY: 30,
    // },
    // {
    //     positionX: 800 / 3,
    //     positionY: 100,
    //     velocityY: 20,
    // }
];
const R = 100;
const w = 0.1;
const OBSTACLES_ASSEMBLY_CONFIG = [
    {
        name: 'Dynamic Obstacle',
        positionX: 320,
        positionY: 150,
        velocityX: (t) => 10,
        velocityY: (t) => R * w * Math.cos(w * t),
        radius: 40,
    },
];
const TRUSS_NODES = [
    // bottom chord (left to right)
    [0, 0],      // 0
    [50, 0],     // 1
    [100, 0],    // 2
    [150, 0],    // 3
    [200, 0],    // 4
    [250, 0],    // 5
    [300, 0],    // 6
    // top chord (no top node at extreme left)
    [50, -60],   // 7
    [100, -60],  // 8
    [150, -60],  // 9
    [200, -60],  //10
    [250, -60]   //11
];
const TRUSS_ELEMENTS = [
    // bottom chord
    [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6],
    // top chord
    [7, 8], [8, 9], [9, 10], [10, 11],
    // verticals
    [1, 7], [2, 8], [3, 9], [4, 10], [5, 11],
    // diagonals (Howe pattern, leaning toward center)
    [0, 7],
    [1, 8],
    [2, 9],
    [4, 9],
    [5, 10],
    [6, 11]
];
const TRUSS = {
    nodes: TRUSS_NODES,
    elements: TRUSS_ELEMENTS,
    coordinate: [200, 100],
    orientation: 0,
    thickness: 4,
}
export let CONFIGURATION = {
    agents: AGENTS_ASSEMBLY_CONFIG,
    environment: TRUSS,
    obstacles: null,//OBSTACLES_ASSEMBLY_CONFIG,
    theme: THEME,
}