/*
    "Commons Clause" License Condition v1.0
    License: GPL-3.0 | Licensor: Elyar Adil

    Facade module — re-exports everything from the modular sub-packages.
*/

export { Vector3D }                   from './models/Vector3D.js';
export { Box }                        from './models/Box.js';
export { Container, Pallet }          from './models/Container.js';
export { HeuristicSolver }            from './solvers/HeuristicSolver.js';
export { GuillotineSolver }           from './solvers/GuillotineSolver.js';
export { MaximalSpacesSolver }        from './solvers/MaximalSpacesSolver.js';
export { SimulatedAnnealingSolver }   from './solvers/SimulatedAnnealingSolver.js';
export { BOX_PRESETS, CONTAINER_PRESETS, PALLET_PRESETS } from './constants/presets.js';

// Backward compatibility alias
export { HeuristicSolver as BinPackingSolver } from './solvers/HeuristicSolver.js';
