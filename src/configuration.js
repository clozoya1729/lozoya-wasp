import {PlannerWASP} from "./planners/wasp.js";
import {PlannerRRTStar} from "./planners/rrt.js";
//theme
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
// scenario 1
const AGENT_CONFIG1 = [
    {
        name: 'Agent 0',
        positionX: 100,
        positionY: 350,
        speed: 50,
        targetX: 700,
        targetY: 100,
        svgTemplate: 'agent-template',
    },
    {
        name: 'Agent 1',
        positionX: 750,
        positionY: 300,
        orientation: Math.PI / 2,
        speed: 50,
        targetX: 100,
        targetY: 200,
        svgTemplate: 'agent-template',
    },
]
const OBSTACLE_CONFIG1 = [
    {
        name: 'Static Obstacle',
        positionX: 320,
        positionY: 150,
        radius: 60,
        svgTemplate: 'agent-template',
    },
    {
        name: 'Dynamic Obstacle 1',
        positionX: 500,
        positionY: 300,
        velocityX: -20,
    },
    {
        name: 'Dynamic Obstacle 2',
        positionX: 450,
        positionY: 0,
        velocityY: 20,
    },
];
const ENVIRONMENT_CONFIG1 = [
];
// scenario 2
const AGENT_CONFIG2 = [
    {
        name: 'Agent 0',
        positionX: 100,
        positionY: 200,
        speed: 50,
        targetX: 550,
        targetY: 100,
        targetOrientation: Math.PI,
        lidarParameters: {
            range: 40,
            fov: Math.PI / 2,
            numRays: 9,
        },
        // planner: PlannerWASP,
        // plannerParameters: {
        //     speed: 50,
        // },
        planner: PlannerRRTStar,
        plannerParameters: {
            maxIterations: 1500,
            stepSize: 30,
            rewireRadius: 50,
            minX: 0,
            maxX: canvas.width,
            minY: 0,
            maxY: canvas.height,
        },
    },
    {
        name: 'Agent 1',
        positionX: 600,
        positionY: 250,
        speed: 50,
        targetX: 150,
        targetY: 100,
        targetOrientation: 0,
        planner: PlannerWASP,
        plannerParameters: {
            speed: 50,
        },
    },
];
const R = 20;
const w = 1;
const OBSTACLE_CONFIG2 = [
    {
        name: 'Dynamic Obstacle',
        positionX: 1,
        positionY: 150,
        velocityX: 40,
        velocityY: (x, y, t) => R * w * Math.cos(w * t),
        radius: 20,
        renderParameters: {
            intervalTrail: 0.2,
        }
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
const ENVIRONMENT_CONFIG2 = [
    {
        truss: TRUSS,
    },
];
// scenarios
let scenario1 = {
    agents: AGENT_CONFIG1,
    environment: ENVIRONMENT_CONFIG1,
    obstacles: OBSTACLE_CONFIG1,
    theme: THEME,
};
let scenario2 = {
    agents: AGENT_CONFIG2,
    environment: ENVIRONMENT_CONFIG2,
    obstacles: OBSTACLE_CONFIG2,
    theme: THEME,
};

export let CONFIGURATION = scenario1;